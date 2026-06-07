import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { formatSize, cn } from "../../lib/utils";
import type { DiskUsageNode } from "../../lib/types";

function TreemapNode({ node, total, depth = 0, onClick }: {
  node: DiskUsageNode;
  total: number;
  depth?: number;
  onClick: (n: DiskUsageNode) => void;
}) {
  const pct = total > 0 ? (node.size / total) * 100 : 0;
  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#f97316", "#a3e635"];
  const color = COLORS[depth % COLORS.length];

  return (
    <div className="group">
      <div
        onClick={() => onClick(node)}
        className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <div className="shrink-0 w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
        <span className="flex-1 text-xs text-[var(--text-primary)] truncate">{node.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
          <span className="text-xs text-[var(--text-secondary)] w-16 text-right font-mono">{formatSize(node.size)}</span>
        </div>
      </div>
      {node.children.slice(0, 10).map((child) => (
        <TreemapNode key={child.path} node={child} total={node.size} depth={depth + 1} onClick={onClick} />
      ))}
    </div>
  );
}

export function DiskUsageModal() {
  const { diskUsageOpen, toggleDiskUsage, activePaneId, panes, navigate } = useStore();
  const pane = panes[activePaneId];
  const [data, setData] = useState<DiskUsageNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState(pane?.path ?? "C:\\");

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const result = await fs.getDiskUsage(p, 3);
      setData(result);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (diskUsageOpen && pane?.path) {
      setPath(pane.path);
      load(pane.path);
    }
  }, [diskUsageOpen, pane?.path]);

  if (!diskUsageOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[680px] max-h-[85vh] flex flex-col bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--border)] shrink-0">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Disk Usage</span>
          <div className="flex items-center gap-2">
            <button onClick={() => load(path)} disabled={loading}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={toggleDiskUsage}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Path input */}
        <div className="px-4 py-2 border-b border-[var(--border)] shrink-0 flex gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(path)}
            className="flex-1 h-7 px-2 bg-[var(--bg-base)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <button onClick={() => load(path)} disabled={loading}
            className="px-3 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors">
            Scan
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm gap-2">
              <RefreshCw size={16} className="animate-spin" /> Scanning…
            </div>
          )}
          {!loading && data && (
            <div>
              <div className="px-2 py-1 mb-2 text-xs text-[var(--text-muted)]">
                Total: <span className="text-[var(--text-primary)] font-semibold">{formatSize(data.size)}</span>
                {" · "}Showing top items by size
              </div>
              <TreemapNode
                node={data}
                total={data.size}
                onClick={(n) => { navigate(activePaneId, n.path); toggleDiskUsage(); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
