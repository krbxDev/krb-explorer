import { Plus, X, Pin } from "lucide-react";
import { useStore } from "../../store";
import { cn } from "../../lib/utils";

export function TabBar() {
  const { tabs, activeTabId, openTab, closeTab, setActiveTab, pinTab } = useStore();

  return (
    <div className="flex items-end h-9 bg-[var(--bg-base)] border-b border-[var(--border)] px-1 gap-0.5 overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex items-center gap-1.5 h-8 px-3 pr-2 rounded-t cursor-pointer max-w-[200px] min-w-0 shrink-0 border border-b-0",
              "transition-colors select-none",
              active
                ? "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
                : "bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/50"
            )}
          >
            {tab.pinned && <Pin size={10} className="shrink-0 text-[var(--accent)]" />}
            <span className="truncate text-xs font-medium">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className={cn(
                "shrink-0 rounded p-0.5 transition-colors",
                active
                  ? "opacity-60 hover:opacity-100 hover:bg-[var(--bg-hover)]"
                  : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--bg-hover)]"
              )}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => openTab()}
        className="h-8 w-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors shrink-0"
        title="New tab (Ctrl+T)"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
