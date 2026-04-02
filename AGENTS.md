# AGENTS.md

VClaw 项目的 AI Agent 操作指南。

## 项目概述

VClaw 是一个基于 Tauri + React + TypeScript 的跨平台桌面客户端，封装原生 openclaw，提供对话聊天、多渠道消息聚合和简化的渠道配置。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + @ant-design/x + antd
- **桌面运行时**: Tauri 2.x
- **openclaw 封装**: TypeScript Adapter (`src/lib/openclaw-adapter.ts`)
- **进程管理**: Rust (Tauri Commands)

## 关键约束

### 1. 沙箱隔离

openclaw 的所有配置和数据必须存放在 `vclaw-data/` 目录（相对于 Tauri app 根目录）。禁止读写系统或其他 openclaw 实例的配置。

### 2. 架构原则

- 前端通过 `src/lib/openclaw-adapter.ts` 与 Tauri Commands 交互
- Rust 层仅负责进程生命周期管理（spawn/kill/log streaming）
- openclaw CLI 调用和业务逻辑在 TypeScript 侧
- Rust Commands 接口保持稳定，后续可换 adapter 支持云服务

### 3. UI/UX

- 界面形态：聊天优先（ChatGPT/Claude 风格）
- 样式：简约浅色风格，基于 antd ConfigProvider 定制
- 渠道配置入口：侧边栏底部常驻「渠道」按钮

## 开发指南

### 目录结构

```
src/
├── lib/
│   └── openclaw-adapter.ts   # TS 适配器
├── components/
│   ├── ChatView.tsx          # @ant-design/x 聊天组件
│   ├── Sidebar.tsx           # 侧边栏
│   ├── ChannelPanel.tsx      # 渠道配置面板
│   ├── LogPanel.tsx          # 日志面板
│   └── SettingsPage.tsx      # 设置页
├── App.tsx                   # 根组件
└── main.tsx                  # 入口

src-tauri/
├── src/
│   └── main.rs               # Rust 命令和进程管理
└── tauri.conf.json
```

### Tauri Commands

| Command | 描述 |
|---------|------|
| `check_node_env` | 检测 Node.js 版本、路径、npm 版本 |
| `start_openclaw` | 在 vclaw-data/ 目录启动 openclaw CLI |
| `stop_openclaw` | 终止 openclaw 进程 |
| `get_channels` | 获取渠道列表 |
| `send_message` | 发送消息 |
| `export_config` | 导出配置 |
| `import_config` | 导入配置 |

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

- 详细设计见 `docs/superpowers/specs/2026-04-02-VClaw-design.md`
- 实现计划见 `docs/superpowers/plans/2026-04-02-VClaw-implementation-plan.md`

## 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <description>

feat(auth): add OAuth2 login
fix(ui): resolve button alignment
docs: update API documentation
```

类型：feat, fix, docs, style, refactor, perf, test, build, chore
