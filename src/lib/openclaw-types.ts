export interface NodeEnv {
  nodeVersion: string
  nodePath: string
  npmVersion: string
}

export interface OpenClawStatus {
  running: boolean
  gatewayUrl?: string
  dashboardUrl?: string
  pid?: number
  port?: number
  bind?: string
}

export interface EnvInfo {
  node: {
    installed: boolean
    version: string
    path: string
    npmVersion: string
  }
  openclaw: {
    installed: boolean
    version: string
    path: string
  }
}

export interface Channel {
  id: string
  name: string
  type: string
}

export interface GatewayEventFrame {
  type: 'event'
  event: string
  payload?: Record<string, unknown>
  seq?: number
}

export interface ChatEventPayload {
  kind: 'delta' | 'final' | 'error' | 'aborted'
  runId?: string
  sessionKey?: string
  text?: string
  error?: string
}

export class GatewayClient {
  get connected(): boolean {
    return false
  }
  getUrl(): string {
    return ''
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setToken(_token: string): void {
    /* stub */
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(_url: string, _token?: string): Promise<void> {
    /* stub */
  }
  disconnect(): void {
    /* stub */
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async request<T = unknown>(
    _method: string,
    _params?: Record<string, unknown>
  ): Promise<T> {
    throw new Error('not implemented')
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEvent(_callback: (evt: GatewayEventFrame) => void): () => void {
    return () => {}
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConnectionChange(_callback: (connected: boolean) => void): () => void {
    return () => {}
  }
}
