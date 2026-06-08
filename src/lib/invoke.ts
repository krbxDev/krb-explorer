import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { FileEntry, DriveInfo, SearchResult, Favorite, HistoryEntry, ConflictInfo, FileProperties, OpenWithApp } from "./types";

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
