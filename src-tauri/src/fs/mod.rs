use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::SystemTime;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub created: Option<String>,
    pub extension: Option<String>,
    pub readonly: bool,
    pub icon_type: String,
    pub ntfs_compressed: bool,
    pub ntfs_encrypted: bool,
    pub is_system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
    pub label: Option<String>,
    pub drive_type: String,
    pub total_space: u64,
    pub free_space: u64,
}

pub fn system_time_to_string(t: SystemTime) -> Option<String> {
    let dt: DateTime<Utc> = t.into();
    Some(dt.to_rfc3339())
}

pub fn is_hidden(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(meta) = std::fs::metadata(path) {
            return meta.file_attributes() & 0x2 != 0;
        }
    }
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with('.'))
        .unwrap_or(false)
}

pub fn entry_from_path(path: &Path) -> Option<FileEntry> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    let is_symlink = meta.file_type().is_symlink();
    let real_meta = if is_symlink {
        std::fs::metadata(path).ok()?
    } else {
        meta.clone()
    };

    let name = path.file_name()?.to_string_lossy().into_owned();
    let extension = if real_meta.is_file() {
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase())
    } else {
        None
    };

    let icon_type = if real_meta.is_dir() {
        "folder".to_string()
    } else {
        extension.as_deref().unwrap_or("file").to_string()
    };

    #[cfg(windows)]
    let (ntfs_compressed, ntfs_encrypted, is_system) = {
        use std::os::windows::fs::MetadataExt;
        let attrs = real_meta.file_attributes();
        (attrs & 0x800 != 0, attrs & 0x4000 != 0, attrs & 0x4 != 0)
    };
    #[cfg(not(windows))]
    let (ntfs_compressed, ntfs_encrypted, is_system) = (false, false, false);

    Some(FileEntry {
        name,
        path: path.to_string_lossy().into_owned(),
        is_dir: real_meta.is_dir(),
        is_symlink,
        is_hidden: is_hidden(path),
        size: if real_meta.is_file() { real_meta.len() } else { 0 },
        modified: real_meta.modified().ok().and_then(|t| system_time_to_string(t)),
        created: real_meta.created().ok().and_then(|t| system_time_to_string(t)),
        extension,
        readonly: real_meta.permissions().readonly(),
        icon_type,
        ntfs_compressed,
        ntfs_encrypted,
        is_system,
    })
}
