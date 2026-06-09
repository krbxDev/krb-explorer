mod commands;
mod db;
mod fs;
mod search;
mod watcher;

use tauri::Manager;

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let db_path = app_handle
                .path()
                .app_data_dir()
                .unwrap()
                .join("nova.db");
            std::fs::create_dir_all(db_path.parent().unwrap()).ok();
            let db = db::Database::new(&db_path).expect("Failed to open database");
            app.manage(std::sync::Mutex::new(db));

            let watcher_state = watcher::WatcherState::new();
            app.manage(std::sync::Mutex::new(watcher_state));

            app.manage(commands::pty::PtyState::default());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Filesystem
            commands::fs::list_directory,
            commands::fs::get_file_info,
            commands::fs::read_text_file,
            commands::fs::create_directory,
            commands::fs::delete_items,
            commands::fs::rename_item,
            commands::fs::copy_items,
            commands::fs::move_items,
            commands::fs::open_item,
            commands::fs::open_in_vscode,
            commands::fs::open_terminal_at,
            commands::fs::get_drives,
            commands::fs::get_recycle_bin_items,
            commands::fs::restore_from_recycle_bin,
            commands::fs::get_icon_data,
            commands::fs::get_thumbnail,
            commands::fs::bulk_rename,
            commands::fs::get_dir_size,
            commands::fs::get_disk_usage,
            commands::fs::path_suggestions,
            commands::fs::check_conflicts,
            commands::fs::create_zip,
            commands::fs::get_file_properties,
            commands::fs::run_as_admin,
            commands::fs::set_wallpaper,
            commands::fs::print_file,
            commands::fs::create_shortcut,
            commands::fs::resolve_shortcut,
            commands::fs::get_open_with_apps,
            commands::fs::open_with_app,
            commands::fs::eject_drive,
            commands::fs::set_file_attributes,
            commands::fs::create_file,
            commands::fs::open_share_dialog,
            commands::fs::scan_with_defender,
            commands::fs::show_previous_versions,
            commands::fs::pin_to_start,
            commands::fs::format_drive,
            commands::fs::get_file_hash,
            commands::fs::empty_recycle_bin,
            commands::fs::map_network_drive,
            commands::fs::disconnect_network_drive,
            commands::fs::find_duplicate_files,
            commands::fs::send_to_desktop_shortcut,
            commands::fs::send_to_zip,
            commands::fs::get_folder_sizes,
            commands::fs::secure_delete,
            commands::fs::detect_suspicious_files,
            commands::fs::find_large_files,
            commands::fs::get_file_acl,
            commands::fs::encrypt_file,
            commands::fs::decrypt_file,
            commands::fs::log_file_operation,
            commands::fs::get_activity_log,
            commands::fs::get_folder_colors,
            commands::fs::set_folder_color,
            commands::fs::check_cloud_sync_status,
            commands::fs::search_files_indexed,
            commands::fs::index_path_to_db,
            commands::fs::get_wsl_distros,
            commands::fs::open_wsl_terminal,
            commands::fs::copy_items_with_progress,
            // Search
            commands::search::search_directory,
            commands::search::index_directory,
            // Watcher
            commands::watcher::watch_directory,
            commands::watcher::unwatch_directory,
            // Database
            commands::db::get_favorites,
            commands::db::add_favorite,
            commands::db::remove_favorite,
            commands::db::get_tags,
            commands::db::set_tag,
            commands::db::get_history,
            commands::db::add_history,
            commands::db::get_thumbnail_cached,
            commands::db::set_thumbnail_cached,
            commands::db::get_column_widths,
            commands::db::set_column_width,
            // Git
            commands::git::get_git_status,
            // Archive
            commands::archive::list_archive,
            commands::archive::extract_archive,
            // PTY
            commands::pty::pty_spawn,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KRB Explorer");
}
