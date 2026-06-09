import { useEffect, useState } from "react";
import { Clock, X, Copy, Scissors, Trash2, Plus, RefreshCw } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import type { ActivityEntry } from "../../lib/types";

const OP_ICON: Record<string, React.ReactNode> = {
  copy: <Copy size={11} />,
  move: <Scissors size={11} />,
  delete: <Trash2 size={11} />,
  create: <Plus size={11} />,
  rename: <RefreshCw size={11} />,
};

const OP_COLOR: Record<string, string> = {
  copy: "text-blue-400",
  move: "text-yellow-400",
  delete: "text-red-400",
  create: "text-green-400",
  rename: "text-purple-400",
};

export function ActivityLogModal() {
  const { activityLogOpen, toggleActivityLog, navigate, activePaneId } = useStore();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!activityLogOpen) return;
    fs.getActivityLog(200).then(setEntries).catch(() => {});
  }, [activityLogOpen]);

  if (!activityLogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={toggleActivityLog}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">File Activity Log</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fs.getActivityLog(200).then(setEntries).catch(() => {})}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
              <RefreshCw size={12} />
            </button>
            <button onClick={toggleActivityLog} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">No activity recorded yet</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {entries.map((e) => {
                const time = new Date(e.timestamp * 1000).toLocaleString();
                return (
                  <div key={e.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                    <div className={`shrink-0 mt-0.5 ${OP_COLOR[e.operation] ?? "text-[var(--text-muted)]"}`}>
                      {OP_ICON[e.operation] ?? <Clock size={11} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold capitalize ${OP_COLOR[e.operation] ?? "text-[var(--text-muted)]"}`}>{e.operation}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
                      </div>
                      {e.paths.slice(0, 3).map((p) => (
                        <div key={p} className="text-[11px] text-[var(--text-secondary)] truncate">{p}</div>
                      ))}
                      {e.paths.length > 3 && <div className="text-[10px] text-[var(--text-muted)]">+{e.paths.length - 3} more</div>}
                      {e.destination && (
                        <div className="text-[10px] text-[var(--text-muted)]">→ {e.destination}</div>
                      )}
                    </div>
                    <button
                      onClick={() => { const dir = (e.destination || e.paths[0])?.replace(/[\\/][^\\/]+$/, ""); if (dir) navigate(activePaneId, dir); }}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors text-[10px]"
                    >
                      Go
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
