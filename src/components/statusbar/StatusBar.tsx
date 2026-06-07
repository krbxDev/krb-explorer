import { useStore } from "../../store";
import { formatSize } from "../../lib/utils";

export function StatusBar() {
  const { activePaneId, panes } = useStore();
  const pane = panes[activePaneId];
  if (!pane) return null;

  const selCount = pane.selection.size;
  const totalCount = pane.entries.length;
  const selSize = Array.from(pane.selection)
    .map((p) => pane.entries.find((e) => e.path === p)?.size ?? 0)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center justify-between h-6 px-3 bg-[var(--bg-surface)] border-t border-[var(--border)] shrink-0 text-[10px] text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        {selCount > 0 ? (
          <span>{selCount} item{selCount !== 1 ? "s" : ""} selected{selSize > 0 ? ` · ${formatSize(selSize)}` : ""}</span>
        ) : (
          <span>{totalCount} item{totalCount !== 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-muted)]">{pane.path}</span>
      </div>
    </div>
  );
}
