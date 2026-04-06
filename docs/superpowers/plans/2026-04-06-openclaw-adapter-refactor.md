# OpenClaw Adapter 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆分 `openclaw-adapter.ts` 为独立关注点的文件，同时重构 WebSocket 封装为 ahooks 风格的 `useWebsocket` hook。

**Architecture:** 按职责拆分为 types/commands/process/websocket 四层，通过组合构建 useGateway。消费方 import 路径相应更新。

**Tech Stack:** React 19, TypeScript, Tauri 2.x, WebSocket

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/lib/openclaw-types.ts` | 所有共用类型和接口 |
| `src/lib/openclaw-commands.ts` | Rust Tauri `invoke` 封装 |
| `src/lib/openclaw-process.ts` | `ProcessManager` 类 |
| `src/hooks/useWebsocket.ts` | WebSocket hook（已有骨架，实现逻辑） |
| `src/hooks/useGateway.ts` | 重构，组合 useWebsocket + openclaw-process |
| `src/lib/openclaw-adapter.ts` | 删除（由上述文件替代） |

消费方更新 import：`GatewayContext.tsx`, `Gateway.tsx`, `EnvCheck.tsx`, `Config.tsx`, `ChatView.tsx`

---

### Task 1: 创建 openclaw-types.ts

**Files:**
- Create: `src/lib/openclaw-types.ts`

- [ ] **Step 1: 创建文件，写入所有共用类型**

```typescript
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 2: 创建 openclaw-commands.ts

**Files:**
- Create: `src/lib/openclaw-commands.ts`

- [ ] **Step 1: 创建文件，写入所有 Rust 命令封装**

```typescript
import { invoke } from '@tauri-apps/api/core'
import type { NodeEnv, OpenClawStatus, EnvInfo, Channel } from './openclaw-types'

export async function checkNodeEnv(): Promise<NodeEnv> {
  return invoke<NodeEnv>('check_node_env')
}

export async function startOpenClaw(): Promise<string> {
  return invoke<string>('start_openclaw')
}

export async function stopOpenClaw(): Promise<void> {
  return invoke('stop_openclaw')
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  return invoke<OpenClawStatus>('get_openclaw_status')
}

export async function getOpenClawVersion(): Promise<string> {
  return invoke<string>('get_openclaw_version')
}

export async function checkEnv(): Promise<EnvInfo> {
  return invoke<EnvInfo>('check_env')
}

export async function getChannels(): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels')
}

export async function readGlobalConfig(): Promise<string> {
  return invoke<string>('read_global_config')
}

export async function getGatewayToken(): Promise<string> {
  return invoke<string>('get_gateway_token')
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 3: 创建 openclaw-process.ts

**Files:**
- Create: `src/lib/openclaw-process.ts`

- [ ] **Step 1: 创建 ProcessManager 类**

```typescript
import type { OpenClawStatus } from './openclaw-types'
import {
  startOpenClaw,
  stopOpenClaw,
  getOpenClawStatus,
} from './openclaw-commands'

export type ProcessStatus = 'idle' | 'running' | 'stopped'

export class ProcessManager {
  get status(): ProcessStatus {
    return 'idle'
  }

  async start(): Promise<string> {
    const status = await getOpenClawStatus()
    if (status.running && status.gatewayUrl) {
      return status.gatewayUrl
    }
    return startOpenClaw()
  }

  async stop(): Promise<void> {
    await stopOpenClaw()
  }

  async getStatus(): Promise<OpenClawStatus> {
    return getOpenClawStatus()
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 4: 实现 useWebsocket.ts

**Files:**
- Modify: `src/hooks/useWebsocket.ts`（已有骨架，完全重写）

- [ ] **Step 1: 实现 WebSocket hook 逻辑**

完整实现覆盖以下要点：
- `connect()`: 创建原生 WebSocket，注册 options 中的 onOpen/onClose/onError/onMessage 回调
- `disconnect()`: 清除 reconnectTimer，调用 `instance.close()`
- 重连逻辑: 使用 `reconnectInterval`（默认 3000ms）和 `reconnectLimit`（默认无限），超出限制后停止
- `readyState`: 直接返回 `instance?.readyState ?? WebSocket.CLOSED`
- `send`: 透传 `instance?.send`

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'

type Options = {
  onMessage?: (message: MessageEvent, instance: WebSocket) => void
  onClose?: (event: CloseEvent, instance: WebSocket) => void
  onError?: (event: Event, instance: WebSocket) => void
  onOpen?: (event: Event, instance: WebSocket) => void
  reconnectInterval?: number
  reconnectLimit?: number
}

type Result = {
  send: (data: string | ArrayBuffer | Blob) => void
  disconnect: () => void
  readyState: number
  connect: () => void
  instance?: WebSocket
}

export function useWebsocket(socketUrl: string, options: Options = {}): Result {
  const {
    onMessage,
    onClose,
    onError,
    onOpen,
    reconnectInterval = 3000,
    reconnectLimit,
  } = options

  const instanceRef = useRef<WebSocket | undefined>(undefined)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)
  const [readyState, setReadyState] = useState(WebSocket.CLOSED)

  const connect = useCallback(() => {
    if (instanceRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(socketUrl)
    instanceRef.current = ws

    ws.addEventListener('open', (event) => {
      reconnectCountRef.current = 0
      setReadyState(WebSocket.OPEN)
      onOpen?.(event, ws)
    })

    ws.addEventListener('message', (event) => {
      onMessage?.(event, ws)
    })

    ws.addEventListener('close', (event) => {
      setReadyState(WebSocket.CLOSED)
      onClose?.(event, ws)

      if (reconnectLimit !== undefined && reconnectCountRef.current >= reconnectLimit) {
        return
      }

      reconnectCountRef.current += 1
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, reconnectInterval)
    })

    ws.addEventListener('error', (event) => {
      onError?.(event, ws)
    })
  }, [socketUrl, reconnectInterval, reconnectLimit, onOpen, onMessage, onClose, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectCountRef.current = 0
    instanceRef.current?.close()
    instanceRef.current = undefined
    setReadyState(WebSocket.CLOSED)
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current)
      }
      instanceRef.current?.close()
    }
  }, [])

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    instanceRef.current?.send(data)
  }, [])

  return {
    send,
    disconnect,
    connect,
    readyState,
    instance: instanceRef.current,
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 5: 重构 useGateway.ts

**Files:**
- Modify: `src/hooks/useGateway.ts`

- [ ] **Step 1: 重写 useGateway，基于 useWebsocket + openclaw-process**

要点：
- 组合 `useWebsocket` 管理 WebSocket 连接（内部处理重连）
- 组合 `ProcessManager` 管理进程启停
- `start()` 调用 `pm.start()`，然后调用 `useWebsocket` 的 `connect()`
- `stop()` 调用 `pm.stop()`，然后调用 `useWebsocket` 的 `disconnect()`
- `closedRef` 废弃（重连由 useWebsocket 内部管理）

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebsocket } from './useWebsocket'
import { ProcessManager } from '../lib/openclaw-process'
import { getOpenClawVersion, getGatewayToken } from '../lib/openclaw-commands'
import type { GatewayClient } from '../lib/openclaw-types'

export interface UseGatewayReturn {
  client: GatewayClient | null
  gatewayConnected: boolean
  version: string
  start: () => Promise<string>
  stop: () => Promise<void>
}

export function useGateway(): UseGatewayReturn {
  const [gatewayConnected, setGatewayConnected] = useState(false)
  const [version, setVersion] = useState('')

  const pmRef = useRef(new ProcessManager())
  const clientRef = useRef<GatewayClient | null>(null)
  const tokenRef = useRef<string>('')
  const closedRef = useRef(false)

  const { connect: wsConnect, disconnect: wsDisconnect, readyState } = useWebsocket('', {
    onOpen: () => setGatewayConnected(true),
    onClose: () => setGatewayConnected(false),
    reconnectInterval: 3000,
  })

  const tryConnect = useCallback(async (url: string, token: string) => {
    if (closedRef.current) return
    tokenRef.current = token
    await wsConnect()
  }, [wsConnect])

  const start = useCallback(async () => {
    closedRef.current = false
    const gatewayUrl = await pmRef.current.start()
    await wsConnect()
    return gatewayUrl
  }, [wsConnect])

  const stop = useCallback(async () => {
    closedRef.current = true
    wsDisconnect()
    await pmRef.current.stop()
  }, [wsDisconnect])

  useEffect(() => {
    getOpenClawVersion()
      .then(setVersion)
      .catch(() => {})
    getGatewayToken()
      .then((t) => { tokenRef.current = t })
      .catch(() => {})
  }, [])

  return {
    client: clientRef.current,
    gatewayConnected,
    version,
    start,
    stop,
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 可能有类型错误（GatewayClient 未定义等），继续修复

- [ ] **Step 3: 添加缺失的 GatewayClient 导出到 openclaw-types.ts**

`openclaw-types.ts` 需补充 `GatewayClient` 类（从现有 `openclaw-adapter.ts` 移入，只保留 WebSocket 相关部分）：

```typescript
export class GatewayClient {
  get connected(): boolean { return false }
  getUrl(): string { return '' }
  setToken(token: string): void {}
  async connect(url: string, token?: string): Promise<void> {}
  disconnect(): void {}
  async request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    throw new Error('not implemented')
  }
  onEvent(callback: (evt: GatewayEventFrame) => void): () => void {
    return () => {}
  }
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    return () => {}
  }
}
```

注意：这是最小化占位实现，实际 WebSocket 逻辑已迁移到 useWebsocket。GatewayClient 类作为类型用途保留。

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 6: 更新消费方 import 路径

**Files:**
- Modify: `src/contexts/GatewayContext.tsx`
- Modify: `src/pages/Gateway.tsx`
- Modify: `src/pages/EnvCheck.tsx`
- Modify: `src/pages/Config.tsx`
- Modify: `src/pages/ChatView.tsx`

- [ ] **Step 1: GatewayContext.tsx — 从 openclaw-types 导入 GatewayClient**

```typescript
import { GatewayClient } from '../lib/openclaw-types'
```

- [ ] **Step 2: Gateway.tsx — 从 openclaw-commands 导入 getOpenClawStatus, getOpenClawVersion, checkEnv**

```typescript
import { getOpenClawStatus, getOpenClawVersion, checkEnv } from '../lib/openclaw-commands'
import type { OpenClawStatus, EnvInfo } from '../lib/openclaw-types'
```

- [ ] **Step 3: EnvCheck.tsx — 从 openclaw-commands 导入 checkEnv**

```typescript
import { checkEnv } from '../lib/openclaw-commands'
```

- [ ] **Step 4: Config.tsx — 从 openclaw-commands 导入 readGlobalConfig**

```typescript
import { readGlobalConfig } from '../lib/openclaw-commands'
```

- [ ] **Step 5: ChatView.tsx — 从 openclaw-types 导入 GatewayEventFrame**

```typescript
import type { GatewayEventFrame } from '../lib/openclaw-types'
```

- [ ] **Step 6: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

---

### Task 7: 删除 openclaw-adapter.ts

**Files:**
- Delete: `src/lib/openclaw-adapter.ts`

- [ ] **Step 1: 确认无任何 import 指向 openclaw-adapter.ts**

Run: `grep -r "openclaw-adapter" src/ --include="*.ts" --include="*.tsx"`
Expected: 无输出

- [ ] **Step 2: 删除文件**

```bash
rm src/lib/openclaw-adapter.ts
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## 自检清单

- [ ] 所有 task 步骤完成
- [ ] `npx tsc --noEmit` 无错误
- [ ] 无 import 指向已删除的 openclaw-adapter.ts
- [ ] 各消费方功能正常（Gateway 启停、EnvCheck 环境检测、Config 读取、ChatView 事件监听）
