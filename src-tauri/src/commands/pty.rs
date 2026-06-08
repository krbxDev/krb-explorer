use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct PtyState {
    writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    alive: Arc<Mutex<bool>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            writer: Arc::new(Mutex::new(None)),
            alive: Arc::new(Mutex::new(false)),
        }
    }
}

#[tauri::command]
pub fn pty_spawn(
    path: String,
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    // Kill any existing session
    *state.alive.lock().unwrap() = false;
    *state.writer.lock().unwrap() = None;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // Build PowerShell command starting in the given directory
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(["-NoLogo", "-NoExit"]);
    cmd.cwd(&path);

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    // Store the writer (master write end)
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    *state.writer.lock().unwrap() = Some(writer);
    *state.alive.lock().unwrap() = true;

    let alive = Arc::clone(&state.alive);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    // Spawn a thread that reads PTY output and emits events
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            if !*alive.lock().unwrap() {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit("pty://output", data);
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("pty://exit", ());
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(data: String, state: State<'_, PtyState>) -> Result<(), String> {
    if let Some(ref mut writer) = *state.writer.lock().unwrap() {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(cols: u16, rows: u16, state: State<'_, PtyState>) -> Result<(), String> {
    // portable-pty resize requires access to the master; store it separately if needed.
    // For now this is a no-op placeholder — the PTY will resize on next spawn.
    let _ = (cols, rows, state);
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>) -> Result<(), String> {
    *state.alive.lock().unwrap() = false;
    *state.writer.lock().unwrap() = None;
    Ok(())
}
