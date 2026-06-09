import { useState, useEffect } from "react";
import { Copy, X, Trash2, Loader2, FolderOpen } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { formatSize } from "../../lib/utils";

export function DuplicateFinderModal() {
  const { duplicateFinderPath, closeDuplicateFinder, activePaneId, navigate, refresh } = useStore();
  const [groups, setGroups] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (duplicateFinderPath) {
      setGroups([]);
      setSelected(new Set());
      setSearched(false);
      setError(null);
    }
  }, [duplicateFinderPath]);

  if (!duplicateFinderPath) return null;

  const run = async () => {
    setLoading(true); setError(null); setSearched(false);
    try {
      const result = await fs.findDuplicateFiles(duplicateFinderPath);
      setGroups(result);
      setSearched(true);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const selectAllButFirst = () => {
    const toSelect = new Set<string>();
    for (const group of groups) {
      group.slice(1).forEach(p => toSelect.add(p));
    }
    setSelected(toSelect);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} duplicate file(s)? This cannot be undone.`)) return;
    for (const p of selected) {
      await fs.deleteItems([p], false).catch(() => {});
    }
    setSelected(new Set());
    await run();
    refresh(activePaneId);
  };

  const totalWaste = groups.reduce((sum, g) => {
    if (g.length < 2) return sum;
    // All but one are "waste" — use the first to get size (we don't have sizes here, estimate 0)
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeDuplicateFinder}>
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Copy size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Duplicate File Finder</span>
          </div>
          <button onClick={closeDuplicateFinder} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Path + run */}
        <div className="px-5 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-[var(--bg-base)] rounded px-3 py-1.5 border border-[var(--border)]">
              <FolderOpen size={12} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-xs text-[var(--text-secondary)] truncate">{duplicateFinderPath}</span>
            </div>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
              {loading ? "Scanning…" : "Find Duplicates"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center h-40 text-[var(--text-muted)]">
              <Copy size={32} className="opacity-20 mb-3" />
              <span className="text-sm">Click "Find Duplicates" to scan the folder</span>
            </div>
          )}

          {error && (
            <div className="m-4 text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</div>
          )}

          {searched && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-[var(--text-muted)]">
              <Copy size={32} className="opacity-20 mb-3" />
              <span className="text-sm">No duplicate files found</span>
            </div>
          )}

          {groups.length > 0 && (
            <div className="p-4 space-y-4">
              {groups.map((group, gi) => (
                <div key={gi} className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                    Group {gi + 1} — {group.length} identical files
                  </div>
                  {group.map((path, fi) => (
                    <div
                      key={path}
                      className={`flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${selected.has(path) ? "bg-[var(--bg-selected)]" : fi % 2 === 0 ? "bg-[var(--bg-base)]/60" : ""}`}
                      onClick={() => toggleFile(path)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(path)}
                        readOnly
                        className="w-3.5 h-3.5 accent-[var(--accent)] shrink-0"
                      />
                      <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{path}</span>
                      {fi === 0 && (
                        <span className="text-[10px] text-[var(--accent)] shrink-0">Keep</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {searched && groups.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface)]">
            <div className="text-xs text-[var(--text-muted)]">
              {selected.size > 0 ? `${selected.size} selected` : `${groups.length} group(s) found`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllButFirst}
                className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Select all duplicates
              </button>
              <button
                onClick={deleteSelected}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <Trash2 size={11} />
                Delete selected ({selected.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
