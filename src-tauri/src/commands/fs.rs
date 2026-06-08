use crate::fs::{entry_from_path, DriveInfo, FileEntry};
use std::path::Path;
use tauri::{command, AppHandle, Emitter};

#[command]
pub async fn list_directory(
    path: String,
    show_hidden: bool,
    sort_by: Option<String>,
    sort_asc: Option<bool>,
) -> Result<Vec<FileEntry>, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut entries: Vec<FileEntry> = tokio::task::spawn_blocking(move || {
        let mut result = Vec::new();
        let read_dir = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
        for entry in read_dir.flatten() {
            let path = entry.path();
            if let Some(fe) = entry_from_path(&path) {
                if !show_hidden && fe.is_hidden {
                    continue;
                }
                result.push(fe);
            }
        }
        Ok::<Vec<FileEntry>, String>(result)
    })
    .await
    .map_err(|e| e.to_string())??;

    let sort_key = sort_by.as_deref().unwrap_or("name");
    let asc = sort_asc.unwrap_or(true);

    entries.sort_by(|a, b| {
        // Dirs-first only applies to name sort, matching File Explorer behaviour.
        // For date/size/type sorts everything is ordered by the chosen key so the
        // modified column reflects the true order top-to-bottom.
        let dirs_first = sort_key == "name" || sort_key == "type";
        if dirs_first && a.is_dir != b.is_dir {
            return if a.is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }

        let ord = match sort_key {
            "size" => {
                // Dirs have size 0; sort them after files when descending so they
                // don't all cluster at the top.
                if a.is_dir != b.is_dir {
                    return if a.is_dir { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less };
                }
                a.size.cmp(&b.size)
            }
            "modified" => {
                // RFC-3339 strings are always UTC from our backend so lexicographic
                // order equals chronological order. None sorts last (treat as epoch 0).
                match (&a.modified, &b.modified) {
                    (None, None) => std::cmp::Ordering::Equal,
                    (None, Some(_)) => std::cmp::Ordering::Less,
                    (Some(_), None) => std::cmp::Ordering::Greater,
                    (Some(am), Some(bm)) => am.cmp(bm),
                }
            }
            "type" => {
                // Sort by extension, then name within the same extension.
                let ext_ord = a.extension.cmp(&b.extension);
                if ext_ord == std::cmp::Ordering::Equal {
                    a.name.to_lowercase().cmp(&b.name.to_lowercase())
                } else {
                    ext_ord
                }
            }
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        if asc { ord } else { ord.reverse() }
    });

    Ok(entries)
}

#[command]
pub async fn get_file_info(path: String) -> Result<FileEntry, String> {
    let p = Path::new(&path);
    entry_from_path(p).ok_or_else(|| format!("Cannot read: {}", path))
}

#[command]
pub async fn read_text_file(path: String, max_bytes: Option<u64>) -> Result<String, String> {
    let limit = max_bytes.unwrap_or(1024 * 1024);
    let content = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;
    let bytes = &content[..content.len().min(limit as usize)];
    Ok(String::from_utf8_lossy(bytes).into_owned())
}

#[command]
pub async fn create_directory(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn delete_items(paths: Vec<String>, to_trash: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        for path in &paths {
            let p = Path::new(path);
            if to_trash {
                #[cfg(windows)]
                trash_windows(path)?;
                #[cfg(not(windows))]
                {
                    if p.is_dir() {
                        std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
                    } else {
                        std::fs::remove_file(p).map_err(|e| e.to_string())?;
                    }
                }
            } else if p.is_dir() {
                std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
            } else {
                std::fs::remove_file(p).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn trash_windows(path: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;

    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(once(0)).chain(once(0)).collect();
    let mut op = winapi::um::shellapi::SHFILEOPSTRUCTW {
        hwnd: std::ptr::null_mut(),
        wFunc: winapi::um::shellapi::FO_DELETE as u32,
        pFrom: wide.as_ptr(),
        pTo: std::ptr::null(),
        fFlags: winapi::um::shellapi::FOF_ALLOWUNDO | winapi::um::shellapi::FOF_NOCONFIRMATION | winapi::um::shellapi::FOF_SILENT,
        fAnyOperationsAborted: 0,
        hNameMappings: std::ptr::null_mut(),
        lpszProgressTitle: std::ptr::null(),
    };
    let result = unsafe { winapi::um::shellapi::SHFileOperationW(&mut op) };
    if result != 0 {
        Err(format!("Recycle failed with code {}", result))
    } else {
        Ok(())
    }
}

#[command]
pub async fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let p = Path::new(&path);
    let new_path = p.parent().ok_or("No parent")?.join(&new_name);
    tokio::fs::rename(&path, &new_path).await.map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().into_owned())
}

#[command]
pub async fn copy_items(
    sources: Vec<String>,
    dest_dir: String,
    app: AppHandle,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let total = sources.len();
        for (i, src) in sources.iter().enumerate() {
            let src_path = Path::new(src);
            let file_name = src_path.file_name().ok_or("No filename")?;
            let dest = Path::new(&dest_dir).join(file_name);

            let _ = app.emit("copy-progress", serde_json::json!({
                "current": i + 1,
                "total": total,
                "file": src,
                "done": false,
            }));

            if src_path.is_dir() {
                copy_dir_recursive(src_path, &dest, &app)?;
            } else {
                copy_file_with_progress(src_path, &dest, &app)?;
            }
        }
        let _ = app.emit("copy-progress", serde_json::json!({ "done": true, "total": total, "current": total }));
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn copy_file_with_progress(src: &Path, dst: &Path, app: &AppHandle) -> Result<(), String> {
    use std::io::{Read, Write};
    let mut reader = std::fs::File::open(src).map_err(|e| e.to_string())?;
    let mut writer = std::fs::File::create(dst).map_err(|e| e.to_string())?;
    let total = reader.metadata().map(|m| m.len()).unwrap_or(0);
    let mut buf = vec![0u8; 256 * 1024]; // 256KB chunks
    let mut copied = 0u64;

    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        writer.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        copied += n as u64;
        if total > 0 {
            let _ = app.emit("copy-file-progress", serde_json::json!({
                "file": src.to_string_lossy(),
                "bytes": copied,
                "total": total,
                "pct": (copied as f64 / total as f64 * 100.0) as u32,
            }));
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path, app: &AppHandle) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let dst_entry = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_recursive(&entry.path(), &dst_entry, app)?;
        } else {
            copy_file_with_progress(&entry.path(), &dst_entry, app)?;
        }
    }
    Ok(())
}

#[command]
pub async fn move_items(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        for src in &sources {
            let src_path = Path::new(src);
            let file_name = src_path.file_name().ok_or("No filename")?;
            let dest = Path::new(&dest_dir).join(file_name);
            // Try rename first (same drive), fall back to copy+delete
            if std::fs::rename(src_path, &dest).is_err() {
                if src_path.is_dir() {
                    copy_dir_recursive_simple(src_path, &dest)?;
                    std::fs::remove_dir_all(src_path).map_err(|e| e.to_string())?;
                } else {
                    std::fs::copy(src_path, &dest).map_err(|e| e.to_string())?;
                    std::fs::remove_file(src_path).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn copy_dir_recursive_simple(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let dst_entry = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_recursive_simple(&entry.path(), &dst_entry)?;
        } else {
            std::fs::copy(entry.path(), dst_entry).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[command]
pub async fn open_item(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn open_in_vscode(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("code");
        cmd.arg(&path);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map(|_| ())
            .map_err(|e| format!("Could not open VS Code: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn open_terminal_at(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        // Try Windows Terminal first, fall back to PowerShell
        let wt = std::process::Command::new("wt")
            .args(["new-tab", "--startingDirectory", &path])
            .spawn();
        if wt.is_ok() { return Ok(()); }

        std::process::Command::new("powershell")
            .args(["-NoExit", "-Command", &format!("Set-Location '{}'", path)])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    tokio::task::spawn_blocking(get_drives_impl)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn get_drives_impl() -> Result<Vec<DriveInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let mut buf = vec![0u16; 512];
    let len = unsafe { winapi::um::fileapi::GetLogicalDriveStringsW(512, buf.as_mut_ptr()) };
    if len == 0 { return Err("Failed to get drives".to_string()); }

    let mut drives = Vec::new();
    let mut start = 0;
    for i in 0..len as usize {
        if buf[i] == 0 {
            if i > start {
                let s = OsString::from_wide(&buf[start..i]).to_string_lossy().into_owned();
                if let Some(info) = get_drive_info(&s) { drives.push(info); }
            }
            start = i + 1;
        }
    }
    Ok(drives)
}

#[cfg(not(windows))]
fn get_drives_impl() -> Result<Vec<DriveInfo>, String> {
    Ok(vec![DriveInfo { name: "/".to_string(), path: "/".to_string(), label: None, drive_type: "Fixed".to_string(), total_space: 0, free_space: 0 }])
}

#[cfg(windows)]
fn get_drive_info(path: &str) -> Option<DriveInfo> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(std::iter::once(0)).collect();
    let drive_type = unsafe { winapi::um::fileapi::GetDriveTypeW(wide.as_ptr()) };
    let type_str = match drive_type {
        winapi::um::winbase::DRIVE_REMOVABLE => "Removable",
        winapi::um::winbase::DRIVE_FIXED => "Fixed",
        winapi::um::winbase::DRIVE_REMOTE => "Network",
        winapi::um::winbase::DRIVE_CDROM => "CD-ROM",
        _ => "Unknown",
    };
    let mut free_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free: u64 = 0;
    unsafe {
        winapi::um::fileapi::GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes as *mut u64 as *mut _,
            &mut total_bytes as *mut u64 as *mut _,
            &mut total_free as *mut u64 as *mut _,
        );
    }
    let name = path.trim_end_matches('\\').to_string();
    Some(DriveInfo {
        name: name.clone(), path: path.to_string(),
        label: get_volume_label(path),
        drive_type: type_str.to_string(),
        total_space: total_bytes, free_space: free_bytes,
    })
}

#[cfg(windows)]
fn get_volume_label(path: &str) -> Option<String> {
    use std::ffi::{OsStr, OsString};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(std::iter::once(0)).collect();
    let mut label = vec![0u16; 261];
    let ok = unsafe {
        winapi::um::fileapi::GetVolumeInformationW(
            wide.as_ptr(), label.as_mut_ptr(), label.len() as u32,
            std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), 0,
        )
    };
    if ok != 0 {
        let end = label.iter().position(|&c| c == 0).unwrap_or(label.len());
        if end > 0 { return Some(OsString::from_wide(&label[..end]).to_string_lossy().into_owned()); }
    }
    None
}

#[command]
pub async fn get_recycle_bin_items() -> Result<Vec<FileEntry>, String> { Ok(vec![]) }

#[command]
pub async fn restore_from_recycle_bin(_path: String) -> Result<(), String> { Ok(()) }

#[command]
pub async fn get_icon_data(path: String, is_dir: bool, size: Option<u32>) -> Result<String, String> {
    let icon_size = size.unwrap_or(32);
    tokio::task::spawn_blocking(move || shell_icon_base64(&path, is_dir, icon_size))
        .await
        .map_err(|e| e.to_string())?
}

fn shell_icon_base64(path: &str, is_dir: bool, size: u32) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL, FILE_FLAGS_AND_ATTRIBUTES,
    };
    use windows::Win32::UI::Shell::{
        SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SMALLICON,
        SHGFI_USEFILEATTRIBUTES,
    };
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL};

    unsafe {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut sfi = std::mem::zeroed::<SHFILEINFOW>();

        let size_flag = if size <= 24 { SHGFI_SMALLICON } else { SHGFI_LARGEICON };

        let (file_attrs, flags) = if is_dir {
            (FILE_FLAGS_AND_ATTRIBUTES(FILE_ATTRIBUTE_DIRECTORY.0), SHGFI_ICON | size_flag)
        } else {
            (FILE_FLAGS_AND_ATTRIBUTES(FILE_ATTRIBUTE_NORMAL.0), SHGFI_ICON | size_flag | SHGFI_USEFILEATTRIBUTES)
        };

        let result = SHGetFileInfoW(
            windows::core::PCWSTR(wide.as_ptr()),
            file_attrs,
            Some(&mut sfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        );

        if result == 0 || sfi.hIcon.is_invalid() {
            return Err(format!("SHGetFileInfo failed for: {path}"));
        }

        let s = size as i32;
        let null_hwnd = HWND(std::ptr::null_mut());
        let hdc_screen = GetDC(null_hwnd);
        if hdc_screen.is_invalid() {
            let _ = DestroyIcon(sfi.hIcon);
            return Err("GetDC failed".to_string());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(null_hwnd, hdc_screen);
            let _ = DestroyIcon(sfi.hIcon);
            return Err("CreateCompatibleDC failed".to_string());
        }

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: s,
                biHeight: -s,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };

        let mut pvbits: *mut std::ffi::c_void = std::ptr::null_mut();
        let hdib = match CreateDIBSection(hdc_mem, &bmi, DIB_RGB_COLORS, &mut pvbits, None, 0) {
            Ok(h) if !h.is_invalid() => h,
            _ => {
                let _ = DeleteDC(hdc_mem);
                ReleaseDC(null_hwnd, hdc_screen);
                let _ = DestroyIcon(sfi.hIcon);
                return Err("CreateDIBSection failed".to_string());
            }
        };

        let old_obj = SelectObject(hdc_mem, HGDIOBJ(hdib.0));
        let _ = DrawIconEx(hdc_mem, 0, 0, sfi.hIcon, s, s, 0, None, DI_NORMAL);

        let pixel_count = (size * size * 4) as usize;
        let pixels = std::slice::from_raw_parts(pvbits as *const u8, pixel_count);
        let mut buf = pixels.to_vec();

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(HGDIOBJ(hdib.0));
        DeleteDC(hdc_mem);
        ReleaseDC(null_hwnd, hdc_screen);
        let _ = DestroyIcon(sfi.hIcon);

        // Windows DIBs are BGRA — swap to RGBA for PNG encoding
        for chunk in buf.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        let img = image::RgbaImage::from_raw(size, size, buf)
            .ok_or_else(|| "Failed to construct RGBA image from icon data".to_string())?;

        let mut png = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        Ok(STANDARD.encode(&png))
    }
}

#[command]
pub async fn get_thumbnail(path: String, size: u32) -> Result<String, String> {
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !["jpg", "jpeg", "png", "gif", "bmp", "webp", "ico"].contains(&ext.as_str()) {
        return Ok(String::new());
    }

    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let img = image::open(&path).map_err(|e| e.to_string())?;
        let thumb = img.thumbnail(size, size);
        let mut buf = Vec::new();
        thumb.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(format!("data:image/png;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf)))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn bulk_rename(
    paths: Vec<String>,
    pattern: String,
    replacement: String,
    use_regex: bool,
    counter_start: Option<i64>,
) -> Result<Vec<(String, String)>, String> {
    tokio::task::spawn_blocking(move || {
        let re = if use_regex {
            Some(regex::Regex::new(&pattern).map_err(|e| e.to_string())?)
        } else {
            None
        };

        let mut results = Vec::new();
        let mut counter = counter_start.unwrap_or(1);

        for path in &paths {
            let p = Path::new(path);
            let name = p.file_name().ok_or("No name")?.to_string_lossy().into_owned();

            let new_name = if let Some(ref r) = re {
                // Replace counter placeholder {N} or {NNN}
                let repl = replacement.replace("{N}", &counter.to_string())
                    .replace("{NN}", &format!("{:02}", counter))
                    .replace("{NNN}", &format!("{:03}", counter))
                    .replace("{NNNN}", &format!("{:04}", counter));
                r.replace(&name, repl.as_str()).into_owned()
            } else {
                let repl = replacement.replace("{N}", &counter.to_string())
                    .replace("{NN}", &format!("{:02}", counter))
                    .replace("{NNN}", &format!("{:03}", counter))
                    .replace("{NNNN}", &format!("{:04}", counter));
                name.replace(&pattern, &repl)
            };

            if new_name != name {
                let new_path = p.parent().ok_or("No parent")?.join(&new_name);
                std::fs::rename(p, &new_path).map_err(|e| e.to_string())?;
                results.push((path.clone(), new_path.to_string_lossy().into_owned()));
            }
            counter += 1;
        }
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Path autocomplete for address bar ─────────────────────────────────────

#[command]
pub async fn path_suggestions(partial: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&partial);
        let (search_dir, prefix) = if partial.ends_with('\\') || partial.ends_with('/') {
            (p.to_owned(), String::new())
        } else {
            let parent = p.parent().unwrap_or(p).to_owned();
            let stem = p.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_lowercase();
            (parent, stem)
        };
        let mut results = Vec::new();
        if let Ok(rd) = std::fs::read_dir(&search_dir) {
            for entry in rd.flatten().take(30) {
                let ep = entry.path();
                if !ep.is_dir() { continue; }
                let name = entry.file_name().to_string_lossy().into_owned();
                if prefix.is_empty() || name.to_lowercase().starts_with(&prefix) {
                    results.push(ep.to_string_lossy().into_owned());
                }
            }
        }
        results.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Conflict detection ──────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub source_path: String,
    pub dest_path: String,
    pub source_name: String,
    pub source_size: u64,
    pub source_modified: Option<String>,
    pub dest_size: u64,
    pub dest_modified: Option<String>,
}

#[command]
pub async fn check_conflicts(sources: Vec<String>, dest_dir: String) -> Result<Vec<ConflictInfo>, String> {
    tokio::task::spawn_blocking(move || {
        use crate::fs::system_time_to_string;
        let mut conflicts = Vec::new();
        for src in &sources {
            let src_path = Path::new(src);
            let file_name = match src_path.file_name() {
                Some(n) => n,
                None => continue,
            };
            let dest = Path::new(&dest_dir).join(file_name);
            if dest.exists() {
                let src_meta = std::fs::metadata(src_path).map_err(|e| e.to_string())?;
                let dest_meta = std::fs::metadata(&dest).map_err(|e| e.to_string())?;
                conflicts.push(ConflictInfo {
                    source_path: src.clone(),
                    dest_path: dest.to_string_lossy().into_owned(),
                    source_name: file_name.to_string_lossy().into_owned(),
                    source_size: src_meta.len(),
                    source_modified: src_meta.modified().ok().and_then(system_time_to_string),
                    dest_size: dest_meta.len(),
                    dest_modified: dest_meta.modified().ok().and_then(system_time_to_string),
                });
            }
        }
        Ok(conflicts)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Create ZIP archive ──────────────────────────────────────────────────────

#[command]
pub async fn create_zip(sources: Vec<String>, output_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        use std::io::Write;
        let file = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for src in &sources {
            let src_path = Path::new(src);
            if src_path.is_file() {
                let name = src_path.file_name()
                    .and_then(|n| n.to_str()).ok_or("Bad filename")?;
                zip.start_file(name, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(src_path).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            } else if src_path.is_dir() {
                let dir_name = src_path.file_name()
                    .and_then(|n| n.to_str()).ok_or("Bad dir name")?;
                add_dir_to_zip(&mut zip, src_path, dir_name, options)?;
            }
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    dir: &Path,
    prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    use std::io::Write;
    zip.add_directory(format!("{}/", prefix), options).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let full_name = format!("{}/{}", prefix, name);
        if p.is_file() {
            zip.start_file(&full_name, options).map_err(|e| e.to_string())?;
            let data = std::fs::read(&p).map_err(|e| e.to_string())?;
            zip.write_all(&data).map_err(|e| e.to_string())?;
        } else if p.is_dir() {
            add_dir_to_zip(zip, &p, &full_name, options)?;
        }
    }
    Ok(())
}

// ─── File properties (General tab) ──────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileProperties {
    pub path: String,
    pub name: String,
    pub file_type: String,
    pub location: String,
    pub size: u64,
    pub size_on_disk: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub accessed: Option<String>,
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub is_system: bool,
    pub is_archive_attr: bool,
    pub is_compressed: bool,
    pub is_encrypted: bool,
    pub is_dir: bool,
    pub item_count: Option<u64>,
}

#[command]
pub async fn get_file_properties(path: String) -> Result<FileProperties, String> {
    tokio::task::spawn_blocking(move || {
        use crate::fs::system_time_to_string;
        let p = Path::new(&path);
        let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let location = p.parent().and_then(|p| p.to_str()).unwrap_or("").to_string();
        let is_dir = meta.is_dir();

        #[cfg(windows)]
        let (is_readonly, is_hidden, is_system, is_archive_attr, is_compressed, is_encrypted, size_on_disk) = {
            use std::os::windows::fs::MetadataExt;
            let attrs = meta.file_attributes();
            let sod = if !is_dir { get_compressed_file_size(&path).unwrap_or(meta.len()) } else { 0 };
            (attrs & 0x1 != 0, attrs & 0x2 != 0, attrs & 0x4 != 0, attrs & 0x20 != 0, attrs & 0x800 != 0, attrs & 0x4000 != 0, sod)
        };
        #[cfg(not(windows))]
        let (is_readonly, is_hidden, is_system, is_archive_attr, is_compressed, is_encrypted, size_on_disk) =
            (meta.permissions().readonly(), false, false, false, false, false, meta.len());

        let file_type = if is_dir {
            "File folder".to_string()
        } else {
            p.extension().and_then(|e| e.to_str())
                .map(|e| format!("{} File", e.to_uppercase()))
                .unwrap_or_else(|| "File".to_string())
        };
        let item_count = if is_dir {
            std::fs::read_dir(&path).ok().map(|rd| rd.flatten().count() as u64)
        } else { None };

        Ok(FileProperties {
            path: path.clone(), name, file_type, location,
            size: meta.len(), size_on_disk,
            created: meta.created().ok().and_then(system_time_to_string),
            modified: meta.modified().ok().and_then(system_time_to_string),
            accessed: meta.accessed().ok().and_then(system_time_to_string),
            is_readonly, is_hidden, is_system, is_archive_attr, is_compressed, is_encrypted, is_dir, item_count,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn get_compressed_file_size(path: &str) -> Option<u64> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(std::iter::once(0)).collect();
    let mut high: u32 = 0;
    let low = unsafe { winapi::um::fileapi::GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    if low == 0xFFFFFFFF { None } else { Some((high as u64) << 32 | low as u64) }
}

// ─── Run as Administrator ────────────────────────────────────────────────────

#[command]
pub async fn run_as_admin(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            let path_wide: Vec<u16> = OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
            let verb: Vec<u16> = "runas\0".encode_utf16().collect();
            let result = unsafe {
                winapi::um::shellapi::ShellExecuteW(
                    std::ptr::null_mut(), verb.as_ptr(), path_wide.as_ptr(),
                    std::ptr::null(), std::ptr::null(), winapi::um::winuser::SW_SHOWNORMAL,
                )
            };
            if result as usize <= 32 { Err(format!("ShellExecuteW failed: {}", result as usize)) } else { Ok(()) }
        }
        #[cfg(not(windows))]
        Err("Run as admin not supported on this platform".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Set desktop wallpaper ───────────────────────────────────────────────────

#[command]
pub async fn set_wallpaper(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            let wide: Vec<u16> = OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
            let result = unsafe {
                winapi::um::winuser::SystemParametersInfoW(
                    winapi::um::winuser::SPI_SETDESKWALLPAPER,
                    0,
                    wide.as_ptr() as *mut _,
                    winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE,
                )
            };
            if result == 0 { Err("SystemParametersInfoW failed".to_string()) } else { Ok(()) }
        }
        #[cfg(not(windows))]
        Err("Set wallpaper not supported on this platform".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Print file ──────────────────────────────────────────────────────────────

#[command]
pub async fn print_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            let path_wide: Vec<u16> = OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
            let verb: Vec<u16> = "print\0".encode_utf16().collect();
            let result = unsafe {
                winapi::um::shellapi::ShellExecuteW(
                    std::ptr::null_mut(), verb.as_ptr(), path_wide.as_ptr(),
                    std::ptr::null(), std::ptr::null(), winapi::um::winuser::SW_SHOWNORMAL,
                )
            };
            if result as usize <= 32 { Err(format!("Print failed: {}", result as usize)) } else { Ok(()) }
        }
        #[cfg(not(windows))]
        Err("Print not supported on this platform".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Create .lnk shortcut (via PowerShell) ───────────────────────────────────

#[command]
pub async fn create_shortcut(target: String, shortcut_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        let script = format!(
            "$s=(New-Object -COM WScript.Shell).CreateShortcut('{}'); $s.TargetPath='{}'; $s.Save()",
            shortcut_path.replace('\'', "''"),
            target.replace('\'', "''")
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);
        let out = cmd.output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            Err(String::from_utf8_lossy(&out.stderr).to_string())
        } else {
            Ok(())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Resolve .lnk shortcut target (via PowerShell) ───────────────────────────

#[command]
pub async fn resolve_shortcut(lnk_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        let script = format!(
            "(New-Object -COM WScript.Shell).CreateShortcut('{}').TargetPath",
            lnk_path.replace('\'', "''")
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);
        let out = cmd.output().map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Open With apps from registry ────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenWithApp {
    pub name: String,
    pub exe_path: String,
    pub display_name: String,
}

#[command]
pub async fn get_open_with_apps(ext: String) -> Result<Vec<OpenWithApp>, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            get_open_with_apps_impl(&ext)
        }
        #[cfg(not(windows))]
        Ok(vec![])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn get_open_with_apps_impl(ext: &str) -> Result<Vec<OpenWithApp>, String> {
    use std::ffi::{OsStr, OsString};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};

    let ext_dot = if ext.starts_with('.') { ext.to_string() } else { format!(".{}", ext) };
    let mut apps: Vec<OpenWithApp> = Vec::new();
    let key_paths = [
        format!("{}\\OpenWithList", ext_dot),
        format!("{}\\OpenWithProgids", ext_dot),
    ];

    unsafe {
        for key_path in &key_paths {
            let key_wide: Vec<u16> = OsStr::new(key_path).encode_wide().chain(std::iter::once(0)).collect();
            let mut hkey: winapi::shared::minwindef::HKEY = std::ptr::null_mut();
            if winapi::um::winreg::RegOpenKeyExW(
                winapi::um::winreg::HKEY_CLASSES_ROOT,
                key_wide.as_ptr(), 0, winapi::um::winnt::KEY_READ, &mut hkey,
            ) != 0 { continue; }

            let mut i = 0u32;
            loop {
                let mut name_buf = vec![0u16; 260];
                let mut name_len = 260u32;
                if winapi::um::winreg::RegEnumKeyExW(
                    hkey, i, name_buf.as_mut_ptr(), &mut name_len,
                    std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(),
                ) != 0 { break; }
                let end = name_buf.iter().position(|&c| c == 0).unwrap_or(name_len as usize);
                let app_name = OsString::from_wide(&name_buf[..end]).to_string_lossy().into_owned();
                if let Some(exe_path) = lookup_app_exe_win(&app_name) {
                    let display = get_app_friendly_name_win(&app_name).unwrap_or_else(|| app_name.clone());
                    if !apps.iter().any(|a| a.exe_path == exe_path) {
                        apps.push(OpenWithApp { name: app_name, display_name: display, exe_path });
                    }
                }
                i += 1;
            }
            winapi::um::winreg::RegCloseKey(hkey);
        }
    }
    Ok(apps)
}

#[cfg(windows)]
fn lookup_app_exe_win(app_name: &str) -> Option<String> {
    use std::ffi::{OsStr, OsString};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    let key_path = format!("Applications\\{}\\shell\\open\\command", app_name);
    unsafe {
        let key_wide: Vec<u16> = OsStr::new(&key_path).encode_wide().chain(std::iter::once(0)).collect();
        let mut hkey: winapi::shared::minwindef::HKEY = std::ptr::null_mut();
        if winapi::um::winreg::RegOpenKeyExW(
            winapi::um::winreg::HKEY_CLASSES_ROOT, key_wide.as_ptr(), 0, winapi::um::winnt::KEY_READ, &mut hkey,
        ) != 0 { return None; }
        let mut buf = vec![0u16; 512];
        let mut buf_size = (512u32 * 2);
        let empty: Vec<u16> = vec![0u16];
        let ok = winapi::um::winreg::RegQueryValueExW(
            hkey, empty.as_ptr(), std::ptr::null_mut(), std::ptr::null_mut(),
            buf.as_mut_ptr() as *mut u8, &mut buf_size,
        );
        winapi::um::winreg::RegCloseKey(hkey);
        if ok != 0 { return None; }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let cmd = OsString::from_wide(&buf[..end]).to_string_lossy().into_owned();
        let exe = cmd.trim_start_matches('"').split('"').next()
            .or_else(|| cmd.split(' ').next()).unwrap_or("").to_string();
        if !exe.is_empty() && Path::new(&exe).exists() { Some(exe) } else { None }
    }
}

#[cfg(windows)]
fn get_app_friendly_name_win(app_name: &str) -> Option<String> {
    use std::ffi::{OsStr, OsString};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    let key_path = format!("Applications\\{}", app_name);
    unsafe {
        let key_wide: Vec<u16> = OsStr::new(&key_path).encode_wide().chain(std::iter::once(0)).collect();
        let mut hkey: winapi::shared::minwindef::HKEY = std::ptr::null_mut();
        if winapi::um::winreg::RegOpenKeyExW(
            winapi::um::winreg::HKEY_CLASSES_ROOT, key_wide.as_ptr(), 0, winapi::um::winnt::KEY_READ, &mut hkey,
        ) != 0 { return None; }
        let mut buf = vec![0u16; 260];
        let mut buf_size = (260u32 * 2);
        let val_name: Vec<u16> = "FriendlyAppName\0".encode_utf16().collect();
        let ok = winapi::um::winreg::RegQueryValueExW(
            hkey, val_name.as_ptr(), std::ptr::null_mut(), std::ptr::null_mut(),
            buf.as_mut_ptr() as *mut u8, &mut buf_size,
        );
        winapi::um::winreg::RegCloseKey(hkey);
        if ok != 0 { return None; }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let s = OsString::from_wide(&buf[..end]).to_string_lossy().into_owned();
        if s.is_empty() { None } else { Some(s) }
    }
}

// ─── Open with specific app ──────────────────────────────────────────────────

#[command]
pub async fn open_with_app(path: String, app_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new(&app_path);
        cmd.arg(&path);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);
        cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Eject removable drive ───────────────────────────────────────────────────

#[command]
pub async fn eject_drive(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        let drive = path.chars().next().ok_or("Invalid path")?;
        let script = format!(
            "$shell = New-Object -COM Shell.Application; $folder = $shell.Namespace(17); $item = $folder.ParseName('{}:\\'); if($item){{$item.InvokeVerb('Eject')}}",
            drive
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);
        cmd.output().map(|_| ()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Set file attributes ─────────────────────────────────────────────────────

#[command]
pub async fn set_file_attributes(path: String, readonly: bool, hidden: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use std::os::windows::fs::MetadataExt;
            let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
            let mut attrs = meta.file_attributes();
            if readonly { attrs |= 0x1; } else { attrs &= !0x1; }
            if hidden { attrs |= 0x2; } else { attrs &= !0x2; }
            let wide: Vec<u16> = OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
            let result = unsafe { winapi::um::fileapi::SetFileAttributesW(wide.as_ptr(), attrs) };
            if result == 0 { Err("SetFileAttributesW failed".to_string()) } else { Ok(()) }
        }
        #[cfg(not(windows))]
        {
            let mut perm = std::fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
            perm.set_readonly(readonly);
            std::fs::set_permissions(&path, perm).map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_dir_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let mut total = 0u64;
        for entry in walkdir::WalkDir::new(&path).follow_links(false) {
            if let Ok(e) = entry {
                if e.file_type().is_file() {
                    total += e.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
        Ok(total)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub children: Vec<DiskUsageEntry>,
}

#[command]
pub async fn get_disk_usage(path: String, depth: Option<u32>) -> Result<DiskUsageEntry, String> {
    let max_depth = depth.unwrap_or(2);
    tokio::task::spawn_blocking(move || {
        build_disk_tree(&path, max_depth, 0)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn build_disk_tree(path: &str, max_depth: u32, current_depth: u32) -> Result<DiskUsageEntry, String> {
    let p = Path::new(path);
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or(path).to_string();

    if !p.is_dir() || current_depth >= max_depth {
        let size = if p.is_file() { std::fs::metadata(p).map(|m| m.len()).unwrap_or(0) } else {
            walkdir::WalkDir::new(p).into_iter().filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
                .sum()
        };
        return Ok(DiskUsageEntry { name, path: path.to_string(), size, children: vec![] });
    }

    let mut children: Vec<DiskUsageEntry> = std::fs::read_dir(p)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|entry| {
            let child_path = entry.path().to_string_lossy().into_owned();
            build_disk_tree(&child_path, max_depth, current_depth + 1).ok()
        })
        .collect();

    children.sort_by(|a, b| b.size.cmp(&a.size));
    children.truncate(20); // top 20 per level

    let size: u64 = children.iter().map(|c| c.size).sum();
    Ok(DiskUsageEntry { name, path: path.to_string(), size, children })
}
