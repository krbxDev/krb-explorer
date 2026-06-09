import { useEffect, useState } from "react";
import { HardDrive, Clock, Folder, Star, Trash2, Network, Copy, Search } from "lucide-react";
import { homeDir, desktopDir, downloadDir, documentDir, pictureDir } from "@tauri-apps/api/path";
import { useStore } from "../../store";
import { fs, db } from "../../lib/invoke";
import { formatSize } from "../../lib/utils";
import type { DriveInfo, HistoryEntry } from "../../lib/types";

interface Props { paneId: string; }

export function HomePane({ paneId }: Props) {
  const { navigate, drives, loadDrives, favorites, openNetworkDriveDialog, openDuplicateFinder } = useStore();
  const [quickPaths, setQuickPaths] = useState<{ label: string; path: string; icon: React.ReactNode }[]>([]);
  const [recentFolders, setRecentFolders] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // BUG-042 FIX: drives are already loaded by App.tsx on startup; only reload
    // if the drive list is actually empty (e.g. first render before init completes)
    if (drives.length === 0) loadDrives();
    // Build quick access paths
    Promise.all([homeDir(), desktopDir(), downloadDir(), documentDir(), pictureDir()])
      .then(([home, desktop, downloads, docs, pics]) => {
        setQuickPaths([
          { label: "Home", path: home, icon: <Folder size={16} /> },
          { label: "Desktop", path: desktop, icon: <Folder size={16} /> },
          { label: "Downloads", path: downloads, icon: <Folder size={16} /> },
          { label: "Documents", path: docs, icon: <Folder size={16} /> },
          { label: "Pictures", path: pics, icon: <Folder size={16} /> },
        ]);
      }).catch(() => {});
    // Recent folders
    db.getHistory(20, false).then(setRecentFolders).catch(() => {});
  }, []);

  const navTo = (path: string) => navigate(paneId, path);

  return (
    <div className="flex-1 overflow-auto p-6 bg-[var(--bg-base)]">
      <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-5">This PC</h1>

      {/* Drives */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Devices and drives</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {drives.map((d) => (
            <DriveCard key={d.path} drive={d} onClick={() => navTo(d.path)} />
          ))}
          {/* Add Network Drive */}
          <button
            onClick={openNetworkDriveDialog}
            className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors group"
          >
            <div className="w-10 h-10 rounded flex items-center justify-center bg-[var(--bg-surface)] shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]">
              <Network size={20} />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-medium text-[var(--text-secondary)] truncate">Map network drive</div>
              <div className="text-[10px] text-[var(--text-muted)]">Connect to share</div>
            </div>
          </button>
        </div>
      </section>

      {/* Quick access */}
      {quickPaths.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Quick access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {quickPaths.map((q) => (
              <button
                key={q.path}
                onClick={() => navTo(q.path)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="text-[var(--accent)] opacity-80">{q.icon}</div>
                <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-full">{q.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <Star size={10} className="inline mr-1" />Pinned
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
            {favorites.slice(0, 8).map((f) => (
              <button
                key={f.path}
                onClick={() => navTo(f.path)}
                className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <Folder size={13} className="text-[var(--accent)] shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      {recentFolders.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <Clock size={10} className="inline mr-1" />Recent
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
            {recentFolders.slice(0, 12).map((h) => (
              <button
                key={h.path}
                onClick={() => navTo(h.path)}
                className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <Clock size={11} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {h.path.split(/[\\/]/).pop() || h.path}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tools */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Tools</h2>
        <div className="flex gap-3 flex-wrap">
          <ToolButton icon={<Trash2 size={14} />} label="Recycle Bin" onClick={() => navTo("::recycle")} />
          <ToolButton icon={<Copy size={14} />} label="Find Duplicates" onClick={() => {
            const pane = useStore.getState().panes[paneId];
            if (pane?.path) openDuplicateFinder(pane.path);
          }} />
          <ToolButton icon={<Search size={14} />} label="Global Search" onClick={() => {
            window.dispatchEvent(new CustomEvent("nova:openglobalsearch"));
          }} />
        </div>
      </section>
    </div>
  );
}

function DriveCard({ drive, onClick }: { drive: DriveInfo; onClick: () => void }) {
  const used = drive.totalSpace - drive.freeSpace;
  const pct = drive.totalSpace > 0 ? (used / drive.totalSpace) * 100 : 0;
  const lowSpace = pct > 90;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors text-left group"
    >
      <div className="w-10 h-10 rounded flex items-center justify-center bg-[var(--bg-surface)] shrink-0 text-[var(--accent)]">
        <HardDrive size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[var(--text-primary)] truncate">
          {drive.label || "Local Disk"} ({drive.path.replace(/[\\/]$/, "")})
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${lowSpace ? "bg-red-500" : "bg-[var(--accent)]"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
          {formatSize(drive.freeSpace)} free of {formatSize(drive.totalSpace)}
        </div>
      </div>
    </button>
  );
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    >
      <span className="text-[var(--accent)]">{icon}</span>
      {label}
    </button>
  );
}
