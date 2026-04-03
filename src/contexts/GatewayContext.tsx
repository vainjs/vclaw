import { createContext, useContext } from 'react'
import { GatewayClient } from '../lib/openclaw-adapter'

export interface GatewayContextValue {
  client: GatewayClient | null
  gatewayConnected: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
}

export const GatewayContext = createContext<GatewayContextValue | null>(null)

export function useGateway(): GatewayClient | null {
  return useContext(GatewayContext)?.client ?? null
}

export function useGatewayContext(): GatewayContextValue | null {
  return useContext(GatewayContext)
}
