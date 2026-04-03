# VClaw Gateway 连接管理重构

**日期：** 2026-04-03
**版本：** 0.2.0

## 一、问题

SettingsPage 的"启动/停止"按钮绑定了 disabled 逻辑但没有 onClick，实际无任何效果。

同时 AppLayout 和 SettingsPage 各维护一套状态 —— `status.running`（Rust 进程状态）vs `gatewayConnected`（WebSocket 连接状态）—— 导致 Badge 和 Sender placeholder 不同步。

## 二、目标

1. 启动/停止按钮真正生效
2. 全局唯一连接状态，所有组件同步

## 三、设计

### 3.1 GatewayContext 扩展

新增 `start()` / `stop()` 方法，暴露给所有消费者。

```typescript
interface GatewayContextValue {
  client: GatewayClient | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}
```

`start()` 执行：
1. `invoke('start_openclaw')` → 启动 openclaw gateway 进程
2. `client.connect(gatewayUrl)` → 建立 WebSocket 连接

`stop()` 执行：
1. `client.disconnect()` → 关闭 WebSocket，`this.closed = true` 阻止自动重连
2. `invoke('stop_openclaw')` → 停止 openclaw gateway 进程

### 3.2 状态流

```
GatewayClient._connected
       ↑
       │ onConnectionChange 广播
       │
   ┌──────────┐
   │ Context  │ gatewayConnected 状态
   └──────────┘
       │
  ┌────┴────┬────────────┐
  ↓         ↓            ↓
AppLayout  Sidebar    SettingsPage
(Badge)   (Badge)    (启动/停止按钮)
```

唯一数据源：GatewayClient._connected

### 3.3 自动重连保留

GatewayClient 原有自动重连逻辑不变：
- 主动 `disconnect()` → `this.closed = true` → 不重连
- 意外断连（进程崩溃/网络波动）→ `this.closed = false` → 指数退避重连 750ms → 15s

### 3.4 启动流程

```
用户点启动
    │
    ▼
invoke('start_openclaw') → Rust 启动进程，固定端口 18790
    │
    ▼
client.connect(ws://127.0.0.1:18790/rpc)
    │
    ▼
WebSocket 握手 + connect RPC
    │
    ▼
connected = true → 所有组件同步更新
```

### 3.5 停止流程

```
用户点停止
    │
    ▼
client.disconnect() → WebSocket 关闭，closed=true
    │
    ▼
invoke('stop_openclaw') → Rust kill 进程
    │
    ▼
connected = false → 所有组件同步更新
```

## 四、文件改动

| 文件 | 改动 |
|------|------|
| `src/contexts/GatewayContext.tsx` | 扩展 value，提供 start/stop/client |
| `src/components/AppLayout.tsx` | 移除本地 status state，改为从 context 导出 start/stop |
| `src/pages/SettingsPage.tsx` | 导入 useGateway，绑定启动/停止 onClick |
| `src/components/Sidebar.tsx` | 无改动，已通过 context 接收 gatewayConnected |
| `src/lib/openclaw-adapter.ts` | startOpenClaw/stopOpenClaw 保持不变 |

## 五、验收标准

1. 点启动 → 进程启动 → WebSocket 连接 → Badge 绿 + 输入框可输入
2. 点停止 → WebSocket 断开 → 进程停止 → Badge 红 + 输入框禁用
3. 意外断连后 → 自动重连（不阻止）
4. AppLayout / Sidebar / SettingsPage 状态始终一致
