import { useEffect, useState } from "react";
import { X, HardDrive, Calendar, Lock, EyeOff } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import type { FileProperties } from "../../lib/types";
import { formatSize, formatDate } from "../../lib/utils";

export function PropertiesDialog() {
  const { propertiesOpen, propertiesPath, closeProperties } = useStore();
  const [props, setProps] = useState<FileProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!propertiesOpen || !propertiesPath) return;
    setLoading(true); setError(null); setProps(null);
    fs.getFileProperties(propertiesPath)
      .then((p) => {
        setProps(p);
        setReadonly(p.isReadonly);
        setHidden(p.isHidden);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [propertiesOpen, propertiesPath]);

  const saveAttributes = async () => {
    if (!propertiesPath) return;
    await fs.setFileAttributes(propertiesPath, readonly, hidden).catch(() => {});
    closeProperties();
  };

  if (!propertiesOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeProperties}>
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-2xl w-[420px] max-h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {props?.name ?? propertiesPath?.split(/[\\/]/).pop() ?? "Properties"}
          </span>
          <button onClick={closeProperties} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
              Loading properties…
            </div>
          )}
          {error && (
            <div className="text-[var(--danger)] text-sm">{error}</div>
          )}
          {props && (
            <>
              {/* Icon + name */}
              <div className="flex items-center gap-3 pb-2 border-b border-[var(--border)]">
                <span className="text-3xl">{props.isDir ? "📁" : "📄"}</span>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{props.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{props.fileType}</div>
                </div>
              </div>

              {/* Path */}
              <Row label="Location" value={props.location} mono />

              {/* Size */}
              {!props.isDir && (
                <>
                  <Row label="Size" value={`${formatSize(props.size)} (${props.size.toLocaleString()} bytes)`} />
                  {props.sizeOnDisk !== props.size && (
                    <Row label="Size on disk" value={`${formatSize(props.sizeOnDisk)} (${props.sizeOnDisk.toLocaleString()} bytes)`} />
                  )}
                </>
              )}
              {props.isDir && props.itemCount != null && (
                <Row label="Contains" value={`${props.itemCount} item${props.itemCount !== 1 ? "s" : ""}`} />
              )}

              {/* Dates */}
              <div className="pt-1 border-t border-[var(--border)] space-y-1">
                <Row label="Created" value={formatDate(props.created)} icon={<Calendar size={11} />} />
                <Row label="Modified" value={formatDate(props.modified)} icon={<Calendar size={11} />} />
                <Row label="Accessed" value={formatDate(props.accessed)} icon={<Calendar size={11} />} />
              </div>

              {/* Attributes */}
              <div className="pt-1 border-t border-[var(--border)]">
                <div className="text-[11px] font-medium text-[var(--text-muted)] mb-2">Attributes</div>
                <label className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={readonly}
                    onChange={(e) => setReadonly(e.target.checked)}
                    className="accent-[var(--accent)] w-3.5 h-3.5"
                  />
                  <Lock size={11} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-primary)]">Read-only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(e) => setHidden(e.target.checked)}
                    className="accent-[var(--accent)] w-3.5 h-3.5"
                  />
                  <EyeOff size={11} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-primary)]">Hidden</span>
                </label>
                {props.isCompressed && (
                  <div className="flex items-center gap-2 mt-1">
                    <HardDrive size={11} className="text-[#3b82f6]" />
                    <span className="text-xs text-[#3b82f6]">Compressed (NTFS)</span>
                  </div>
                )}
                {props.isEncrypted && (
                  <div className="flex items-center gap-2 mt-1">
                    <Lock size={11} className="text-[#22c55e]" />
                    <span className="text-xs text-[#22c55e]">Encrypted (EFS)</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={closeProperties}
            className="px-4 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveAttributes}
            className="px-4 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-[var(--text-muted)] w-24 shrink-0 pt-0.5 flex items-center gap-1">
        {icon}{label}
      </span>
      <span className={`text-xs text-[var(--text-primary)] break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
