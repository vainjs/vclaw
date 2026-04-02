import { Bubble, Sender } from '@ant-design/x'
import { useState } from 'react'
import { sendMessage } from '../lib/openclaw-adapter'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = async (value: string) => {
    if (!value.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: value,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await sendMessage(value)
      const assistantMessage: ChatMessage = {
        id: response.id,
        role: 'assistant',
        content: response.content,
        timestamp: response.timestamp,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (e) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '消息发送失败: ' + String(e),
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Bubble.List
          items={messages.map((msg) => ({
            key: msg.id,
            role: msg.role,
            content: msg.content,
            placement: msg.role === 'user' ? 'end' : 'start',
            loading: msg.role === 'assistant' && loading && msg.id === messages[messages.length - 1]?.id,
          }))}
        />
      </div>
      <Sender
        value={inputValue}
        placeholder='输入消息...'
        loading={loading}
        onSubmit={(v) => {
          handleSend(v)
          setInputValue('')
        }}
        onChange={setInputValue}
        style={{ borderTop: '1px solid #f0f0f0' }}
      />
    </div>
  )
}
