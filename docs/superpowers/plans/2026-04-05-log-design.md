# VClaw 日志页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 Log 页面，支持双 Tab（openclaw 日志 / VClaw 日志），实现文本过滤、级别过滤、auto-follow 追踪。

**Architecture:** Rust 侧初始化 tracing 写文件 + 后台线程 tail openclaw 日志文件，前端通过 Tauri 事件接收并渲染。

**Tech Stack:** Rust tracing-subscriber + tracing-appender, Tauri event emit, React hooks, antd components.

---

## 文件结构

```
Modified:
- src-tauri/Cargo.toml          新增 tracing-subscriber, tracing-appender 依赖
- src-tauri/src/lib.rs          初始化日志系统 + openclaw 文件 tail 线程 + emit 事件
- src/pages/Log.tsx             重写，双 Tab + 过滤 + auto-follow
- src/hooks/useLog.ts           新建，日志状态管理 hook

依赖已具备 (Cargo.lock 中已有 tracing/tracing-core):
- src/lib/openclaw-adapter.ts   已有 getOpenClawStatus, 无需改动
```

---

## 实现任务

### Task 1: Rust - 添加 tracing 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 添加依赖**

```toml
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
```

Run: `cd src-tauri && cargo build --release` 验证编译

---

### Task 2: Rust - 初始化 VClaw tracing 日志系统

**Files:**
- Modify: `src-tauri/src/lib.rs` (在 `run()` 函数中初始化)
- Modify: `src-tauri/src/lib.rs` (添加 `init_logging()` 函数)

**关键点:**
- `tracing_appender::rolling::RollingFileAppender` 写入 `vclaw-data/logs/app.log`
- `tracing_subscriber::fmt::layer()` 配合 subscriber
- 每条日志 emit 到前端: `app_handle.emit("vclaw-log", json_entry)`
- JSON 格式: `{"time":"...","level":"info","message":"...","raw":"..."}`

- [ ] **Step 1: 添加 init_logging 函数**

在 lib.rs 顶部添加:
```rust
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
```

在 `run()` 中调用 `init_logging(app_handle.clone())`。

- [ ] **Step 2: 实现 init_logging**

```rust
fn init_logging(app_handle: tauri::AppHandle) {
    let log_dir = app_handle.path().app_data_dir().unwrap().join("logs");
    std::fs::create_dir_all(&log_dir).ok();

    let file_appender = RollingFileAppender::new(Rotation::DAILY, &log_dir, "app.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .init();

    tracing::info!("VClaw logging initialized");
}
```

- [ ] **Step 3: 保存 guard 防止 drop**

在 `AppState` 中添加 `log_guard: Mutex<Option<tracing_appender::non_blocking::WorkerGuard>>`。

- [ ] **Step 4: 编译验证**

Run: `cd src-tauri && cargo build --release 2>&1 | tail -10`

Expected: 编译成功（可能有 unused warning，无 error）

---

### Task 3: Rust - openclaw 日志文件 tail 后台线程

**Files:**
- Modify: `src-tauri/src/lib.rs` (在 `run()` 中启动 tail 线程)
- Modify: `src-tauri/src/lib.rs` (添加 `start_openclaw_log_tail()` 函数)

**关键点:**
- openclaw 日志目录: `~/.openclaw/logs/`
- 后台线程每 500ms 读取文件增量内容（记住上次读取位置）
- 每行 emit 到前端: `app_handle.emit("openclaw-log", json_entry)`
- JSON 格式: `{"time":"...","level":"info","subsystem":"...","message":"...","raw":"..."}`

- [ ] **Step 1: 添加 openclaw 日志文件查找逻辑**

```rust
fn get_openclaw_log_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".openclaw").join("logs"))
}
```

- [ ] **Step 2: 实现 tail 函数**

```rust
fn start_openclaw_log_tail(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let log_dir = get_openclaw_log_dir()?;
        let mut positions: std::collections::HashMap<_, u64> = std::collections::HashMap::new();
        loop {
            if let Ok(entries) = std::fs::read_dir(&log_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if path.extension().map_or(false, |e| e == "log") {
                        let pos = positions.entry(path.clone()).or_insert(0);
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            let new_content: String = content.chars().skip(*pos as usize).collect();
                            for line in new_content.lines() {
                                if !line.trim().is_empty() {
                                    let entry = parse_log_line(line);
                                    let _ = app_handle.emit("openclaw-log", serde_json::json!(entry));
                                }
                            }
                            *pos = content.len() as u64;
                        }
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}
```

- [ ] **Step 3: 添加 parse_log_line 函数**

解析一行日志为 `{"time","level","subsystem","message","raw"}`。按 `[2026-04-05 10:23:45]` 或类似格式解析时间，提取 level（括号内或方括号前缀）。

- [ ] **Step 4: 在 `run()` 中启动线程**

```rust
start_openclaw_log_tail(app_handle.clone());
```

- [ ] **Step 5: 编译验证**

Run: `cd src-tauri && cargo build --release 2>&1 | tail -10`

---

### Task 4: Frontend - useLog hook

**Files:**
- Create: `src/hooks/useLog.ts`

```typescript
import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'

export interface LogEntry {
  time: string
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  subsystem?: string
  message: string
  raw: string
}

export function useLog(channel: 'openclaw' | 'vclaw') {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [autoFollow, setAutoFollow] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [levelFilters, setLevelFilters] = useState<Record<string, boolean>>({
    trace: true, debug: true, info: true, warn: true, error: true, fatal: true,
  })

  useEffect(() => {
    const unlistenPromise = listen<LogEntry>(`${channel}-log`, (event) => {
      setEntries((prev) => [...prev.slice(-500), event.payload])
    })
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [channel])

  const toggleLevel = (level: string) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  const filtered = entries.filter((e) => {
    if (!levelFilters[e.level]) return false
    if (filterText) {
      const haystack = [e.message, e.subsystem, e.raw].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(filterText.toLowerCase())) return false
    }
    return true
  })

  return { entries, filtered, autoFollow, setAutoFollow, filterText, setFilterText, levelFilters, toggleLevel }
}
```

- [ ] **Step 1: 创建文件**

Write `src/hooks/useLog.ts` with the code above.

---

### Task 5: Frontend - 重写 Log.tsx

**Files:**
- Modify: `src/pages/Log.tsx`

**关键点:**
- antd `Tabs` 组件，两个 Tab
- 每个 Tab: Filter 输入框 + Level chips + Auto-follow Checkbox + 日志列表
- 日志行: time(灰) level(彩) subsystem(灰) message(白)
- 容器 div ref，autoFollow=true 时每次 entries 变化滚动到底部
- autoFollow=false 时用户可自由滚动

- [ ] **Step 1: 重写 Log.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { Tabs, Input, Checkbox, Tag } from 'antd'
import { useLog } from '../hooks/useLog'

const LEVEL_COLORS: Record<string, string> = {
  trace: '#888', debug: '#999', info: '#d4d4d4', warn: '#cca700', error: '#f48771', fatal: '#f14747',
}
const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

function LogTab({ channel }: { channel: 'openclaw' | 'vclaw' }) {
  const { filtered, autoFollow, setAutoFollow, filterText, setFilterText, levelFilters, toggleLevel } = useLog(channel)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFollow && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filtered.length, autoFollow])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Input
          placeholder="Filter logs..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ width: 220 }}
        />
        <Checkbox checked={autoFollow} onChange={(e) => setAutoFollow(e.target.checked)}>
          Auto-follow
        </Checkbox>
        {LEVELS.map((level) => (
          <Tag
            key={level}
            color={levelFilters[level] ? LEVEL_COLORS[level] : '#333'}
            style={{ cursor: 'pointer', color: levelFilters[level] ? '#fff' : '#666' }}
            onClick={() => toggleLevel(level)}
          >
            {level}
          </Tag>
        ))}
      </div>
      <div
        ref={containerRef}
        style={{
          height: 400,
          overflow: 'auto',
          background: '#1e1e1e',
          padding: 8,
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ color: '#666', padding: 12 }}>No log entries.</div>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} style={{ lineHeight: 1.6, color: LEVEL_COLORS[entry.level] ?? '#d4d4d4' }}>
              <span style={{ color: '#666', marginRight: 8 }}>{entry.time}</span>
              <span style={{ marginRight: 8 }}>[{entry.level}]</span>
              {entry.subsystem && <span style={{ color: '#888', marginRight: 8 }}>[{entry.subsystem}]</span>}
              <span>{entry.message || entry.raw}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Log() {
  return (
    <Tabs
      items={[
        { key: 'openclaw', label: 'openclaw 日志', children: <LogTab channel="openclaw" /> },
        { key: 'vclaw', label: 'VClaw 日志', children: <LogTab channel="vclaw" /> },
      ]}
    />
  )
}
```

---

## 验证步骤

1. **编译 Rust**: `cd src-tauri && cargo build --release 2>&1 | tail -5`
   - Expected: `Finished release profile`

2. **启动 VClaw**: 启动应用，进入日志页
   - VClaw 日志 Tab 应实时显示 "VClaw logging initialized"
   - openclaw 日志 Tab 应等待 openclaw gateway 启动后才开始显示日志

3. **测试过滤**: 在 Filter 输入框输入关键词，日志列表应实时过滤

4. **测试级别过滤**: 点击某个 Level Tag 取消选中，列表应过滤掉该级别

5. **测试 auto-follow**: 关闭 Auto-follow checkbox 后滚动列表，列表不应自动跳到最底部

---

## 自检清单

- [ ] `tracing-subscriber` 和 `tracing-appender` 已在 Cargo.toml 中添加
- [ ] `init_logging()` 在 `run()` 中调用，log guard 保存在 AppState
- [ ] `start_openclaw_log_tail()` 在 `run()` 中调用，后台线程每 500ms tail ~/.openclaw/logs/*.log
- [ ] `emit("vclaw-log", ...)` 和 `emit("openclaw-log", ...)` 在 Rust 侧正确 emit
- [ ] `useLog` hook 正确 listen 两个事件 channel
- [ ] `Log.tsx` 有两个 Tab，每个 Tab 有 filter + level chips + auto-follow
- [ ] auto-follow=true 时滚动到底部，=false 时保持用户滚动位置
