import {
  HardDrive, Star, Folder, Home, Download, Music, ImageIcon, Film,
  ChevronDown, ChevronRight, Clock, Bookmark, LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { homeDir, desktopDir, downloadDir, documentDir, pictureDir, audioDir, videoDir } from "@tauri-apps/api/path";
import { useStore } from "../../store";
import { db, fs } from "../../lib/invoke";
import { cn, formatSize } from "../../lib/utils";
import type { HistoryEntry } from "../../lib/types";

interface SideItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  extra?: string;
  isSearch?: boolean;
  searchQuery?: string;
}

function SidebarItem({ item, active, onClick }: { item: SideItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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

function Section({ label, items, activePath, onNavigate, defaultOpen = true }: {
  label: string;
  items: SideItem[];
  activePath: string;
  onNavigate: (item: SideItem) => void;
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { activePaneId, panes, drives, favorites, navigate, runGlobalSearch, sidebarWidth, openPalette } = useStore();
  const pane = panes[activePaneId];
  const activePath = pane?.path ?? "";
  const [recentFiles, setRecentFiles] = useState<HistoryEntry[]>([]);
  const [quickAccessItems, setQuickAccessItems] = useState<SideItem[]>([]);

  // Resolve real user dirs from OS (Desktop, Downloads, etc. → C:\Users\kiero\...)
  useEffect(() => {
    Promise.all([
      homeDir(),
      desktopDir(),
      downloadDir(),
      documentDir(),
      pictureDir(),
      audioDir(),
      videoDir(),
    ]).then(([home, desktop, downloads, documents, pictures, music, videos]) => {
      setQuickAccessItems([
        { label: "Home", path: home.replace(/[\\/]$/, ""), icon: <Home size={13} /> },
        { label: "Desktop", path: desktop.replace(/[\\/]$/, ""), icon: <Home size={13} /> },
        { label: "Downloads", path: downloads.replace(/[\\/]$/, ""), icon: <Download size={13} /> },
        { label: "Documents", path: documents.replace(/[\\/]$/, ""), icon: <Folder size={13} /> },
        { label: "Pictures", path: pictures.replace(/[\\/]$/, ""), icon: <ImageIcon size={13} /> },
        { label: "Music", path: music.replace(/[\\/]$/, ""), icon: <Music size={13} /> },
        { label: "Videos", path: videos.replace(/[\\/]$/, ""), icon: <Film size={13} /> },
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

  const favoriteItems: SideItem[] = favorites
    .filter((f) => !f.isSearch)
    .map((f) => ({
      label: f.name,
      path: f.path,
      icon: <Star size={13} className="text-[#f4b942]" />,
    }));

  const savedSearchItems: SideItem[] = favorites
    .filter((f) => f.isSearch)
    .map((f) => ({
      label: f.name,
      path: f.path,
      icon: <Bookmark size={13} />,
      isSearch: true,
      searchQuery: f.searchQuery ?? undefined,
    }));

  const driveItems: SideItem[] = drives.map((d) => ({
    label: d.label ? `${d.label} (${d.name})` : d.name,
    path: d.path,
    icon: <HardDrive size={13} />,
    extra: d.totalSpace > 0 ? formatSize(d.freeSpace) + " free" : undefined,
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
      <Section label="Quick Access" items={quickAccessItems} activePath={activePath} onNavigate={handleNavigate} />
      <Section label="Favorites" items={favoriteItems} activePath={activePath} onNavigate={handleNavigate} />
      <Section label="Saved Searches" items={savedSearchItems} activePath={activePath} onNavigate={handleNavigate} defaultOpen={savedSearchItems.length > 0} />
      <Section label="Recent Files" items={recentFileItems} activePath={activePath} onNavigate={handleNavigate} defaultOpen={false} />
      {/* Drives with eject button for removable */}
      <div className="mb-1">
        <button
          className="w-full flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ChevronDown size={10} />
          Drives
        </button>
        <div className="mt-0.5 space-y-0.5 px-1">
          {drives.map((d) => (
            <div key={d.path} className="flex items-center gap-1">
              <button
                onClick={() => navigate(activePaneId, d.path)}
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
          ))}
        </div>
      </div>
    </div>
  );
}
