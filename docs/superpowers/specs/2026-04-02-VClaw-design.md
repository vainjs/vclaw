# VClaw 设计文档

**项目名称：** VClaw
**版本：** 0.1.0
**日期：** 2026-04-02

## 一、项目概述

VClaw 是一个基于 Tauri + React + TypeScript 的跨平台桌面客户端，用于封装原生 openclaw。安装即用，通过全新 UI 暴露 openclaw 的核心能力：对话聊天、多渠道消息聚合、简化的渠道配置。

**核心设计原则：**
- 轻量实现，快速出 MVP，不过度工程化
- 沙箱隔离：VClaw 使用独立的 `vclaw-data/` 目录存放配置和数据，与系统或其他 openclaw 实例隔离
- 可演进：接口抽象层设计为可插拔，后续可接入云服务

## 二、技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件库 | @ant-design/x + antd（最新版本） |
| 桌面运行时 | Tauri 2.x |
| openclaw 封装层 | TypeScript Adapter（`src/lib/openclaw-adapter.ts`） |
| openclaw 进程管理 | Rust（Tauri Commands） |
| 配置存储 | 本地 JSON 文件（`vclaw-data/` 内） |
| 实时消息 | Tauri Events |
| Node.js 检测 | 安装时检测 Node.js 版本及路径信息 |

## 三、架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │   Chat UI    │   │   Sidebar    │   │  Channel Panel  │ │
│  └──────────────┘   └──────────────┘   └─────────────────┘ │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │           openclaw-adapter.ts (TS Adapter)           │   │
│  └────────────────────────┬─────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │ invoke
┌───────────────────────────┼─────────────────────────────────┐
│                      Rust (Tauri)                            │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │   Commands: send_message, get_channels, start/stop   │   │
│  │   Process Manager: spawn, kill, tail stdout/stderr   │   │
│  └────────────────────────┬─────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │ stdin/stdout
┌───────────────────────────┼─────────────────────────────────┐
│                    openclaw CLI (Node.js)                    │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │             vclaw-data/ (隔离的沙箱目录)               │   │
│  │   config.json │ channels/ │ logs/ │ data/            │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 四、模块设计

### 4.1 TS Adapter（`src/lib/openclaw-adapter.ts`）

openclaw CLI 的 TypeScript 封装层，负责：
- CLI 命令的参数组装
- stdout/stderr 结果解析
- JSON 响应映射为前端数据结构
- 与 Tauri invoke 交互

```typescript
// 核心接口（待 openclaw CLI 实际接口确定后调整）
export interface VClawAdapter {
  sendMessage(channel: string, message: string): Promise<Message>;
  getChannels(): Promise<Channel[]>;
  getConversations(channel?: string): Promise<Conversation[]>;
  startOpenClaw(): Promise<void>;
  stopOpenClaw(): Promise<void>;
}
```

### 4.2 Rust 进程管理（Tauri Commands）

负责 openclaw CLI 进程的生命周期管理：
- `check_node_env()` — 检测 Node.js 版本、路径、npm 版本
- `start_openclaw()` — 在 `vclaw-data/` 目录启动 openclaw CLI
- `stop_openclaw()` — 终止进程
- `tail_logs()` — 通过 Tauri Event 将 stdout/stderr 实时推送到前端

### 4.3 前端组件

| 组件 | 职责 |
|------|------|
| `App.tsx` | 根组件，布局容器 |
| `ChatView` | 对话界面（基于 @ant-design/x 的聊天组件） |
| `Sidebar` | 左侧边栏（会话列表、渠道切换） |
| `ChannelPanel` | 渠道配置面板（侧边栏底部展开） |
| `MessageBubble` | 单条消息渲染 |
| `ChannelItem` | 渠道列表项 |

### 4.4 样式

基于 @ant-design/x 和 antd 的简约浅色风格：
- 使用 antd ConfigProvider 定制主题（白色/浅灰背景）
- 保持 @ant-design/x 聊天组件默认样式，微调主色调
- 参考 ChatGPT/Claude 的简洁对话体验

### 4.5 安装检测

安装时通过 Tauri 命令检测 Node.js 环境：
- `node --version` — 获取 Node.js 版本
- `which node` — 获取 Node.js 路径
- `npm --version` — 获取 npm 版本
- 检测结果写入 `vclaw-data/config.json`

## 五、目录结构

```
vclaw/
├── src/
│   ├── lib/
│   │   └── openclaw-adapter.ts   # TS 适配器
│   ├── components/
│   │   ├── ChatView.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ChannelPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ChannelItem.tsx
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   └── main.rs              # Tauri 命令、进程管理
│   └── tauri.conf.json
├── vclaw-data/                   # 运行时生成，隔离的沙箱目录
│   ├── config.json
│   ├── channels/
│   ├── logs/
│   └── data/
└── docs/superpowers/specs/       # 设计文档
```

## 六、数据流

### 6.1 发送消息

```
用户输入 → ChatView → openclaw-adapter.sendMessage()
  → Tauri invoke('send_message')
  → Rust: openclaw CLI stdout
  → 解析 JSON → 返回 Message
  → ChatView 更新消息列表
```

### 6.2 实时日志

```
Rust tail stdout → Tauri Event('openclaw-log')
→ Frontend 监听 → 在日志面板实时展示
```

### 6.3 启动流程

```
App 挂载 → Tauri invoke('start_openclaw')
→ Rust: spawn openclaw CLI in vclaw-data/
→ Tauri Event('openclaw-started')
→ getChannels() → 渲染侧边栏渠道列表
```

## 七、沙箱隔离

- **数据目录：** 所有 openclaw 配置和数据存放在 `vclaw-data/`（相对 Tauri app 根目录）
- **环境隔离：** openclaw 进程看不到系统其他位置的任何 openclaw 配置
- **Node.js 环境：** 复用系统 Node.js，不捆绑独立运行时

## 八、上云迁移路径

当前架构为本地优先，云服务支持在后续版本实现：

```
当前: Frontend → Tauri Commands → Local openclaw CLI
            ↓ 换 adapter 实现
未来: Frontend → Tauri Commands → Remote openclaw HTTP API
```

关键：Rust 层的 Commands 接口保持稳定，前端通过 TS Adapter 切换本地/远程实现。

## 九、待确定事项

- openclaw CLI 的具体接口（send_message、get_channels 等的参数和返回值格式）
- openclaw 日志输出格式（以便 Rust 解析实时推送）
- 渠道配置的 JSON Schema

以上接口待 openclaw 提供方确认后补充到本文档。

## 十、验收标准

1. VClaw 启动时正确检测并显示 Node.js 环境信息
2. VClaw 可正常启动 openclaw CLI 进程
3. 用户可在 ChatView 发送消息并收到回复
4. 渠道列表正确显示，且可展开配置面板
5. 所有 openclaw 数据严格限制在 `vclaw-data/` 目录内
6. UI 使用 @ant-design/x + antd，简约浅色风格，聊天优先界面
