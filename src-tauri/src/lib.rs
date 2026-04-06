use tauri::Manager;
use tokio::process::Command;

fn get_config_port() -> u16 {
    if let Ok(port) = std::env::var("OPENCLAW_GATEWAY_PORT") {
        if let Ok(port) = port.parse() {
            return port;
        }
    }
    if let Some(home) = dirs::home_dir() {
        let config_path = home.join(".openclaw").join("openclaw.json");
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(port) = json["gateway"]["port"].as_u64() {
                    return port as u16;
                }
            }
        }
    }
    18789
}

#[tauri::command]
async fn check_node_env() -> Result<serde_json::Value, String> {
    let node_version = Command::new("node")
        .arg("--version")
        .output()
        .await
        .map_err(|e| e.to_string())?
        .stdout;
    let node_path = Command::new("which")
        .arg("node")
        .output()
        .await
        .map_err(|e| e.to_string())?
        .stdout;
    let npm_version = Command::new("npm")
        .arg("--version")
        .output()
        .await
        .map_err(|e| e.to_string())?
        .stdout;

    Ok(serde_json::json!({
        "nodeVersion": String::from_utf8_lossy(&node_version).trim().to_string(),
        "nodePath": String::from_utf8_lossy(&node_path).trim().to_string(),
        "npmVersion": String::from_utf8_lossy(&npm_version).trim().to_string(),
    }))
}

#[tauri::command]
async fn start_openclaw() -> Result<String, String> {
    let port = get_config_port();
    // Launch via launchd
    let output = Command::new("openclaw")
        .args(["gateway", "start"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    // Return immediately; WebSocket reconnection handles pending state
    Ok(format!("ws://127.0.0.1:{}", port))
}

#[tauri::command]
async fn stop_openclaw() -> Result<(), String> {
    let output = Command::new("openclaw")
        .args(["gateway", "stop"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    // Return immediately; WebSocket close event will update connected state
    Ok(())
}

#[tauri::command]
async fn get_openclaw_version() -> Result<String, String> {
    let output = Command::new("openclaw")
        .arg("--version")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let version = raw
        .strip_prefix("OpenClaw ")
        .and_then(|s| s.split_whitespace().next())
        .unwrap_or(&raw);
    Ok(format!("v{}", version))
}

#[tauri::command]
async fn get_openclaw_status() -> Result<serde_json::Value, String> {
    let port = get_config_port();
    let output = Command::new("openclaw")
        .args(["gateway", "status", "--json"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let running = if output.status.success() {
        let raw = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
            let rpc_ok = json["gateway"]["rpc"]["ok"].as_bool().unwrap_or(false);
            let started = json["service"]["status"].as_str() == Some("started");
            started && rpc_ok
        } else {
            false
        }
    } else {
        false
    };

    let gateway_url = format!("ws://127.0.0.1:{}", port);
    let dashboard_url = format!("http://127.0.0.1:{}/", port);

    Ok(serde_json::json!({
        "running": running,
        "gatewayUrl": gateway_url,
        "dashboardUrl": dashboard_url,
        "port": port,
    }))
}

#[tauri::command]
async fn check_env() -> Result<serde_json::Value, String> {
    let node_output = Command::new("node").arg("--version").output().await;
    let (node_installed, node_version, node_path, npm_version) = match &node_output {
        Ok(o) if o.status.success() => {
            let version = String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();
            let path = Command::new("which")
                .arg("node")
                .output()
                .await
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            let npm = Command::new("npm")
                .arg("--version")
                .output()
                .await
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            (true, version, path, npm)
        }
        _ => (false, String::new(), String::new(), String::new()),
    };

    let openclaw_output = Command::new("openclaw").arg("--version").output().await;
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
                .await
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
        .invoke_handler(tauri::generate_handler![
            check_node_env,
            start_openclaw,
            stop_openclaw,
            get_openclaw_status,
            get_openclaw_version,
            check_env,
            read_global_config,
            get_gateway_token,
            get_channels
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}