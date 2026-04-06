# AGENTS.md

VClaw 项目的 AI Agent 操作指南。

## 项目概述

VClaw 是一个基于 Tauri + React + TypeScript 的跨平台桌面客户端，作为 openclaw 的官方桌面 UI，提供对话聊天、多渠道消息聚合和简化的渠道配置。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + @ant-design/x + antd
- **桌面运行时**: Tauri 2.x
- **openclaw 封装**: TypeScript Adapter (`src/lib/openclaw-adapter.ts`)
- **进程管理**: Rust (Tauri Commands)

## 依赖要求

- **Node.js**: 全局安装（https://nodejs.org/）
- **OpenClaw**: 全局安装（`npm install -g openclaw` 或 `pnpm add -g openclaw`）

## 架构原则

- **openclaw 全局运行**：使用系统全局安装的 openclaw，配置在 `~/.openclaw/`
- **VClaw 自身数据**：VClaw 的配置和数据存放在 `vclaw-data/`（Tauri app data dir）
- 前端通过 `src/lib/openclaw-adapter.ts` 与 Tauri Commands 交互
- Rust 层仅负责进程生命周期管理（spawn/kill/log streaming）
- Rust Commands 接口保持稳定，后续可换 adapter 支持云服务

## UI/UX

- 界面形态：聊天优先（ChatGPT/Claude 风格）
- 样式：简约浅色风格，基于 antd ConfigProvider 定制
- 侧边栏导航：聊天、渠道、日志、设置、配置

## 开发指南

### 目录结构

```
### 目录结构规范

```
src/
├── lib/                       # 跨项目复用
│   └── openclaw-adapter.ts   # TS 适配器
├── pages/                     # 页面模块（按需拆分）
│   ├── ChatView/
│   │   └── index.tsx         # 页面入口
│   ├── Channel/
│   │   └── index.tsx
│   ├── Config/
│   │   └── index.tsx
│   ├── EnvCheck/
│   │   └── index.tsx
│   ├── Gateway/
│   │   └── index.tsx
│   └── Log/
│       ├── index.tsx         # 页面入口
│       ├── LogTab.tsx        # 子组件
│       └── useLog.ts         # 页面内 hook
├── components/                 # 跨页面复用组件
│   ├── AppLayout.tsx
│   └── Sidebar.tsx
├── contexts/                  # React Context
│   └── GatewayContext.tsx
├── hooks/                      # 跨页面复用 hook
├── routes.tsx
├── App.tsx
└── main.tsx
```

**规范：**

1. **页面入口**：`pages/<Name>/index.tsx`，routes 导入 `'./pages/<Name>'` 自动解析
2. **子组件**：只在单一页面使用的组件，放置在该页面目录下，名称与文件名相同
3. **页面内 hook**：只在单一页面使用的 hook，放置在该页面目录下（如 `Log/useLog.ts`）
4. **跨页面复用**：hook 和组件放置在 `hooks/` 和 `components/` 目录

### Tauri Commands

| Command | 描述 |
|---------|------|
| `check_node_env` | 检测 Node.js 版本、路径、npm 版本 |
| `start_openclaw` | 启动 openclaw gateway（TCP 检测端口，已运行则直接返回 URL） |
| `stop_openclaw` | 停止 openclaw gateway（执行 CLI 命令） |
| `restart_openclaw` | 重启 openclaw gateway |
| `get_openclaw_version` | 获取 openclaw 版本 |
| `get_openclaw_status` | 获取 openclaw 进程状态 |
| `check_env` | 检测 Node.js 和 OpenClaw 安装状态 |
| `read_global_config` | 读取全局配置文件 `~/.openclaw/openclaw.json` |
| `get_channels` | 获取渠道列表 |
| `export_config` | 导出 VClaw 自身配置 |
| `import_config` | 导入 VClaw 自身配置 |

### 实时日志

Rust 通过 `tauri::Emitter` 将 openclaw stdout 实时推送到前端：

```typescript
// 前端监听
import { listen } from '@tauri-apps/api/event';
listen<string>('openclaw-log', (event) => {
  console.log(event.payload);
});
```

## 设计文档

- 详细设计见 `docs/superpowers/specs/2026-04-03-VClaw-design.md`
- Gateway WebSocket 协议见 `docs/superpowers/specs/2026-04-03-gateway-chat-core-design.md`

## 工作流程

本项目使用 superpowers 和 oh-my-openagent 配合工作。

### 工具链

| 工具 | 职责 |
|------|------|
| **superpowers** | 项目专属技能和工作流（brainstorming、writing-plans、TDD 等） |
| **oh-my-openagent** | 模型编排和高效执行（Sisyphus 调度、parallel agents、ultrawork） |

### 工作流程

| 阶段 | 工具 | 触发方式 |
|------|------|---------|
| 需求分析 | superpowers brainstorming | 任务匹配时自动加载，或明确说 "用 brainstorming" |
| 方案规划 | superpowers writing-plans | 设计确认后触发 |
| 代码实现 | oh-my-openagent ultrawork | 说 "ultrawork" 或 "ulw" 激活并行执行 |
| 代码审查 | oh-my-openagent subagent | 派发独立 agent 执行 |
| 提交代码 | superpowers commit skill | 触发 Conventional Commits 格式检查 |

### 触发示例

```
帮我分析这个功能的设计         → 触发 brainstorming skill
基于 spec 写实现计划           → 触发 writing-plans skill
用 TDD 方式实现这个功能        → 触发 test-driven-development skill
开始实现 Phase 1 的任务        → 使用 ultrawork 并行执行
```

## 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <description>

feat(auth): add OAuth2 login
fix(ui): resolve button alignment
docs: update API documentation
```

类型：feat, fix, docs, style, refactor, perf, test, build, chore

**注意：** commit 时只能使用 git 配置的用户信息，不使用 Co-Authored-By。

## 代码规范

编写 React/TypeScript 代码时，调用 `superpowers:react-code-standards` skill 遵循代码规范，包括：
- React hooks 完整依赖声明
- 组件和 hook 文件组织
- TypeScript 类型规范
