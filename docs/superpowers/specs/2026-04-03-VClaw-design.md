# VClaw 设计文档

**项目名称：** VClaw
**版本：** 0.2.0
**日期：** 2026-04-03

## 一、项目概述

VClaw 是一个基于 Tauri + React + TypeScript 的跨平台桌面客户端，作为 openclaw 的官方桌面 UI，提供对话聊天、多渠道消息聚合和简化的渠道配置。

**核心设计原则：**
- **openclaw 全局运行**：用户自行安装 openclaw（`npm install -g openclaw`），VClaw 通过 `openclaw gateway run` 启动
- **VClaw 自身数据隔离**：VClaw 的配置和数据存放在 `vclaw-data/` 目录，与 openclaw 全局配置隔离
- **开箱即用**：用户安装 Node.js 和 openclaw 后，直接运行 VClaw 即可

## 二、技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件库 | antd + @ant-design/x |
| 桌面运行时 | Tauri 2.x |
| openclaw 封装层 | TypeScript GatewayClient (`src/lib/openclaw-adapter.ts`) |
| openclaw 进程管理 | Rust (Tauri Commands) |
| 配置存储 | openclaw: `~/.openclaw/`（全局），VClaw: `vclaw-data/` |

## 三、核心架构

### 3.1 openclaw 管理策略

```
┌─────────────────────────────────────────────────────────────┐
│                    VClaw Application                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Rust Layer (Tauri Commands)                  │   │
│  │  ┌───────────────┐  ┌───────────────┐                │   │
│  │  │ Process Mgr   │  │ Version Check │                │   │
│  │  │ - spawn      │  │ - openclaw --version           │   │
│  │  │ - kill       │  │               │                │   │
│  │  └───────┬───────┘  └───────┬───────┘                │   │
│  └──────────┼──────────────────┼──────────────────────┘   │
│             │                  │                            │
│             ▼                  ▼                            │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  openclaw CLI   │  │  ~/.openclaw/  │              │
│  │  (全局安装)     │  │  (全局配置)     │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         TypeScript Layer                             │   │
│  │  ┌─────────────────────────────────────────────┐     │   │
│  │  │ GatewayClient (WebSocket)                    │     │   │
│  │  │ - connect / disconnect                      │     │   │
│  │  │ - request (RPC)                            │     │   │
│  │  │ - onEvent / onConnectionChange              │     │   │
│  │  └─────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         VClaw Data (vclaw-data/)                   │   │
│  │  - config.json (VClaw 自身配置)                      │   │
│  │  - channels/ (VClaw 渠道数据)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
vclaw/
├── src/                          # 前端源码
│   ├── lib/
│   │   └── openclaw-adapter.ts  # GatewayClient TS 封装
│   ├── components/               # React 组件
│   ├── contexts/                 # React Context
│   │   └── GatewayContext.tsx   # GatewayClient 上下文
│   ├── routes.tsx               # 路由配置
│   ├── App.tsx                  # 根组件
│   └── main.tsx                 # 入口
├── src-tauri/                    # Tauri/Rust 后端
│   ├── src/
│   │   └── lib.rs              # Tauri Commands
│   └── tauri.conf.json
└── vclaw-data/                   # VClaw 自身数据目录
    ├── config.json               # VClaw 配置
    └── channels/                # 渠道数据
```

### 3.3 启动流程

```
用户启动 VClaw
       │
       ▼
┌──────────────────┐
│  /env-check      │
│  EnvCheckPage    │
│  检测 Node.js    │
│  检测 OpenClaw   │
└────────┬─────────┘
         │
    检测通过
         │
         ▼
┌──────────────────┐
│  / → /chat      │
│  AppLayout       │
│  startOpenClaw()│
│  gateway run     │
└────────┬─────────┘
         │
    Gateway 启动
         │
         ▼
┌──────────────────┐
│  WebSocket       │
│  connect         │
│  ws://127.0.0.1 │
│  :18790/rpc      │
└────────┬─────────┘
         │
    连接成功
         │
         ▼
   ChatView 就绪
```

## 四、前端组件

| 组件 | 路由 | 职责 |
|------|------|------|
| `EnvCheckPage` | `/env-check` | 检测 Node.js + OpenClaw 是否安装 |
| `AppLayout` | `/` | 布局容器，管理 GatewayClient 连接 |
| `ChatView` | `/chat` | 对话界面，WebSocket 流式聊天 |
| `ChannelPanel` | `/channels` | 渠道配置面板 |
| `LogPanel` | `/logs` | 日志面板 |
| `ConfigPage` | `/config` | 配置查看（`~/.openclaw/openclaw.json`） |
| `SettingsPage` | `/settings` | 设置页（进程管理） |
| `Sidebar` | - | 侧边栏导航 |

## 五、Tauri Commands

| Command | 描述 |
|---------|------|
| `check_node_env` | 检测 Node.js 版本、路径、npm 版本 |
| `check_env` | 检测 Node.js 和 OpenClaw 是否安装 |
| `start_openclaw` | 启动 openclaw gateway 进程 |
| `stop_openclaw` | 终止 openclaw 进程 |
| `get_openclaw_version` | 获取 openclaw 版本 |
| `get_openclaw_status` | 获取 openclaw 进程状态 |
| `read_global_config` | 读取全局配置文件 `~/.openclaw/openclaw.json` |
| `get_channels` | 获取渠道列表 |
| `export_config` | 导出 VClaw 自身配置 |
| `import_config` | 导入 VClaw 自身配置 |

## 六、Gateway WebSocket 协议

详见 `2026-04-03-gateway-chat-core-design.md`

## 七、路由

| 路径 | 页面 |
|------|------|
| `/env-check` | 环境检测页 |
| `/chat` | 聊天页 |
| `/channels` | 渠道配置页 |
| `/logs` | 日志页 |
| `/settings` | 设置页 |
| `/config` | 配置查看页（`~/.openclaw/openclaw.json`） |

## 八、验收标准

1. VClaw 启动时检测 Node.js 和 openclaw，未安装时引导用户安装
2. openclaw gateway 通过 WebSocket 与前端通信，流式显示回复
3. Sidebar 状态指示灯正确反映 gateway 连接状态
4. 配置页面正确展示 `~/.openclaw/openclaw.json` 内容
5. VClaw 自身数据（配置、渠道）与 openclaw 全局配置隔离
