import type { GatewayEventFrame } from '../../lib/openclaw-types'
import type { BubbleItemType } from '@ant-design/x'
import { Bubble, Sender } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { Avatar, Typography } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { useState, useEffect, useRef, useMemo } from 'react'
import dayjs from 'dayjs'
import { useGatewayContext } from '../../contexts/GatewayContext'
import { useChatHistory } from './useChatHistory'

function renderMarkdown(content: string) {
  return (
    <Typography>
      <XMarkdown content={content} />
    </Typography>
  )
}

const bubbleRole = {
  user: {
    avatar: (
      <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
    ),
  },
  assistant: {
    avatar: (
      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
    ),
  },
}

function formatTime(timestamp: number) {
  return dayjs(timestamp).format('HH:mm')
}

interface GatewayChatPayload {
  runId: string
  sessionKey: string
  seq?: number
  state: 'delta' | 'final' | 'error' | 'aborted'
  message?: {
    role: string
    content: Array<{ type: string; text: string }>
    timestamp?: number
  }
  stopReason?: string
  errorMessage?: string
}

let idCounter = 0
function nextId(): string {
  return `msg-${++idCounter}-${Date.now()}`
}

function getTextFromPayload(payload: GatewayChatPayload): string | null {
  if (payload.state === 'error') return payload.errorMessage || '未知错误'
  if (payload.message?.content?.[0]?.text) {
    return payload.message.content[0].text
  }
  return null
}

function idempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function ChatView() {
  const { client, gatewayConnected } = useGatewayContext() ?? {}
  const { messages, sessionKey, addMessage } = useChatHistory()
  const [streamingContent, setStreamingContent] = useState('')
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const streamingRef = useRef('')
  const runIdRef = useRef<string | null>(null)

  // Listen for chat events from the gateway
  useEffect(() => {
    if (!client) return

    const unlisten = client.onEvent((evt: GatewayEventFrame) => {
      if (evt.event !== 'chat') return
      const payload = evt.payload as unknown as GatewayChatPayload
      if (!payload || !payload.state) return

      const text = getTextFromPayload(payload)

      switch (payload.state) {
        case 'delta': {
          if (text) {
            // Gateway sends full accumulated text in each delta, so replace
            // rather than append to avoid duplication
            streamingRef.current = text
            setStreamingContent(streamingRef.current)
          }
          if (payload.runId) {
            runIdRef.current = payload.runId
          }
          break
        }
        case 'final': {
          const finalContent = streamingRef.current || text || ''
          addMessage({
            id: nextId(),
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
          })
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setSending(false)
          break
        }
        case 'error': {
          const errorText = text || '未知错误'
          addMessage({
            id: nextId(),
            role: 'assistant',
            content: `错误: ${errorText}`,
            timestamp: Date.now(),
          })
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setSending(false)
          break
        }
        case 'aborted': {
          const abortedContent = streamingRef.current
          if (abortedContent) {
            addMessage({
              id: nextId(),
              role: 'assistant',
              content: abortedContent + '\n[已中断]',
              timestamp: Date.now(),
            })
          }
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setSending(false)
          break
        }
      }
    })

    return unlisten
  }, [client, addMessage])

  const handleSend = async (value: string) => {
    if (!value.trim() || sending || !client) return

    if (!gatewayConnected) {
      addMessage({
        id: nextId(),
        role: 'assistant',
        content: '连接已断开，请等待重连...',
        timestamp: Date.now(),
      })
      return
    }

    addMessage({
      id: nextId(),
      role: 'user',
      content: value,
      timestamp: Date.now(),
    })
    setSending(true)
    streamingRef.current = ''
    setStreamingContent('')

    try {
      await client.request('chat.send', {
        sessionKey,
        message: value,
        idempotencyKey: idempotencyKey(),
      })
    } catch (e) {
      const err = e as Error
      addMessage({
        id: nextId(),
        role: 'assistant',
        content: '发送失败: ' + err.message,
        timestamp: Date.now(),
      })
      setSending(false)
    }
  }

  // Build bubble items: committed messages + streaming bubble
  const bubbleItems = useMemo<BubbleItemType[]>(() => {
    const items: BubbleItemType[] = messages.map((msg) => ({
      key: msg.id,
      role: msg.role,
      content: msg.content,
      placement: (msg.role === 'user' ? 'end' : 'start') as 'end' | 'start',
      contentRender: renderMarkdown,
      footer: msg.timestamp ? (
        <span style={{ fontSize: 12, color: '#999' }}>
          {formatTime(msg.timestamp)}
        </span>
      ) : undefined,
    }))

    if (sending) {
      items.push({
        key: 'streaming',
        role: 'assistant',
        content: streamingContent,
        placement: 'start',
        contentRender: renderMarkdown,
        streaming: true,
        typing: true,
      })
    }

    return items
  }, [messages, sending, streamingContent])

  const showConnecting = client !== null && !gatewayConnected

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {(!client || showConnecting) && <Bubble.List items={[]} />}
        {client && !showConnecting && (
          <Bubble.List items={bubbleItems} role={bubbleRole} autoScroll />
        )}
      </div>
      <Sender
        value={inputValue}
        placeholder={showConnecting ? '等待连接...' : '输入消息...'}
        loading={(sending && !streamingContent) || showConnecting}
        onSubmit={(v) => {
          handleSend(v)
          setInputValue('')
        }}
        onChange={setInputValue}
      />
    </div>
  )
}
