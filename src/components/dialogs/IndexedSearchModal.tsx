import { useState, useRef } from "react";
import { Search, X, Database, Zap, FolderOpen, RefreshCw } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { formatSize } from "../../lib/utils";
import type { SearchResult } from "../../lib/types";

export function IndexedSearchModal() {
  const { indexedSearchOpen, toggleIndexedSearch, activePaneId, panes, navigate } = useStore();
  const pane = panes[activePaneId];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [indexed, setIndexed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fs.searchFilesIndexed(q, 200);
      setResults(r);
    } catch {}
    finally { setSearching(false); }
  };

  const buildIndex = async () => {
    if (!pane?.path) return;
    setIndexing(true);
    try {
      const count = await fs.indexPathToDb(pane.path);
      setIndexed(count);
    } catch (e) { console.error(e); }
    finally { setIndexing(false); }
  };

  if (!indexedSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={toggleIndexedSearch}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Instant Search</span>
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">FTS5 indexed</span>
          </div>
          <button onClick={toggleIndexedSearch} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface)]">
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-3 focus-within:border-[var(--accent)] transition-colors">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input ref={inputRef} value={query}
                onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); }}
                placeholder="Search indexed files…"
                autoFocus
                className="flex-1 bg-transparent py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {searching && <RefreshCw size={11} className="text-[var(--accent)] animate-spin shrink-0" />}
              {query && <button onClick={() => { setQuery(""); setResults([]); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"><X size={11} /></button>}
            </div>
            <button onClick={buildIndex} disabled={indexing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--border)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
              title={`Build index for ${pane?.path}`}>
              <Database size={11} />
              {indexing ? "Indexing…" : indexed ? `Re-index (${indexed.toLocaleString()})` : "Build index"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {results.length === 0 && query && !searching && (
            <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">No results. Try building the index first.</div>
          )}
          {results.length === 0 && !query && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
              <Zap size={32} className="opacity-20" />
              <span className="text-sm">Build an index then type to search instantly</span>
            </div>
          )}
          {results.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {results.map((r) => {
                const dir = r.path.replace(/[\\/][^\\/]+$/, "");
                return (
                  <div key={r.path}
                    className="flex items-center gap-3 px-5 py-2 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onDoubleClick={() => navigate(activePaneId, r.isDir ? r.path : dir)}
                  >
                    <span className="text-lg">{r.isDir ? "📁" : "📄"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{r.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">{dir}</div>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] shrink-0">{r.isDir ? "" : formatSize(r.size)}</div>
                    <button onClick={() => navigate(activePaneId, r.isDir ? r.path : dir)}
                      className="shrink-0 p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                      <FolderOpen size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-5 py-2 border-t border-[var(--border)] shrink-0 text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)]">
            {results.length} results
          </div>
        )}
      </div>
    </div>
  );
}
