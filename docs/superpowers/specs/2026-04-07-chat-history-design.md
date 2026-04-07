# Chat History Persistence Design

## Context

当前 ChatView 消息仅存在内存中，刷新页面或重启应用后历史丢失。需要从 openclaw gateway 获取历史并支持新会话。

## Architecture

```
src/pages/ChatView/
├── index.tsx           # 改动：连接成功后 loadHistory，新增新对话按钮
└── useChatHistory.ts  # 新增：history 逻辑封装
```

## Data Flow

1. `gatewayConnected === true` → 自动调用 `loadHistory()`
2. 新对话 → `newSession()` 生成新 sessionKey，清空本地消息
3. 发送消息 → `chat.send({ sessionKey })`

## Core RPC

| RPC | 参数 | 描述 |
|-----|------|------|
| `chat.history` | `{ sessionKey }` | 获取历史消息列表 |
| `chat.send` | `{ sessionKey, message, ... }` | 已有，传入 sessionKey |

## SessionKey

格式：`agent:main:{timestamp}`，例如 `agent:main:1744108800000`

每次新对话生成新的 timestamp-based key。

## Implementation

### useChatHistory.ts

```typescript
interface UseChatHistory {
  messages: ChatMessage[]
  sessionKey: string
  loading: boolean
  loadHistory: () => Promise<void>
  newSession: () => void
}
```

- `loadHistory()` — 调用 `client.request('chat.history', { sessionKey })`，设置 messages
- `newSession()` — 生成新 sessionKey，清空 messages
- ChatView 在 `gatewayConnected` 变为 true 时调用 `loadHistory()`

## ChatView Changes

- 从 `useChatHistory` 获取 `messages`、`newSession`
- "新对话" 按钮调用 `newSession()`
- 连接成功后自动加载历史
