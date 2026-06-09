import { useState } from "react";
import { Layout, X, Plus, Trash2, Play } from "lucide-react";
import { useStore } from "../../store";

export function WorkspacesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspaces, saveWorkspace, loadWorkspace, deleteWorkspace } = useStore();
  const [newName, setNewName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Layout size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Workspaces</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>

        {/* Save current */}
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs text-[var(--text-muted)] mb-2">Save current layout as workspace</div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { saveWorkspace(newName.trim()); setNewName(""); } }}
              placeholder="Workspace name…"
              className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
            <button onClick={() => { if (newName.trim()) { saveWorkspace(newName.trim()); setNewName(""); } }}
              disabled={!newName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 disabled:opacity-40 transition-colors">
              <Plus size={11} /> Save
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[300px] overflow-y-auto">
          {workspaces.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[var(--text-muted)] text-sm">No saved workspaces</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {workspaces.map((ws) => (
                <div key={ws.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">{ws.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {ws.splitMode !== "none" ? `Split ${ws.splitMode}` : "Single pane"} · {ws.paths.length} path(s)
                    </div>
                    {ws.paths.map((p) => (
                      <div key={p} className="text-[10px] text-[var(--text-muted)] truncate max-w-[280px]">{p}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { loadWorkspace(ws.id); onClose(); }}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--accent)] hover:text-[var(--accent)] transition-colors" title="Load workspace">
                      <Play size={12} />
                    </button>
                    <button onClick={() => deleteWorkspace(ws.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
