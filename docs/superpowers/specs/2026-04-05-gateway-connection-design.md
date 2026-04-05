# VClaw Gateway 连接设计

## 状态
已通过 - 2026-04-05

## 背景

VClaw 是一个 Tauri + React 桌面应用，需要通过 WebSocket 连接到 OpenClaw gateway（`ws://127.0.0.1:18789`）实现 AI 聊天功能。

---

## 1. 连接流程总览

```
┌─────────────────────────────────────────────────────────────┐
│                      VClaw App (Tauri)                       │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ useGateway  │ → │ GatewayClient│ → │ openclaw-adapter│  │
│  │   (React)   │   │ (WebSocket)  │   │  (Tauri invoke) │  │
│  └─────────────┘   └──────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↕ WebSocket                    ↕ Tauri Commands
         ↓                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  OpenClaw Gateway                            │
│              (ws://127.0.0.1:18789)                        │
└─────────────────────────────────────────────────────────────┘
```

### 握手时序

```
1. GatewayClient.doConnect()          WebSocket 连接打开
2. Gateway 发送 → {type:"event", event:"connect.challenge", payload:{nonce, ts}}
3. GatewayClient.handleMessage()       收到 challenge，提取 nonce
4. GatewayClient.sendConnect()         构建并发送 connect req
5. Gateway 验证 → {type:"res", id:"...", ok:true, payload:{...}}
```

---

## 2. 认证机制

### 2.1 必需配置 (`~/.openclaw/openclaw.json`)

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "controlUi": {
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token",
      "token": "<token>"
    }
  }
}
```

**关键说明：**
- `allowInsecureAuth: true` 对浏览器客户端是**架构性要求**，无法绕过
- VClaw 运行在 Tauri WKWebView 中，WebSocket 请求带有浏览器 origin header
- Gateway 对带有 origin header 的 control UI 连接有严格的安全检查
- 没有 `allowInsecureAuth: true` 时，连接会被拒绝并报错：`control ui requires device identity (use HTTPS or localhost secure context)`

### 2.2 macOS 原生客户端不需要 `allowInsecureAuth` 的原因

- macOS WebSocket 没有浏览器 origin header
- 不触发 gateway 的浏览器安全检查 (`resolveHandshakeBrowserSecurityContext`)
- 因此可以使用更宽松的认证策略

### 2.3 Client ID 白名单

Gateway 验证 `client.id` 字段，**必须在白名单中**：

| Client ID          | 来源        | VClaw 可用 |
|--------------------|-------------|-----------|
| `openclaw-control-ui` | Gateway 内部 | ✅ 是 |
| `webchat`          | WebUI       | ✅ 是 |
| `webchat-ui`       | WebUI       | ✅ 是 |
| `cli`              | CLI         | ✅ 是 |
| `vclaw`            | VClaw (旧) | ❌ 不在白名单 |
| `webclaw-ui`       | VClaw (旧) | ❌ 不在白名单 |

VClaw 使用 `openclaw-control-ui`。

---

## 3. 关键 API (Tauri Commands)

### 3.1 `get_gateway_token` → `String`
读取 `~/.openclaw/openclaw.json` 中 `gateway.auth.token`。

### 3.2 `get_openclaw_status` → `{ running: bool, gatewayUrl: string }`
通过 TCP 检测 `127.0.0.1:18789` 是否可达。

### 3.3 `get_openclaw_version` → `String`
执行 `openclaw --version` 并解析输出。

### 3.4 `get_device_identity` → `{ device_id: String, public_key: String }`
加载或创建 `~/.openclaw/identity/device.json`。

### 3.5 `sign_payload(payload: String)` → `String`
使用 Ed25519 私钥对 payload 签名。

---

## 4. Device Identity (Ed25519)

### 4.1 文件格式 (`~/.openclaw/identity/device.json`)

```json
{
  "deviceId": "sha256-hash-of-public-key",
  "publicKeyRawBase64": "base64url-encoded-public-key",
  "privateKeySeedBase64": "base64url-encoded-32-byte-seed",
  "createdAtMs": 1737264000000
}
```

### 4.2 Rust 实现

- **密钥生成**：`ed25519-dalek::SigningKey::from_bytes(&mut OsRng)` 生成 32 字节 seed
- **公钥推导**：`VerifyingKey::from(&signing_key)` 提取公钥字节
- **Device ID**：`SHA256(public_key_bytes)` 取 hex 编码
- **签名算法**：Ed25519 (EdDSA) - `signing_key.sign(payload.as_bytes())`
- **Payload 格式**（V3）：
  ```
  v3|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}|{nonce}|{platform}|{deviceFamily}
  ```
  用 `|` 分隔后整体做签名。

### 4.3 Device Identity 在当前架构中的角色

Device identity 已实现，但在浏览器客户端中**不参与 `allowInsecureAuth` 的绕过**。它对以下场景有意义：
- 设备配对（device pairing）流程
- 跨设备认证
- 长期会话持久化

当前 VClaw 连接仍**必须**依赖 `allowInsecureAuth: true`。

---

## 5. WebSocket 协议 (Gateway Protocol v3)

### 5.1 消息帧格式

```typescript
// 请求帧
{ type: "req", id: string, method: string, params: Record<string, unknown> }

// 响应帧
{ type: "res", id: string, ok: boolean, payload?: unknown, error?: { message: string, code: string } }

// 事件帧
{ type: "event", event: string, payload?: Record<string, unknown>, seq?: number }
```

### 5.2 Connect 握手参数

```typescript
{
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: 'openclaw-control-ui',
    version: '0.2.0',
    platform: navigator.platform,  // e.g. "MacIntel"
    mode: 'ui',
  },
  role: 'operator',
  scopes: [
    'operator.admin',
    'operator.read',
    'operator.write',
    'operator.approvals',
    'operator.pairing',
  ],
  caps: ['tool-events'],
  userAgent: navigator.userAgent,
  locale: navigator.language,
  auth: { token: '<gateway-token>' },
}
```

### 5.3 聊天相关 API

**发送消息**：`chat.send`
```typescript
{
  sessionKey: 'agent:main:main',
  message: '用户输入的文本',
  idempotencyKey: '<unique-key>',
}
```

**聊天事件** (`type: "event", event: "chat"`)：
```typescript
{
  type: 'event',
  event: 'chat',
  payload: {
    runId: string,
    sessionKey: string,
    state: 'delta' | 'final' | 'error' | 'aborted',
    message?: {
      role: 'assistant',
      content: [{ type: 'text', text: string }],
      timestamp: number,
    },
    errorMessage?: string,
    stopReason?: string,
  }
}
```

**注意**：
- `state` 而不是 `kind`（旧版本可能用 `kind`）
- `delta` 事件中 `message.content[0].text` 是**完整累积文本**（gateway 做了去重），前端应**替换**而不是追加
- `final` 事件后应清空 streaming buffer

---

## 6. 前端架构

### 6.1 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| `GatewayClient` | `src/lib/openclaw-adapter.ts` | WebSocket 连接、消息编解码、重连逻辑 |
| `useGateway` | `src/hooks/useGateway.ts` | React hook，生命周期管理 |
| `ChatView` | `src/pages/ChatView.tsx` | 聊天 UI，消费 GatewayClient |

### 6.2 GatewayClient 状态机

```
disconnected → connecting → connected → disconnected
                   ↓
              handshake_failed → disconnected
```

### 6.3 重连策略

- 初始 backoff：750ms
- 最大 backoff：15s
- 指数退避：`backoffMs = min(backoffMs * 1.7, 15000)`
- 重连时重新获取 gateway URL 和 token

---

## 7. 已知限制

1. **必须配置 `allowInsecureAuth: true`**：Tauri WKWebView 客户端无法绕过此要求
2. **Device identity 目前不解锁 `allowInsecureAuth`**：即使有有效签名，仍需该配置
3. **无设备配对 UI**：VClaw 尚未实现首次连接的配对批准流程

---

## 8. 相关文件

| 文件 | 说明 |
|------|------|
| `src/lib/openclaw-adapter.ts` | GatewayClient 实现 |
| `src/hooks/useGateway.ts` | React hook |
| `src/pages/ChatView.tsx` | 聊天页面 |
| `src-tauri/src/lib.rs` | Tauri commands |
| `src-tauri/src/device_identity.rs` | Ed25519 设备身份 |
| `src-tauri/Cargo.toml` | Rust 依赖 |
