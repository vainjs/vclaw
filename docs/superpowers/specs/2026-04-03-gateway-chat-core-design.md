# VClaw 核心聊天 — Gateway WebSocket 直连

**项目名称：** VClaw
**版本：** 0.2.0
**日期：** 2026-04-03

## 一、概述

VClaw 通过 WebSocket 直连 openclaw gateway，实现流式聊天功能。

**架构：**
- openclaw 全局安装（`npm install -g openclaw`）
- VClaw 启动 `openclaw gateway run` 进程
- 前端通过 WebSocket 连接 gateway，发送 RPC 请求
- gateway 通过事件流推送聊天结果

## 二、Gateway RPC 协议

WebSocket 地址：`ws://127.0.0.1:{port}/rpc`

### 2.1 连接握手

连接后发送 connect 请求：
```json
{
  "type": "req",
  "id": "1",
  "method": "connect",
  "params": {
    "protocol": 1,
    "client": {
      "name": "vclaw",
      "version": "0.2.0",
      "platform": "desktop",
      "mode": "webchat"
    }
  }
}
```

Gateway 回复 hello 确认连接成功。

### 2.2 RPC 方法

| Method | Params | 说明 |
|--------|--------|------|
| `chat.send` | `{ sessionKey, message, idempotencyKey }` | 发送聊天消息 |
| `chat.abort` | `{ sessionKey, runId? }` | 中断当前生成 |

### 2.3 事件流

Gateway 推送事件帧：
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "kind": "delta" | "final" | "error" | "aborted",
    "runId": "...",
    "sessionKey": "...",
    "text": "..."
  }
}
```

- **delta**：流式文本片段
- **final**：生成完成
- **error**：出错
- **aborted**：用户或系统中断

## 三、组件架构

```
AppLayout
  ├── Sidebar（状态指示）
  └── ChatView（GatewayClient context）
       │
       └── GatewayClient (WebSocket)
            ├── connect(url) / disconnect()
            ├── request(method, params) → RPC
            ├── onEvent(callback) → 事件分发
            └── onConnectionChange(callback) → 连接状态
```

### 3.1 GatewayClient（openclaw-adapter.ts）

- WebSocket 连接管理
- RPC 请求/响应匹配（pending map）
- 事件分发（onEvent）
- 自动重连（指数退避 750ms → 15s）

### 3.2 AppLayout

- 启动 `startOpenClaw()` → gatewayUrl
- 创建 GatewayClient 并连接
- 通过 GatewayContext 传递给子组件

### 3.3 ChatView

- 使用 `client.request('chat.send', ...)` 发送消息
- 监听 `chat` 事件，流式渲染
- 支持中断（`chat.abort`）

## 四、连接生命周期

```
AppLayout 挂载
     │
     ▼
startOpenClaw() → gatewayUrl
     │
     ▼
client.connect(gatewayUrl)
     │  发送 connect 请求
     ▼
Gateway 回复 hello
     │  connected = true
     ▼
ChatView 就绪
     │
     ├── 断线 → 自动重连
     │
     └── App 卸载 → disconnect() + stopOpenClaw()
```

## 五、消息流

```
用户输入消息
     │
     ▼
client.request('chat.send', {
  sessionKey: 'main',
  message: content,
  idempotencyKey: uuid
})
     │
     ▼
Gateway 处理
     │
     ▼
chat 事件推送
     │
     ├── delta → streamingContent 追加
     ├── ...
     └── final → streamingContent flush 到 messages
```

## 六、Tauri Commands

| Command | 描述 |
|---------|------|
| `start_openclaw` | 启动 `openclaw gateway run` |
| `stop_openclaw` | 终止 openclaw 进程 |
| `get_openclaw_status` | 获取进程状态和 gateway URL |

## 七、关键设计

| 决策 | 选择 |
|------|------|
| 连接方式 | WebSocket 直连 gateway |
| sessionKey | 固定 `"main"` |
| 重连 | 指数退避 750ms → 15s |
| 消息发送 | `client.request('chat.send', ...)` |
| 流式渲染 | delta 追加到 streamingContent，final flush |

## 八、验收标准

1. VClaw 启动后自动启动 gateway 并连接 WebSocket
2. 聊天消息通过 RPC 发送，回复流式显示
3. 可中断生成
4. 断线自动重连
5. Sidebar 指示灯反映连接状态
