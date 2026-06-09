import { useState, useCallback } from "react";
import { HardDrive, X, Search, FolderOpen, Trash2 } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { formatSize } from "../../lib/utils";

export function LargeFilesModal() {
  const { largeFilesOpen, toggleLargeFiles, activePaneId, panes, navigate, refresh } = useStore();
  const pane = panes[activePaneId];
  const [results, setResults] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const run = useCallback(async () => {
    if (!pane?.path) return;
    setLoading(true); setScanned(false);
    try {
      const r = await fs.findLargeFiles(pane.path, 100);
      setResults(r);
      setScanned(true);
    } catch (e: any) {
      console.error(e);
      alert(`Scan failed: ${String(e)}`);
    } finally { setLoading(false); }
  }, [pane?.path]);

  const deleteSelected = async () => {
    if (!confirm(`Permanently delete ${selected.size} file(s)?`)) return;
    try {
      await fs.deleteItems([...selected], false);
    } catch (e: any) {
      alert(`Delete failed: ${String(e)}`);
    }
    setResults((r) => r.filter(([p]) => !selected.has(p)));
    setSelected(new Set());
    refresh(activePaneId);
  };

  if (!largeFilesOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={toggleLargeFiles}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Large Files Finder</span>
          </div>
          <button onClick={toggleLargeFiles} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface)] flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-[var(--bg-base)] rounded px-3 py-1.5 border border-[var(--border)]">
            <FolderOpen size={12} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-xs text-[var(--text-secondary)] truncate">{pane?.path}</span>
          </div>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 disabled:opacity-50 transition-colors">
            <Search size={11} />
            {loading ? "Scanning…" : "Scan"}
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {!scanned && !loading && (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">Click Scan to find large files</div>
          )}
          {scanned && results.length === 0 && (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">No large files found</div>
          )}
          {results.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border)]">
                <tr>
                  <th className="w-8 px-3 py-1.5"></th>
                  <th className="text-left px-2 py-1.5 text-[var(--text-muted)] font-medium">File</th>
                  <th className="text-right px-3 py-1.5 text-[var(--text-muted)] font-medium w-24">Size</th>
                  <th className="w-20 px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {results.map(([path, size]) => {
                  const sel = selected.has(path);
                  const name = path.split(/[\\/]/).pop() ?? path;
                  const dir = path.replace(/[\\/][^\\/]+$/, "");
                  return (
                    <tr key={path} className={`hover:bg-[var(--bg-hover)] transition-colors ${sel ? "bg-[var(--bg-selected)]" : ""}`}>
                      <td className="px-3 py-1 text-center">
                        <input type="checkbox" checked={sel} onChange={() => setSelected((p) => { const n = new Set(p); sel ? n.delete(path) : n.add(path); return n; })}
                          className="w-3.5 h-3.5 accent-[var(--accent)]" />
                      </td>
                      <td className="px-2 py-1">
                        <div className="text-[var(--text-primary)] truncate max-w-[340px]">{name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[340px]">{dir}</div>
                      </td>
                      <td className="px-3 py-1 text-right font-mono text-[var(--text-secondary)]">{formatSize(size)}</td>
                      <td className="px-2 py-1 text-center">
                        <button onClick={() => navigate(activePaneId, dir)} title="Open location"
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                          <FolderOpen size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface)]">
            <span className="text-xs text-[var(--text-muted)]">{results.length} files · {selected.size} selected</span>
            <button onClick={deleteSelected} disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              <Trash2 size={11} />Delete selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
