import { Bubble, Sender } from '@ant-design/x'
import { useState, useEffect, useRef } from 'react'
import { Typography } from 'antd'
import { GatewayEventFrame, ChatEventPayload } from '../lib/openclaw-adapter'
import { useGateway } from '../contexts/GatewayContext'

const { Text } = Typography

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let idCounter = 0
function nextId(): string {
  return `msg-${++idCounter}-${Date.now()}`
}

function idempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function ChatView() {
  const client = useGateway()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const streamingRef = useRef('')
  const runIdRef = useRef<string | null>(null)

  // Track connection state
  useEffect(() => {
    if (!client) return
    setConnected(client.connected)
    const unlisten = client.onConnectionChange((c) => setConnected(c))
    return unlisten
  }, [client])

  // Listen for chat events from the gateway
  useEffect(() => {
    if (!client) return

    const unlisten = client.onEvent((evt: GatewayEventFrame) => {
      if (evt.event !== 'chat') return
      const payload = evt.payload as unknown as ChatEventPayload | undefined
      if (!payload) return

      switch (payload.kind) {
        case 'delta': {
          if (payload.text) {
            streamingRef.current += payload.text
            setStreamingContent(streamingRef.current)
          }
          if (payload.runId) {
            runIdRef.current = payload.runId
          }
          break
        }
        case 'final': {
          const finalContent = streamingRef.current
          if (finalContent) {
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: 'assistant', content: finalContent },
            ])
          }
          streamingRef.current = ''
          setStreamingContent('')
          runIdRef.current = null
          setLoading(false)
          break
        }
        case 'error': {
          const errorText = payload.error || payload.text || '未知错误'
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
              { id: nextId(), role: 'assistant', content: abortedContent + '\n[已中断]' },
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

    if (!connected) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: '连接已断开，请等待重连...' },
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
        sessionKey: 'main',
        message: value,
        idempotencyKey: idempotencyKey(),
      })
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: '发送失败: ' + String(e) },
      ])
      setLoading(false)
    }
  }

  const handleAbort = async () => {
    if (!client) return
    try {
      await client.request('chat.abort', { sessionKey: 'main' })
    } catch (e) {
      console.error('Abort failed:', e)
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

  const showConnecting = client !== null && !connected

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(!client || showConnecting) && (
          <Bubble.List items={[]} />
        )}
        {client && !showConnecting && (
          <Bubble.List items={bubbleItems} />
        )}
      </div>
      <div style={{ borderTop: '1px solid #f0f0f0', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: -32, right: 16 }}>
            <Text
              type="secondary"
              style={{ cursor: 'pointer', fontSize: 12 }}
              onClick={handleAbort}
            >
              [停止生成]
            </Text>
          </div>
        )}
        <Sender
          value={inputValue}
          placeholder={showConnecting ? '等待连接...' : '输入消息...'}
          loading={loading || showConnecting}
          disabled={showConnecting}
          onSubmit={(v) => {
            handleSend(v)
            setInputValue('')
          }}
          onChange={setInputValue}
        />
      </div>
    </div>
  )
}
