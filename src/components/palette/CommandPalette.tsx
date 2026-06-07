import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Folder, File, ArrowRight } from "lucide-react";
import { useStore } from "../../store";
import { search as searchApi } from "../../lib/invoke";
import { cn, pathBasename } from "../../lib/utils";
import type { SearchResult } from "../../lib/types";

export function CommandPalette() {
  const { paletteOpen, closePalette, activePaneId, panes, navigate } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pane = panes[activePaneId];

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!query.trim() || !pane) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.searchDirectory(pane.path, query, false, 50);
        setResults(res);
        setSelected(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, pane]);

  const handleSelect = (result: SearchResult) => {
    if (result.isDir) navigate(activePaneId, result.path);
    closePalette();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) handleSelect(results[selected]);
    else if (e.key === "Escape") closePalette();
  };

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50"
      onClick={closePalette}
    >
      <div
        className="w-[580px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and folders..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          {loading && <span className="text-[10px] text-[var(--text-muted)]">Searching…</span>}
          <kbd className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-overlay)] px-1.5 py-0.5 rounded border border-[var(--border)]">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((result, i) => (
              <button
                key={result.path}
                onClick={() => handleSelect(result)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 h-9 text-left transition-colors",
                  i === selected ? "bg-[var(--bg-selected)]" : "hover:bg-[var(--bg-hover)]"
                )}
              >
                {result.isDir ? <Folder size={14} className="text-[#f4b942] shrink-0" /> : <File size={14} className="text-[var(--text-muted)] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[var(--text-primary)] truncate block">{result.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate block">{result.path}</span>
                </div>
                <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-[var(--text-muted)]">
            No results for "{query}"
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 h-8 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
          <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono">↵</kbd> Open</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
