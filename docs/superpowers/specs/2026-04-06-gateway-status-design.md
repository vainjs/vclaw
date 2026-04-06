# Gateway Status 动态获取设计

## 1. 目标

将 `get_openclaw_status` 从硬编码常量改为通过 `openclaw gateway status` 命令动态获取真实网关信息，消除端口硬编码。

## 2. 现状问题

- `GATEWAY_PORT` 在 Rust 层硬编码为 `18789`
- `get_openclaw_status` 返回的 `gatewayUrl` 永远是 `ws://127.0.0.1:18789`
- 实际网关端口可能因 `~/.openclaw/openclaw.json` 配置或 `OPENCLAW_GATEWAY_PORT` 环境变量而不同
- 前端 WebUI 地址依赖硬编码派生

## 3. 方案

### Rust 层 (`src-tauri/src/lib.rs`)

`get_openclaw_status` 改为调用 `openclaw gateway status --json` 并解析 JSON 输出：

```json
{
  "gateway": { "bindMode": "loopback", "bindHost": "127.0.0.1", "port": 18789, "probeUrl": "ws://127.0.0.1:18789" },
  "rpc": { "ok": true, "url": "ws://127.0.0.1:18789" },
  "service": { "runtime": { "status": "running", "pid": 16578 } }
}
```

解析字段：
- `running`: `service.runtime.status === "running"`
- `gatewayUrl`: `gateway.probeUrl`（直接使用）
- `dashboardUrl`: `gateway.probeUrl` 替换 `ws` → `http` + 末尾加 `/`
- `pid`: `service.runtime.pid`
- `port`: `gateway.port`
- `bind`: `gateway.bindMode`

TCP 检测函数 `is_gateway_running` 保留用于 `start_openclaw` 的快速路径判断。

### TypeScript 层 (`src/lib/openclaw-adapter.ts`)

```typescript
export interface OpenClawStatus {
  running: boolean;
  gatewayUrl?: string;
  dashboardUrl?: string;
  pid?: number;
  port?: number;
  bind?: string;
}
```

### 前端 (`src/pages/Gateway.tsx`)

- "网关地址" 使用 `status.gatewayUrl`
- "Web 控制台地址" 使用 `status.dashboardUrl`，不再做 ws→http 替换
- 移除所有硬编码端口

### Log 页面 (`src/pages/Log/index.tsx`)

若后续需要网关 URL，同理从 `getOpenClawStatus()` 获取，不硬编码。

## 4. 风险

- `openclaw gateway status --json` 命令执行有进程 spawn 开销，但可接受（JSON 解析比文本解析更稳定）
- JSON 输出格式若因版本升级变化，解析逻辑需同步更新（但 JSON 比文本格式更稳定）
- Gateway 未运行时，`openclaw gateway status` 返回非零退出码，需处理错误

## 5. 改动范围

| 文件 | 改动 |
|------|------|
| `src-tauri/src/lib.rs` | 重写 `get_openclaw_status` 命令，删除 `GATEWAY_PORT` 常量 |
| `src/lib/openclaw-adapter.ts` | 扩展 `OpenClawStatus` 接口 |
| `src/pages/Gateway.tsx` | 使用动态 `dashboardUrl`，移除硬编码 |
