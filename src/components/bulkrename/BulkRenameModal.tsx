import { useState, useMemo } from "react";
import { X, RefreshCw } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { cn } from "../../lib/utils";

export function BulkRenameModal() {
  const { bulkRenameOpen, toggleBulkRename, activePaneId, panes, refresh } = useStore();
  const pane = panes[activePaneId];
  const selected = Array.from(pane?.selection ?? []);

  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [counterStart, setCounterStart] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = (pane?.entries ?? []).filter((e) => selected.includes(e.path));

  const preview = useMemo(() => {
    if (!pattern) return entries.map((e) => ({ old: e.name, new: e.name }));
    let counter = counterStart;
    return entries.map((e) => {
      const repl = replacement
        .replace("{N}", String(counter))
        .replace("{NN}", String(counter).padStart(2, "0"))
        .replace("{NNN}", String(counter).padStart(3, "0"))
        .replace("{NNNN}", String(counter).padStart(4, "0"));
      let newName = e.name;
      try {
        if (useRegex) {
          newName = e.name.replace(new RegExp(pattern, "g"), repl);
        } else {
          newName = e.name.split(pattern).join(repl);
        }
      } catch {}
      counter++;
      return { old: e.name, new: newName };
    });
  }, [pattern, replacement, useRegex, counterStart, entries]);

  const handleApply = async () => {
    if (!pattern || selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await fs.bulkRename(selected, pattern, replacement, useRegex, counterStart);
      await refresh(activePaneId);
      toggleBulkRename();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!bulkRenameOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[600px] max-h-[80vh] flex flex-col bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--border)] shrink-0">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Bulk Rename — {selected.length} files
          </span>
          <button onClick={toggleBulkRename}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            <X size={14} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-[var(--border)] space-y-3 shrink-0">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Find {useRegex ? "(regex)" : "(text)"}
              </label>
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={useRegex ? "e.g. \\d+" : "e.g. IMG_"}
                className="w-full h-8 px-2 bg-[var(--bg-base)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Replace with ({"{N}"} {"{NNN}"} = counter)
              </label>
              <input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="e.g. Photo_{NNN}"
                className="w-full h-8 px-2 bg-[var(--bg-base)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)}
                className="accent-[var(--accent)]" />
              Use regex
            </label>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>Counter start:</span>
              <input
                type="number"
                value={counterStart}
                onChange={(e) => setCounterStart(Number(e.target.value))}
                className="w-16 h-6 px-2 bg-[var(--bg-base)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-2">Preview</div>
          <div className="space-y-1">
            {preview.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className={cn("flex-1 truncate", p.old !== p.new ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]")}>
                  {p.old}
                </span>
                {p.old !== p.new && (
                  <>
                    <span className="text-[var(--text-muted)]">→</span>
                    <span className="flex-1 truncate text-[var(--success)]">{p.new}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 h-12 border-t border-[var(--border)] shrink-0">
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
          <div className="ml-auto flex gap-2">
            <button onClick={toggleBulkRename}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={loading || !pattern || selected.length === 0}
              className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />}
              Apply to {selected.length} files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
