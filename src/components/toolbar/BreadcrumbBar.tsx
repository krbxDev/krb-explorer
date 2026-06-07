import { ChevronRight, Home, Copy } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useStore } from "../../store";
import { getPathParts } from "../../lib/utils";

interface Props { paneId: string; }

export function BreadcrumbBar({ paneId }: Props) {
  const { panes, navigate } = useStore();
  const pane = panes[paneId];
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = pane ? getPathParts(pane.path) : [];

  const startEdit = () => {
    setEditValue(pane?.path ?? "");
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
  };

  const commitEdit = () => {
    const v = editValue.trim();
    if (v && pane) navigate(paneId, v);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    else if (e.key === "Escape") cancelEdit();
  };

  // Right-click on breadcrumb to copy path
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pane?.path) navigator.clipboard.writeText(pane.path);
  };

  if (!pane) return null;

  if (editing) {
    return (
      <div className="flex-1 h-6 flex items-center">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          className="flex-1 h-full bg-[var(--bg-base)] border border-[var(--accent)] rounded px-2 text-xs text-[var(--text-primary)] outline-none font-mono"
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center gap-0.5 overflow-hidden min-w-0 h-6 px-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-text group"
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
              className={`px-1 py-0.5 rounded text-xs hover:bg-[var(--bg-hover)] transition-colors truncate max-w-[120px] ${
                i === parts.length - 1
                  ? "text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)]"
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
  );
}
