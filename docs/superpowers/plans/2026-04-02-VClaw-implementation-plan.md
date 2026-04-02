# VClaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VClaw desktop client that wraps openclaw with chat UI (ant-design/x) and sandboxed process management

**Architecture:** Tauri + React + TypeScript + @ant-design/x, openclaw CLI spawned as child process in `vclaw-data/` sandbox

**Tech Stack:** Tauri 2.x, React 19, TypeScript, @ant-design/x, antd, Vite

---

## Phase 1: Core MVP — Run openclaw CLI and basic chat

### File Structure

```
src/
├── lib/
│   └── openclaw-adapter.ts     # TS wrapper for openclaw CLI via Tauri invoke
├── components/
│   ├── ChatView.tsx            # @ant-design/x Chat component
│   └── Sidebar.tsx            # Simple sidebar with channel list
├── App.tsx                    # Layout with antd ConfigProvider
└── main.tsx                   # Entry point

src-tauri/
├── src/
│   └── main.rs                # Tauri commands: check_node_env, start/stop openclaw
└── tauri.conf.json            # Permissions for process spawn, events
```

### Task 1: Install antd and @ant-design/x

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install antd and @ant-design/x**

```bash
npm install antd @ant-design/x
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json && git commit -m "deps: install antd and @ant-design/x"
```

---

### Task 2: Configure antd theme

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add antd ConfigProvider with light theme**

```tsx
import { ConfigProvider } from 'antd';
import App from './App';

root.render(
  <ConfigProvider theme={{ algorithm: 'default' }}>
    <App />
  </ConfigProvider>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx && git commit -m "feat: add antd ConfigProvider with light theme"
```

---

### Task 3: Rust — check node environment command

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add check_node_env command to main.rs**

```rust
#[tauri::command]
fn check_node_env() -> Result<serde_json::Value, String> {
    let node_version = std::process::Command::new("node")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;
    let node_path = std::process::Command::new("which")
        .arg("node")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;
    let npm_version = std::process::Command::new("npm")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;

    Ok(serde_json::json!({
        "nodeVersion": String::from_utf8_lossy(&node_version).trim().to_string(),
        "nodePath": String::from_utf8_lossy(&node_path).trim().to_string(),
        "npmVersion": String::from_utf8_lossy(&npm_version).trim().to_string(),
    }))
}
```

- [ ] **Step 2: Add to tauri::generate_handler! macro**

```rust
#[cfg_attr(mobile, tauri::generate_handler)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_node_env])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs && git commit -m "feat: add check_node_env tauri command"
```

---

### Task 4: Rust — spawn and manage openclaw process

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add process management state and commands**

```rust
use std::process::Child;
use std::sync::Mutex;

struct AppState {
    openclaw_process: Mutex<Option<Child>>,
}

#[tauri::command]
fn start_openclaw(state: tauri::State<AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("openclaw already running".to_string());
    }

    let vclaw_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;

    let child = std::process::Command::new("openclaw")
        .current_dir(&vclaw_data)
        .spawn()
        .map_err(|e| e.to_string())?;

    *guard = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_openclaw(state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

- [ ] **Step 2: Update tauri builder to include state**

```rust
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { openclaw_process: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![check_node_env, start_openclaw, stop_openclaw])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs && git commit -m "feat: add openclaw process spawn/stop commands"
```

---

### Task 5: TypeScript adapter for openclaw CLI

**Files:**
- Create: `src/lib/openclaw-adapter.ts`

- [ ] **Step 1: Create TS adapter**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface NodeEnv {
  nodeVersion: string;
  nodePath: string;
  npmVersion: string;
}

export async function checkNodeEnv(): Promise<NodeEnv> {
  return invoke<NodeEnv>('check_node_env');
}

export async function startOpenClaw(): Promise<void> {
  return invoke('start_openclaw');
}

export async function stopOpenClaw(): Promise<void> {
  return invoke('stop_openclaw');
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
}

export async function sendMessage(channel: string, content: string): Promise<Message> {
  return invoke<Message>('send_message', { channel, content });
}

export async function getChannels(): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openclaw-adapter.ts && git commit -m "feat: add TypeScript openclaw adapter"
```

---

### Task 6: Basic layout — App.tsx with sidebar and chat area

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create basic layout with antd Layout component**

```tsx
import { Layout, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { checkNodeEnv, NodeEnv } from './lib/openclaw-adapter';
import ChatView from './components/ChatView';
import Sidebar from './components/Sidebar';

const { Sider, Content } = Layout;
const { Text } = Typography;

function App() {
  const [nodeEnv, setNodeEnv] = useState<NodeEnv | null>(null);

  useEffect(() => {
    checkNodeEnv().then(setNodeEnv).catch(console.error);
  }, []);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={260} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Text strong>VClaw</Text>
          {nodeEnv && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Node: {nodeEnv.nodeVersion}
            </Text>
          )}
        </div>
        <Sidebar />
      </Sider>
      <Content style={{ background: '#fff' }}>
        <ChatView />
      </Content>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 2: Update App.css with minimal styles**

```css
#root {
  height: 100vh;
  overflow: hidden;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/App.css && git commit -m "feat: add basic layout with sidebar and chat area"
```

---

### Task 7: ChatView component with @ant-design/x

**Files:**
- Create: `src/components/ChatView.tsx`

- [ ] **Step 1: Create ChatView with @ant-design/x Chat component**

```tsx
import { Chat } from '@ant-design/x';
import { useState } from 'react';

const mockMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }> = [];

export default function ChatView() {
  const [messages, setMessages] = useState(mockMessages);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ fontWeight: 500 }}>Chat</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Chat
          messages={messages}
          onSend={(content) => {
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), role: 'user', content },
            ]);
          }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChatView.tsx && git commit -m "feat: add ChatView with @ant-design/x"
```

---

### Task 8: Sidebar component with channel list

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar with channel list**

```tsx
import { List, Typography, Badge } from 'antd';
import { useState } from 'react';

const { Text } = Typography;

const mockChannels = [
  { id: '1', name: 'general', type: 'discord' },
  { id: '2', name: 'support', type: 'slack' },
];

export default function Sidebar() {
  const [channels] = useState(mockChannels);
  const [activeId, setActiveId] = useState<string>('1');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <Text type="secondary" style={{ fontSize: 12, padding: '8px' }}>
          Channels
        </Text>
        <List
          dataSource={channels}
          renderItem={(channel) => (
            <List.Item
              onClick={() => setActiveId(channel.id)}
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                background: activeId === channel.id ? '#f0f0f0' : 'transparent',
                padding: '8px 12px',
              }}
            >
              <Badge color={channel.type === 'discord' ? '#7289da' : '#4a154b'} />
              <Text style={{ marginLeft: 8 }}>{channel.name}</Text>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx && git commit -m "feat: add Sidebar with channel list"
```

---

### Task 9: Verify Phase 1 builds and runs

- [ ] **Step 1: Build the app**

```bash
npm run build
```

Expected: Build succeeds without errors

- [ ] **Step 2: Verify tauri dev runs**

```bash
npm run tauri dev
```

Expected: Tauri window opens, Node version displayed in sidebar

- [ ] **Step 3: Commit Phase 1 completion**

```bash
git add -A && git commit -m "phase1: core MVP - chat UI and process management"
```

---

## Phase 2: Full Features — Channels, config, real-time logs

### Task 10: Rust — get_channels and send_message commands

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add get_channels command**

```rust
#[tauri::command]
fn get_channels() -> Result<Vec<serde_json::Value>, String> {
    let vclaw_data = dirs::data_dir()
        .ok_or("failed to get data dir")?
        .join("vclaw");
    let channels_dir = vclaw_data.join("channels");
    
    if !channels_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut channels = vec![];
    for entry in std::fs::read_dir(channels_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            channels.push(serde_json::json!({
                "id": name,
                "name": name,
                "type": "channel"
            }));
        }
    }
    Ok(channels)
}
```

- [ ] **Step 2: Add send_message command (placeholder that writes to stdout)**

```rust
#[tauri::command]
fn send_message(channel: String, content: String) -> Result<serde_json::Value, String> {
    println!("[VCLAW] channel={} content={}", channel, content);
    Ok(serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "role": "assistant",
        "content": format!("Echo: {}", content),
        "timestamp": chrono::Utc::now().timestamp_millis()
    }))
}
```

- [ ] **Step 3: Add uuid and chrono to Cargo.toml dependencies**

```toml
uuid = { version = "0.8", features = ["v4"] }
chrono = "0.4"
dirs = "5"
```

- [ ] **Step 4: Update generate_handler**

```rust
.invoke_handler(tauri::generate_handler![
    check_node_env,
    start_openclaw,
    stop_openclaw,
    get_channels,
    send_message
])
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/Cargo.toml && git commit -m "feat: add get_channels and send_message commands"
```

---

### Task 11: Update TS adapter with real commands

**Files:**
- Modify: `src/lib/openclaw-adapter.ts`

- [ ] **Step 1: Update sendMessage and getChannels implementations**

```typescript
export async function sendMessage(channel: string, content: string): Promise<Message> {
  return invoke<Message>('send_message', { channel, content });
}

export async function getChannels(): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openclaw-adapter.ts && git commit -m "feat: wire up sendMessage and getChannels in adapter"
```

---

### Task 12: ChannelPanel component for channel configuration

**Files:**
- Create: `src/components/ChannelPanel.tsx`

- [ ] **Step 1: Create ChannelPanel with antd Form for channel config**

```tsx
import { Form, Input, Select, Button, Space } from 'antd';
import { useState } from 'react';

interface ChannelConfig {
  name: string;
  type: string;
  token?: string;
  webhookUrl?: string;
}

export default function ChannelPanel() {
  const [form] = Form.useForm<ChannelConfig>();

  const handleAddChannel = (values: ChannelConfig) => {
    console.log('Add channel:', values);
  };

  return (
    <div style={{ padding: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleAddChannel}>
        <Form.Item name="name" label="Channel Name" rules={[{ required: true }]}>
          <Input placeholder="e.g. general" />
        </Form.Item>
        <Form.Item name="type" label="Channel Type" rules={[{ required: true }]}>
          <Select placeholder="Select type">
            <Select.Option value="discord">Discord</Select.Option>
            <Select.Option value="slack">Slack</Select.Option>
            <Select.Option value="telegram">Telegram</Select.Option>
            <Select.Option value="webhook">Webhook</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="token" label="Token (optional)">
          <Input.Password placeholder="Bot token" />
        </Form.Item>
        <Form.Item name="webhookUrl" label="Webhook URL (optional)">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add Channel</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChannelPanel.tsx && git commit -m "feat: add ChannelPanel for channel configuration"
```

---

### Task 13: Rust — real-time log streaming via Tauri events

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add log streaming with Tauri event emitter**

```rust
use tauri::{Emitter, AppHandle};

fn start_log_stream(app_handle: AppHandle, child_stdout: std::process::ChildStdout) {
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(child_stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_handle.emit("openclaw-log", line);
            }
        }
    });
}
```

- [ ] **Step 2: Modify start_openclaw to capture stdout and emit logs**

```rust
#[tauri::command]
fn start_openclaw(state: tauri::State<AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("openclaw already running".to_string());
    }

    let vclaw_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;

    let mut child = std::process::Command::new("openclaw")
        .current_dir(&vclaw_data)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("failed to capture stdout")?;
    start_log_stream(app_handle.clone(), stdout);

    *guard = Some(child);
    Ok(())
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs && git commit -m "feat: add real-time log streaming via Tauri events"
```

---

### Task 14: LogPanel component to display streamed logs

**Files:**
- Create: `src/components/LogPanel.tsx`

- [ ] **Step 1: Create LogPanel that listens to Tauri event**

```tsx
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Typography, AutoComplete } from 'antd';

const { Text } = Typography;

export default function LogPanel() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const unlisten = listen<string>('openclaw-log', (event) => {
      setLogs((prev) => [...prev.slice(-100), event.payload]);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <div style={{ height: 200, overflow: 'auto', background: '#1e1e1e', padding: 8 }}>
      {logs.map((log, i) => (
        <Text key={i} style={{ color: '#d4d4d4', fontFamily: 'monospace', fontSize: 12, display: 'block' }}>
          {log}
        </Text>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LogPanel.tsx && git commit -m "feat: add LogPanel for real-time log display"
```

---

### Task 15: Integrate ChatView with openclaw-adapter

**Files:**
- Modify: `src/components/ChatView.tsx`

- [ ] **Step 1: Wire ChatView to sendMessage via adapter**

```tsx
import { Chat } from '@ant-design/x';
import { useState, useEffect } from 'react';
import { sendMessage, getChannels, Message } from '../lib/openclaw-adapter';

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannel] = useState('general');

  useEffect(() => {
    getChannels().then((channels) => {
      if (channels.length > 0) {
        // Load conversation history
      }
    }).catch(console.error);
  }, [activeChannel]);

  const handleSend = async (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content, timestamp: Date.now() },
    ]);
    try {
      const response = await sendMessage(activeChannel, content);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ fontWeight: 500 }}>Chat</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Chat
          messages={messages}
          onSend={handleSend}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChatView.tsx && git commit -m "feat: wire ChatView to openclaw adapter"
```

---

### Task 16: Verify Phase 2 builds and runs

- [ ] **Step 1: Build the app**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 2: Test start/stop openclaw**

```bash
npm run tauri dev
```

Expected: openclaw process starts, logs stream to LogPanel

- [ ] **Step 3: Test send message**

Expected: Message appears in ChatView, response echoed back

- [ ] **Step 4: Commit Phase 2 completion**

```bash
git add -A && git commit -m "phase2: full features - channels, config, real-time logs"
```

---

## Phase 3: Polish — Error handling, settings, export/import

### Task 17: Error handling for Rust commands

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add proper error handling with Result types**

Every command already returns `Result<T, String>`. Ensure all `.map_err(|e| e.to_string())?` are present and meaningful error messages are returned.

- [ ] **Step 2: Add command to check openclaw availability**

```rust
#[tauri::command]
fn check_openclaw_available() -> Result<bool, String> {
    std::process::Command::new("openclaw")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs && git commit -m "feat: add openclaw availability check and error handling"
```

---

### Task 18: Settings page with Node.js info display

**Files:**
- Create: `src/components/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage component**

```tsx
import { Card, Descriptions, Button, Space, message } from 'antd';
import { checkNodeEnv, startOpenClaw, stopOpenClaw } from '../lib/openclaw-adapter';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [nodeEnv, setNodeEnv] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    checkNodeEnv().then(setNodeEnv).catch(console.error);
  }, []);

  const handleStart = async () => {
    try {
      await startOpenClaw();
      setIsRunning(true);
      message.success('openclaw started');
    } catch (err) {
      message.error('Failed to start openclaw');
    }
  };

  const handleStop = async () => {
    try {
      await stopOpenClaw();
      setIsRunning(false);
      message.success('openclaw stopped');
    } catch (err) {
      message.error('Failed to stop openclaw');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="Environment">
        <Descriptions column={1}>
          <Descriptions.Item label="Node.js Version">{nodeEnv?.nodeVersion}</Descriptions.Item>
          <Descriptions.Item label="Node.js Path">{nodeEnv?.nodePath}</Descriptions.Item>
          <Descriptions.Item label="npm Version">{nodeEnv?.npmVersion}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="openclaw Process" style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" onClick={handleStart} disabled={isRunning}>Start</Button>
          <Button onClick={handleStop} disabled={!isRunning}>Stop</Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          Status: {isRunning ? 'Running' : 'Stopped'}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsPage.tsx && git commit -m "feat: add SettingsPage with environment info and process controls"
```

---

### Task 19: Export/Import configuration

**Files:**
- Modify: `src-tauri/src/main.rs`
- Create: `src/lib/config-manager.ts`

- [ ] **Step 1: Add Rust commands for config export/import**

```rust
#[tauri::command]
fn export_config(app_handle: tauri::AppHandle) -> Result<String, String> {
    let vclaw_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = vclaw_data.join("config.json");
    if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn import_config(app_handle: tauri::AppHandle, config: String) -> Result<(), String> {
    let vclaw_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;
    let config_path = vclaw_data.join("config.json");
    std::fs::write(&config_path, config).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Add TS wrapper in config-manager.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function exportConfig(): Promise<string> {
  return invoke<string>('export_config');
}

export async function importConfig(config: string): Promise<void> {
  return invoke('import_config', { config });
}
```

- [ ] **Step 3: Update SettingsPage with export/import buttons**

```tsx
import { exportConfig, importConfig } from '../lib/config-manager';

const handleExport = async () => {
  const config = await exportConfig();
  // Download as file
};

const handleImport = async () => {
  // Read from file input
};
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs src/lib/config-manager.ts src/components/SettingsPage.tsx && git commit -m "feat: add config export/import functionality"
```

---

### Task 20: Final verification and cleanup

- [ ] **Step 1: Run full build**

```bash
npm run build && npm run tauri build
```

Expected: Both succeed

- [ ] **Step 2: Verify all features work**

- [ ] **Step 3: Commit Phase 3 completion**

```bash
git add -A && git commit -m "phase3: polish - error handling, settings, export/import"
```

- [ ] **Step 4: Tag release**

```bash
git tag v0.1.0 && git push origin main --tags
```

---

## Spec Coverage Check

| Spec Section | Task |
|--------------|------|
| Tauri + React + TS | Tasks 1-9 (Phase 1) |
| @ant-design/x + antd | Tasks 1, 6, 7, 12, 14 |
| TS Adapter | Tasks 5, 11, 15 |
| Rust process management | Tasks 3, 4, 10, 13 |
| check_node_env | Tasks 3 |
| start/stop openclaw | Tasks 4, 10 |
| ChatView | Tasks 7, 15 |
| Sidebar | Tasks 6, 8 |
| ChannelPanel | Tasks 12 |
| LogPanel | Task 14 |
| Real-time logs | Tasks 13, 14 |
| Settings | Task 18 |
| Export/Import | Task 19 |
| Node.js detection | Tasks 3, 6 |
| Sandboxed vclaw-data/ | Tasks 4, 10 |

All spec requirements covered.
