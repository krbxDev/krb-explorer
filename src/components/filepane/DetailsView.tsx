import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useCallback, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { FileEntry, SortKey } from "../../lib/types";
import { FileIcon } from "./FileIcon";
import { formatSize, formatDate, cn } from "../../lib/utils";
import { useStore } from "../../store";

interface Props {
  paneId: string;
  entries: FileEntry[];
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}

const GIT_BADGE: Record<string, { label: string; color: string }> = {
  M: { label: "M", color: "#f59e0b" },
  A: { label: "A", color: "#22c55e" },
  D: { label: "D", color: "#ef4444" },
  "?": { label: "?", color: "#a0a0b8" },
  "!": { label: "!", color: "#a0a0b8" },
  R: { label: "R", color: "#3b82f6" },
  C: { label: "C", color: "#8b5cf6" },
};

const ROW_HEIGHT = 26;
const MIN_COL = 60;

export function DetailsView({ paneId, entries, onOpen, onContextMenu }: Props) {
  const { panes, setSelection, toggleSelection, setSort, columnWidths, setColumnWidth } = useStore();
  const pane = panes[paneId];
  const selection = pane?.selection ?? new Set();
  const sortKey = pane?.sortKey ?? "name";
  const sortAsc = pane?.sortAsc ?? true;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Column resize state
  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const startResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(col);
    resizeStartX.current = e.clientX;
    resizeStartW.current = columnWidths[col] ?? 120;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - resizeStartX.current;
      const newW = Math.max(MIN_COL, resizeStartW.current + delta);
      setColumnWidth(col, newW);
    };
    const onUp = () => {
      setResizing(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleClick = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    if (e.ctrlKey) {
      toggleSelection(paneId, entry.path);
    } else if (e.shiftKey && selection.size > 0) {
      const selArr = Array.from(selection);
      const lastSel = selArr[selArr.length - 1];
      const lastIdx = entries.findIndex((x) => x.path === lastSel);
      const curIdx = entries.findIndex((x) => x.path === entry.path);
      if (lastIdx >= 0 && curIdx >= 0) {
        const [lo, hi] = [Math.min(lastIdx, curIdx), Math.max(lastIdx, curIdx)];
        setSelection(paneId, entries.slice(lo, hi + 1).map((x) => x.path));
      }
    } else {
      setSelection(paneId, [entry.path]);
    }
  }, [entries, selection, paneId, setSelection, toggleSelection]);

  const cols = [
    { key: "name" as SortKey, label: "Name" },
    { key: "modified" as SortKey, label: "Date modified" },
    { key: "type" as SortKey, label: "Type" },
    { key: "size" as SortKey, label: "Size" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center h-7 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0 select-none">
        <div className="w-5 shrink-0" />
        {cols.map((col) => {
          const w = columnWidths[col.key] ?? 120;
          return (
            <div
              key={col.key}
              className="relative flex items-center shrink-0"
              style={{ width: col.key === "name" ? undefined : w, flex: col.key === "name" ? 1 : undefined }}
            >
              <button
                onClick={() => setSort(paneId, col.key, sortKey === col.key ? !sortAsc : true)}
                className={cn(
                  "flex items-center gap-1 h-7 px-2 w-full text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                  col.key === "size" && "justify-end"
                )}
              >
                {col.label}
                {sortKey === col.key && (sortAsc ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
              {/* Resize handle */}
              <div
                onMouseDown={(e) => startResize(e, col.key)}
                className={cn(
                  "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)] transition-colors",
                  resizing === col.key && "bg-[var(--accent)]"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vrow) => {
            const entry = entries[vrow.index];
            const selected = selection.has(entry.path);
            const gitBadge = entry.gitStatus ? GIT_BADGE[entry.gitStatus] : null;
            const nameW = columnWidths["name"];

            return (
              <div
                key={vrow.key}
                data-index={vrow.index}
                ref={virtualizer.measureElement}
                style={{ position: "absolute", top: vrow.start, left: 0, right: 0 }}
                onClick={(e) => handleClick(e, entry)}
                onDoubleClick={() => onOpen(entry)}
                onContextMenu={(e) => { e.preventDefault(); handleClick(e, entry); onContextMenu(e, entry); }}
                draggable
                onDragStart={(e) => {
                  const paths = selected ? Array.from(selection) : [entry.path];
                  e.dataTransfer.setData("nova/paths", JSON.stringify(paths));
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                className={cn(
                  "flex items-center h-[26px] px-2 cursor-default select-none transition-colors",
                  selected
                    ? "bg-[var(--bg-selected)] hover:bg-[var(--bg-selected-hover)]"
                    : vrow.index % 2 === 0
                      ? "bg-[var(--bg-base)]/60 hover:bg-[var(--bg-hover)]"
                      : "hover:bg-[var(--bg-hover)]"
                )}
              >
                <div className="w-5 shrink-0 flex items-center justify-center">
                  <FileIcon entry={entry} size={14} />
                </div>

                {/* Name */}
                <div
                  className="flex items-center gap-1.5 px-2 min-w-0 overflow-hidden"
                  style={{ flex: 1 }}
                >
                  <span className={cn("truncate text-xs", entry.isHidden && "opacity-50")}>
                    {entry.name}
                  </span>
                  {gitBadge && (
                    <span
                      className="shrink-0 text-[9px] font-bold px-1 rounded"
                      style={{ color: gitBadge.color, backgroundColor: `${gitBadge.color}22` }}
                    >
                      {gitBadge.label}
                    </span>
                  )}
                </div>

                {/* Modified */}
                <div style={{ width: columnWidths["modified"] ?? 144 }}
                  className="px-2 text-xs text-[var(--text-secondary)] truncate shrink-0">
                  {formatDate(entry.modified)}
                </div>

                {/* Type */}
                <div style={{ width: columnWidths["type"] ?? 96 }}
                  className="px-2 text-xs text-[var(--text-muted)] truncate shrink-0">
                  {entry.isDir ? "Folder" : (entry.extension?.toUpperCase() ?? "File")}
                </div>

                {/* Size */}
                <div style={{ width: columnWidths["size"] ?? 80 }}
                  className="px-2 text-xs text-[var(--text-secondary)] text-right shrink-0">
                  {entry.isDir ? "" : formatSize(entry.size)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
