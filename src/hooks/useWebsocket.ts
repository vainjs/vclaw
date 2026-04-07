import { useState, useCallback, useRef, useEffect } from 'react'
import { useLatest, useUnmounted } from '@vainjs/hooks'
import { useMemoizedFn } from './useMemoizedFn'

type Options = {
  onMessage?: (message: MessageEvent, instance: WebSocket) => void
  onClose?: (event: CloseEvent, instance: WebSocket) => void
  onError?: (event: Event, instance: WebSocket) => void
  onOpen?: (event: Event, instance: WebSocket) => void
  reconnectInterval?: number
  reconnectLimit?: number
  manual?: boolean
}

type Result = {
  send: (data: string | ArrayBuffer | Blob) => void
  disconnect: () => void
  instance?: WebSocket
  connect: (url?: string) => void
  readyState: number
}

export function useWebsocket(socketUrl: string, options: Options = {}): Result {
  const {
    reconnectInterval = 3000,
    manual = false,
    reconnectLimit,
    onMessage,
    onClose,
    onError,
    onOpen,
  } = options

  const onMessageRef = useLatest(onMessage)
  const onCloseRef = useLatest(onClose)
  const onErrorRef = useLatest(onError)
  const onOpenRef = useLatest(onOpen)

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsInstanceRef = useRef<WebSocket | undefined>(undefined)
  const reconnectCountRef = useRef(0)
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)

  const reconnect = useMemoizedFn(() => {
    if (
      reconnectLimit !== undefined &&
      reconnectCountRef.current >= reconnectLimit
    ) {
      return
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }

    reconnectTimerRef.current = setTimeout(() => {
      connect()
      reconnectCountRef.current += 1
    }, reconnectInterval)
  })

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectCountRef.current = 0
    if (wsInstanceRef.current) {
      wsInstanceRef.current.close()
      wsInstanceRef.current = undefined
    }
    setReadyState(WebSocket.CLOSED)
  }, [])

  const connect = useMemoizedFn(() => {
    if (!socketUrl) return
    if (wsInstanceRef.current) {
      disconnect()
    }

    const ws = new WebSocket(socketUrl)
    wsInstanceRef.current = ws
    setReadyState(WebSocket.CONNECTING)

    ws.addEventListener('open', (event) => {
      if (!wsInstanceRef.current) return
      onOpenRef.current?.(event, ws)
      reconnectCountRef.current = 0
      setReadyState(ws.readyState ?? WebSocket.OPEN)
    })

    ws.addEventListener('message', (event) => {
      if (!wsInstanceRef.current) return
      onMessageRef.current?.(event, ws)
    })

    ws.addEventListener('close', (event) => {
      onCloseRef.current?.(event, ws)
      setReadyState(ws.readyState ?? WebSocket.CLOSED)
      if (wsInstanceRef.current) {
        reconnect()
      }
    })

    ws.addEventListener('error', (event) => {
      if (!wsInstanceRef.current) return
      onErrorRef.current?.(event, ws)
      setReadyState(ws.readyState ?? WebSocket.CLOSED)
      reconnect()
    })
  })

  useEffect(() => {
    if (!manual && socketUrl) {
      connect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketUrl, manual])

  useUnmounted(() => {
    disconnect()
  })

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    if (wsInstanceRef.current?.readyState === WebSocket.OPEN) {
      wsInstanceRef.current?.send(data)
    } else {
      throw new Error('WebSocket disconnected')
    }
  }, [])

  return {
    instance: wsInstanceRef.current,
    readyState,
    disconnect,
    connect,
    send,
  }
}
