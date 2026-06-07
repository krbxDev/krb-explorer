import { useEffect, useState } from "react";
import { X, ExternalLink, FileText, Image, Volume2, Film } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { IMAGE_EXTS, TEXT_EXTS, VIDEO_EXTS, AUDIO_EXTS, formatSize, formatDate } from "../../lib/utils";
import type { FileEntry } from "../../lib/types";

export function PreviewPanel() {
  const { previewPath, closePreview } = useStore();
  const [entry, setEntry] = useState<FileEntry | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!previewPath) { setEntry(null); return; }
    setLoading(true);
    setTextContent(null);
    setThumbnail(null);

    fs.getFileInfo(previewPath).then(async (info) => {
      setEntry(info);
      const ext = info.extension?.toLowerCase() ?? "";

      if (IMAGE_EXTS.has(ext)) {
        const thumb = await fs.getThumbnail(previewPath, 400).catch(() => "");
        setThumbnail(thumb || null);
      } else if (TEXT_EXTS.has(ext)) {
        const text = await fs.readTextFile(previewPath, 64 * 1024).catch(() => null);
        setTextContent(text);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [previewPath]);

  if (!previewPath) return null;

  const ext = entry?.extension?.toLowerCase() ?? "";

  return (
    <div className="w-72 h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Preview</span>
        <button onClick={closePreview} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-xs">Loading…</div>
        )}

        {/* Image preview */}
        {thumbnail && (
          <div className="p-2">
            <img
              src={thumbnail}
              alt={entry?.name}
              className="w-full rounded object-contain max-h-64 bg-[var(--bg-base)]"
            />
          </div>
        )}

        {/* Text preview */}
        {textContent !== null && (
          <div className="p-2">
            <pre className="text-[10px] text-[var(--text-secondary)] leading-relaxed overflow-auto max-h-64 bg-[var(--bg-base)] rounded p-2 whitespace-pre-wrap break-all">
              {textContent.slice(0, 4000)}{textContent.length > 4000 ? "\n…" : ""}
            </pre>
          </div>
        )}

        {/* Video placeholder */}
        {VIDEO_EXTS.has(ext) && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
            <Film size={40} />
            <span className="text-xs">Video file</span>
          </div>
        )}

        {/* Audio placeholder */}
        {AUDIO_EXTS.has(ext) && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
            <Volume2 size={40} />
            <span className="text-xs">Audio file</span>
          </div>
        )}

        {/* File info */}
        {entry && (
          <div className="px-3 py-2 space-y-2 border-t border-[var(--border)] mt-2">
            <h3 className="text-xs font-medium text-[var(--text-primary)] break-all">{entry.name}</h3>
            <div className="space-y-1">
              {[
                { label: "Size", value: entry.isDir ? "—" : formatSize(entry.size) },
                { label: "Modified", value: formatDate(entry.modified) },
                { label: "Created", value: formatDate(entry.created) },
                { label: "Type", value: entry.isDir ? "Folder" : (entry.extension?.toUpperCase() ?? "File") },
                { label: "Path", value: entry.path },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
                  <p className="text-xs text-[var(--text-secondary)] break-all">{value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => fs.openItem(entry.path)}
              className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              <ExternalLink size={12} /> Open with default app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
