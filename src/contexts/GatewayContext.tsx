import type { GatewayEventFrame } from '../lib/openclaw-types'
import { createContext, useContext } from 'react'

export interface GatewayContextValue {
  client: {
    request<T = unknown>(
      method: string,
      params?: Record<string, unknown>
    ): Promise<T>
    onEvent(callback: (evt: GatewayEventFrame) => void): () => void
  } | null
  gatewayConnected: boolean
  start: () => Promise<string>
  stop: () => Promise<void>
}

export const GatewayContext = createContext<GatewayContextValue | null>(null)

export function useGateway(): GatewayContextValue['client'] {
  return useContext(GatewayContext)?.client ?? null
}

export function useGatewayContext(): GatewayContextValue | null {
  return useContext(GatewayContext)
}
