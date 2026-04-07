# VClaw 设计文档

**项目名称：** VClaw
**版本：** 0.2.0
**日期：** 2026-04-03
**更新：** 2026-04-07

## 一、项目概述

VClaw 是基于 Tauri + React + TypeScript 的跨平台桌面客户端，openclaw 的桌面 UI，提供对话聊天、日志查看和配置管理功能。

**核心设计原则：**
- **openclaw 全局运行**：用户安装 openclaw（`npm install -g openclaw`），VClaw 通过 `openclaw gateway run` 启动
- **开箱即用**：用户安装 Node.js 和 openclaw 后，直接运行 VClaw 即可

## 二、技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件库 | antd + @ant-design/x |
| 桌面运行时 | Tauri 2.x |
| openclaw 封装层 | TypeScript (`src/lib/openclaw-*.ts`) |
| openclaw 进程管理 | Rust (Tauri Commands) |
| 配置存储 | openclaw: `~/.openclaw/` |

## 三、架构

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VClaw Application                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Rust Layer (Tauri Commands)                  │   │
│  │  start/stop openclaw, read config, get status       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         TypeScript Layer                             │   │
│  │  ┌──────────────┐  ┌───────────────┐                │   │
│  │  │ openclaw-   │  │ openclaw-    │                │   │
│  │  │ commands.ts  │  │ types.ts     │                │   │
│  │  └──────┬───────┘  └───────┬───────┘                │   │
│  │         └──────────┬───────┘                          │   │
│  │                    ▼                                  │   │
│  │  ┌─────────────────────────────────────────┐        │   │
│  │  │ useGateway.ts (WebSocket 连接管理)      │        │   │
│  │  └─────────────────────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
src/
├── lib/
│   ├── openclaw-commands.ts  # Rust Tauri invoke 封装
│   ├── openclaw-types.ts     # 共享 TypeScript 类型
│   └── utils.ts              # 工具函数
├── hooks/
│   ├── useGateway.ts         # Gateway 连接 lifecycle
│   ├── useWebsocket.ts       # WebSocket hook
│   └── useMemoizedFn.ts      # 函数记忆化
├── components/
│   ├── AppLayout.tsx         # 布局容器（侧边栏 + 内容区）
│   └── Sidebar.tsx           # 导航侧栏（可折叠）
├── contexts/
│   └── GatewayContext.tsx     # GatewayClient React Context
└── pages/
    ├── ChatView/             # 聊天页面
    │   ├── index.tsx
    │   ├── index.module.less
    │   └── useChatHistory.ts  # 聊天历史 hook
    ├── Gateway/              # 网关管理页面
    │   ├── index.tsx
    │   └── index.module.less
    ├── Log/                  # 日志页面
    │   ├── index.tsx
    │   ├── index.module.less
    │   └── useLog.ts         # 日志状态管理 hook
    └── Config/               # 配置查看页面
        ├── index.tsx
        └── index.module.less
```

## 四、页面模块

| 页面 | 路由 | 状态 | 说明 |
|------|------|------|------|
| `EnvCheck` | `/env-check` | ✅ | 环境检测（Node.js + OpenClaw） |
| `ChatView` | `/chat` | ✅ | 聊天界面，流式对话，历史记录，markdown |
| `Gateway` | `/gateway` | ✅ | 网关进程启停，状态展示 |
| `Config` | `/config` | ✅ | 查看 `~/.openclaw/openclaw.json` |
| `Log` | `/logs` | ✅ | 日志查看，级别过滤，auto-follow |
| `Channel` | `/channels` | 🔒 | 渠道管理（暂未开放） |

## 五、ChatView 模块

### 5.1 功能

- **历史记录**：连接成功后自动加载 `chat.history`，stable sessionKey (`agent:main:main`)
- **流式对话**：`chat.send` + `chat` 事件流，`streaming: true` + `typing: true`
- **Markdown 渲染**：`XMarkdown` + `Typography` 渲染气泡内容
- **头像**：`Avatar` 组件区分 user（蓝色）和 assistant（绿色）
- **时间戳**：`footer` 显示每条消息时间

### 5.2 数据流

```
useChatHistory (sessionKey: 'agent:main:main')
       ↓
chat.history RPC → 加载历史消息
       ↓
GatewayClient → chat.send
       ↓
chat 事件 (delta/final/error/aborted)
       ↓
Bubble 渲染 (streaming + markdown + avatar + timestamp)
```

### 5.3 关键类型

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}
```

## 六、Log 模块

### 6.1 功能

- **日志轮询**：每 2s 调用 `logs.tail` RPC 获取增量日志
- **级别过滤**：trace / debug / info / warn / error / fatal 六个级别
- **文本过滤**：关键词搜索（message / subsystem / raw）
- **Auto-follow**：自动滚动到最新日志，可切换开关
- **游标分页**：基于 cursor 的增量拉取，最多保留 2000 条

### 6.2 日志格式解析

支持 JSON 格式日志行，解析字段：

| 字段 | 来源 | 说明 |
|------|------|------|
| time | `obj.time` 或 `obj._meta.date` | 时间戳 |
| level | `obj._meta.logLevelName` 或 `level` | 日志级别 |
| subsystem | `obj._meta.name` 或 context 对象 | 子系统名 |
| message | `obj['1']` 或 `obj['0']` 或 `obj.message` | 正文 |

### 6.3 级别颜色

| level | 颜色 | 说明 |
|-------|------|------|
| trace | `#888888` | 灰色 |
| debug | `#999999` | 浅灰 |
| info | `#d4d4d4` | 白灰 |
| warn | `#cca700` | 黄色 |
| error | `#f48771` | 红色 |
| fatal | `#f14747` | 亮红 |

## 七、Gateway WebSocket 协议

### 7.1 连接参数

```typescript
{
  client: { id: 'openclaw-control-ui', version: '0.2.0', platform, mode: 'ui' },
  role: 'operator',
  scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
  caps: ['tool-events'],
  auth: { token: '<gateway-token>' },
  minProtocol: 3,
  maxProtocol: 3,
}
```

### 7.2 聊天 API

**发送消息**：`chat.send`
```typescript
{ sessionKey: 'agent:main:main', message: string, idempotencyKey: string }
```

**聊天事件** (`event: 'chat'`)：
```typescript
{ state: 'delta' | 'final' | 'error' | 'aborted', runId?, message?: {...}, errorMessage?, stopReason? }
```

### 7.3 日志 API

**拉取日志**：`logs.tail`
```typescript
{ cursor?: number, limit: number, maxBytes: number }
```

**日志响应**：
```typescript
{ file?: string, cursor?: number, lines?: string[], truncated?: boolean, reset?: boolean }
```

### 7.4 sessionKey

固定值：`'agent:main:main'`

## 八、Tauri Commands

| Command | 描述 |
|---------|------|
| `check_env` | 检测 Node.js 和 OpenClaw 是否安装 |
| `start_openclaw` | 启动 openclaw gateway 进程 |
| `stop_openclaw` | 终止 openclaw 进程 |
| `get_openclaw_version` | 获取 openclaw 版本 |
| `get_openclaw_status` | 获取进程状态和 gateway URL（动态） |
| `read_global_config` | 读取 `~/.openclaw/openclaw.json` |
| `get_gateway_token` | 读取 gateway auth token |

## 九、验收标准

1. VClaw 启动时检测 Node.js 和 openclaw，未安装时引导用户安装
2. openclaw gateway 通过 WebSocket 与前端通信，流式显示回复
3. 侧边栏状态指示灯正确反映 gateway 连接状态
4. 侧边栏可折叠，状态保存在 localStorage
5. 聊天消息自动加载历史记录，支持 markdown 渲染和头像显示
6. 日志页面实时显示 gateway 日志，支持级别过滤和关键词搜索
7. 配置页面正确展示 `~/.openclaw/openclaw.json` 内容
