import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import type { OpenWithApp } from "../../lib/types";
import { fs } from "../../lib/invoke";

interface OpenWithEvent {
  path: string;
  ext: string;
  apps: OpenWithApp[];
}

export function OpenWithDialog() {
  const [ev, setEv] = useState<OpenWithEvent | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OpenWithEvent>;
      setEv(ce.detail);
      setFilter("");
    };
    window.addEventListener("nova:openwith", handler);
    return () => window.removeEventListener("nova:openwith", handler);
  }, []);

  if (!ev) return null;

  const filtered = ev.apps.filter((a) =>
    filter ? a.displayName.toLowerCase().includes(filter.toLowerCase()) : true
  );

  const open = (app: OpenWithApp) => {
    fs.openWithApp(ev.path, app.exePath).catch(() => {});
    setEv(null);
  };

  const openDefault = () => {
    fs.openItem(ev.path).catch(() => {});
    setEv(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setEv(null)}>
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-2xl w-[360px] flex flex-col max-h-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Open with</span>
          <button onClick={() => setEv(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <Search size={12} className="text-[var(--text-muted)]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search apps…"
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            autoFocus
          />
        </div>

        {/* App list */}
        <div className="flex-1 overflow-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-[var(--text-muted)]">
              {ev.apps.length === 0 ? "No registered apps found for this file type." : "No matches."}
            </div>
          )}
          {filtered.map((app) => (
            <button
              key={app.exePath}
              onClick={() => open(app)}
              className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="text-lg">🖥️</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">{app.displayName}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{app.exePath}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={openDefault}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Open with default app
          </button>
          <button
            onClick={() => setEv(null)}
            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
