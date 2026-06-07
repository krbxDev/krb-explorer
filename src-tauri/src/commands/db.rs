use crate::db::{Database, Favorite, HistoryEntry, ColumnWidth};
use tauri::command;

#[command]
pub async fn get_favorites(
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<Vec<Favorite>, String> {
    state.lock().unwrap().get_favorites().map_err(|e| e.to_string())
}

#[command]
pub async fn add_favorite(
    path: String,
    name: String,
    is_search: Option<bool>,
    search_query: Option<String>,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<i64, String> {
    state.lock().unwrap()
        .add_favorite(&path, &name, is_search.unwrap_or(false), search_query.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn remove_favorite(
    path: String,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<(), String> {
    state.lock().unwrap().remove_favorite(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn get_tags(
    path: String,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<Vec<String>, String> {
    state.lock().unwrap().get_tags(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn set_tag(
    path: String,
    tag: String,
    color: Option<String>,
    remove: Option<bool>,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<(), String> {
    state.lock().unwrap()
        .set_tag(&path, &tag, color.as_deref(), remove.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_history(
    limit: Option<usize>,
    files_only: Option<bool>,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<Vec<HistoryEntry>, String> {
    state.lock().unwrap()
        .get_history(limit.unwrap_or(100), files_only.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_history(
    path: String,
    is_file: Option<bool>,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<(), String> {
    state.lock().unwrap()
        .add_history(&path, is_file.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_thumbnail_cached(
    path: String,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<Option<String>, String> {
    let mtime = std::fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0);
    state.lock().unwrap().get_thumbnail(&path, mtime).map_err(|e| e.to_string())
}

#[command]
pub async fn set_thumbnail_cached(
    path: String,
    data: String,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<(), String> {
    let mtime = std::fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0);
    state.lock().unwrap().set_thumbnail(&path, &data, mtime).map_err(|e| e.to_string())
}

#[command]
pub async fn get_column_widths(
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<Vec<ColumnWidth>, String> {
    state.lock().unwrap().get_column_widths().map_err(|e| e.to_string())
}

#[command]
pub async fn set_column_width(
    col: String,
    width: i64,
    state: tauri::State<'_, std::sync::Mutex<Database>>,
) -> Result<(), String> {
    state.lock().unwrap().set_column_width(&col, width).map_err(|e| e.to_string())
}
