use crate::search::{search_in_directory, SearchResult};
use tauri::command;

#[command]
pub async fn search_directory(
    root: String,
    query: String,
    include_hidden: bool,
    max_results: Option<usize>,
    case_sensitive: Option<bool>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(200);
    let cs = case_sensitive.unwrap_or(false);
    tokio::task::spawn_blocking(move || {
        Ok(search_in_directory(&root, &query, include_hidden, max, cs))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn index_directory(_root: String) -> Result<usize, String> {
    // Future: build SQLite FTS index
    Ok(0)
}
