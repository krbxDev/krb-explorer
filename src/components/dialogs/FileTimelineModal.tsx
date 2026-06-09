import { useState, useEffect } from "react";
import { Clock, X, RefreshCw, FolderOpen } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import type { ActivityEntry } from "../../lib/types";
import { formatDate } from "../../lib/utils";

const OP_COLORS: Record<string, string> = {
  copy:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
  move:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  delete: "bg-red-500/20 text-red-400 border-red-500/30",
  create: "bg-green-500/20 text-green-400 border-green-500/30",
  rename: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function FileTimelineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activePaneId, navigate } = useStore();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const result = await fs.getActivityLog(200);
      setEntries(result);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const ops = ["all", "copy", "move", "delete", "create", "rename"];
  const filtered = filter === "all" ? entries : entries.filter((e) => e.operation === filter);

  // Group by day
  const grouped: Record<string, ActivityEntry[]> = {};
  for (const entry of filtered) {
    const d = new Date(entry.timestamp * 1000);
    const key = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  const goToPath = (path: string) => {
    const isFile = /\.[a-zA-Z0-9]+$/.test(path.split(/[\\/]/).pop() ?? "");
    const dir = isFile ? path.replace(/[\\/][^\\/]+$/, "") : path;
    navigate(activePaneId, dir);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">File Timeline</span>
            <span className="text-[10px] text-[var(--text-muted)]">Recent operations</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} title="Refresh"
              className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0 flex-wrap">
          {ops.map((op) => (
            <button key={op} onClick={() => setFilter(op)}
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors capitalize ${
                filter === op
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
              }`}>
              {op}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-[var(--accent)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
              <Clock size={32} className="opacity-20" />
              <span className="text-sm">No activity recorded yet</span>
              <span className="text-[10px]">Operations you perform will appear here</span>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(grouped).map(([day, dayEntries]) => (
                <div key={day} className="mb-4">
                  <div className="sticky top-0 px-5 py-1 bg-[var(--bg-elevated)] border-y border-[var(--border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {day}
                  </div>
                  {dayEntries.map((entry) => {
                    const color = OP_COLORS[entry.operation] ?? "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]";
                    const time = new Date(entry.timestamp * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                    const primaryPath = entry.paths[0] ?? "";
                    const name = primaryPath.split(/[\\/]/).pop() ?? primaryPath;
                    return (
                      <div key={entry.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors group">
                        <div className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase shrink-0 mt-0.5 ${color}`}>
                          {entry.operation}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--text-primary)] truncate font-medium">{name || primaryPath}</div>
                          {entry.paths.length > 1 && (
                            <div className="text-[10px] text-[var(--text-muted)]">+{entry.paths.length - 1} more</div>
                          )}
                          {entry.destination && (
                            <div className="text-[10px] text-[var(--text-muted)] truncate">→ {entry.destination}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
                          <button onClick={() => goToPath(primaryPath)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all">
                            <FolderOpen size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-2 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface)] text-[10px] text-[var(--text-muted)]">
          {filtered.length} entries
        </div>
      </div>
    </div>
  );
}
