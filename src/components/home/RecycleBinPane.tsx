import { useEffect, useState, useCallback } from "react";
import { Trash2, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { formatSize, formatDate } from "../../lib/utils";
import type { FileEntry } from "../../lib/types";
import { FileIcon } from "../filepane/FileIcon";

interface Props { paneId: string; }

export function RecycleBinPane({ paneId }: Props) {
  const { navigate } = useStore();
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fs.getRecycleBinItems();
      setItems(result);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const restore = async (paths: string[]) => {
    // BUG-034 FIX: surface individual restore errors instead of silencing them
    const errors: string[] = [];
    for (const p of paths) {
      try {
        await fs.restoreFromRecycleBin(p);
      } catch (e: any) {
        errors.push(String(e));
      }
    }
    setSelected(new Set());
    load();
    if (errors.length > 0) {
      console.error("Restore errors:", errors);
      alert(`Some items could not be restored:\n${errors.slice(0, 5).join("\n")}`);
    }
  };

  const emptyBin = async () => {
    if (!confirm("Permanently delete all items in the Recycle Bin?")) return;
    await fs.emptyRecycleBin().catch(() => {});
    load();
  };

  const toggleSel = (path: string, e: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.ctrlKey) {
        if (next.has(path)) next.delete(path); else next.add(path);
      } else if (e.shiftKey && prev.size > 0) {
        // range select
        const paths = items.map(i => i.path);
        const last = [...prev].pop()!;
        const fromIdx = paths.indexOf(last);
        const toIdx = paths.indexOf(path);
        const [lo, hi] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
        return new Set(paths.slice(lo, hi + 1));
      } else {
        return new Set([path]);
      }
      return next;
    });
  };

  const selItems = items.filter(i => selected.has(i.path));
  const totalSize = selItems.reduce((s, i) => s + (i.size ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] mr-2">
          <Trash2 size={14} />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Recycle Bin</span>
        </div>

        <button
          onClick={() => restore(selected.size > 0 ? [...selected] : items.map(i => i.path))}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RotateCcw size={12} />
          {selected.size > 0 ? `Restore ${selected.size} item(s)` : "Restore all"}
        </button>

        <button
          onClick={emptyBin}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <AlertTriangle size={12} />
          Empty Recycle Bin
        </button>

        <div className="flex-1" />

        <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <RefreshCw size={11} />
          Refresh
        </button>

        <button
          onClick={() => navigate(paneId, "::home")}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm px-8 text-center">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-muted)]">
            <Trash2 size={40} className="opacity-20" />
            <span className="text-sm">Recycle Bin is empty</span>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-3 py-1.5 text-[var(--text-muted)] font-medium w-7"></th>
                <th className="text-left px-2 py-1.5 text-[var(--text-muted)] font-medium">Name</th>
                <th className="text-left px-2 py-1.5 text-[var(--text-muted)] font-medium w-36">Original location</th>
                <th className="text-left px-2 py-1.5 text-[var(--text-muted)] font-medium w-36">Date deleted</th>
                <th className="text-right px-3 py-1.5 text-[var(--text-muted)] font-medium w-20">Size</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const sel = selected.has(item.path);
                const parent = item.path.replace(/[\\/][^\\/]+$/, "");
                return (
                  <tr
                    key={item.path}
                    onClick={(e) => toggleSel(item.path, e)}
                    onDoubleClick={() => restore([item.path])}
                    className={`cursor-default transition-colors ${sel
                      ? "bg-[var(--bg-selected)]"
                      : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <td className="px-3 py-1">
                      <FileIcon entry={item} size={13} />
                    </td>
                    <td className="px-2 py-1">
                      <span className="truncate block max-w-xs">{item.name}</span>
                    </td>
                    <td className="px-2 py-1 text-[var(--text-muted)] truncate max-w-[140px]">{parent}</td>
                    <td className="px-2 py-1 text-[var(--text-muted)]">{formatDate(item.modified)}</td>
                    <td className="px-3 py-1 text-right text-[var(--text-muted)]">
                      {item.isDir ? "" : formatSize(item.size)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status */}
      {items.length > 0 && (
        <div className="flex items-center px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg-surface)] text-[10px] text-[var(--text-muted)] shrink-0">
          {selected.size > 0
            ? `${selected.size} item(s) selected · ${formatSize(totalSize)}`
            : `${items.length} item(s)`
          }
        </div>
      )}
    </div>
  );
}
