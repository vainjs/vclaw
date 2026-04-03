# VClaw

基于 Tauri + React + TypeScript 的跨平台桌面客户端，封装原生 openclaw，提供对话聊天、多渠道消息聚合和简化的渠道配置。

## 核心特性

- **聊天优先界面** — 基于 @ant-design/x 的现代化对话体验
- **多渠道聚合** — 支持 Discord、Slack、Telegram、Webhook 等渠道
- **全局 openclaw** — 使用系统全局安装的 openclaw，配置在 `~/.openclaw/`
- **VClaw 数据隔离** — VClaw 自身配置存放在 `vclaw-data/` 目录

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
- openclaw (`pnpm add -g openclaw`)

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

## 架构

```
Frontend (React) ──invoke──> Rust (Tauri) ──stdin/stdout──> openclaw CLI (全局)
                                              │
                                      vclaw-data/ (VClaw 数据)
```

- `src/lib/openclaw-adapter.ts` — TypeScript 封装层
- `src/pages/` — 页面组件
- `src-tauri/src/lib.rs` — Rust Tauri 命令
