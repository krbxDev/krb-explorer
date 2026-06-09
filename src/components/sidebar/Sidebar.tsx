import {
  HardDrive, Star, Folder, Home, Download, Music, ImageIcon, Film,
  ChevronDown, ChevronRight, Clock, Bookmark, LogOut, Trash2, Network, Search,
  Terminal
} from "lucide-react";
import { useState, useEffect } from "react";
import { homeDir, desktopDir, downloadDir, documentDir, pictureDir, audioDir, videoDir } from "@tauri-apps/api/path";
import { useStore } from "../../store";
import { db, fs } from "../../lib/invoke";
import { cn, formatSize } from "../../lib/utils";
import { ContextMenu } from "../filepane/ContextMenu";
import type { HistoryEntry } from "../../lib/types";
import type { ContextMenuAction } from "../../lib/types";

interface SideItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  extra?: string;
  isSearch?: boolean;
  searchQuery?: string;
  isRemovable?: boolean;
}

interface CtxState { x: number; y: number; item: SideItem; type: "folder" | "drive" | "favorite" | "recent" }

function SidebarItem({ item, active, onClick, onContextMenu }: {
  item: SideItem;
  active: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs transition-colors",
        active
          ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      <span className="shrink-0 text-[var(--text-muted)]">{item.icon}</span>
      <span className="truncate flex-1 text-left">{item.label}</span>
      {item.extra && <span className="text-[var(--text-muted)] text-[10px] shrink-0">{item.extra}</span>}
    </button>
  );
}

function Section({ label, items, activePath, onNavigate, onContextMenu, defaultOpen = true }: {
  label: string;
  items: SideItem[];
  activePath: string;
  onNavigate: (item: SideItem) => void;
  onContextMenu: (e: React.MouseEvent, item: SideItem) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {label}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 px-1">
          {items.map((item) => (
            <SidebarItem
              key={item.path}
              item={item}
              active={activePath === item.path}
              onClick={() => onNavigate(item)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Expandable folder tree node
const MAX_TREE_DEPTH = 8; // BUG-032 FIX: prevent infinite recursion via symlink loops

function FolderTreeNode({ path, depth, activePath, onNavigate }: {
  path: string; depth: number; activePath: string; onNavigate: (p: string) => void;
}) {
  if (depth > MAX_TREE_DEPTH) return null;
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<string[]>([]);
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) {
      try {
        const entries = await fs.listDirectory(path, false);
        setChildren(entries.filter((x) => x.isDir).map((x) => x.path));
      } catch {}
    }
    setExpanded((v) => !v);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] transition-colors",
          activePath === path && "bg-[var(--bg-selected)]"
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onNavigate(path)}
      >
        <button onClick={toggle} className="shrink-0 w-4 h-4 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        </button>
        <Folder size={12} className="text-[var(--accent)] shrink-0 opacity-70" />
        <span className="text-[11px] text-[var(--text-secondary)] truncate">{name}</span>
      </div>
      {expanded && children.map((child) => (
        <FolderTreeNode key={child} path={child} depth={depth + 1} activePath={activePath} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

interface SidebarProps {
  /** Override which pane navigation targets (used in split mode). Defaults to activePaneId. */
  paneId?: string;
  /** Width override for split panes */
  width?: number;
  /** If provided, shows a collapse button at the top */
  onCollapse?: () => void;
}

export function Sidebar({ paneId: paneIdProp, width, onCollapse }: SidebarProps = {}) {
  const {
    activePaneId, panes, drives, favorites, navigate, runGlobalSearch,
    sidebarWidth, openPalette, openTab, addFavorite, removeFavorite, renameFavorite, openProperties,
    openNetworkDriveDialog, wslDistros, folderColors,
  } = useStore();
  const paneId = paneIdProp ?? activePaneId;
  const pane = panes[paneId] ?? panes[activePaneId];
  const activePath = pane?.path ?? "";
  const [recentFiles, setRecentFiles] = useState<HistoryEntry[]>([]);
  const [quickAccessItems, setQuickAccessItems] = useState<SideItem[]>([]);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [drivesOpen, setDrivesOpen] = useState(true);

  useEffect(() => {
    Promise.all([
      homeDir(), desktopDir(), downloadDir(), documentDir(), pictureDir(), audioDir(), videoDir(),
    ]).then(([home, desktop, downloads, documents, pictures, music, videos]) => {
      setQuickAccessItems([
        { label: "Home",      path: home.replace(/[\\/]$/, ""),      icon: <Home size={13} /> },
        { label: "Desktop",   path: desktop.replace(/[\\/]$/, ""),   icon: <Home size={13} /> },
        { label: "Downloads", path: downloads.replace(/[\\/]$/, ""), icon: <Download size={13} /> },
        { label: "Documents", path: documents.replace(/[\\/]$/, ""), icon: <Folder size={13} /> },
        { label: "Pictures",  path: pictures.replace(/[\\/]$/, ""),  icon: <ImageIcon size={13} /> },
        { label: "Music",     path: music.replace(/[\\/]$/, ""),     icon: <Music size={13} /> },
        { label: "Videos",    path: videos.replace(/[\\/]$/, ""),    icon: <Film size={13} /> },
      ]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    db.getHistory(15, true).then(setRecentFiles).catch(() => {});
  }, [activePath]);

  const handleNavigate = (item: SideItem) => {
    if (item.isSearch && item.searchQuery) {
      runGlobalSearch(item.searchQuery, item.path);
      openPalette();
    } else {
      navigate(paneId, item.path);
    }
  };

  const copyPath = (path: string) => navigator.clipboard.writeText(path).catch(() => {});

  const openInNewWindow = (path: string) => {
    import("@tauri-apps/api/webviewWindow").then(({ WebviewWindow }) => {
      new WebviewWindow(`window-${Date.now()}`, {
        url: `/?path=${encodeURIComponent(path)}`,
        title: "KRB Explorer",
        width: 1100, height: 700,
      });
    }).catch(() => {});
  };

  const buildActions = (item: SideItem, type: CtxState["type"]): ContextMenuAction[] => {
    const isVirtual = item.path.startsWith("::");
    const isFav = favorites.some((f) => f.path === item.path && !f.isSearch);
    const isDriveRoot = /^[A-Za-z]:[/\\]?$/.test(item.path);

    // This PC
    if (item.path === "::home") {
      return [
        { id: "open",       label: "Open",               action: () => navigate(paneId, "::home") },
        { id: "new-window", label: "Open in new window",  action: () => openInNewWindow("::home") },
        { id: "sep1", label: "", separator: true, action: () => {} },
        { id: "map-drive",        label: "Map network drive…",        action: () => openNetworkDriveDialog() },
        { id: "disconnect-drive", label: "Disconnect network drive…", action: () => openNetworkDriveDialog() },
        { id: "sep2", label: "", separator: true, action: () => {} },
        // BUG-055 FIX: removed spurious openTerminalAt("") side-effect
        { id: "properties", label: "Properties", action: () => {
            import("@tauri-apps/plugin-shell").then(({ Command }) =>
              Command.create("rundll32", ["shell32.dll,Control_RunDLL", "sysdm.cpl"]).execute()
            ).catch(() => {});
          }
        },
      ];
    }

    // Recycle Bin
    if (item.path === "::recycle") {
      const isFavRecycle = favorites.some((f) => f.path === "::recycle" && !f.isSearch);
      return [
        { id: "open", label: "Open", action: () => navigate(paneId, "::recycle") },
        { id: "sep1", label: "", separator: true, action: () => {} },
        {
          id: "empty-recycle",
          label: "Empty Recycle Bin",
          danger: true,
          action: async () => {
            if (confirm("Permanently delete all items in the Recycle Bin?")) {
              await fs.emptyRecycleBin().catch(() => {});
            }
          },
        },
        { id: "sep2", label: "", separator: true, action: () => {} },
        isFavRecycle
          ? { id: "unpin", label: "Unpin from Quick access", danger: true, action: () => removeFavorite("::recycle") }
          : { id: "pin",   label: "Pin to Quick access",                    action: () => addFavorite("::recycle", "Recycle Bin") },
        { id: "sep3", label: "", separator: true, action: () => {} },
        { id: "properties", label: "Properties", action: () => openProperties("::recycle") },
      ];
    }

    const newTextFile = async () => {
      navigate(paneId, item.path);
      await new Promise((r) => setTimeout(r, 120));
      const base = item.path.replace(/[\\/]+$/, "");
      let name = "New Text Document.txt";
      let i = 1;
      while (true) {
        try { await fs.getFileInfo(base + "\\" + name); name = `New Text Document (${i++}).txt`; } catch { break; }
      }
      await fs.createFile(base + "\\" + name).catch(() => {});
      window.dispatchEvent(new CustomEvent("nova:refresh", { detail: { paneId } }));
    };

    const actions: ContextMenuAction[] = [
      { id: "open",       label: "Open",               action: () => navigate(paneId, item.path) },
      { id: "new-tab",    label: "Open in new tab",    action: () => { openTab(item.path); } },
      { id: "new-window", label: "Open in new window", action: () => openInNewWindow(item.path) },
      { id: "sep1", label: "", separator: true, action: () => {} },
    ];

    // Pin to Quick access
    if (type !== "favorite") {
      if (isFav) {
        actions.push({ id: "unpin-quick", label: "Unpin from Quick access", action: () => removeFavorite(item.path), danger: true });
      } else {
        actions.push({ id: "pin-quick", label: "Pin to Quick access", action: () => addFavorite(item.path, item.label) });
      }
    }

    // Give access to
    actions.push({ id: "give-access", label: "Give access to", action: () => fs.openShareDialog(item.path).catch(() => {}) });

    // Restore previous versions
    actions.push({ id: "prev-versions", label: "Restore previous versions", action: () => fs.showPreviousVersions(item.path).catch(() => {}) });

    // Scan with Defender
    actions.push({ id: "scan-virus", label: "Scan with Windows Defender", action: () => fs.scanWithDefender([item.path]).catch(() => {}) });

    // Pin to Start
    actions.push({ id: "pin-start", label: "Pin to Start", action: () => fs.pinToStart(item.path).catch(() => {}) });

    // Format (drives only)
    if (isDriveRoot) {
      actions.push({ id: "format-drive", label: "Format…", action: () => fs.formatDrive(item.path).catch((e: unknown) => alert(`Format failed: ${e}`)) });
    }

    if (type === "favorite") {
      actions.push({ id: "sep2", label: "", separator: true, action: () => {} });
      actions.push({ id: "rename-fav", label: "Rename", action: () => {
        const newName = window.prompt("Rename favorite:", item.label);
        if (newName && newName.trim() && newName.trim() !== item.label) renameFavorite(item.path, newName.trim());
      }});
      actions.push({ id: "unfav", label: "Remove from Favorites", action: () => removeFavorite(item.path), danger: true });
    }

    actions.push({ id: "sep3", label: "", separator: true, action: () => {} });

    // New submenu
    actions.push({ id: "newfolder", label: "New → Folder", action: () => {
      navigate(paneId, item.path);
      setTimeout(() => window.dispatchEvent(new CustomEvent("nova:newfolder", { detail: { paneId } })), 120);
    }});
    actions.push({ id: "new-text", label: "New → Text Document", action: newTextFile });

    actions.push({ id: "sep4", label: "", separator: true, action: () => {} });
    actions.push({ id: "copy-path",  label: "Copy path",      action: () => copyPath(item.path) });
    actions.push({ id: "terminal",   label: "Open in Terminal", action: () => fs.openTerminalAt(item.path).catch(() => {}) });
    actions.push({ id: "properties", label: "Properties",      action: () => openProperties(item.path) });

    if (type === "drive" && item.isRemovable) {
      actions.push({ id: "sep5", label: "", separator: true, action: () => {} });
      actions.push({ id: "eject", label: "Eject", danger: true,
        action: () => fs.ejectDrive(item.path).then(() => useStore.getState().loadDrives()).catch(() => {}),
      });
    }

    return actions;
  };

  const favoriteItems: SideItem[] = favorites
    .filter((f) => !f.isSearch)
    .map((f) => ({
      label: f.name,
      path: f.path,
      icon: folderColors[f.path]
        ? <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: folderColors[f.path] }} />
        : <Star size={13} className="text-[#f4b942]" />,
    }));

  const savedSearchItems: SideItem[] = favorites
    .filter((f) => f.isSearch)
    .map((f) => ({
      label: f.name, path: f.path, icon: <Bookmark size={13} />,
      isSearch: true, searchQuery: f.searchQuery ?? undefined,
    }));

  const recentFileItems: SideItem[] = recentFiles.slice(0, 10).map((h) => ({
    label: h.path.split(/[\\/]/).pop() ?? h.path,
    path: h.path,
    icon: <Clock size={13} />,
  }));

  return (
    <div
      className="h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] overflow-y-auto py-2"
      style={{ width: width ?? sidebarWidth, minWidth: width ?? sidebarWidth }}
    >
      {/* Collapse button (split mode only) */}
      {onCollapse && (
        <div className="flex justify-end px-1 mb-1">
          <button onClick={onCollapse} title="Collapse sidebar"
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m15 9-3 3 3 3"/></svg>
          </button>
        </div>
      )}

      {/* This PC / Home */}
      <div className="px-1 mb-1">
        <button
          onClick={() => navigate(paneId, "::home")}
          onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, item: { label: "This PC", path: "::home", icon: <Home size={13} /> }, type: "folder" }); }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs transition-colors",
            activePath === "::home"
              ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          )}
        >
          <Home size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="truncate flex-1 text-left">This PC</span>
        </button>
        <button
          onClick={() => navigate(paneId, "::recycle")}
          onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, item: { label: "Recycle Bin", path: "::recycle", icon: <Trash2 size={13} /> }, type: "folder" }); }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs transition-colors",
            activePath === "::recycle"
              ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          )}
        >
          <Trash2 size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="truncate flex-1 text-left">Recycle Bin</span>
        </button>
      </div>

      <Section label="Quick Access" items={quickAccessItems} activePath={activePath} onNavigate={handleNavigate}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "folder" })} />
      <Section label="Favorites" items={favoriteItems} activePath={activePath} onNavigate={handleNavigate}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "favorite" })}/>
      <Section label="Saved Searches" items={savedSearchItems} activePath={activePath} onNavigate={handleNavigate}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "folder" })}
        defaultOpen={savedSearchItems.length > 0} />
      <Section label="Recent Files" items={recentFileItems} activePath={activePath} onNavigate={handleNavigate}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "recent" })}
        defaultOpen={false} />

      {/* Drives — BUG-031 FIX: collapsible */}
      <div className="mb-1">
        <button onClick={() => setDrivesOpen((v) => !v)} className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          {drivesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Drives
        </button>
        {drivesOpen && <div className="mt-0.5 space-y-0.5 px-1">
          {drives.map((d) => {
            const driveItem: SideItem = {
              label: d.label ? `${d.label} (${d.name})` : d.name,
              path: d.path,
              icon: <HardDrive size={13} />,
              extra: d.totalSpace > 0 ? formatSize(d.freeSpace) + " free" : undefined,
              isRemovable: d.driveType === "Removable",
            };
            return (
              <div key={d.path} className="flex items-center gap-1">
                <button
                  onClick={() => navigate(paneId, d.path)}
                  onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, item: driveItem, type: "drive" }); }}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs transition-colors text-left",
                    activePath === d.path
                      ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <HardDrive size={13} className="text-[var(--text-muted)] shrink-0" />
                  <span className="truncate flex-1">{d.label ? `${d.label} (${d.name})` : d.name}</span>
                  {d.totalSpace > 0 && (
                    <span className="text-[var(--text-muted)] text-[10px] shrink-0">{formatSize(d.freeSpace)}</span>
                  )}
                </button>
                {d.driveType === "Removable" && (
                  <button
                    onClick={() => fs.ejectDrive(d.path).then(() => useStore.getState().loadDrives()).catch(() => {})}
                    title={`Eject ${d.name}`}
                    className="shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <LogOut size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>}
      </div>

      {/* Network drive */}
      <div className="px-1 mb-1">
        <button
          onClick={openNetworkDriveDialog}
          className="w-full flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Network size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="flex-1 text-left">Map network drive…</span>
        </button>
      </div>

      {/* WSL distros */}
      {wslDistros.length > 0 && (
        <div className="mb-1">
          <button className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <ChevronDown size={10} /> Linux (WSL)
          </button>
          <div className="mt-0.5 space-y-0.5 px-1">
            {wslDistros.map((d) => (
              <button
                key={d.name}
                onClick={() => navigate(paneId, d.home_path)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1 rounded-[var(--radius-sm)] text-xs transition-colors",
                  activePath === d.home_path
                    ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                <Terminal size={12} className="text-[var(--text-muted)] shrink-0" />
                <span className="truncate flex-1 text-left">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Folder tree for current location */}
      {activePath && !activePath.startsWith("::") && /^[A-Za-z]:/.test(activePath) && (() => {
        const drivePath = activePath.slice(0, 3); // e.g. "C:\"
        return (
          <div className="mb-1">
            <button
              className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <ChevronDown size={10} /> Folder Tree
            </button>
            <div className="mt-0.5 px-1 max-h-[200px] overflow-y-auto">
              <FolderTreeNode
                path={drivePath}
                depth={0}
                activePath={activePath}
                onNavigate={(p) => navigate(paneId, p)}
              />
            </div>
          </div>
        );
      })()}

      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          actions={buildActions(ctx.item, ctx.type)}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  );
}
