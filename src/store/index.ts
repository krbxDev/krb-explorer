import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  PaneState, Tab, FileEntry, DriveInfo, Favorite, SortKey, ViewMode, CopyProgress,
  OperationRecord, CopyQueueItem, Workspace, FtpConnection, RowDensity, ActivityEntry
} from "../lib/types";
import { fs, db, search, git, watcher } from "../lib/invoke";
import { generateId, pathParent } from "../lib/utils";

interface Clipboard { paths: string[]; mode: "copy" | "cut"; sourcePaneId?: string }

interface NovaStore {
  panes: Record<string, PaneState>;
  activePaneId: string;
  splitMode: "none" | "horizontal" | "vertical";
  splitPaneIds: [string, string] | null; // stable order so panes don't swap on click
  tabs: Tab[];
  activeTabId: string;
  drives: DriveInfo[];
  favorites: Favorite[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  previewOpen: boolean;
  previewPath: string | null;
  paletteOpen: boolean;
  theme: "dark" | "light";
  globalSearchQuery: string;
  globalSearchResults: any[];
  globalSearching: boolean;
  clipboard: Clipboard | null;
  copyProgress: CopyProgress | null;
  quickLookPath: string | null;
  terminalOpen: boolean;
  bulkRenameOpen: boolean;
  diskUsageOpen: boolean;
  columnWidths: Record<string, number>;
  columnOrder: string[];
  // Undo/redo
  undoStack: OperationRecord[];
  redoStack: OperationRecord[];
  // UI state
  checkboxMode: boolean;
  showExtensions: boolean;
  showSystemFiles: boolean;
  propertiesPath: string | null;
  propertiesOpen: boolean;
  // New Windows Explorer features
  gridIconSize: number;
  hiddenColumns: string[];
  groupBy: string | null;
  alwaysOnTop: boolean;
  recycleBinOpen: boolean;
  networkDriveOpen: boolean;
  duplicateFinderPath: string | null;
  showFolderSizes: boolean;
  // Copy queue
  copyQueue: CopyQueueItem[];
  copyQueueOpen: boolean;
  // Workspaces
  workspaces: Workspace[];
  // Row density
  rowDensity: RowDensity;
  // Folder colors
  folderColors: Record<string, string>;
  // Activity log
  activityLogOpen: boolean;
  // Large files finder
  largeFilesOpen: boolean;
  // File vault
  fileVaultOpen: boolean;
  fileVaultPath: string | null;
  // Permissions viewer
  permissionsPath: string | null;
  // FTP connections
  ftpConnections: FtpConnection[];
  ftpOpen: boolean;
  // WSL
  wslDistros: { name: string; home_path: string }[];
  // Indexed search
  indexedSearchOpen: boolean;
  // AI features
  aiOpen: boolean;
  aiApiKey: string;
  // Session
  lastSession: { paths: string[]; splitMode: string } | null;

  navigate: (paneId: string, path: string) => Promise<void>;
  invertSelection: (paneId: string) => void;
  pushUndo: (op: OperationRecord) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  toggleCheckboxMode: () => void;
  toggleShowExtensions: () => void;
  toggleShowSystemFiles: () => void;
  openProperties: (path: string) => void;
  closeProperties: () => void;
  setGridIconSize: (size: number) => void;
  setHiddenColumns: (cols: string[]) => void;
  setGroupBy: (col: string | null) => void;
  setAlwaysOnTop: (v: boolean) => void;
  openRecycleBin: () => void;
  closeRecycleBin: () => void;
  openNetworkDriveDialog: () => void;
  closeNetworkDriveDialog: () => void;
  openDuplicateFinder: (path: string) => void;
  closeDuplicateFinder: () => void;
  toggleShowFolderSizes: () => void;
  // Copy queue
  addCopyQueueItem: (item: CopyQueueItem) => void;
  updateCopyQueueItem: (id: string, update: Partial<CopyQueueItem>) => void;
  removeCopyQueueItem: (id: string) => void;
  toggleCopyQueue: () => void;
  // Workspaces
  saveWorkspace: (name: string) => void;
  loadWorkspace: (id: string) => void;
  deleteWorkspace: (id: string) => void;
  // Row density
  setRowDensity: (d: RowDensity) => void;
  // Folder colors
  loadFolderColors: () => Promise<void>;
  setFolderColor: (path: string, color: string | null) => Promise<void>;
  // Activity log
  toggleActivityLog: () => void;
  // Large files finder
  toggleLargeFiles: () => void;
  // File vault
  openFileVault: (path: string) => void;
  closeFileVault: () => void;
  // Permissions
  openPermissions: (path: string) => void;
  closePermissions: () => void;
  // FTP
  toggleFtp: () => void;
  addFtpConnection: (conn: FtpConnection) => void;
  removeFtpConnection: (id: string) => void;
  // WSL
  loadWslDistros: () => Promise<void>;
  // Indexed search
  toggleIndexedSearch: () => void;
  // AI
  toggleAi: () => void;
  setAiApiKey: (key: string) => void;
  // Session save/restore
  saveSession: () => void;
  restoreSession: () => void;
  setColumnOrder: (order: string[]) => void;
  navigateBack: (paneId: string) => void;
  navigateForward: (paneId: string) => void;
  navigateUp: (paneId: string) => void;
  refresh: (paneId: string) => Promise<void>;

  setSelection: (paneId: string, paths: string[]) => void;
  toggleSelection: (paneId: string, path: string) => void;
  clearSelection: (paneId: string) => void;
  selectAll: (paneId: string) => void;

  folderSortPrefs: Record<string, { key: SortKey; asc: boolean }>;
  setSort: (paneId: string, key: SortKey, asc: boolean) => void;
  setViewMode: (paneId: string, mode: ViewMode) => void;
  setShowHidden: (paneId: string, show: boolean) => void;
  setSearchQuery: (paneId: string, query: string) => void;

  openTab: (path?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  pinTab: (tabId: string) => void;

  setSplit: (mode: "none" | "horizontal" | "vertical") => void;
  setActivePane: (paneId: string) => void;

  loadDrives: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  addFavorite: (path: string, name: string, isSearch?: boolean, searchQuery?: string) => Promise<void>;
  removeFavorite: (path: string) => Promise<void>;
  renameFavorite: (path: string, newName: string) => Promise<void>;
  setSidebarWidth: (w: number) => void;
  setSidebarCollapsed: (v: boolean) => void;

  openPreview: (path: string) => void;
  closePreview: () => void;
  openPalette: () => void;
  closePalette: () => void;

  setClipboard: (paths: string[], mode: "copy" | "cut") => void;
  pasteClipboard: (destPaneId: string) => Promise<void>;

  setCopyProgress: (p: CopyProgress | null) => void;
  openQuickLook: (path: string) => void;
  closeQuickLook: () => void;
  toggleTerminal: () => void;
  toggleBulkRename: () => void;
  toggleDiskUsage: () => void;

  runGlobalSearch: (query: string, root: string) => Promise<void>;
  loadColumnWidths: () => Promise<void>;
  setColumnWidth: (col: string, width: number) => void;
}

function createPane(path: string): PaneState {
  return {
    id: generateId(),
    path,
    history: [path],
    historyIndex: 0,
    entries: [],
    loading: false,
    error: null,
    selection: new Set(),
    sortKey: "name",
    sortAsc: true,
    showHidden: true,
    viewMode: "details",
    searchQuery: "",
    gitStatus: {},
    isGitRepo: false,
    gitBranch: null,
    isArchive: false,
    archivePath: null,
  };
}

const HOME = "::home";
const initialPane = createPane(HOME);
const initialTab: Tab = { id: generateId(), label: "Home", paneId: initialPane.id, pinned: false };

export const useStore = create<NovaStore>()(
  immer((set, get) => ({
    panes: { [initialPane.id]: initialPane },
    activePaneId: initialPane.id,
    splitMode: "none",
    splitPaneIds: null,
    tabs: [initialTab],
    activeTabId: initialTab.id,
    drives: [],
    favorites: [],
    sidebarWidth: 220,
    sidebarCollapsed: false,
    previewOpen: false,
    previewPath: null,
    paletteOpen: false,
    theme: "dark",
    globalSearchQuery: "",
    globalSearchResults: [],
    globalSearching: false,
    clipboard: null,
    copyProgress: null,
    quickLookPath: null,
    terminalOpen: false,
    bulkRenameOpen: false,
    diskUsageOpen: false,
    columnWidths: { name: 400, modified: 144, type: 96, size: 80, attributes: 72 },
    columnOrder: ["name", "modified", "type", "size", "attributes"],
    // attributes column is hidden by default; users can show it via column chooser
    folderSortPrefs: {},
    undoStack: [],
    redoStack: [],
    checkboxMode: false,
    showExtensions: true,
    showSystemFiles: false,
    propertiesPath: null,
    propertiesOpen: false,
    gridIconSize: 100,
    hiddenColumns: ["attributes"],
    groupBy: null,
    alwaysOnTop: false,
    recycleBinOpen: false,
    networkDriveOpen: false,
    duplicateFinderPath: null,
    showFolderSizes: false,
    copyQueue: [],
    copyQueueOpen: false,
    workspaces: JSON.parse(localStorage.getItem("krb-workspaces") ?? "[]"),
    rowDensity: (localStorage.getItem("krb-row-density") as RowDensity) ?? "comfortable",
    folderColors: {},
    activityLogOpen: false,
    largeFilesOpen: false,
    fileVaultOpen: false,
    fileVaultPath: null,
    permissionsPath: null,
    ftpConnections: JSON.parse(localStorage.getItem("krb-ftp-connections") ?? "[]"),
    ftpOpen: false,
    wslDistros: [],
    indexedSearchOpen: false,
    aiOpen: false,
    aiApiKey: localStorage.getItem("krb-ai-key") ?? "",
    lastSession: JSON.parse(localStorage.getItem("krb-last-session") ?? "null"),

    navigate: async (paneId, path) => {
      // Handle special virtual paths
      if (path === "::home" || path === "::recycle") {
        set((s) => {
          const pane = s.panes[paneId];
          if (!pane) return;
          if (pane.history[pane.historyIndex] !== path) {
            pane.history = pane.history.slice(0, pane.historyIndex + 1);
            pane.history.push(path);
            pane.historyIndex = pane.history.length - 1;
          }
          pane.path = path;
          pane.entries = [];
          pane.loading = false;
          pane.selection = new Set();
          const tab = s.tabs.find((t) => t.paneId === paneId);
          if (tab) tab.label = path === "::home" ? "Home" : "Recycle Bin";
        });
        return;
      }

      const { ARCHIVE_EXTS } = await import("../lib/utils");
      const ext = path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
      const isArchive = ARCHIVE_EXTS.has(ext) && !path.endsWith("\\") && !path.endsWith("/");

      // Determine sort for this folder:
      // 1. Saved per-folder pref (user previously changed sort here)
      // 2. Folder-specific default (Downloads → modified desc)
      // 3. Carry over pane's current sort
      const { folderSortPrefs, panes } = get();
      const basename = path.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
      const FOLDER_DEFAULTS: Record<string, { key: SortKey; asc: boolean }> = {
        downloads: { key: "modified", asc: false },
      };
      const resolvedSort: { key: SortKey; asc: boolean } =
        folderSortPrefs[path] ??
        FOLDER_DEFAULTS[basename] ??
        { key: panes[paneId]?.sortKey ?? "name", asc: panes[paneId]?.sortAsc ?? true };

      set((s) => {
        const pane = s.panes[paneId];
        if (!pane) return;
        pane.loading = true;
        pane.error = null;
        pane.searchQuery = "";
        pane.sortKey = resolvedSort.key;
        pane.sortAsc = resolvedSort.asc;
        if (pane.history[pane.historyIndex] !== path) {
          pane.history = pane.history.slice(0, pane.historyIndex + 1);
          pane.history.push(path);
          pane.historyIndex = pane.history.length - 1;
        }
        pane.path = path;
        pane.selection = new Set();
        const tab = s.tabs.find((t) => t.paneId === paneId);
        if (tab) tab.label = path.split(/[\\/]/).pop() || path;
      });

      try {
        const pane = get().panes[paneId];
        let entries: FileEntry[] = [];

        // Helper: list entries from an archive, optionally scoped to a sub-directory
        const listArchive = async (archivePath: string, subDir: string = "") => {
          const { archive } = await import("../lib/invoke");
          const rawEntries = await archive.list(archivePath);
          const prefix = subDir ? subDir.replace(/\\/g, "/").replace(/\/?$/, "/") : "";
          const seen = new Set<string>();
          const result: FileEntry[] = rawEntries
            .filter((e: any) => {
              const ep = e.path.replace(/\\/g, "/");
              if (!ep.startsWith(prefix)) return false;
              const remaining = ep.slice(prefix.length).split("/").filter(Boolean);
              return remaining.length === 1 || (remaining.length === 0 && e.isDir);
            })
            .filter((e: any) => {
              const key = e.path.replace(/\\/g, "/").replace(/\/?$/, "");
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((e: any): FileEntry => {
              const namePart = e.name || e.path.replace(/\\/g, "/").replace(/\/?$/, "").split("/").pop() || e.path;
              const extPart = e.isDir ? null : namePart.includes(".") ? namePart.split(".").pop()!.toLowerCase() : null;
              return {
                name: namePart,
                path: `${archivePath}::${e.path}`,
                isDir: e.isDir,
                isSymlink: false,
                isHidden: false,
                size: e.size ?? 0,
                modified: e.modified ?? null,
                created: null,
                extension: extPart,
                readonly: true,
                iconType: e.isDir ? "folder" : extPart ?? "file",
              };
            });
          result.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          });
          return result;
        };

        // Case 1: navigating INTO a subfolder inside an already-open archive
        // path looks like: C:\foo\bar.zip::some/subdir/
        if (path.includes("::")) {
          const sepIdx = path.indexOf("::");
          const archivePath = path.slice(0, sepIdx);
          const subDir = path.slice(sepIdx + 2);
          try {
            const result = await listArchive(archivePath, subDir);
            set((s) => {
              const p = s.panes[paneId];
              if (p) { p.loading = false; p.isArchive = true; p.archivePath = archivePath; p.entries = result; p.error = null; }
            });
          } catch (err: any) {
            set((s) => { const p = s.panes[paneId]; if (p) { p.loading = false; p.error = String(err); } });
          }
          return;
        }

        // Case 2: opening an archive file from the filesystem
        if (isArchive) {
          try {
            const result = await listArchive(path);
            set((s) => {
              const p = s.panes[paneId];
              if (p) { p.loading = false; p.isArchive = true; p.archivePath = path; p.entries = result; p.error = null; }
            });
          } catch (err: any) {
            set((s) => {
              const p = s.panes[paneId];
              if (p) { p.loading = false; p.error = String(err); }
            });
          }
          return;
        }

        entries = await fs.listDirectory(path, pane?.showHidden ?? false, resolvedSort.key, resolvedSort.asc);
        // Filter system files if toggled off
        if (!get().showSystemFiles) {
          entries = entries.filter((e) => !e.isSystem);
        }

        // Git status (non-blocking, best-effort)
        git.getStatus(path).then((gs) => {
          set((s) => {
            const p = s.panes[paneId];
            if (p) {
              p.isGitRepo = gs.isRepo;
              p.gitBranch = gs.branch;
              p.gitStatus = gs.files;
              // Annotate entries
              p.entries = p.entries.map((e) => ({
                ...e,
                gitStatus: gs.files[e.path] ?? gs.files[e.path.replace(/\\/g, "/")] ?? undefined,
              }));
            }
          });
        }).catch(() => {});

        // Watch directory
        watcher.watchDirectory(path).catch(() => {});

        set((s) => {
          const p = s.panes[paneId];
          if (p) { p.entries = entries; p.loading = false; p.isArchive = false; p.archivePath = null; }
        });
        db.addHistory(path, false).catch(() => {});
      } catch (err: any) {
        set((s) => {
          const p = s.panes[paneId];
          if (p) { p.loading = false; p.error = String(err); }
        });
      }
    },

    navigateBack: (paneId) => {
      const pane = get().panes[paneId];
      if (!pane || pane.historyIndex <= 0) return;
      const newIndex = pane.historyIndex - 1;
      const targetPath = pane.history[newIndex];
      // BUG-006 FIX: set index first, then navigate with history already at correct index
      // so navigate()'s guard `history[historyIndex] !== path` sees equality and skips push
      set((s) => { s.panes[paneId].historyIndex = newIndex; });
      get().navigate(paneId, targetPath);
    },

    navigateForward: (paneId) => {
      const pane = get().panes[paneId];
      if (!pane || pane.historyIndex >= pane.history.length - 1) return;
      const newIndex = pane.historyIndex + 1;
      const targetPath = pane.history[newIndex];
      // BUG-006 FIX: same as navigateBack
      set((s) => { s.panes[paneId].historyIndex = newIndex; });
      get().navigate(paneId, targetPath);
    },

    navigateUp: (paneId) => {
      const pane = get().panes[paneId];
      if (!pane) return;
      const parent = pathParent(pane.path);
      if (parent !== pane.path) get().navigate(paneId, parent);
    },

    refresh: async (paneId) => {
      const pane = get().panes[paneId];
      if (!pane) return;
      await get().navigate(paneId, pane.path);
    },

    setSelection: (paneId, paths) => {
      set((s) => { s.panes[paneId].selection = new Set(paths); });
    },
    toggleSelection: (paneId, path) => {
      set((s) => {
        const sel = s.panes[paneId].selection;
        if (sel.has(path)) sel.delete(path); else sel.add(path);
      });
    },
    clearSelection: (paneId) => {
      set((s) => { s.panes[paneId].selection = new Set(); });
    },
    selectAll: (paneId) => {
      set((s) => {
        s.panes[paneId].selection = new Set(s.panes[paneId].entries.map((e) => e.path));
      });
    },

    setSort: (paneId, key, asc) => {
      set((s) => {
        const p = s.panes[paneId];
        p.sortKey = key;
        p.sortAsc = asc;
        // Remember this sort for the folder so it persists across navigations
        if (p.path) s.folderSortPrefs[p.path] = { key, asc };
      });
      get().refresh(paneId);
    },
    setViewMode: (paneId, mode) => { set((s) => { s.panes[paneId].viewMode = mode; }); },
    setShowHidden: (paneId, show) => {
      set((s) => { s.panes[paneId].showHidden = show; });
      get().refresh(paneId);
    },
    setSearchQuery: (paneId, query) => { set((s) => { s.panes[paneId].searchQuery = query; }); },

    openTab: (path) => {
      const newPane = createPane(path ?? HOME);
      const newTab: Tab = { id: generateId(), label: path?.split(/[\\/]/).pop() || "New Tab", paneId: newPane.id, pinned: false };
      set((s) => {
        s.panes[newPane.id] = newPane;
        s.tabs.push(newTab);
        s.activeTabId = newTab.id;
        s.activePaneId = newPane.id;
      });
      get().navigate(newPane.id, path ?? HOME);
    },

    closeTab: (tabId) => {
      const { tabs } = get();
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const tab = tabs[idx];
      set((s) => {
        delete s.panes[tab.paneId];
        s.tabs.splice(idx, 1);
        if (s.activeTabId === tabId) {
          const newIdx = Math.max(0, idx - 1);
          s.activeTabId = s.tabs[newIdx]?.id ?? "";
          s.activePaneId = s.tabs[newIdx]?.paneId ?? "";
        }
      });
    },

    setActiveTab: (tabId) => {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      set((s) => { s.activeTabId = tabId; s.activePaneId = tab.paneId; });
    },

    pinTab: (tabId) => {
      set((s) => { const tab = s.tabs.find((t) => t.id === tabId); if (tab) tab.pinned = !tab.pinned; });
    },

    setSplit: (mode) => {
      set((s) => {
        s.splitMode = mode;
        if (mode === "none") {
          s.splitPaneIds = null;
          return;
        }
        // Create second pane if needed
        if (Object.keys(s.panes).length < 2) {
          const currentPane = s.panes[s.activePaneId];
          const newPane = createPane(currentPane?.path ?? HOME);
          s.panes[newPane.id] = newPane;
          s.splitPaneIds = [s.activePaneId, newPane.id];
        } else if (!s.splitPaneIds) {
          const ids = Object.keys(s.panes);
          s.splitPaneIds = [s.activePaneId, ids.find((id) => id !== s.activePaneId)!];
        }
      });
      if (mode !== "none") {
        const { splitPaneIds } = get();
        const secondId = splitPaneIds?.[1];
        if (secondId) {
          const secondPane = get().panes[secondId];
          if (secondPane) get().navigate(secondId, secondPane.path);
        }
      }
    },

    setActivePane: (paneId) => { set((s) => { s.activePaneId = paneId; }); },

    loadDrives: async () => {
      try { const drives = await fs.getDrives(); set((s) => { s.drives = drives; }); } catch {}
    },

    loadFavorites: async () => {
      try { const favorites = await db.getFavorites(); set((s) => { s.favorites = favorites; }); } catch {}
    },

    addFavorite: async (path, name, isSearch = false, searchQuery) => {
      await db.addFavorite(path, name, isSearch, searchQuery);
      await get().loadFavorites();
    },

    removeFavorite: async (path) => {
      await db.removeFavorite(path);
      await get().loadFavorites();
    },

    renameFavorite: async (path, newName) => {
      const { favorites } = get();
      const fav = favorites.find((f) => f.path === path);
      if (!fav) return;
      await db.removeFavorite(path);
      await db.addFavorite(path, newName, fav.isSearch ?? false, fav.searchQuery ?? undefined);
      await get().loadFavorites();
    },

    setSidebarWidth: (w) => set((s) => { s.sidebarWidth = w; }),
    setSidebarCollapsed: (v) => set((s) => { s.sidebarCollapsed = v; }),

    openPreview: (path) => set((s) => { s.previewOpen = true; s.previewPath = path; }),
    closePreview: () => set((s) => { s.previewOpen = false; s.previewPath = null; }),
    openPalette: () => set((s) => { s.paletteOpen = true; }),
    closePalette: () => set((s) => { s.paletteOpen = false; }),

    setClipboard: (paths, mode) => set((s) => {
      // BUG-009 FIX: record source pane so we can refresh it after a cut+paste
      s.clipboard = { paths, mode, sourcePaneId: s.activePaneId };
    }),

    pasteClipboard: async (destPaneId) => {
      const { clipboard, panes } = get();
      if (!clipboard) return;
      const destPane = panes[destPaneId];
      if (!destPane) return;
      const destDir = destPane.path;

      // Check for conflicts first — emit event for ConflictDialog to handle
      const conflicts = await fs.checkConflicts(clipboard.paths, destDir).catch(() => []);
      if (conflicts.length > 0) {
        // Dispatch a custom event so ConflictDialog can intercept
        window.dispatchEvent(new CustomEvent("nova:conflict", {
          detail: { conflicts, paths: clipboard.paths, destDir, mode: clipboard.mode, destPaneId }
        }));
        return;
      }

      get().setCopyProgress({ current: 0, total: clipboard.paths.length, file: "", done: false });
      try {
        if (clipboard.mode === "copy") {
          await fs.copyItems(clipboard.paths, destDir);
          get().pushUndo({ id: crypto.randomUUID(), kind: 'copy', sources: clipboard.paths, dest: destDir, timestamp: Date.now() });
        } else {
          await fs.moveItems(clipboard.paths, destDir);
          get().pushUndo({ id: crypto.randomUUID(), kind: 'move', sources: clipboard.paths, dest: destDir, timestamp: Date.now() });
          const sourcePaneId = clipboard.sourcePaneId;
          set((s) => { s.clipboard = null; });
          // BUG-009 FIX: refresh source pane after cut so moved files disappear
          if (sourcePaneId && sourcePaneId !== destPaneId) {
            get().refresh(sourcePaneId).catch(() => {});
          }
        }
      } finally {
        get().setCopyProgress(null);
        await get().refresh(destPaneId);
      }
    },

    setCopyProgress: (p) => set((s) => { s.copyProgress = p; }),
    openQuickLook: (path) => set((s) => { s.quickLookPath = path; }),
    closeQuickLook: () => set((s) => { s.quickLookPath = null; }),
    toggleTerminal: () => set((s) => { s.terminalOpen = !s.terminalOpen; }),
    toggleBulkRename: () => set((s) => { s.bulkRenameOpen = !s.bulkRenameOpen; }),
    toggleDiskUsage: () => set((s) => { s.diskUsageOpen = !s.diskUsageOpen; }),

    runGlobalSearch: async (query, root) => {
      set((s) => { s.globalSearchQuery = query; s.globalSearching = true; });
      try {
        const results = await search.searchDirectory(root, query);
        set((s) => { s.globalSearchResults = results; s.globalSearching = false; });
      } catch {
        set((s) => { s.globalSearching = false; });
      }
    },

    invertSelection: (paneId) => {
      set((s) => {
        const p = s.panes[paneId];
        if (!p) return;
        const all = new Set(p.entries.map((e) => e.path));
        const newSel = new Set<string>();
        all.forEach((path) => { if (!p.selection.has(path)) newSel.add(path); });
        p.selection = newSel;
      });
    },

    pushUndo: (op) => {
      set((s) => {
        s.undoStack.push(op);
        if (s.undoStack.length > 50) s.undoStack.shift();
        s.redoStack = [];
      });
    },

    undo: async () => {
      const { undoStack } = get();
      if (undoStack.length === 0) return;
      const op = undoStack[undoStack.length - 1];
      set((s) => { s.undoStack.pop(); s.redoStack.push(op); });
      try {
        if (op.kind === 'rename' && op.sources[0] && op.newName && op.oldName) {
          const parent = op.sources[0].replace(/[\\/][^\\/]+$/, "");
          const currentPath = parent + "\\" + op.newName;
          await fs.renameItem(currentPath, op.oldName);
        } else if (op.kind === 'move' && op.dest) {
          // BUG-011 FIX: group sources by their original parent dir so each file
          // is moved back to its correct original location, not all to one dir.
          const byParent = new Map<string, string[]>();
          for (const s of op.sources) {
            const name = s.replace(/[\\/]+$/, "").split(/[\\/]/).pop()!;
            const movedPath = op.dest!.replace(/[\\/]+$/, "") + "\\" + name;
            const origParent = s.replace(/[\\/][^\\/]+$/, "");
            if (!byParent.has(origParent)) byParent.set(origParent, []);
            byParent.get(origParent)!.push(movedPath);
          }
          for (const [origParent, movedPaths] of byParent) {
            await fs.moveItems(movedPaths, origParent);
          }
        } else if (op.kind === 'copy' && op.dest) {
          const copied = op.sources.map(s => {
            const name = s.replace(/\\/g, "/").split("/").pop()!;
            return op.dest! + "\\" + name;
          });
          await fs.deleteItems(copied, false);
        } else if (op.kind === 'create' && op.sources[0]) {
          await fs.deleteItems(op.sources, false);
        }
        const { activePaneId } = get();
        await get().refresh(activePaneId);
      } catch { /* best-effort */ }
    },

    redo: async () => {
      const { redoStack } = get();
      if (redoStack.length === 0) return;
      const op = redoStack[redoStack.length - 1];
      set((s) => { s.redoStack.pop(); s.undoStack.push(op); });
      // Re-apply the operation
      try {
        if (op.kind === 'rename' && op.sources[0] && op.oldName && op.newName) {
          const parent = op.sources[0].replace(/[\\/][^\\/]+$/, "");
          await fs.renameItem(parent + "\\" + op.oldName, op.newName);
        } else if (op.kind === 'move' && op.dest) {
          await fs.moveItems(op.sources, op.dest);
        } else if (op.kind === 'copy' && op.dest) {
          await fs.copyItems(op.sources, op.dest);
        } else if (op.kind === 'create' && op.sources[0]) {
          await fs.createDirectory(op.sources[0]);
        }
        const { activePaneId } = get();
        await get().refresh(activePaneId);
      } catch { /* best-effort */ }
    },

    // Copy queue
    addCopyQueueItem: (item) => set((s) => { s.copyQueue.push(item); }),
    updateCopyQueueItem: (id, update) => set((s) => {
      const item = s.copyQueue.find((i) => i.id === id);
      if (item) Object.assign(item, update);
    }),
    removeCopyQueueItem: (id) => set((s) => { s.copyQueue = s.copyQueue.filter((i) => i.id !== id); }),
    toggleCopyQueue: () => set((s) => { s.copyQueueOpen = !s.copyQueueOpen; }),

    // Workspaces
    saveWorkspace: (name) => {
      const { panes, activePaneId, splitMode, splitPaneIds } = get();
      const paths = splitPaneIds
        ? splitPaneIds.map((id) => panes[id]?.path ?? "").filter(Boolean)
        : [panes[activePaneId]?.path ?? ""];
      const workspace: Workspace = { id: crypto.randomUUID(), name, splitMode, paths, createdAt: Date.now() };
      set((s) => { s.workspaces.push(workspace); });
      localStorage.setItem("krb-workspaces", JSON.stringify(get().workspaces));
    },
    loadWorkspace: (id) => {
      const { workspaces } = get();
      const ws = workspaces.find((w) => w.id === id);
      if (!ws) return;
      get().setSplit(ws.splitMode as any);
      // BUG-058 FIX: defer navigate so setSplit's own navigate() call doesn't race
      // with ours and overwrite the workspace paths.
      setTimeout(() => {
        const { panes, activePaneId, splitPaneIds } = get();
        const paneIds = splitPaneIds ?? [activePaneId];
        ws.paths.forEach((path, i) => { if (paneIds[i]) get().navigate(paneIds[i], path); });
      }, 0);
    },
    deleteWorkspace: (id) => {
      set((s) => { s.workspaces = s.workspaces.filter((w) => w.id !== id); });
      localStorage.setItem("krb-workspaces", JSON.stringify(get().workspaces));
    },

    // Row density
    setRowDensity: (d) => {
      set((s) => { s.rowDensity = d; });
      localStorage.setItem("krb-row-density", d);
    },

    // Folder colors
    loadFolderColors: async () => {
      try {
        const entries = await fs.getFolderColors();
        set((s) => { s.folderColors = Object.fromEntries(entries); });
      } catch {}
    },
    setFolderColor: async (path, color) => {
      await fs.setFolderColor(path, color).catch(() => {});
      set((s) => {
        if (color) s.folderColors[path] = color;
        else delete s.folderColors[path];
      });
    },

    // Panels
    toggleActivityLog: () => set((s) => { s.activityLogOpen = !s.activityLogOpen; }),
    toggleLargeFiles: () => set((s) => { s.largeFilesOpen = !s.largeFilesOpen; }),
    openFileVault: (path) => set((s) => { s.fileVaultOpen = true; s.fileVaultPath = path; }),
    closeFileVault: () => set((s) => { s.fileVaultOpen = false; s.fileVaultPath = null; }),
    openPermissions: (path) => set((s) => { s.permissionsPath = path; }),
    closePermissions: () => set((s) => { s.permissionsPath = null; }),
    toggleFtp: () => set((s) => { s.ftpOpen = !s.ftpOpen; }),
    addFtpConnection: (conn) => {
      set((s) => { s.ftpConnections.push(conn); });
      localStorage.setItem("krb-ftp-connections", JSON.stringify(get().ftpConnections));
    },
    removeFtpConnection: (id) => {
      set((s) => { s.ftpConnections = s.ftpConnections.filter((c) => c.id !== id); });
      localStorage.setItem("krb-ftp-connections", JSON.stringify(get().ftpConnections));
    },
    loadWslDistros: async () => {
      try { const distros = await fs.getWslDistros(); set((s) => { s.wslDistros = distros; }); } catch {}
    },
    toggleIndexedSearch: () => set((s) => { s.indexedSearchOpen = !s.indexedSearchOpen; }),
    toggleAi: () => set((s) => { s.aiOpen = !s.aiOpen; }),
    setAiApiKey: (key) => { set((s) => { s.aiApiKey = key; }); localStorage.setItem("krb-ai-key", key); },

    // Session
    saveSession: () => {
      const { panes, activePaneId, splitMode, splitPaneIds } = get();
      const paths = splitPaneIds
        ? splitPaneIds.map((id) => panes[id]?.path ?? "").filter(Boolean)
        : [panes[activePaneId]?.path ?? ""];
      const session = { paths, splitMode };
      localStorage.setItem("krb-last-session", JSON.stringify(session));
      set((s) => { s.lastSession = session; });
    },
    restoreSession: () => {
      const session = get().lastSession;
      if (!session) return;
      if (session.splitMode !== "none") get().setSplit(session.splitMode as any);
      const { panes, activePaneId, splitPaneIds } = get();
      const paneIds = splitPaneIds ?? [activePaneId];
      session.paths.forEach((path, i) => { if (paneIds[i] && path) get().navigate(paneIds[i], path); });
    },

    setGridIconSize: (size) => set((s) => { s.gridIconSize = Math.max(60, Math.min(256, size)); }),
    setHiddenColumns: (cols) => set((s) => { s.hiddenColumns = cols; }),
    setGroupBy: (col) => set((s) => { s.groupBy = col; }),
    setAlwaysOnTop: (v) => {
      set((s) => { s.alwaysOnTop = v; });
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().setAlwaysOnTop(v).catch(() => {});
      }).catch(() => {});
    },
    openRecycleBin: () => set((s) => { s.recycleBinOpen = true; }),
    closeRecycleBin: () => set((s) => { s.recycleBinOpen = false; }),
    openNetworkDriveDialog: () => set((s) => { s.networkDriveOpen = true; }),
    closeNetworkDriveDialog: () => set((s) => { s.networkDriveOpen = false; }),
    openDuplicateFinder: (path) => set((s) => { s.duplicateFinderPath = path; }),
    closeDuplicateFinder: () => set((s) => { s.duplicateFinderPath = null; }),
    toggleShowFolderSizes: () => set((s) => { s.showFolderSizes = !s.showFolderSizes; }),

    toggleCheckboxMode: () => set((s) => { s.checkboxMode = !s.checkboxMode; }),
    toggleShowExtensions: () => set((s) => { s.showExtensions = !s.showExtensions; }),
    toggleShowSystemFiles: () => {
      set((s) => { s.showSystemFiles = !s.showSystemFiles; });
      const { activePaneId } = get();
      get().refresh(activePaneId);
    },

    openProperties: (path) => set((s) => { s.propertiesPath = path; s.propertiesOpen = true; }),
    closeProperties: () => set((s) => { s.propertiesOpen = false; s.propertiesPath = null; }),
    setColumnOrder: (order) => set((s) => { s.columnOrder = order; }),

    loadColumnWidths: async () => {
      try {
        const widths = await db.getColumnWidths();
        set((s) => {
          for (const { col, width } of widths) s.columnWidths[col] = width;
        });
      } catch {}
    },

    setColumnWidth: (col, width) => {
      set((s) => { s.columnWidths[col] = width; });
      db.setColumnWidth(col, width).catch(() => {});
    },
  }))
);
