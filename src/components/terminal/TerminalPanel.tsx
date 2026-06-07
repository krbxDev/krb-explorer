import { X, ExternalLink, Terminal } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";

export function TerminalPanel() {
  const { terminalOpen, toggleTerminal, activePaneId, panes } = useStore();
  const pane = panes[activePaneId];
  if (!terminalOpen) return null;

  const path = pane?.path ?? "C:\\";

  return (
    <div className="h-48 border-t border-[var(--border)] bg-[var(--bg-base)] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Terminal size={12} />
          <span className="font-mono text-[var(--text-muted)]">{path}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fs.openTerminalAt(path)}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] px-2 py-0.5 rounded hover:bg-[var(--accent-dim)] transition-colors"
            title="Open in external terminal"
          >
            <ExternalLink size={11} /> Open external
          </button>
          <button
            onClick={toggleTerminal}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Terminal body - placeholder for embedded terminal */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
        <Terminal size={24} className="opacity-30" />
        <p className="text-xs text-center px-4">
          Embedded terminal coming soon. Click "Open external" to launch Windows Terminal or PowerShell at this location.
        </p>
        <button
          onClick={() => fs.openTerminalAt(path)}
          className="mt-1 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
        >
          Open Terminal Here
        </button>
      </div>
    </div>
  );
}
