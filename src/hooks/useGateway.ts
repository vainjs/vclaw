import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getOpenClawStatus,
  getOpenClawVersion,
  getGatewayToken,
  GatewayClient,
  ProcessManager,
} from '../lib/openclaw-adapter'

export interface UseGatewayReturn {
  client: GatewayClient | null
  gatewayConnected: boolean
  version: string
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useGateway(): UseGatewayReturn {
  const [gatewayConnected, setGatewayConnected] = useState(false)
  const [version, setVersion] = useState('')

  const pmRef = useRef(new ProcessManager())
  const clientRef = useRef<GatewayClient | null>(null)
  const tokenRef = useRef<string>('')
  const closedRef = useRef(false)

  const start = useCallback(async () => {
    if (!clientRef.current) return
    try {
      const url = await pmRef.current.start()
      await clientRef.current.connect(url, tokenRef.current)
    } catch (err) {
      console.error('[useGateway] Failed to start:', err)
      throw err
    }
  }, [])

  const stop = useCallback(async () => {
    closedRef.current = true
    // Don't call disconnect() — let the WS close naturally when server stops.
    // The ws 'close' event will fire setConnected(false) -> gatewayConnected=false
    try {
      await pmRef.current.stop()
    } finally {
      closedRef.current = false
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    const client = new GatewayClient()
    clientRef.current = client
    closedRef.current = false

    client.onConnectionChange((connected) => {
      setGatewayConnected(connected)
    })

    getOpenClawVersion().then(setVersion).catch(() => {})
    getGatewayToken().then((t) => { tokenRef.current = t }).catch(() => {})

    // Auto-connect if gateway is already running
    getOpenClawStatus().then(async (status) => {
      if (status.running && status.gatewayUrl) {
        try {
          await client.connect(status.gatewayUrl, tokenRef.current)
        } catch {
          // GatewayClient handles reconnect internally
        }
      }
    }).catch(() => {})

    return () => {
      closedRef.current = true
      client.disconnect()
      clientRef.current = null
    }
  }, [])

  return {
    client: clientRef.current,
    gatewayConnected,
    version,
    start,
    stop,
  }
}
