use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
    pub modified: Option<String>,
}

#[command]
pub async fn list_archive(path: String) -> Result<Vec<ArchiveEntry>, String> {
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    tokio::task::spawn_blocking(move || {
        match ext.as_str() {
            "zip" => list_zip(&path),
            "tar" | "gz" | "tgz" => list_tar(&path),
            _ => Err(format!("Unsupported archive format: {}", ext)),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn list_zip(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            let is_dir = file.is_dir();
            entries.push(ArchiveEntry {
                name: Path::new(&name).file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&name)
                    .to_string(),
                path: name,
                is_dir,
                size: file.size(),
                compressed_size: file.compressed_size(),
                modified: file.last_modified().map(|dt| {
                    format!("{:04}-{:02}-{:02}T{:02}:{:02}:00Z",
                        dt.year(), dt.month(), dt.day(), dt.hour(), dt.minute())
                }),
            });
        }
    }
    Ok(entries)
}

fn list_tar(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    if path.ends_with(".gz") || path.ends_with(".tgz") {
        let decoder = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(decoder);
        for entry in archive.entries().map_err(|e| e.to_string())? {
            if let Ok(e) = entry {
                let path_str = e.path().ok().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
                let is_dir = e.header().entry_type().is_dir();
                entries.push(ArchiveEntry {
                    name: Path::new(&path_str).file_name()
                        .and_then(|n| n.to_str()).unwrap_or(&path_str).to_string(),
                    path: path_str,
                    is_dir,
                    size: e.header().size().unwrap_or(0),
                    compressed_size: 0,
                    modified: None,
                });
            }
        }
    } else {
        let mut archive = tar::Archive::new(file);
        for entry in archive.entries().map_err(|e| e.to_string())? {
            if let Ok(e) = entry {
                let path_str = e.path().ok().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
                let is_dir = e.header().entry_type().is_dir();
                entries.push(ArchiveEntry {
                    name: Path::new(&path_str).file_name()
                        .and_then(|n| n.to_str()).unwrap_or(&path_str).to_string(),
                    path: path_str,
                    is_dir,
                    size: e.header().size().unwrap_or(0),
                    compressed_size: 0,
                    modified: None,
                });
            }
        }
    }

    Ok(entries)
}

#[command]
pub async fn extract_archive(archive_path: String, dest_dir: String) -> Result<(), String> {
    let ext = Path::new(&archive_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    tokio::task::spawn_blocking(move || {
        match ext.as_str() {
            "zip" => extract_zip(&archive_path, &dest_dir),
            "tar" | "gz" | "tgz" => extract_tar(&archive_path, &dest_dir),
            _ => Err(format!("Unsupported format: {}", ext)),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn extract_zip(path: &str, dest: &str) -> Result<(), String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    archive.extract(dest).map_err(|e| e.to_string())
}

fn extract_tar(path: &str, dest: &str) -> Result<(), String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if path.ends_with(".gz") || path.ends_with(".tgz") {
        let decoder = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(decoder);
        archive.unpack(dest).map_err(|e| e.to_string())
    } else {
        let mut archive = tar::Archive::new(file);
        archive.unpack(dest).map_err(|e| e.to_string())
    }
}
