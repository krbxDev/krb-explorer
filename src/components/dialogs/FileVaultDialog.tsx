import { useState, useEffect } from "react";
import { Lock, Unlock, X, Eye, EyeOff, Shield } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";

export function FileVaultDialog() {
  const { fileVaultOpen, fileVaultPath, closeFileVault, refresh, activePaneId } = useStore();
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // BUG-019 FIX: reset all state when the dialog opens for a different file
  useEffect(() => {
    if (fileVaultPath) {
      setPassword(""); setConfirm(""); setError(null); setDone(false); setShowPw(false); setLoading(false);
    }
  }, [fileVaultPath]);

  if (!fileVaultOpen || !fileVaultPath) return null;

  const isEnc = fileVaultPath.endsWith(".enc");
  const fileName = fileVaultPath.split(/[\\/]/).pop() ?? "";
  const effectiveMode = isEnc ? "decrypt" : mode;

  const handle = async () => {
    if (!password) { setError("Enter a password"); return; }
    if (effectiveMode === "encrypt" && password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true); setError(null);
    try {
      if (effectiveMode === "encrypt") {
        await fs.encryptFile(fileVaultPath, password, "");
      } else {
        const outputPath = fileVaultPath.replace(/\.enc$/, "");
        await fs.decryptFile(fileVaultPath, password, outputPath);
      }
      setDone(true);
      refresh(activePaneId);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeFileVault}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">File Vault</span>
          </div>
          <button onClick={closeFileVault} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>

        <div className="mb-4 p-3 bg-[var(--bg-surface)] rounded-lg">
          <div className="text-xs text-[var(--text-muted)] mb-1">File</div>
          <div className="text-xs font-medium text-[var(--text-primary)] truncate">{fileName}</div>
        </div>

        {!isEnc && (
          <div className="flex gap-1 mb-4 p-1 bg-[var(--bg-base)] rounded-lg">
            {(["encrypt", "decrypt"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded transition-colors ${mode === m ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                {m === "encrypt" ? <Lock size={11} /> : <Unlock size={11} />}
                {m === "encrypt" ? "Encrypt" : "Decrypt"}
              </button>
            ))}
          </div>
        )}

        {done ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-sm font-medium mb-1">
              {effectiveMode === "encrypt" ? "File encrypted successfully" : "File decrypted successfully"}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {effectiveMode === "encrypt" ? `Saved as ${fileName}.enc` : `Saved as ${fileName.replace(/\.enc$/, "")}`}
            </div>
            <button onClick={closeFileVault} className="mt-3 px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 transition-colors">Close</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Password (AES-256)</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password…"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] pr-8"
                />
                <button onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>
            {effectiveMode === "encrypt" && (
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Confirm password</label>
                <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password…"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}
            {error && <div className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={closeFileVault} className="flex-1 py-1.5 text-xs border border-[var(--border)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
              <button onClick={handle} disabled={loading}
                className="flex-1 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 disabled:opacity-50 transition-colors">
                {loading ? "Working…" : effectiveMode === "encrypt" ? "Encrypt file" : "Decrypt file"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
