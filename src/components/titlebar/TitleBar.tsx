import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Search, ArrowUpCircle } from "lucide-react";
import { useStore } from "../../store";
import { cn } from "../../lib/utils";

export function TitleBar() {
  const { openPalette } = useStore();
  const win = getCurrentWindow();

  return (
    <div
      className="flex items-center h-10 bg-[var(--bg-surface)] border-b border-[var(--border)] select-none shrink-0"
      data-tauri-drag-region
    >
      {/* App icon + name */}
      <div className="flex items-center gap-2 px-3 w-[220px] shrink-0" data-tauri-drag-region>
        <div className="w-5 h-5 rounded bg-[var(--accent)] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">N</span>
        </div>
        <span className="text-[var(--text-secondary)] text-xs font-medium">Nova Explorer</span>
      </div>

      {/* Search bar */}
      <button
        onClick={openPalette}
        className="flex-1 mx-4 h-6 flex items-center gap-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] text-xs hover:border-[var(--accent)] hover:text-[var(--text-secondary)] transition-colors cursor-text"
      >
        <Search size={12} />
        <span>Search files... (Ctrl+P)</span>
      </button>

      {/* Check for updates */}
      <button
        onClick={() => (window as any).__openUpdateChecker?.()}
        title="Check for updates"
        className={cn("h-10 w-10 flex items-center justify-center text-[var(--text-muted)]",
          "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors")}
      >
        <ArrowUpCircle size={14} />
      </button>

      {/* Window controls */}
      <div className="flex items-center h-full">
        <button
          onClick={() => win.minimize()}
          className={cn("h-10 w-12 flex items-center justify-center text-[var(--text-muted)]",
            "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors")}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          className={cn("h-10 w-12 flex items-center justify-center text-[var(--text-muted)]",
            "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors")}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => win.close()}
          className={cn("h-10 w-12 flex items-center justify-center text-[var(--text-muted)]",
            "hover:bg-red-500 hover:text-white transition-colors")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
