# VClaw 设计文档

**项目名称：** VClaw
**版本：** 0.1.0
**日期：** 2026-04-02
**更新：** 2026-04-02（新增 openclaw 内置和版本升级机制）

## 一、项目概述

VClaw 是一个基于 Tauri + React + TypeScript 的跨平台桌面客户端，用于封装原生 openclaw。安装即用，通过全新 UI 暴露 openclaw 的核心能力：对话聊天、多渠道消息聚合、简化的渠道配置。

**核心设计原则：**
- **一键安装即用**：VClaw 内置 openclaw，用户无需单独安装
- **版本自动管理**：检测 npm 最新版本，支持一键升级
- **沙箱隔离**：VClaw 使用独立的 `vclaw-data/` 目录存放配置和数据，与系统或其他 openclaw 实例隔离
- **可演进**：接口抽象层设计为可插拔，后续可接入云服务

## 二、技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件库 | antd（最新版本） |
| 桌面运行时 | Tauri 2.x |
| openclaw 封装层 | TypeScript Adapter（`src/lib/openclaw-adapter.ts`） |
| openclaw 进程管理 | Rust（Tauri Commands） |
| openclaw 版本管理 | Rust（Tauri Commands）+ npm registry |
| 配置存储 | 本地 JSON 文件（`vclaw-data/` 内） |
| 实时消息 | Tauri Events |
| Node.js 环境 | 复用系统 Node.js（通过 node 命令调用） |

## 三、核心架构

### 3.1 openclaw 管理策略

```
┌─────────────────────────────────────────────────────────────┐
│                    VClaw Application                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Rust Layer (Tauri Commands)                  │   │
│  │  ┌───────────────┐  ┌───────────────┐                │   │
│  │  │ Process Mgr   │  │ Version Mgr    │                │   │
│  │  │ - spawn       │  │ - get_version │                │   │
│  │  │ - kill        │  │ - check_latest│                │   │
│  │  │ - tail_logs   │  │ - upgrade     │                │   │
│  │  └───────┬───────┘  └───────┬───────┘                │   │
│  └──────────┼──────────────────┼────────────────────────┘   │
│             │                  │                            │
│  ┌──────────┼──────────────────┼────────────────────────┐   │
│  │          ▼                  ▼                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐              │   │
│  │  │  vclaw-data/   │  │  npm Registry   │              │   │
│  │  │  openclaw/     │  │  (版本检测)     │              │   │
│  │  │  (运行时目录)    │  │                 │              │   │
│  │  └─────────────────┘  └─────────────────┘              │   │
│  │         │                                               │   │
│  │         ▼                                               │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │           node openclaw.js                      │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
vclaw/
├── src/                          # 前端源码
│   ├── lib/
│   │   └── openclaw-adapter.ts   # TS 适配器
│   ├── components/                # React 组件
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── src-tauri/                    # Tauri/Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # Tauri Commands
│   │   └── openclaw_manager.rs   # openclaw 版本和进程管理
│   └── tauri.conf.json
├── resources/                    # 内置资源（首次安装用）
│   └── openclaw/                 # 内置 openclaw 包
└── vclaw-data/                   # 运行时沙箱目录
    ├── config.json               # VClaw 配置
    ├── openclaw/                 # 用户下载的 openclaw（覆盖内置）
    │   └── bin/
    │       └── openclaw.js
    ├── channels/                 # 渠道配置
    ├── logs/                     # 日志
    └── data/                     # 数据文件
```

### 3.3 启动流程

```
用户启动 VClaw
       │
       ▼
┌──────────────────┐
│ 检测 vclaw-data/ │
│   openclaw 存在? │
└────────┬─────────┘
         │
    No   │   Yes
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌────────────────────────┐
│复制内置  │  │ 检测 npm 最新版本      │
│资源到    │  │ 比较当前版本            │
│vclaw-data│  └────────┬─────────────┘
└────┬────┘           │
     │           有新版本?
     │           ┌────┴────┐
     │           ▼         ▼
     │        提示升级   使用当前版本
     │        │              │
     └────┬───┘              │
          │                  │
          ▼                  ▼
    ┌─────────────────────────────┐
    │    spawn openclaw 进程       │
    │    启动成功 → 显示主界面       │
    └─────────────────────────────┘
```

### 3.4 版本升级流程

```
┌─────────────────┐
│ 用户点击"检查更新"│
└────────┬────────┘
         ▼
┌─────────────────┐
│ 请求 npm registry│
│ 获取 openclaw   │
│ 最新版本号       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 比较内置版本 vs  │
│ npm 最新版本    │
└────────┬────────┘
         │
    内置版本 < 最新
         │
         ▼
┌─────────────────┐
│ 显示更新提示    │
│ "发现新版本 X.X" │
└────────┬────────┘
         │
    用户确认升级
         │
         ▼
┌─────────────────────────┐
│ npm pack openclaw@latest │
│ 解压到 vclaw-data/openclaw│
└────────┬──────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 重启 openclaw 进程       │
│ 使用新版本              │
└─────────────────────────┘
```

## 四、Rust Commands 设计

| Command | 描述 |
|---------|------|
| `get_node_env` | 获取 Node.js 环境信息 |
| `get_openclaw_version` | 获取当前 openclaw 版本 |
| `check_openclaw_update` | 检查 npm 最新版本 |
| `upgrade_openclaw` | 升级到最新版本 |
| `start_openclaw` | 启动 openclaw 进程 |
| `stop_openclaw` | 停止 openclaw 进程 |
| `send_message` | 发送消息（预留） |
| `get_channels` | 获取渠道列表（预留） |

## 五、前端组件

| 组件 | 职责 |
|------|------|
| `App.tsx` | 根组件，布局容器 |
| `ChatView` | 对话界面（antd List + Input 实现） |
| `Sidebar` | 左侧边栏（渠道切换） |
| `ChannelPanel` | 渠道配置面板 |
| `SettingsPage` | 设置页（版本信息、检查更新） |

## 六、样式

简约浅色风格（基于 antd ConfigProvider）：
- 白色/浅灰背景
- 干净线条，无多余装饰
- 参考 ChatGPT/Claude 的简洁对话体验

## 七、沙箱隔离

openclaw 支持通过环境变量指定目录，实现完全隔离：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `OPENCLAW_STATE_DIR` | `~/.openclaw/` | 状态目录（sessions、logs、cache） |
| `OPENCLAW_CONFIG_PATH` | `$STATE_DIR/openclaw.json` | 配置文件路径 |
| `OPENCLAW_OAUTH_DIR` | `$STATE_DIR/credentials/` | OAuth 凭证目录 |

**启动命令：**

```bash
OPENCLAW_STATE_DIR=/path/to/vclaw-data \
OPENCLAW_OAUTH_DIR=/path/to/vclaw-data/credentials \
node /path/to/vclaw-data/openclaw/bin/openclaw.js
```

**效果：**
- openclaw 所有数据写入 `vclaw-data/` 目录
- 不读写 `~/.openclaw/` 等系统目录
- 与系统或其他 openclaw 实例完全隔离

**目录结构：**

```
vclaw-data/                    # 沙箱根目录
├── openclaw.json              # 配置文件
├── credentials/               # OAuth 凭证
├── agents/                    # Agent 配置
├── sessions/                  # 会话数据
├── logs/                     # 日志
├── cache/                    # 缓存
└── workspace/                 # 工作区
```

## 八、验收标准

1. 用户安装 VClaw 后，无需额外操作即可使用 openclaw
2. VClaw 启动时自动检测并显示当前 openclaw 版本
3. VClaw 可检查 npm 最新版本，提示用户升级
4. 用户可一键升级 openclaw 到最新版本
5. openclaw 所有数据严格限制在 `vclaw-data/` 目录内
6. UI 为简约浅色风格，聊天优先界面

## 九、待确定事项

- openclaw CLI 的具体接口（send_message、get_channels 等的参数和返回值格式）
- openclaw 日志输出格式
- 渠道配置的 JSON Schema

以上接口待 openclaw 提供方确认后补充到本文档。
