import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useCallback, useEffect, useState } from "react";
import type { FileEntry } from "../../lib/types";
import { FileIcon } from "./FileIcon";
import { cn } from "../../lib/utils";
import { useStore } from "../../store";
import { fs, db } from "../../lib/invoke";
import { IMAGE_EXTS } from "../../lib/utils";

interface Props {
  paneId: string;
  entries: FileEntry[];
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}

const CELL_SIZE = 100;
const CELL_HEIGHT = 110;

function ThumbnailCellSized({ entry, size }: { entry: FileEntry; size: number }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const ext = entry.extension?.toLowerCase() ?? "";

  useEffect(() => {
    if (!IMAGE_EXTS.has(ext)) return;
    let cancelled = false;
    db.getThumbnailCached(entry.path).then(async (cached) => {
      if (cached) { if (!cancelled) setThumb(cached); return; }
      const data = await fs.getThumbnail(entry.path, Math.max(128, size * 2)).catch(() => "");
      if (data && !cancelled) {
        setThumb(data);
        db.setThumbnailCached(entry.path, data).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entry.path, ext, size]);

  if (thumb) {
    return <img src={thumb} alt="" style={{ width: size, height: size }} className="object-cover rounded" />;
  }
  return <FileIcon entry={entry} size={size} />;
}

export function GridView({ paneId, entries, onOpen, onContextMenu }: Props) {
  const { panes, setSelection, toggleSelection, gridIconSize, clipboard } = useStore();
  const pane = panes[paneId];
  const selection = pane?.selection ?? new Set();
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const cellSize = gridIconSize;
  const cellHeight = Math.round(gridIconSize * 1.1);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cutPaths = clipboard?.mode === "cut" ? new Set(clipboard.paths) : new Set<string>();

  const cols = Math.max(1, Math.floor(containerWidth / cellSize));
  const rowCount = Math.ceil(entries.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cellHeight,
    overscan: 5,
  });

  // BUG-014 FIX: remeasure all rows when icon size changes
  useEffect(() => {
    virtualizer.measure();
  }, [gridIconSize]);

  return (
    <div ref={parentRef} className="flex-1 overflow-auto p-2"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vrow) => (
          <div key={vrow.key}
            style={{ position: "absolute", top: vrow.start, left: 0, right: 0, display: "flex" }}>
            {Array.from({ length: cols }).map((_, colIdx) => {
              const idx = vrow.index * cols + colIdx;
              if (idx >= entries.length) return <div key={colIdx} style={{ width: cellSize }} />;
              const entry = entries[idx];
              const selected = selection.has(entry.path);
              const isCut = cutPaths.has(entry.path);
              const iconSz = Math.round(cellSize * 0.4);

              return (
                <div
                  key={entry.path}
                  style={{ width: cellSize, height: cellHeight }}
                  onClick={(e) => {
                    if (e.ctrlKey) toggleSelection(paneId, entry.path);
                    else setSelection(paneId, [entry.path]);
                  }}
                  onDoubleClick={() => onOpen(entry)}
                  onContextMenu={(e) => { e.preventDefault(); if (!selection.has(entry.path)) setSelection(paneId, [entry.path]); onContextMenu(e, entry); }}
                  draggable
                  onDragStart={(e) => {
                    const paths = selected ? Array.from(selection) : [entry.path];
                    e.dataTransfer.setData("nova/paths", JSON.stringify(paths));
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 p-2 rounded cursor-default transition-colors",
                    isCut && "opacity-50",
                    selected ? "bg-[var(--bg-selected)]" : "hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <ThumbnailCellSized entry={entry} size={iconSz} />
                  <span className="text-[10px] text-center text-[var(--text-primary)] leading-tight line-clamp-2 max-w-full px-1">
                    {entry.name}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
