import { useState, useEffect } from "react";
import { Shield, X, RefreshCw, AlertCircle } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import type { AclEntry } from "../../lib/types";

export function PermissionsModal() {
  const { permissionsPath, closePermissions } = useStore();
  const [acl, setAcl] = useState<AclEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!permissionsPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fs.getFileAcl(permissionsPath);
      setAcl(result);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permissionsPath) load();
    else setAcl([]);
  }, [permissionsPath]);

  if (!permissionsPath) return null;

  const name = permissionsPath.split(/[\\/]/).pop() ?? permissionsPath;

  const typeColor = (t: string) => {
    if (t.toLowerCase().includes("allow")) return "text-green-400";
    if (t.toLowerCase().includes("deny")) return "text-red-400";
    return "text-[var(--text-muted)]";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closePermissions}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[560px] max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-[var(--accent)]" />
            <div>
              <span className="font-semibold text-sm text-[var(--text-primary)]">Permissions</span>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5 max-w-[380px] truncate">{permissionsPath}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} disabled={loading} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={closePermissions} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--danger)]">
              <AlertCircle size={24} />
              <span className="text-xs text-center px-6">{error}</span>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-[var(--accent)]" />
            </div>
          ) : acl.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">No ACL entries found</div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_80px] gap-2 px-5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Identity</span>
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Rights</span>
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Access</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {acl.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_80px] gap-2 px-5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                    <span className="text-xs text-[var(--text-primary)] truncate" title={entry.identity}>{entry.identity}</span>
                    <span className="text-xs text-[var(--text-secondary)] truncate" title={entry.rights}>{entry.rights}</span>
                    <span className={`text-xs font-medium ${typeColor(entry.access_type)}`}>{entry.access_type}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">{acl.length} entries · {name}</span>
          <span className="text-[10px] text-[var(--text-muted)]">Windows ACL (NTFS)</span>
        </div>
      </div>
    </div>
  );
}
