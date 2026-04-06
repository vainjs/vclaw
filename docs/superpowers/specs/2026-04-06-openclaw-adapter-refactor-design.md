# OpenClaw Adapter 重构设计

## 目标

拆分 `openclaw-adapter.ts`（373行）为独立关注点的文件，同时重构 WebSocket 封装为 ahooks 风格的 `useWebsocket` hook。

## 文件拆分

| 文件                           | 职责                                               |
| ------------------------------ | -------------------------------------------------- |
| `src/lib/openclaw-commands.ts` | 所有 Rust Tauri `invoke` 调用                      |
| `src/lib/openclaw-process.ts`  | `ProcessManager` 进程管理类                        |
| `src/lib/openclaw-types.ts`    | 共用 TypeScript 类型和接口                         |
| `src/hooks/useWebsocket.ts`    | WebSocket hook，基于已有接口定义实现               |
| `src/hooks/useGateway.ts`      | 简化后组合 `useWebsocket`，只负责 gateway 连接状态 |

删除：`openclaw-adapter.ts`（进程管理和 WebSocket 部分）

## 类型定义（openclaw-types.ts）

```typescript
export interface NodeEnv { nodeVersion, nodePath, npmVersion }
export interface OpenClawStatus { running, gatewayUrl?, dashboardUrl?, pid?, port?, bind? }
export interface EnvInfo { node: {...}, openclaw: {...} }
export interface Channel { id, name, type }
export interface GatewayEventFrame { type: 'event', event, payload?, seq? }
export interface ChatEventPayload { kind, runId?, sessionKey?, text?, error? }
```

## Tauri 命令封装（openclaw-commands.ts）

每个命令对应 Rust 端一个 `#[tauri::command]`：

| 函数                   | Rust command           |
| ---------------------- | ---------------------- |
| `checkNodeEnv()`       | `check_node_env`       |
| `startOpenClaw()`      | `start_openclaw`       |
| `stopOpenClaw()`       | `stop_openclaw`        |
| `getOpenClawStatus()`  | `get_openclaw_status`  |
| `getOpenClawVersion()` | `get_openclaw_version` |
| `checkEnv()`           | `check_env`            |
| `getChannels()`        | `get_channels`         |
| `readGlobalConfig()`   | `read_global_config`   |
| `getGatewayToken()`    | `get_gateway_token`    |

## ProcessManager（openclaw-process.ts）

```typescript
export class ProcessManager {
  async start(): Promise<string> // 返回 gatewayUrl
  async stop(): Promise<void>
  async getStatus(): Promise<OpenClawStatus>
}
```

## useWebsocket hook

**接口已定义**（`src/hooks/useWebsocket.ts`）：

```typescript
type Options = {
  onMessage?: (message: WebSocketEventMap['message'], instance: WebSocket) => void
  onClose?: (event: WebSocketEventMap['close'], instance: WebSocket) => void
  onError?: (event: WebSocketEventMap['error'], instance: WebSocket) => void
  onOpen?: (event: WebSocketEventMap['open'], instance: WebSocket) => void
  reconnectInterval?: number // 默认 3000ms
  reconnectLimit?: number // 默认无限
}

type Result = {
  send: WebSocket['send']
  disconnect: () => void
  readyState: ReadyState
  connect: () => void
  instance?: WebSocket
}

export function useWebsocket(socketUrl: string, options: Options = {}): Result
```

**实现要点：**

- `connect()` 创建原生 WebSocket，注册 options 回调
- 重连逻辑：超出 `reconnectLimit` 后停止重连
- `disconnect()` 清理所有定时器，关闭 WebSocket
- `readyState` 直接透传 `instance.readyState`

## 依赖关系

```
openclaw-commands.ts (底层 Rust 命令)
    ↑
openclaw-process.ts  (进程管理)
    ↑
useGateway.ts        (组合层，调用 openclaw-process + useWebsocket)

useWebsocket.ts     (独立 WebSocket hook，不依赖 openclaw 模块)
    ↑
useGateway.ts        (组合层)
```

## 涉及的消费方改动

| 文件                 | 改动                                             |
| -------------------- | ------------------------------------------------ |
| `Gateway.tsx`        | import 从 `openclaw-adapter` 改为新文件          |
| `EnvCheck.tsx`       | import `checkEnv` 从 `openclaw-commands`         |
| `Config.tsx`         | import `readGlobalConfig` 从 `openclaw-commands` |
| `ChatView.tsx`       | import `GatewayEventFrame` 从 `openclaw-types`   |
| `useGateway.ts`      | 重构，使用 `useWebsocket` 和 `openclaw-process`  |
| `GatewayContext.tsx` | 保持不变，类型来源改为 `openclaw-types`          |

## 实现顺序

1. `openclaw-types.ts` — 类型抽离
2. `openclaw-commands.ts` — Rust 命令封装
3. `openclaw-process.ts` — ProcessManager
4. `useWebsocket.ts` — WebSocket hook 实现
5. `useGateway.ts` — 简化重构
6. 更新各消费方的 import 路径
7. 删除 `openclaw-adapter.ts`
