import { useState } from "react";
import { Globe, X, Plus, Trash2, ChevronRight, Server } from "lucide-react";
import { useStore } from "../../store";
import type { FtpConnection } from "../../lib/types";
import { generateId } from "../../lib/utils";

export function FtpPanel() {
  const { ftpOpen, toggleFtp, ftpConnections, addFtpConnection, removeFtpConnection, navigate, activePaneId } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<FtpConnection>>({ protocol: "sftp", port: 22, remotePath: "/" });

  if (!ftpOpen) return null;

  const save = () => {
    if (!form.host || !form.label) return;
    addFtpConnection({
      id: generateId(),
      label: form.label!,
      protocol: form.protocol as any ?? "sftp",
      host: form.host!,
      port: form.port ?? 22,
      username: form.username ?? "",
      remotePath: form.remotePath ?? "/",
    });
    setForm({ protocol: "sftp", port: 22, remotePath: "/" });
    setShowForm(false);
  };

  const connect = (conn: FtpConnection) => {
    // BUG-037 FIX: remote protocol paths are not yet handled by the file pane;
    // show a clear message rather than silently navigating to an unhandled URL.
    alert(
      `Remote connections (${conn.protocol.toUpperCase()}) are not yet supported for in-pane browsing.\n\n` +
      `Connection details saved:\n${conn.protocol}://${conn.host}:${conn.port}${conn.remotePath}`
    );
    toggleFtp();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={toggleFtp}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[500px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Remote Connections</span>
            <span className="text-[10px] text-[var(--text-muted)]">FTP · SFTP · S3</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 transition-colors">
              <Plus size={11} /> New
            </button>
            <button onClick={toggleFtp} className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
          </div>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] space-y-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Name</label>
                <input value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="My Server" className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Protocol</label>
                <select value={form.protocol} onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value as any, port: e.target.value === "ftp" ? 21 : e.target.value === "s3" ? 443 : 22 }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]">
                  <option value="sftp">SFTP</option>
                  <option value="ftp">FTP</option>
                  <option value="s3">S3</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Host</label>
                <input value={form.host ?? ""} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="192.168.1.1" className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Port</label>
                <input type="number" value={form.port ?? 22} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Username</label>
                <input value={form.username ?? ""} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="admin" className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">Remote path</label>
                <input value={form.remotePath ?? "/"} onChange={(e) => setForm((f) => ({ ...f, remotePath: e.target.value }))}
                  placeholder="/" className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border border-[var(--border)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 transition-colors">Save connection</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {ftpConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
              <Server size={32} className="opacity-20" />
              <span className="text-sm">No saved connections</span>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {ftpConnections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent)]">
                      <Globe size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--text-primary)]">{conn.label}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{conn.protocol.toUpperCase()} · {conn.host}:{conn.port}{conn.remotePath}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => connect(conn)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-[var(--accent)]/10 text-[var(--accent)] rounded hover:bg-[var(--accent)]/20 transition-colors">
                      Connect <ChevronRight size={10} />
                    </button>
                    <button onClick={() => removeFtpConnection(conn.id)}
                      className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={11} />
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
