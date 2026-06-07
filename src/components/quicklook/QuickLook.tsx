import { useEffect, useState, useCallback } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { IMAGE_EXTS, TEXT_EXTS, VIDEO_EXTS, AUDIO_EXTS, ARCHIVE_EXTS, formatSize, formatDate } from "../../lib/utils";
import type { FileEntry } from "../../lib/types";

export function QuickLook() {
  const { quickLookPath, closeQuickLook, activePaneId, panes } = useStore();
  const [entry, setEntry] = useState<FileEntry | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pane = panes[activePaneId];
  const entries = pane?.entries ?? [];
  const currentIdx = entries.findIndex((e) => e.path === quickLookPath);

  const navigate = useCallback((delta: number) => {
    const newIdx = currentIdx + delta;
    if (newIdx >= 0 && newIdx < entries.length) {
      useStore.getState().openQuickLook(entries[newIdx].path);
    }
  }, [currentIdx, entries]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") { e.preventDefault(); closeQuickLook(); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeQuickLook, navigate]);

  useEffect(() => {
    if (!quickLookPath) { setEntry(null); return; }
    setLoading(true);
    setTextContent(null);
    setThumbnail(null);

    fs.getFileInfo(quickLookPath).then(async (info) => {
      setEntry(info);
      const ext = info.extension?.toLowerCase() ?? "";
      if (IMAGE_EXTS.has(ext)) {
        const t = await fs.getThumbnail(quickLookPath, 600).catch(() => "");
        setThumbnail(t || null);
      } else if (TEXT_EXTS.has(ext)) {
        const t = await fs.readTextFile(quickLookPath, 128 * 1024).catch(() => null);
        setTextContent(t);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [quickLookPath]);

  if (!quickLookPath) return null;

  const ext = entry?.extension?.toLowerCase() ?? "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
      onClick={closeQuickLook}
    >
      <div
        className="relative bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col"
        style={{ width: "min(860px, 90vw)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{entry?.name ?? "Loading…"}</span>
            {entry && !entry.isDir && (
              <span className="text-xs text-[var(--text-muted)]">{formatSize(entry.size)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {entry && (
              <button onClick={() => fs.openItem(entry.path)}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] px-2 py-1 rounded hover:bg-[var(--accent-dim)] transition-colors">
                <ExternalLink size={12} /> Open
              </button>
            )}
            <button onClick={closeQuickLook}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">Loading preview…</div>
          )}

          {!loading && thumbnail && (
            <div className="flex items-center justify-center p-4 bg-[var(--bg-base)] min-h-[300px]">
              <img src={thumbnail} alt={entry?.name} className="max-w-full max-h-[60vh] object-contain rounded" />
            </div>
          )}

          {!loading && textContent !== null && (
            <pre className="p-4 text-xs font-mono text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-all overflow-auto max-h-[60vh]">
              {textContent}
            </pre>
          )}

          {!loading && VIDEO_EXTS.has(ext) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--text-muted)]">
              <span className="text-5xl">🎬</span>
              <span className="text-sm">Video — {entry?.name}</span>
              <span className="text-xs">{entry && formatSize(entry.size)}</span>
            </div>
          )}

          {!loading && AUDIO_EXTS.has(ext) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--text-muted)]">
              <span className="text-5xl">🎵</span>
              <span className="text-sm">Audio — {entry?.name}</span>
            </div>
          )}

          {!loading && ARCHIVE_EXTS.has(ext) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--text-muted)]">
              <span className="text-5xl">📦</span>
              <span className="text-sm">Archive — {entry?.name}</span>
              <span className="text-xs">{entry && formatSize(entry.size)}</span>
            </div>
          )}

          {!loading && entry?.isDir && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--text-muted)]">
              <span className="text-5xl">📁</span>
              <span className="text-sm">{entry.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{formatDate(entry.modified)}</span>
            </div>
          )}
        </div>

        {/* Navigation footer */}
        {entries.length > 1 && (
          <div className="flex items-center justify-between px-4 h-9 border-t border-[var(--border)] shrink-0 text-xs text-[var(--text-muted)]">
            <button onClick={() => navigate(-1)} disabled={currentIdx <= 0}
              className="flex items-center gap-1 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} /> Previous
            </button>
            <span>{currentIdx + 1} / {entries.length}</span>
            <button onClick={() => navigate(1)} disabled={currentIdx >= entries.length - 1}
              className="flex items-center gap-1 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
