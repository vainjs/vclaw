# VClaw 日志页面设计

## Context

当前 Log.tsx 是一个空壳，`listen('openclaw-log')` 没有 Rust 端 emit，是死代码。需要同时支持两类日志：

1. **openclaw 日志** — openclaw gateway 进程输出到日志文件
2. **VClaw 自身日志** — VClaw 桌面应用的运行日志

参考 openclaw logs.ts 的交互设计（过滤、级别筛选、auto-follow）。

## 架构

```
两层日志，独立文件，独立事件，独立渲染：

openclaw 日志                              VClaw 日志
~/.openclaw/logs/*.log                   vclaw-data/logs/*.log
        ↓                                        ↓
  Rust: 文件 tail 轮询                      Rust: tracing crate
  → emit 'openclaw-log'                    → emit 'vclaw-log'
        ↓                                        ↓
  Log 页 Tab 1                             Log 页 Tab 2
```

## Rust 层改动

### VClaw 日志

添加 `tracing` + `tracing-subscriber` 依赖：
- 写文件到 `vclaw-data/logs/app.log`
- 每次写完 emit 到前端：`emit('vclaw-log', json_string)`

### openclaw 日志

Rust 侧启动一个后台线程，每 500ms tail openclaw 日志文件（读取增量内容），emit 新行到前端。

**openclaw 日志文件路径**：通过 `openclaw gateway info` 或 `~/.openclaw/` 查找。

## Log 页面组件

### 两个 Tab

| Tab 1: openclaw 日志 | Tab 2: VClaw 日志 |
|----------------------|-------------------|

### Tab 内容

每 Tab 内部：

```
┌─────────────────────────────────────────────────┐
│ [Filter 输入框............................]     │
│ [✓trace] [✓debug] [✓info] [✓warn] [✓error]  │
│ [✓ Auto-follow]                               │
├─────────────────────────────────────────────────┤
│ 10:23:45  info   [subsystem]  message text     │
│ 10:23:46  error  [subsystem]  error details    │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

### 字段

| 字段 | 说明 |
|------|------|
| time | 格式化后的时间（HH:mm:ss） |
| level | trace/debug/info/warn/error/fatal，颜色区分 |
| subsystem | 子系统名（无则空） |
| message | 日志正文 |

### 级别颜色

| level | 颜色 |
|-------|------|
| trace | #888（灰色） |
| debug | #999（浅灰） |
| info | #d4d4d4（白灰） |
| warn | #cca700（黄色） |
| error | #f48771（红色） |
| fatal | #f14747（亮红） |

## 数据结构

```typescript
interface LogEntry {
  time: string    // ISO 8601 或原始时间字符串
  level: LogLevel
  subsystem?: string
  message: string
  raw: string     // 原始行
}

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
```

## 关键文件

- `src/pages/Log.tsx` — 重写，支持双 Tab
- `src-tauri/src/lib.rs` — 添加 VClaw tracing 日志 + openclaw 文件 tail
- `src-tauri/Cargo.toml` — 添加 tracing 相关依赖
- `src/hooks/useLog.ts` — 新增，日志状态管理

## 实现步骤

1. Rust: 添加 tracing 依赖，初始化日志文件写入，emit 事件
2. Rust: 添加 openclaw 日志文件 tail 后台线程，emit 事件
3. Frontend: 新增 `useLog` hook 管理双日志列表
4. Frontend: 重写 Log.tsx 双 Tab 布局 + 过滤 + auto-follow

## 验证

1. 启动 VClaw，看 VClaw 日志 Tab 是否实时显示
2. 启动 openclaw gateway，看 openclaw 日志 Tab 是否实时显示
3. 过滤文本框输入关键词是否生效
4. 级别 chip 点击是否过滤
5. auto-follow 开关关闭后滚动不跳走
