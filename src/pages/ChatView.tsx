import type { GatewayEventFrame } from '../lib/openclaw-types'
import { Bubble, Sender } from '@ant-design/x'
import { useState, useEffect, useRef } from 'react'
import { useGatewayContext } from '../contexts/GatewayContext'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
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

function idempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getTextFromPayload(payload: GatewayChatPayload): string | null {
  if (payload.state === 'error') return payload.errorMessage || '未知错误'
  if (payload.message?.content?.[0]?.text) {
    return payload.message.content[0].text
  }
  return null
}

export default function ChatView() {
  const { client, gatewayConnected } = useGatewayContext() ?? {}
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [loading, setLoading] = useState(false)
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
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', content: finalContent },
          ])
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setLoading(false)
          break
        }
        case 'error': {
          const errorText = text || '未知错误'
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', content: `错误: ${errorText}` },
          ])
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setLoading(false)
          break
        }
        case 'aborted': {
          const abortedContent = streamingRef.current
          if (abortedContent) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: 'assistant',
                content: abortedContent + '\n[已中断]',
              },
            ])
          }
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setLoading(false)
          break
        }
      }
    })

    return unlisten
  }, [client])

  const handleSend = async (value: string) => {
    if (!value.trim() || loading || !client) return

    if (!gatewayConnected) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: '连接已断开，请等待重连...',
        },
      ])
      return
    }

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', content: value },
    ])
    setLoading(true)
    streamingRef.current = ''
    setStreamingContent('')

    try {
      await client.request('chat.send', {
        sessionKey: 'agent:main:main',
        message: value,
        idempotencyKey: idempotencyKey(),
      })
    } catch (e) {
      const err = e as Error
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: '发送失败: ' + err.message,
        },
      ])
      setLoading(false)
    }
  }

  // Build bubble items: committed messages + streaming bubble
  const bubbleItems = messages.map((msg) => ({
    key: msg.id,
    role: msg.role,
    content: msg.content,
    placement: (msg.role === 'user' ? 'end' : 'start') as 'end' | 'start',
  }))

  if (loading && streamingContent) {
    bubbleItems.push({
      key: 'streaming',
      role: 'assistant',
      content: streamingContent,
      placement: 'start',
    })
  } else if (loading && !streamingContent) {
    bubbleItems.push({
      key: 'streaming',
      role: 'assistant',
      content: '...',
      placement: 'start',
    })
  }

  const showConnecting = client !== null && !gatewayConnected

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(!client || showConnecting) && <Bubble.List items={[]} />}
        {client && !showConnecting && <Bubble.List items={bubbleItems} />}
      </div>
      <Sender
        value={inputValue}
        placeholder={showConnecting ? '等待连接...' : '输入消息...'}
        loading={loading || showConnecting}
        onSubmit={(v) => {
          handleSend(v)
          setInputValue('')
        }}
        onChange={setInputValue}
      />
    </div>
  )
}
