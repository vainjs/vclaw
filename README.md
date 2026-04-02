# VClaw

基于 Tauri + React + TypeScript 的跨平台桌面客户端，封装原生 openclaw，提供对话聊天、多渠道消息聚合和简化的渠道配置。

## 核心特性

- **聊天优先界面** — 基于 @ant-design/x 的现代化对话体验
- **多渠道聚合** — 支持 Discord、Slack、Telegram、Webhook 等渠道
- **沙箱隔离** — 所有配置和数据存放在独立的 `vclaw-data/` 目录
- **开箱即用** — 安装即可使用，无需复杂配置

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件库 | @ant-design/x + antd |
| 桌面运行时 | Tauri 2.x |
| 进程管理 | Rust (Tauri Commands) |

## 快速开始

### 环境要求

- Node.js 18+
- Rust 1.70+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建

```bash
npm run build
npm run tauri build
```

## 架构

```
Frontend (React) ──invoke──> Rust (Tauri) ──stdin/stdout──> openclaw CLI
                                              │
                                      vclaw-data/ (沙箱目录)
```

- `src/lib/openclaw-adapter.ts` — TypeScript 封装层
- `src/components/` — React 组件
- `src-tauri/src/main.rs` — Rust Tauri 命令

## 许可证

MIT
