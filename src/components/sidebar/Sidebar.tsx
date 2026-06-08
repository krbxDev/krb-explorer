import {
  HardDrive, Star, Folder, Home, Download, Music, ImageIcon, Film,
  ChevronDown, ChevronRight, Clock, Bookmark, LogOut
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

export function Sidebar() {
  const {
    activePaneId, panes, drives, favorites, navigate, runGlobalSearch,
    sidebarWidth, openPalette, openTab, addFavorite, removeFavorite, renameFavorite, openProperties,
  } = useStore();
  const pane = panes[activePaneId];
  const activePath = pane?.path ?? "";
  const [recentFiles, setRecentFiles] = useState<HistoryEntry[]>([]);
  const [quickAccessItems, setQuickAccessItems] = useState<SideItem[]>([]);
  const [ctx, setCtx] = useState<CtxState | null>(null);

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
      navigate(activePaneId, item.path);
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
    const isFav = favorites.some((f) => f.path === item.path && !f.isSearch);
    const isDriveRoot = /^[A-Za-z]:[/\\]?$/.test(item.path);

    const newTextFile = async () => {
      navigate(activePaneId, item.path);
      await new Promise((r) => setTimeout(r, 120));
      const base = item.path.replace(/[\\/]+$/, "");
      let name = "New Text Document.txt";
      let i = 1;
      while (true) {
        try { await fs.getFileInfo(base + "\\" + name); name = `New Text Document (${i++}).txt`; } catch { break; }
      }
      await fs.createFile(base + "\\" + name).catch(() => {});
      window.dispatchEvent(new CustomEvent("nova:refresh", { detail: { paneId: activePaneId } }));
    };

    const actions: ContextMenuAction[] = [
      { id: "open",       label: "Open",               action: () => navigate(activePaneId, item.path) },
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
      actions.push({ id: "format-drive", label: "Format…", action: () => fs.formatDrive(item.path).catch(() => {}) });
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
      navigate(activePaneId, item.path);
      setTimeout(() => window.dispatchEvent(new CustomEvent("nova:newfolder", { detail: { paneId: activePaneId } })), 120);
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
    .map((f) => ({ label: f.name, path: f.path, icon: <Star size={13} className="text-[#f4b942]" /> }));

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
      style={{ width: sidebarWidth, minWidth: sidebarWidth }}
    >
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

      {/* Drives */}
      <div className="mb-1">
        <button className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <ChevronDown size={10} /> Drives
        </button>
        <div className="mt-0.5 space-y-0.5 px-1">
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
                  onClick={() => navigate(activePaneId, d.path)}
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
        </div>
      </div>

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
