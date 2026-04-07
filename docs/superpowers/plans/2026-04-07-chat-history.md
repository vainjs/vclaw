# Chat History Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 openclaw gateway 获取聊天历史，新连接时自动加载，支持新会话。

**Architecture:** 新建 `useChatHistory` hook 封装 history RPC 和会话管理；ChatView 连接成功后自动加载历史；"新对话"按钮开新会话。

**Tech Stack:** React hooks, TypeScript, antd x Bubble/Sender

---

## File Map

| Action | File |
|--------|------|
| Create | `src/pages/ChatView/index.tsx` (move from ChatView.tsx) |
| Create | `src/pages/ChatView/useChatHistory.ts` |
| Create | `src/pages/ChatView/index.module.less` |
| Modify | `src/routes.tsx` |
| Delete | `src/pages/ChatView.tsx` |

---

## Task 1: 创建 ChatView 目录结构

**Files:**
- Create: `src/pages/ChatView/index.tsx`
- Create: `src/pages/ChatView/useChatHistory.ts`
- Create: `src/pages/ChatView/index.module.less`
- Modify: `src/routes.tsx:5`
- Delete: `src/pages/ChatView.tsx`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p src/pages/ChatView
```

- [ ] **Step 2: 移动 ChatView.tsx → ChatView/index.tsx**

从 `src/pages/ChatView.tsx` 内容复制到 `src/pages/ChatView/index.tsx`，路径调整：
- `'../lib/openclaw-types'` → `'../../lib/openclaw-types'`
- `'../contexts/GatewayContext'` → `'../../contexts/GatewayContext'`

- [ ] **Step 3: 更新 routes.tsx 导入**

```typescript
// 修改前
import ChatView from './pages/ChatView'
// 修改后
import ChatView from './pages/ChatView/index'
```

- [ ] **Step 4: 删除旧文件**

```bash
rm src/pages/ChatView.tsx
```

- [ ] **Step 5: 创建空 module.less**

```less
// src/pages/ChatView/index.module.less
// 暂留空，后续样式可加此处
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ChatView/ src/routes.tsx && rm src/pages/ChatView.tsx
git add -A
git commit -m "refactor(chatview): restructure to directory module"
```

---

## Task 2: 实现 useChatHistory hook

**Files:**
- Modify: `src/pages/ChatView/useChatHistory.ts` (create)

- [ ] **Step 1: 创建 useChatHistory.ts**

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { GatewayEventFrame } from '../../lib/openclaw-types'
import { useGatewayContext } from '../../contexts/GatewayContext'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatHistoryResponse {
  messages?: Array<{
    id?: string
    role: string
    content: Array<{ type: string; text: string }>
    timestamp?: number
  }>
}

function generateSessionKey(): string {
  return `agent:main:${Date.now()}`
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
  newSession: () => void
  addMessage: (msg: ChatMessage) => void
}

export function useChatHistory(): UseChatHistory {
  const { client, gatewayConnected } = useGatewayContext() ?? {}
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionKey, setSessionKey] = useState(generateSessionKey)
  const [loading, setLoading] = useState(false)

  // gateway connected → auto load history
  useEffect(() => {
    if (gatewayConnected && client) {
      loadHistory()
    }
  }, [gatewayConnected, client])

  const loadHistory = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const res = await client.request<ChatHistoryResponse>('chat.history', {
        sessionKey,
      })
      const msgs: ChatMessage[] = (res.messages || []).map((m) => ({
        id: m.id || nextId(),
        role: m.role as 'user' | 'assistant',
        content: m.content?.[0]?.text || '',
      }))
      setMessages(msgs)
    } catch (e) {
      console.error('[useChatHistory] loadHistory error:', e)
    } finally {
      setLoading(false)
    }
  }, [client, sessionKey])

  const newSession = useCallback(() => {
    setSessionKey(generateSessionKey())
    setMessages([])
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  return { messages, sessionKey, loading, loadHistory, newSession, addMessage }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ChatView/useChatHistory.ts
git commit -m "feat(chat): add useChatHistory hook for history loading"
```

---

## Task 3: ChatView 对接 useChatHistory

**Files:**
- Modify: `src/pages/ChatView/index.tsx`

- [ ] **Step 1: 替换 ChatView 中消息相关逻辑**

1. 删除本地 `ChatMessage` interface（改用 hook 导出）
2. 删除 `idCounter`、`nextId`、`idempotencyKey`（移到 hook 或保留在 ChatView）
3. 删除 `getTextFromPayload`（保留）
4. 删除 `messages` state、`streamingContent` state、`runIdRef`（改用 hook）
5. 删除 `handleSend` 中的 `setMessages`（改用 hook 的 addMessage）
6. 删除 `gatewayConnected` local 变量（改用 hook 的）
7. 新增从 `useChatHistory` 导入：`messages`、`sessionKey`、`loading`（history loading）、`newSession`
8. 内部 `loading` 重命名避免冲突：`historyLoading`
9. `handleSend` 中的 `loading` 状态需要区分：history loading vs sending，用一个 local `sending` state

**关键改动对照：**

```typescript
// 旧
const [messages, setMessages] = useState<ChatMessage[]>([])
const [streamingContent, setStreamingContent] = useState('')
const [loading, setLoading] = useState(false)
const runIdRef = useRef<string | null>(null)

// 新：从 hook 获取
const { messages, sessionKey, loading: historyLoading, loadHistory, newSession, addMessage } = useChatHistory()
const [sending, setSending] = useState(false)

// 旧: handleSend 中
setLoading(true)
await client.request('chat.send', { sessionKey: 'agent:main:main', ... })

// 新: handleSend 中
setSending(true)
await client.request('chat.send', { sessionKey, ... })
```

```typescript
// 旧: Bubble items 构建
bubbleItems.push({ key: 'streaming', role: 'assistant', content: streamingContent, ... })

// 新: streamingContent 仍保留在 ChatView（因为 handleSend 需要）
// 不变，继续用 useState
```

```typescript
// 旧: Sender loading
loading={loading || showConnecting}

// 新:
loading={(sending || showConnecting) && !streamingContent}
```

```typescript
// 新增: 新对话按钮
<Button onClick={newSession}>新对话</Button>
```

10. `handleSend` 中发送消息后用 `addMessage` 添加用户消息（而非本地 setMessages）

**handleSend 修改对照：**

```typescript
// 旧
setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: value }])
setLoading(true)

// 新
addMessage({ id: nextId(), role: 'user', content: value })
setSending(true)
```

11. 最终 `loading` state 在 Bubble.List 中用于显示 "..." 状态，改为：
```typescript
const isLoading = sending && !streamingContent
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ChatView/index.tsx
git commit -m "feat(chat): integrate useChatHistory, auto-load history on connect"
```

---

## Task 4: 验证

- [ ] 启动应用，打开 ChatView，控制台无报错
- 连接 gateway 后历史消息自动显示
- 点击"新对话"，消息列表清空，sessionKey 换新
- 发送消息，正常收发
