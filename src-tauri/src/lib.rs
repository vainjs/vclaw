use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{Emitter, Manager};

struct AppState {
    openclaw_process: Mutex<Option<Child>>,
    gateway_port: Mutex<Option<u16>>,
}

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

#[tauri::command]
fn start_openclaw(
    state: tauri::State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("openclaw already running".to_string());
    }

    let vclaw_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;

    let openclaw_bin = resource_dir.join("openclaw/bin/openclaw.js");

    let vclaw_data_str = vclaw_data.to_string_lossy().to_string();
    let credentials_dir = vclaw_data.join("credentials");
    let gateway_port = 18790;

    let mut cmd = if openclaw_bin.exists() {
        let mut c = Command::new("node");
        c.arg(&openclaw_bin);
        c
    } else {
        Command::new("openclaw")
    };

    cmd.current_dir(&vclaw_data)
        .env("OPENCLAW_STATE_DIR", &vclaw_data_str)
        .env(
            "OPENCLAW_OAUTH_DIR",
            credentials_dir.to_string_lossy().as_ref(),
        )
        .env("OPENCLAW_GATEWAY_PORT", gateway_port.to_string())
        .arg("gateway")
        .arg("run")
        .arg("--port")
        .arg(gateway_port.to_string())
        .arg("--log-level")
        .arg("info")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_handle_stdout = app_handle.clone();
    let app_handle_stderr = app_handle.clone();

    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_handle_stdout.emit("openclaw-log", format!("[stdout] {}", line));
                }
            }
        }
    });

    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_handle_stderr.emit("openclaw-log", format!("[stderr] {}", line));
                }
            }
        }
    });

    *guard = Some(child);

    let mut port_guard = state.gateway_port.lock().map_err(|e| e.to_string())?;
    *port_guard = Some(gateway_port);

    let gateway_url = format!("ws://127.0.0.1:{}/rpc", gateway_port);
    Ok(gateway_url)
}

#[tauri::command]
fn stop_openclaw(state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_openclaw_version() -> Result<String, String> {
    let resource_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Failed to get exe parent")?
        .to_path_buf();

    let openclaw_bin = resource_dir.join("openclaw/bin/openclaw.js");

    let output = if openclaw_bin.exists() {
        Command::new("node")
            .arg(&openclaw_bin)
            .arg("--version")
            .output()
            .map_err(|e| e.to_string())?
    } else {
        Command::new("openclaw")
            .arg("--version")
            .output()
            .map_err(|e| e.to_string())?
    };

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let version = raw
        .strip_prefix("OpenClaw ")
        .and_then(|s| s.split_whitespace().next())
        .unwrap_or(&raw);
    let version = format!("v{}", version);
    Ok(version)
}

#[tauri::command]
fn get_openclaw_status(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    let running = guard.is_some();
    let port_guard = state.gateway_port.lock().map_err(|e| e.to_string())?;
    let gateway_url = port_guard.map(|p| format!("ws://127.0.0.1:{}/rpc", p));
    Ok(serde_json::json!({
        "running": running,
        "gatewayUrl": gateway_url
    }))
}

#[tauri::command]
fn check_env() -> Result<serde_json::Value, String> {
    let node_version = Command::new("node")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;
    let node_path = Command::new("which")
        .arg("node")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;
    let npm_version = Command::new("npm")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?
        .stdout;

    let openclaw_version = Command::new("openclaw")
        .arg("--version")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let openclaw_exists = !openclaw_version.is_empty();

    Ok(serde_json::json!({
        "node": {
            "installed": true,
            "version": String::from_utf8_lossy(&node_version).trim().trim_start_matches('v').to_string(),
            "path": String::from_utf8_lossy(&node_path).trim().to_string(),
            "npmVersion": String::from_utf8_lossy(&npm_version).trim().to_string(),
        },
        "openclaw": {
            "installed": openclaw_exists,
            "version": openclaw_version.replace("OpenClaw ", ""),
        }
    }))
}

#[tauri::command]
fn check_global_config() -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let global_config_path = home.join(".openclaw");
    let config_file = global_config_path.join("openclaw.json");

    let exists = global_config_path.exists() && config_file.exists();

    let dirs_to_check = vec![
        ("openclaw.json", "配置文件"),
        ("credentials", "凭证"),
        ("extensions", "插件"),
        ("skills", "Skills"),
        ("agents", "Agent 配置"),
        ("feishu", "飞书数据"),
        ("workspace", "工作区"),
    ];

    let mut available_items = Vec::new();
    let mut channels = Vec::new();

    if exists {
        for (name, label) in &dirs_to_check {
            let path = global_config_path.join(name);
            if path.exists() {
                available_items.push(serde_json::json!({
                    "name": name,
                    "label": label,
                    "size": get_dir_size(&path)
                }));
            }
        }

        if let Ok(content) = std::fs::read_to_string(&config_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(channels_obj) = json.get("channels").and_then(|c| c.as_object()) {
                    for (key, _) in channels_obj {
                        channels.push(key.clone());
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "exists": exists,
        "path": global_config_path.to_string_lossy().to_string(),
        "availableItems": available_items,
        "channels": channels
    }))
}

fn get_dir_size(path: &PathBuf) -> u64 {
    if path.is_file() {
        return path.metadata().map(|m| m.len()).unwrap_or(0);
    }
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            size += get_dir_size(&entry.path());
        }
    }
    size
}

#[tauri::command]
async fn import_global_config(
    app_handle: tauri::AppHandle,
    items: Vec<String>,
) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let global_config_path = home.join(".openclaw");
    let global_config_file = global_config_path.join("openclaw.json");

    if !global_config_file.exists() {
        return Err("Global config does not exist".to_string());
    }

    let vclaw_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;

    let home_str = home.to_string_lossy().to_string();
    let vclaw_data_str = vclaw_data.to_string_lossy().to_string();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let global_config_path = std::path::PathBuf::from(&home_str);
        let vclaw_data = std::path::PathBuf::from(&vclaw_data_str);

        let mut copied = Vec::new();
        let mut failed = Vec::new();

        for item in &items {
            let src = global_config_path.join(item);
            let dst = vclaw_data.join(item);
            if src.exists() {
                let result = if src.is_file() {
                    std::fs::copy(&src, &dst).map(|_| ())
                } else {
                    copy_dir_recursive(&src, &dst)
                };
                match result {
                    Ok(_) => copied.push(item.clone()),
                    Err(e) => failed.push(format!("{}: {}", item, e)),
                }
            }
        }

        let message = if failed.is_empty() {
            format!("Imported: {}", copied.join(", "))
        } else {
            format!("Imported {} with errors: {:?}", copied.join(", "), failed)
        };

        Ok::<_, String>((copied, failed, message, vclaw_data_str))
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(serde_json::json!({
        "success": true,
        "localPath": result.3,
        "message": result.2,
        "copied": result.0,
        "failed": result.1
    }))
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn send_message(message: String) -> Result<serde_json::Value, String> {
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("openclaw")
            .arg("agent")
            .arg("--message")
            .arg(&message)
            .arg("--agent")
            .arg("main")
            .arg("--json")
            .output()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Agent command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse JSON: {} - stdout: {}", e, stdout))?;

    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            openclaw_process: Mutex::new(None),
            gateway_port: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            check_node_env,
            start_openclaw,
            stop_openclaw,
            get_openclaw_status,
            get_openclaw_version,
            send_message,
            check_env,
            check_global_config,
            import_global_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
