use crate::watcher::WatcherState;
use tauri::{command, AppHandle};

#[command]
pub async fn watch_directory(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, std::sync::Mutex<WatcherState>>,
) -> Result<(), String> {
    state.lock().unwrap().watch(path, app)
}

#[command]
pub async fn unwatch_directory(
    path: String,
    state: tauri::State<'_, std::sync::Mutex<WatcherState>>,
) -> Result<(), String> {
    state.lock().unwrap().unwatch(&path);
    Ok(())
}
