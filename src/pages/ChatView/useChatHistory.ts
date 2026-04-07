import { filter, find, map } from 'lodash-es'
import { useState, useCallback, useEffect } from 'react'
import { useGatewayContext } from '../../contexts/GatewayContext'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

interface ChatHistoryResponse {
  messages?: Array<{
    id?: string
    role: string
    content: Array<{ type: string; text?: string; thinking?: string }>
    timestamp?: number
    __openclaw?: { id: string }
  }>
}

function generateSessionKey(): string {
  // Use stable session key, not timestamp-based
  return 'agent:main:main'
}

let idCounter = 0
function nextId(): string {
  return `msg-${++idCounter}-${Date.now()}`
}

export interface UseChatHistory {
  messages: ChatMessage[]
  sessionKey: string
  loading: boolean
  loadHistory: () => Promise<void>
  addMessage: (msg: ChatMessage) => void
}

export function useChatHistory(): UseChatHistory {
  const { client, gatewayConnected } = useGatewayContext() ?? {}
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionKey] = useState(generateSessionKey)
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      // Add timeout to prevent hanging
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('chat.history timeout after 5s')),
          5000
        )
      )
      const res = await Promise.race([
        client.request<ChatHistoryResponse>('chat.history', {
          sessionKey,
          limit: 200,
        }),
        timeout,
      ])
      const msgs: ChatMessage[] = filter(
        map(
          filter(
            (res as ChatHistoryResponse).messages || [],
            (m) => m.role === 'user' || m.role === 'assistant'
          ),
          (m) => {
            // Find the text content (skip thinking, toolCall, etc.)
            const textItem = find(m.content, (c) => c.type === 'text')
            return {
              id: m.id || m.__openclaw?.id || nextId(),
              role: m.role as 'user' | 'assistant',
              content: textItem?.text || '',
              timestamp: m.timestamp,
            }
          }
        ),
        (m) => m.content.trim() !== ''
      )
      setMessages(msgs)
    } catch (e) {
      console.error('[useChatHistory] loadHistory error:', e)
    } finally {
      setLoading(false)
    }
  }, [client, sessionKey])

  // gateway connected → auto load history
  useEffect(() => {
    if (gatewayConnected && client) {
      loadHistory()
    }
  }, [gatewayConnected, client, loadHistory])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  return { messages, sessionKey, loading, loadHistory, addMessage }
}
