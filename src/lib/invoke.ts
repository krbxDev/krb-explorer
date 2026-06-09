import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { FileEntry, DriveInfo, SearchResult, Favorite, HistoryEntry, ConflictInfo, FileProperties, OpenWithApp, AclEntry, ActivityEntry, WslDistro } from "./types";

const invoke = tauriInvoke;

export const fs = {
  listDirectory: (path: string, showHidden = false, sortBy?: string, sortAsc?: boolean) =>
    invoke<FileEntry[]>("list_directory", { path, showHidden, sortBy, sortAsc }),
  getFileInfo: (path: string) => invoke<FileEntry>("get_file_info", { path }),
  readTextFile: (path: string, maxBytes?: number) => invoke<string>("read_text_file", { path, maxBytes }),
  createDirectory: (path: string) => invoke<void>("create_directory", { path }),
  deleteItems: (paths: string[], toTrash = true) => invoke<void>("delete_items", { paths, toTrash }),
  renameItem: (path: string, newName: string) => invoke<string>("rename_item", { path, newName }),
  copyItems: (sources: string[], destDir: string) => invoke<void>("copy_items", { sources, destDir }),
  moveItems: (sources: string[], destDir: string) => invoke<void>("move_items", { sources, destDir }),
  openItem: (path: string) => invoke<void>("open_item", { path }),
  openInVscode: (path: string) => invoke<void>("open_in_vscode", { path }),
  openTerminalAt: (path: string) => invoke<void>("open_terminal_at", { path }),
  getDrives: () => invoke<DriveInfo[]>("get_drives"),
  getThumbnail: (path: string, size = 128) => invoke<string>("get_thumbnail", { path, size }),
  bulkRename: (paths: string[], pattern: string, replacement: string, useRegex = false, counterStart = 1) =>
    invoke<[string, string][]>("bulk_rename", { paths, pattern, replacement, useRegex, counterStart }),
  getDirSize: (path: string) => invoke<number>("get_dir_size", { path }),
  getDiskUsage: (path: string, depth = 2) => invoke<any>("get_disk_usage", { path, depth }),
  pathSuggestions: (partial: string) => invoke<string[]>("path_suggestions", { partial }),
  checkConflicts: (sources: string[], destDir: string) => invoke<ConflictInfo[]>("check_conflicts", { sources, destDir }),
  createZip: (sources: string[], outputPath: string) => invoke<void>("create_zip", { sources, outputPath }),
  getFileProperties: (path: string) => invoke<FileProperties>("get_file_properties", { path }),
  runAsAdmin: (path: string) => invoke<void>("run_as_admin", { path }),
  setWallpaper: (path: string) => invoke<void>("set_wallpaper", { path }),
  printFile: (path: string) => invoke<void>("print_file", { path }),
  createShortcut: (target: string, shortcutPath: string) => invoke<void>("create_shortcut", { target, shortcutPath }),
  resolveShortcut: (lnkPath: string) => invoke<string>("resolve_shortcut", { lnkPath }),
  getOpenWithApps: (ext: string) => invoke<OpenWithApp[]>("get_open_with_apps", { ext }),
  openWithApp: (path: string, appPath: string) => invoke<void>("open_with_app", { path, appPath }),
  ejectDrive: (path: string) => invoke<void>("eject_drive", { path }),
  setFileAttributes: (path: string, readonly: boolean, hidden: boolean) => invoke<void>("set_file_attributes", { path, readonly, hidden }),
  createFile: (path: string) => invoke<void>("create_file", { path }),
  openShareDialog: (path: string) => invoke<void>("open_share_dialog", { path }),
  scanWithDefender: (paths: string[]) => invoke<void>("scan_with_defender", { paths }),
  showPreviousVersions: (path: string) => invoke<void>("show_previous_versions", { path }),
  pinToStart: (path: string) => invoke<void>("pin_to_start", { path }),
  formatDrive: (path: string) => invoke<void>("format_drive", { path }),
  getFileHash: (path: string, algorithm: "MD5" | "SHA1" | "SHA256") =>
    invoke<string>("get_file_hash", { path, algorithm }),
  getRecycleBinItems: () => invoke<FileEntry[]>("get_recycle_bin_items"),
  restoreFromRecycleBin: (path: string) => invoke<void>("restore_from_recycle_bin", { path }),
  emptyRecycleBin: () => invoke<void>("empty_recycle_bin"),
  mapNetworkDrive: (letter: string, path: string, persistent: boolean) =>
    invoke<void>("map_network_drive", { letter, path, persistent }),
  disconnectNetworkDrive: (letter: string) => invoke<void>("disconnect_network_drive", { letter }),
  findDuplicateFiles: (path: string) => invoke<string[][]>("find_duplicate_files", { path }),
  sendToDesktopShortcut: (path: string) => invoke<void>("send_to_desktop_shortcut", { path }),
  sendToZip: (paths: string[], destDir: string) => invoke<string>("send_to_zip", { paths, destDir }),
  getFolderSizes: (paths: string[]) => invoke<[string, number][]>("get_folder_sizes", { paths }),
  secureDelete: (paths: string[], passes?: number) => invoke<void>("secure_delete", { paths, passes: passes ?? 3 }),
  detectSuspiciousFiles: (paths: string[]) => invoke<string[]>("detect_suspicious_files", { paths }),
  findLargeFiles: (path: string, limit?: number) => invoke<[string, number][]>("find_large_files", { path, limit: limit ?? 50 }),
  getFileAcl: (path: string) => invoke<AclEntry[]>("get_file_acl", { path }),
  encryptFile: (path: string, password: string, outputPath?: string) => invoke<void>("encrypt_file", { path, password, outputPath: outputPath ?? "" }),
  decryptFile: (path: string, password: string, outputPath?: string) => invoke<void>("decrypt_file", { path, password, outputPath: outputPath ?? "" }),
  logFileOperation: (operation: string, paths: string[], destination?: string) => invoke<void>("log_file_operation", { operation, paths, destination }),
  getActivityLog: (limit?: number) => invoke<ActivityEntry[]>("get_activity_log", { limit: limit ?? 100 }),
  getFolderColors: () => invoke<[string, string][]>("get_folder_colors"),
  setFolderColor: (path: string, color: string | null) => invoke<void>("set_folder_color", { path, color }),
  checkCloudSyncStatus: (path: string) => invoke<string>("check_cloud_sync_status", { path }),
  searchFilesIndexed: (query: string, limit?: number) => invoke<SearchResult[]>("search_files_indexed", { query, limit: limit ?? 200 }),
  indexPathToDb: (path: string) => invoke<number>("index_path_to_db", { path }),
  getWslDistros: () => invoke<WslDistro[]>("get_wsl_distros"),
  openWslTerminal: (distro: string, path: string) => invoke<void>("open_wsl_terminal", { distro, path }),
  copyItemsWithProgress: (sources: string[], destDir: string, operationId: string) => invoke<void>("copy_items_with_progress", { sources, destDir, operationId }),
};

export const search = {
  searchDirectory: (root: string, query: string, includeHidden = false, maxResults = 200) =>
    invoke<SearchResult[]>("search_directory", { root, query, includeHidden, maxResults }),
};

export const db = {
  getFavorites: () => invoke<Favorite[]>("get_favorites"),
  addFavorite: (path: string, name: string, isSearch = false, searchQuery?: string) =>
    invoke<number>("add_favorite", { path, name, isSearch, searchQuery }),
  removeFavorite: (path: string) => invoke<void>("remove_favorite", { path }),
  getTags: (path: string) => invoke<string[]>("get_tags", { path }),
  setTag: (path: string, tag: string, color?: string, remove = false) =>
    invoke<void>("set_tag", { path, tag, color, remove }),
  getHistory: (limit = 100, filesOnly = false) => invoke<HistoryEntry[]>("get_history", { limit, filesOnly }),
  addHistory: (path: string, isFile = false) => invoke<void>("add_history", { path, isFile }),
  getThumbnailCached: (path: string) => invoke<string | null>("get_thumbnail_cached", { path }),
  setThumbnailCached: (path: string, data: string) => invoke<void>("set_thumbnail_cached", { path, data }),
  getColumnWidths: () => invoke<{ col: string; width: number }[]>("get_column_widths"),
  setColumnWidth: (col: string, width: number) => invoke<void>("set_column_width", { col, width }),
};

export const git = {
  getStatus: (path: string) => invoke<{
    isRepo: boolean;
    branch: string | null;
    files: Record<string, string>;
    root: string | null;
  }>("get_git_status", { path }),
};

export const archive = {
  list: (path: string) => invoke<any[]>("list_archive", { path }),
  extract: (archivePath: string, destDir: string) => invoke<void>("extract_archive", { archivePath, destDir }),
};

export const watcher = {
  watchDirectory: (path: string) => invoke<void>("watch_directory", { path }),
  unwatchDirectory: (path: string) => invoke<void>("unwatch_directory", { path }),
};
