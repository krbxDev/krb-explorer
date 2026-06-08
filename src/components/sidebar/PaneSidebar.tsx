import {
  HardDrive, Star, Folder, Home, Download, Music, ImageIcon, Film,
  ChevronDown, ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import { homeDir, desktopDir, downloadDir, documentDir, pictureDir, audioDir, videoDir } from "@tauri-apps/api/path";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { cn, formatSize } from "../../lib/utils";
import { ContextMenu } from "../filepane/ContextMenu";
import type { ContextMenuAction } from "../../lib/types";

interface SideItem { label: string; path: string; icon: React.ReactNode; extra?: string; isRemovable?: boolean }
interface CtxState { x: number; y: number; item: SideItem; type: "folder" | "drive" | "favorite" }

function Item({ item, active, onClick, onContextMenu }: {
  item: SideItem; active: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={item.label}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors text-left",
        active
          ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      <span className="shrink-0 text-[var(--text-muted)]">{item.icon}</span>
      <span className="truncate flex-1">{item.label}</span>
      {item.extra && <span className="text-[10px] text-[var(--text-muted)] shrink-0">{item.extra}</span>}
    </button>
  );
}

function Section({ label, items, activePath, onNavigate, onContextMenu, defaultOpen = true }: {
  label: string; items: SideItem[]; activePath: string;
  onNavigate: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, item: SideItem) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        {label}
      </button>
      {open && (
        <div className="space-y-px px-0.5">
          {items.map((item) => (
            <Item
              key={item.path} item={item} active={activePath === item.path}
              onClick={() => onNavigate(item.path)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  paneId: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function PaneSidebar({ paneId, collapsed, onToggle }: Props) {
  const { panes, drives, favorites, navigate, openTab, addFavorite, removeFavorite, renameFavorite, openProperties } = useStore();
  const activePath = panes[paneId]?.path ?? "";
  const [quickAccess, setQuickAccess] = useState<SideItem[]>([]);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  useEffect(() => {
    Promise.all([
      homeDir(), desktopDir(), downloadDir(), documentDir(), pictureDir(), audioDir(), videoDir(),
    ]).then(([home, desktop, downloads, documents, pictures, music, videos]) => {
      setQuickAccess([
        { label: "Home",      path: home.replace(/[\\/]$/, ""),      icon: <Home size={12} /> },
        { label: "Desktop",   path: desktop.replace(/[\\/]$/, ""),   icon: <Home size={12} /> },
        { label: "Downloads", path: downloads.replace(/[\\/]$/, ""), icon: <Download size={12} /> },
        { label: "Documents", path: documents.replace(/[\\/]$/, ""), icon: <Folder size={12} /> },
        { label: "Pictures",  path: pictures.replace(/[\\/]$/, ""),  icon: <ImageIcon size={12} /> },
        { label: "Music",     path: music.replace(/[\\/]$/, ""),     icon: <Music size={12} /> },
        { label: "Videos",    path: videos.replace(/[\\/]$/, ""),    icon: <Film size={12} /> },
      ]);
    }).catch(() => {});
  }, []);

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
      { id: "new-tab",    label: "Open in new tab",    action: () => openTab(item.path) },
      { id: "new-window", label: "Open in new window", action: () => openInNewWindow(item.path) },
      { id: "sep1",       label: "", separator: true, action: () => {} },
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
    actions.push({ id: "give-access",   label: "Give access to",            action: () => fs.openShareDialog(item.path).catch(() => {}) });
    // Restore previous versions
    actions.push({ id: "prev-versions", label: "Restore previous versions", action: () => fs.showPreviousVersions(item.path).catch(() => {}) });
    // Scan with Defender
    actions.push({ id: "scan-virus",    label: "Scan with Windows Defender", action: () => fs.scanWithDefender([item.path]).catch(() => {}) });
    // Pin to Start
    actions.push({ id: "pin-start",     label: "Pin to Start",              action: () => fs.pinToStart(item.path).catch(() => {}) });

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
      actions.push({ id: "unfav", label: "Remove from Favorites", danger: true, action: () => removeFavorite(item.path) });
    }

    actions.push({ id: "sep3", label: "", separator: true, action: () => {} });

    // New submenu
    actions.push({ id: "newfolder", label: "New → Folder", action: () => {
      navigate(paneId, item.path);
      setTimeout(() => window.dispatchEvent(new CustomEvent("nova:newfolder", { detail: { paneId } })), 120);
    }});
    actions.push({ id: "new-text", label: "New → Text Document", action: newTextFile });

    actions.push({ id: "sep4", label: "", separator: true, action: () => {} });
    actions.push({ id: "copy-path",  label: "Copy path",       action: () => copyPath(item.path) });
    actions.push({ id: "terminal",   label: "Open in Terminal", action: () => fs.openTerminalAt(item.path).catch(() => {}) });
    actions.push({ id: "properties", label: "Properties",       action: () => openProperties(item.path) });

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
    .map((f) => ({ label: f.name, path: f.path, icon: <Star size={12} className="text-[#f4b942]" /> }));

  if (collapsed) {
    return (
      <div className="flex flex-col items-center pt-1 border-r border-[var(--border)] bg-[var(--bg-surface)]" style={{ width: 28, minWidth: 28 }}>
        <button
          onClick={onToggle}
          title="Expand panel"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <PanelLeftOpen size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg-surface)] overflow-y-auto py-1" style={{ width: 148, minWidth: 148 }}>
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-1 mb-1">
        <button
          onClick={onToggle}
          title="Collapse panel"
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <PanelLeftClose size={12} />
        </button>
      </div>

      <Section label="Quick Access" items={quickAccess} activePath={activePath}
        onNavigate={(p) => navigate(paneId, p)}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "folder" })} />

      <Section label="Favorites" items={favoriteItems} activePath={activePath}
        onNavigate={(p) => navigate(paneId, p)}
        onContextMenu={(e, item) => setCtx({ x: e.clientX, y: e.clientY, item, type: "favorite" })}
        defaultOpen={favoriteItems.length > 0} />

      {/* Drives */}
      <div className="mb-1">
        <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <ChevronDown size={9} /> Drives
        </div>
        <div className="space-y-px px-0.5">
          {drives.map((d) => {
            const driveItem: SideItem = {
              label: d.label ? `${d.label} (${d.name})` : d.name,
              path: d.path,
              icon: <HardDrive size={12} />,
              extra: d.totalSpace > 0 ? formatSize(d.freeSpace) + " free" : undefined,
              isRemovable: d.driveType === "Removable",
            };
            return (
              <div key={d.path} className="flex items-center gap-0.5">
                <button
                  onClick={() => navigate(paneId, d.path)}
                  onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, item: driveItem, type: "drive" }); }}
                  title={driveItem.label}
                  className={cn(
                    "flex-1 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors text-left",
                    activePath === d.path
                      ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <HardDrive size={12} className="text-[var(--text-muted)] shrink-0" />
                  <span className="truncate flex-1">{d.label ? `${d.label} (${d.name})` : d.name}</span>
                  {d.totalSpace > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">{formatSize(d.freeSpace)}</span>
                  )}
                </button>
                {d.driveType === "Removable" && (
                  <button
                    onClick={() => fs.ejectDrive(d.path).then(() => useStore.getState().loadDrives()).catch(() => {})}
                    title={`Eject ${d.name}`}
                    className="shrink-0 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)]"
                  >
                    <LogOut size={10} />
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
