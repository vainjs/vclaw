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

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let gateway_port = 18789;

    let mut cmd = Command::new("openclaw");

    cmd.current_dir(&app_data_dir)
        .arg("gateway")
        .arg("run")
        .arg("--port")
        .arg(gateway_port.to_string())
        .arg("--auth")
        .arg("none")
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

    let gateway_url = format!("ws://127.0.0.1:{}", gateway_port);
    Ok(gateway_url)
}

#[tauri::command]
fn stop_openclaw(state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    let mut port_guard = state.gateway_port.lock().map_err(|e| e.to_string())?;
    *port_guard = None;
    Ok(())
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
fn get_openclaw_status(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let guard = state.openclaw_process.lock().map_err(|e| e.to_string())?;
    let running = guard.is_some();
    let port_guard = state.gateway_port.lock().map_err(|e| e.to_string())?;
    let gateway_url = port_guard.map(|p| format!("ws://127.0.0.1:{}", p));
    Ok(serde_json::json!({
        "running": running,
        "gatewayUrl": gateway_url
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
            openclaw_process: Mutex::new(None),
            gateway_port: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            check_node_env,
            start_openclaw,
            stop_openclaw,
            get_openclaw_status,
            get_openclaw_version,
            check_env,
            read_global_config,
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
