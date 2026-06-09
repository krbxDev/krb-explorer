import { useState } from "react";
import { Network, X, Check } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";

export function NetworkDriveDialog() {
  const { networkDriveOpen, closeNetworkDriveDialog, loadDrives } = useStore();
  const [letter, setLetter] = useState("Z");
  const [path, setPath] = useState("");
  const [persistent, setPersistent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"map" | "disconnect">("map");
  const [discLetter, setDiscLetter] = useState("Z");

  if (!networkDriveOpen) return null;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !["A","B","C"].includes(l));

  const handleMap = async () => {
    if (!path.trim()) { setError("Enter a network path (e.g. \\\\server\\share)"); return; }
    setLoading(true); setError(null);
    try {
      await fs.mapNetworkDrive(letter, path.trim(), persistent);
      await loadDrives();
      closeNetworkDriveDialog();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true); setError(null);
    try {
      await fs.disconnectNetworkDrive(discLetter);
      await loadDrives();
      closeNetworkDriveDialog();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeNetworkDriveDialog}>
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[420px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Network size={16} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm">Map Network Drive</span>
          </div>
          <button onClick={closeNetworkDriveDialog} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-[var(--border)] pb-2">
          {["map", "disconnect"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t as any); setError(null); }}
              className={`px-3 py-1 text-xs rounded-t transition-colors ${tab === t ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              {t === "map" ? "Map drive" : "Disconnect"}
            </button>
          ))}
        </div>

        {tab === "map" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-muted)] w-24 shrink-0">Drive letter</label>
              <select
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {letters.map(l => <option key={l} value={l}>{l}:</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-muted)] w-24 shrink-0">Folder</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="\\server\share"
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={persistent}
                onChange={(e) => setPersistent(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">Reconnect at sign-in</span>
            </label>
          </div>
        )}

        {tab === "disconnect" && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--text-muted)] w-24 shrink-0">Drive letter</label>
            <select
              value={discLetter}
              onChange={(e) => setDiscLetter(e.target.value)}
              className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              {letters.map(l => <option key={l} value={l}>{l}:</option>)}
            </select>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={closeNetworkDriveDialog}
            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={tab === "map" ? handleMap : handleDisconnect}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Check size={12} />
            {loading ? "Working…" : tab === "map" ? "Map drive" : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}
