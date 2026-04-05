use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

// AppState kept for backward compatibility with invoke_handler, but no longer tracks child process
struct AppState {
    _placeholder: Mutex<Option<()>>,
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

const GATEWAY_PORT: u16 = 18789;

fn is_gateway_running() -> bool {
    std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], GATEWAY_PORT)),
        std::time::Duration::from_millis(500),
    )
    .is_ok()
}

#[tauri::command]
async fn start_openclaw() -> Result<String, String> {
    use futures_channel::oneshot;
    if is_gateway_running() {
        return Ok(format!("ws://127.0.0.1:{}", GATEWAY_PORT));
    }
    let output = Command::new("openclaw")
        .args(["gateway", "start"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    // Wait for server to be ready in background thread (up to 10s)
    let (tx, rx): (futures_channel::oneshot::Sender<Result<(), String>>, _) = oneshot::channel();
    std::thread::spawn(move || {
        let start = std::time::Instant::now();
        while start.elapsed().as_secs() < 10 {
            if std::net::TcpStream::connect_timeout(
                &std::net::SocketAddr::from(([127, 0, 0, 1], GATEWAY_PORT)),
                std::time::Duration::from_millis(50),
            )
            .is_ok()
            {
                let _ = tx.send(Ok(()));
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        let _ = tx.send(Err("gateway start timeout".to_string()));
    });
    let _ = match rx.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(e.to_string()),
    }?;
    Ok(format!("ws://127.0.0.1:{}", GATEWAY_PORT))
}

#[tauri::command]
async fn stop_openclaw() -> Result<(), String> {
    use futures_channel::oneshot;
    let output = Command::new("openclaw")
        .args(["gateway", "stop"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    // Wait for server to actually stop (up to 10s)
    let (tx, rx): (futures_channel::oneshot::Sender<Result<(), String>>, _) = oneshot::channel();
    std::thread::spawn(move || {
        let start = std::time::Instant::now();
        while start.elapsed().as_secs() < 10 {
            if !std::net::TcpStream::connect_timeout(
                &std::net::SocketAddr::from(([127, 0, 0, 1], GATEWAY_PORT)),
                std::time::Duration::from_millis(50),
            )
            .is_ok()
            {
                let _ = tx.send(Ok(()));
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        let _ = tx.send(Err("gateway stop timeout".to_string()));
    });
    let _ = match rx.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(e.to_string()),
    }?;
    Ok(())
}

#[tauri::command]
fn restart_openclaw() -> Result<String, String> {
    let output = Command::new("openclaw")
        .args(["gateway", "restart"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(format!("ws://127.0.0.1:{}", GATEWAY_PORT))
}

#[tauri::command]
fn get_openclaw_version() -> Result<String, String> {
    let output = Command::new("openclaw")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let version = raw
        .strip_prefix("OpenClaw ")
        .and_then(|s| s.split_whitespace().next())
        .unwrap_or(&raw);
    let version = format!("v{}", version);
    Ok(version)
}

#[tauri::command]
fn get_openclaw_status(_state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let running = is_gateway_running();
    Ok(serde_json::json!({
        "running": running,
        "gatewayUrl": format!("ws://127.0.0.1:{}", GATEWAY_PORT)
    }))
}

#[tauri::command]
fn check_env() -> Result<serde_json::Value, String> {
    let node_output = Command::new("node").arg("--version").output();

    let (node_installed, node_version, node_path, npm_version) = match &node_output {
        Ok(o) if o.status.success() => {
            let version = String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();
            let path = Command::new("which")
                .arg("node")
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            let npm = Command::new("npm")
                .arg("--version")
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            (true, version, path, npm)
        }
        _ => (false, String::new(), String::new(), String::new()),
    };

    let openclaw_output = Command::new("openclaw").arg("--version").output();

    let (openclaw_installed, openclaw_version, openclaw_path) = match &openclaw_output {
        Ok(o) if o.status.success() => {
            let raw = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let version = raw
                .strip_prefix("OpenClaw ")
                .and_then(|s| s.split_whitespace().next())
                .unwrap_or(&raw);
            let path = Command::new("which")
                .arg("openclaw")
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            (true, version.to_string(), path)
        }
        _ => (false, String::new(), String::new()),
    };

    Ok(serde_json::json!({
        "node": {
            "installed": node_installed,
            "version": node_version,
            "path": node_path,
            "npmVersion": npm_version,
        },
        "openclaw": {
            "installed": openclaw_installed,
            "version": openclaw_version,
            "path": openclaw_path,
        }
    }))
}

#[tauri::command]
fn read_global_config() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let config_path = home.join(".openclaw").join("openclaw.json");
    std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))
}

#[tauri::command]
fn get_gateway_token() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let config_path = home.join(".openclaw").join("openclaw.json");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
    json["gateway"]["auth"]["token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "gateway token not found".to_string())
}

#[tauri::command]
fn get_channels(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let vclaw_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let channels_dir = vclaw_data.join("channels");

    if !channels_dir.exists() {
        return Ok(vec![]);
    }

    let mut channels = vec![];
    for entry in std::fs::read_dir(&channels_dir).map_err(|e| e.to_string())? {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            _placeholder: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            check_node_env,
            start_openclaw,
            stop_openclaw,
            restart_openclaw,
            get_openclaw_status,
            get_openclaw_version,
            check_env,
            read_global_config,
            get_gateway_token,
            get_channels,
            export_config,
            import_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn export_config(app_handle: tauri::AppHandle) -> Result<String, String> {
    let vclaw_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let config_path = vclaw_data.join("config.json");
    if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn import_config(app_handle: tauri::AppHandle, config: String) -> Result<(), String> {
    let vclaw_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&vclaw_data).map_err(|e| e.to_string())?;
    let config_path = vclaw_data.join("config.json");
    std::fs::write(&config_path, config).map_err(|e| e.to_string())
}
