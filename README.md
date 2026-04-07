# VClaw

基于 Tauri + React + TypeScript 的跨平台桌面客户端，封装原生 openclaw，提供对话聊天、日志查看和配置管理功能。

## 核心特性

- **聊天优先界面** — 基于 @ant-design/x 的现代化对话体验，支持 markdown、头像、流式输出
- **实时日志** — 查看 openclaw gateway 运行日志，支持级别过滤和关键词搜索
- **网关管理** — 图形化启停 openclaw gateway，查看连接状态
- **配置查看** — 直接浏览 `~/.openclaw/openclaw.json` 内容

## 技术栈

| 层级       | 技术                         |
| ---------- | ---------------------------- |
| 前端框架   | React 19 + TypeScript + Vite |
| UI 组件库  | @ant-design/x + antd         |
| 桌面运行时 | Tauri 2.x                    |
| 进程管理   | Rust (Tauri Commands)        |

## 快速开始

### 环境要求

- Node.js 18+
- Rust 1.70+
- pnpm (`npm install -g pnpm`)
- openclaw (`npm install -g openclaw`)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm run tauri dev
```

### 构建

```bash
pnpm run build
pnpm run tauri build
```
