import { ChevronRight, Home, Copy, History } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useStore } from "../../store";
import { fs, db } from "../../lib/invoke";
import { getPathParts } from "../../lib/utils";

interface Props { paneId: string; }

export function BreadcrumbBar({ paneId }: Props) {
  const { panes, navigate } = useStore();
  const pane = panes[paneId];
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggIdx, setSuggIdx] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const parts = pane ? getPathParts(pane.path) : [];

  const startEdit = () => {
    setEditValue(pane?.path ?? "");
    setEditing(true);
    setSuggestions([]);
    setSuggIdx(-1);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
  };

  const commitEdit = () => {
    const v = editValue.trim();
    if (v && pane) navigate(paneId, v);
    setEditing(false);
    setSuggestions([]);
  };

  const cancelEdit = () => { setEditing(false); setSuggestions([]); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (suggIdx >= 0 && suggIdx < suggestions.length) {
        setEditValue(suggestions[suggIdx]);
        setSuggestions([]);
        setSuggIdx(-1);
      } else {
        commitEdit();
      }
    } else if (e.key === "Escape") {
      if (suggestions.length > 0) { setSuggestions([]); setSuggIdx(-1); }
      else cancelEdit();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) {
        const next = (suggIdx + 1) % suggestions.length;
        setSuggIdx(next);
        setEditValue(suggestions[next]);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValue(val);
    setSuggIdx(-1);
    clearTimeout(debounceTimer.current);
    if (val.length < 2) { setSuggestions([]); return; }
    debounceTimer.current = setTimeout(async () => {
      try {
        const s = await fs.pathSuggestions(val);
        setSuggestions(s.slice(0, 8));
      } catch {
        setSuggestions([]);
      }
    }, 120);
  };

  // Listen for nova:focusaddress to activate the edit mode (placed after startEdit is declared)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ paneId?: string }>;
      if (!ce.detail?.paneId || ce.detail.paneId === paneId) startEdit();
    };
    window.addEventListener("nova:focusaddress", handler);
    return () => window.removeEventListener("nova:focusaddress", handler);
  }, [paneId]);

  const loadHistory = async () => {
    try {
      const h = await db.getHistory(30, false);
      const unique = [...new Set(h.map((e: any) => e.path))].filter((p: string) => !p.includes("::"));
      setHistory(unique.slice(0, 20));
    } catch {
      setHistory([]);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestions([]);
      }
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pane?.path) navigator.clipboard.writeText(pane.path);
  };

  if (!pane) return null;

  if (editing) {
    return (
      <div className="flex-1 h-6 flex items-center relative">
        <input
          ref={inputRef}
          value={editValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => { setTimeout(() => { if (suggestions.length === 0) commitEdit(); }, 150); }}
          className="flex-1 h-full bg-[var(--bg-base)] border border-[var(--accent)] rounded px-2 text-xs text-[var(--text-primary)] outline-none font-mono"
        />
        {suggestions.length > 0 && (
          <div
            ref={suggestRef}
            className="absolute top-full left-0 right-0 mt-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded shadow-lg z-50 max-h-48 overflow-auto"
          >
            {suggestions.map((s, i) => (
              <button
                key={s}
                onMouseDown={(e) => { e.preventDefault(); setEditValue(s); setSuggestions([]); setTimeout(commitEdit, 10); }}
                className={`w-full text-left px-3 py-1 text-xs truncate hover:bg-[var(--bg-hover)] ${i === suggIdx ? "bg-[var(--bg-selected)]" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-0.5 overflow-hidden min-w-0 h-6 relative">
      {/* History dropdown button */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          if (!showHistory) await loadHistory();
          setShowHistory((v) => !v);
        }}
        className="shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Navigation history"
      >
        <History size={12} />
      </button>

      {showHistory && history.length > 0 && (
        <div
          ref={historyRef}
          className="absolute top-full left-0 mt-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded shadow-lg z-50 max-h-64 overflow-auto w-72"
        >
          {history.map((h) => (
            <button
              key={h}
              onClick={() => { navigate(paneId, h); setShowHistory(false); }}
              className="w-full text-left px-3 py-1 text-xs truncate hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              title={h}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex flex-1 items-center gap-0.5 overflow-hidden min-w-0 h-6 px-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-text group"
        onClick={startEdit}
        onContextMenu={handleContextMenu}
        title="Click to edit path · Right-click to copy"
      >
        <button
          onClick={(e) => { e.stopPropagation(); navigate(paneId, "C:\\Users"); }}
          className="shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Home size={12} />
        </button>

        <div className="flex items-center overflow-hidden min-w-0">
          {parts.map((part, i) => (
            <div key={part.path} className="flex items-center min-w-0 shrink-0">
              {i > 0 && <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0 mx-0.5" />}
              <button
                onClick={(e) => { e.stopPropagation(); navigate(paneId, part.path); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const raw = e.dataTransfer.getData("nova/paths");
                  if (!raw) return;
                  try {
                    const paths: string[] = JSON.parse(raw);
                    if (e.ctrlKey) fs.copyItems(paths, part.path).then(() => useStore.getState().refresh(paneId));
                    else fs.moveItems(paths, part.path).then(() => useStore.getState().refresh(paneId));
                  } catch {}
                }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move"; }}
                className={`px-1 py-0.5 rounded text-xs hover:bg-[var(--bg-hover)] transition-colors truncate max-w-[120px] ${
                  i === parts.length - 1 ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"
                }`}
                title={part.path}
              >
                {part.label}
              </button>
            </div>
          ))}
        </div>

        {/* Git branch indicator */}
        {pane.isGitRepo && pane.gitBranch && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="ml-2 shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
            title={`Git branch: ${pane.gitBranch}`}
          >
            <span>⎇</span>
            <span className="font-mono">{pane.gitBranch}</span>
          </div>
        )}

        <Copy size={10} className="ml-auto shrink-0 opacity-0 group-hover:opacity-40 text-[var(--text-muted)]" />
      </div>
    </div>
  );
}
