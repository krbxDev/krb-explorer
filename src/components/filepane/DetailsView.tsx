import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import type { FileEntry, SortKey } from "../../lib/types";
import { FileIcon } from "./FileIcon";
import { formatSize, formatDate, cn, getFileTypeLabel } from "../../lib/utils";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";

interface Props {
  paneId: string;
  entries: FileEntry[];
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onRenameCommit?: (entry: FileEntry, newName: string) => void;
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
const MIN_COL = 40;

const ALL_COLS = [
  { key: "name" as SortKey, label: "Name", defaultWidth: 400, flex: true },
  { key: "modified" as SortKey, label: "Date modified", defaultWidth: 144, flex: false },
  { key: "type" as SortKey, label: "Type", defaultWidth: 96, flex: false },
  { key: "size" as SortKey, label: "Size", defaultWidth: 80, flex: false },
];

export function DetailsView({ paneId, entries, onOpen, onContextMenu, onRenameCommit }: Props) {
  const {
    panes, setSelection, toggleSelection, setSort, columnWidths, setColumnWidth,
    columnOrder, setColumnOrder, checkboxMode, showExtensions,
    pushUndo, refresh,
  } = useStore();
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

  // Focused row index for keyboard navigation
  const [focusedIdx, setFocusedIdx] = useState(-1);

  // Inline rename
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Rubber-band selection
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const lassoStart = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const isDragging = useRef(false);

  // Column resize
  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  // Column drag-to-reorder
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const cols = columnOrder
    .map((k) => ALL_COLS.find((c) => c.key === k))
    .filter(Boolean) as typeof ALL_COLS;

  // Focus management
  useEffect(() => {
    if (focusedIdx >= entries.length) setFocusedIdx(Math.max(0, entries.length - 1));
  }, [entries.length]);

  useEffect(() => {
    if (focusedIdx >= 0 && focusedIdx < entries.length) {
      virtualizer.scrollToIndex(focusedIdx, { align: "auto" });
    }
  }, [focusedIdx]);

  // Inline rename focus
  useLayoutEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      // Select name without extension
      const entry = entries.find((e) => e.path === renamingPath);
      if (entry && !entry.isDir && entry.extension) {
        const dotIdx = entry.name.lastIndexOf(".");
        if (dotIdx > 0) renameInputRef.current.setSelectionRange(0, dotIdx);
        else renameInputRef.current.select();
      } else {
        renameInputRef.current.select();
      }
    }
  }, [renamingPath]);

  const startRename = useCallback((entry: FileEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingPath || !renameValue.trim()) { setRenamingPath(null); return; }
    const entry = entries.find((e) => e.path === renamingPath);
    if (!entry || renameValue === entry.name) { setRenamingPath(null); return; }
    try {
      await fs.renameItem(renamingPath, renameValue.trim());
      pushUndo({ id: Math.random().toString(36).slice(2), kind: "rename", sources: [renamingPath], oldName: entry.name, newName: renameValue.trim(), timestamp: Date.now() });
      onRenameCommit?.(entry, renameValue.trim());
      refresh(paneId);
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setRenamingPath(null);
  }, [renamingPath, renameValue, entries, paneId]);

  const cancelRename = useCallback(() => { setRenamingPath(null); }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (renamingPath) return; // handled by rename input

    if (e.key === "F2") {
      e.preventDefault();
      if (selection.size === 1) {
        const entry = entries.find((e2) => selection.has(e2.path));
        if (entry) startRename(entry);
      } else if (focusedIdx >= 0 && focusedIdx < entries.length) {
        startRename(entries[focusedIdx]);
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextIdx = e.key === "ArrowDown"
        ? Math.min(focusedIdx + 1, entries.length - 1)
        : Math.max(focusedIdx - 1, 0);
      if (e.shiftKey) {
        // Extend selection
        const anchor = focusedIdx >= 0 ? focusedIdx : 0;
        const lo = Math.min(anchor, nextIdx);
        const hi = Math.max(anchor, nextIdx);
        setSelection(paneId, entries.slice(lo, hi + 1).map((x) => x.path));
      } else if (!e.ctrlKey) {
        setSelection(paneId, [entries[nextIdx]?.path ?? ""]);
      }
      setFocusedIdx(nextIdx);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      setFocusedIdx(0);
      if (!e.shiftKey) setSelection(paneId, [entries[0]?.path ?? ""]);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      const last = entries.length - 1;
      setFocusedIdx(last);
      if (!e.shiftKey) setSelection(paneId, [entries[last]?.path ?? ""]);
      return;
    }

    if (e.key === "Enter" && focusedIdx >= 0 && focusedIdx < entries.length) {
      e.preventDefault();
      onOpen(entries[focusedIdx]);
      return;
    }

    if (e.key === " " && e.ctrlKey && focusedIdx >= 0 && focusedIdx < entries.length) {
      e.preventDefault();
      toggleSelection(paneId, entries[focusedIdx].path);
      return;
    }
  }, [focusedIdx, entries, selection, paneId, renamingPath, setSelection, toggleSelection, onOpen, startRename]);

  const handleClick = useCallback((e: React.MouseEvent, entry: FileEntry, idx: number) => {
    setFocusedIdx(idx);
    if (e.ctrlKey) {
      toggleSelection(paneId, entry.path);
    } else if (e.shiftKey && selection.size > 0) {
      const anchor = focusedIdx >= 0 ? focusedIdx : 0;
      const [lo, hi] = [Math.min(anchor, idx), Math.max(anchor, idx)];
      setSelection(paneId, entries.slice(lo, hi + 1).map((x) => x.path));
    } else {
      setSelection(paneId, [entry.path]);
    }
  }, [entries, selection, focusedIdx, paneId, setSelection, toggleSelection]);

  // Column resize
  const startResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault(); e.stopPropagation();
    setResizing(col);
    resizeStartX.current = e.clientX;
    resizeStartW.current = columnWidths[col] ?? 120;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - resizeStartX.current;
      setColumnWidth(col, Math.max(MIN_COL, resizeStartW.current + delta));
    };
    const onUp = () => {
      setResizing(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Column auto-size on double-click header divider
  const autoSizeCol = (col: string) => {
    // Estimate based on content — use 120px as a sensible default auto-size
    const colEntries = entries.slice(0, 100);
    let maxW = col === "name" ? 200 : 80;
    if (col === "modified") maxW = 130;
    if (col === "type") {
      const maxLabel = colEntries.reduce((m, e) => Math.max(m, getFileTypeLabel(e).length), 0);
      maxW = Math.max(80, maxLabel * 7 + 16);
    }
    if (col === "size") maxW = 80;
    if (col === "name") {
      const maxLen = colEntries.reduce((m, e) => Math.max(m, e.name.length), 0);
      maxW = Math.max(160, Math.min(500, maxLen * 7 + 40));
    }
    setColumnWidth(col, maxW);
  };

  // Column drag-to-reorder
  const handleColDragStart = (col: string) => setDragCol(col);
  const handleColDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverCol(col);
  };
  const handleColDrop = (col: string) => {
    if (!dragCol || dragCol === col) { setDragCol(null); setDragOverCol(null); return; }
    const newOrder = [...columnOrder];
    const fromIdx = newOrder.indexOf(dragCol);
    const toIdx = newOrder.indexOf(col);
    if (fromIdx >= 0 && toIdx >= 0) {
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, dragCol);
      setColumnOrder(newOrder);
    }
    setDragCol(null); setDragOverCol(null);
  };

  // Rubber-band / lasso selection
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start lasso on left click on the container (not on a row)
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-row]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollTop = parentRef.current?.scrollTop ?? 0;
    lassoStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top + scrollTop, scrollTop };
    isDragging.current = false;

    const onMouseMove = (ev: MouseEvent) => {
      if (!lassoStart.current || !parentRef.current) return;
      const rect2 = parentRef.current.getBoundingClientRect();
      const scrollTop2 = parentRef.current.scrollTop;
      const x2 = ev.clientX - rect2.left;
      const y2 = ev.clientY - rect2.top + scrollTop2;
      const { x: x1, y: y1 } = lassoStart.current;
      if (Math.abs(x2 - x1) > 3 || Math.abs(y2 - y1) > 3) {
        isDragging.current = true;
        setLasso({ x1, y1, x2, y2 });
        // Hit-test rows
        const lo = Math.min(y1, y2);
        const hi = Math.max(y1, y2);
        const matchedPaths: string[] = [];
        entries.forEach((entry, idx) => {
          const rowTop = idx * ROW_HEIGHT;
          const rowBot = rowTop + ROW_HEIGHT;
          if (rowBot >= lo && rowTop <= hi) matchedPaths.push(entry.path);
        });
        if (ev.ctrlKey) {
          // Add to existing
          const combined = new Set([...Array.from(panes[paneId]?.selection ?? []), ...matchedPaths]);
          setSelection(paneId, Array.from(combined));
        } else {
          setSelection(paneId, matchedPaths);
        }
      }
    };

    const onMouseUp = () => {
      setLasso(null);
      lassoStart.current = null;
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="flex flex-col h-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center h-7 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0 select-none">
        {checkboxMode && <div className="w-7 shrink-0" />}
        <div className="w-5 shrink-0" />
        {cols.map((col) => {
          const w = col.flex ? undefined : (columnWidths[col.key] ?? col.defaultWidth);
          return (
            <div
              key={col.key}
              className={cn(
                "relative flex items-center shrink-0",
                dragOverCol === col.key && "bg-[var(--accent)]/10"
              )}
              style={{ width: col.flex ? undefined : w, flex: col.flex ? 1 : undefined }}
              draggable
              onDragStart={() => handleColDragStart(col.key)}
              onDragOver={(e) => handleColDragOver(e, col.key)}
              onDrop={() => handleColDrop(col.key)}
              onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
            >
              {/* Drag handle */}
              <GripVertical size={10} className="text-[var(--text-muted)] opacity-30 hover:opacity-60 cursor-grab shrink-0 ml-1" />
              <button
                onClick={() => setSort(paneId, col.key, sortKey === col.key ? !sortAsc : true)}
                className={cn(
                  "flex items-center gap-1 h-7 px-1 flex-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                  col.key === "size" && "justify-end"
                )}
              >
                {col.label}
                {sortKey === col.key && (sortAsc ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
              {/* Resize handle */}
              <div
                onMouseDown={(e) => startResize(e, col.key)}
                onDoubleClick={() => autoSizeCol(col.key)}
                className={cn(
                  "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)] transition-colors z-10",
                  resizing === col.key && "bg-[var(--accent)]"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative select-none"
        onMouseDown={handleMouseDown}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vrow) => {
            const entry = entries[vrow.index];
            const selected = selection.has(entry.path);
            const focused = focusedIdx === vrow.index;
            const gitBadge = entry.gitStatus ? GIT_BADGE[entry.gitStatus] : null;

            // NTFS color: compressed=blue, encrypted=green
            const nameColor = entry.ntfsEncrypted
              ? "text-[#22c55e]"
              : entry.ntfsCompressed
                ? "text-[#3b82f6]"
                : "";

            const displayName = showExtensions
              ? entry.name
              : (entry.isDir
                ? entry.name
                : (entry.extension && entry.name.endsWith(`.${entry.extension}`)
                  ? entry.name.slice(0, -(entry.extension.length + 1))
                  : entry.name));

            return (
              <div
                key={vrow.key}
                data-row="true"
                data-index={vrow.index}
                ref={virtualizer.measureElement}
                style={{ position: "absolute", top: vrow.start, left: 0, right: 0 }}
                onClick={(e) => { e.stopPropagation(); handleClick(e, entry, vrow.index); }}
                onDoubleClick={() => {
                  if (renamingPath === entry.path) return;
                  onOpen(entry);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selection.has(entry.path)) handleClick(e, entry, vrow.index);
                  onContextMenu(e, entry);
                }}
                draggable={renamingPath !== entry.path}
                onDragStart={(e) => {
                  const paths = selected ? Array.from(selection) : [entry.path];
                  e.dataTransfer.setData("nova/paths", JSON.stringify(paths));
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                className={cn(
                  "flex items-center h-[26px] cursor-default transition-colors",
                  selected
                    ? "bg-[var(--bg-selected)] hover:bg-[var(--bg-selected-hover)]"
                    : vrow.index % 2 === 0
                      ? "bg-[var(--bg-base)]/60 hover:bg-[var(--bg-hover)]"
                      : "hover:bg-[var(--bg-hover)]",
                  focused && !selected && "ring-1 ring-inset ring-[var(--accent)]/40"
                )}
              >
                {/* Checkbox */}
                {checkboxMode && (
                  <div
                    className="w-7 flex items-center justify-center shrink-0"
                    onClick={(e) => { e.stopPropagation(); toggleSelection(paneId, entry.path); }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                )}

                <div className="w-5 shrink-0 flex items-center justify-center">
                  <FileIcon entry={entry} size={14} />
                </div>

                {cols.map((col) => {
                  const w = col.flex ? undefined : (columnWidths[col.key] ?? col.defaultWidth);

                  if (col.key === "name") {
                    return (
                      <div
                        key="name"
                        className="flex items-center gap-1.5 px-2 min-w-0 overflow-hidden"
                        style={{ flex: 1 }}
                      >
                        {renamingPath === entry.path ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e2) => setRenameValue(e2.target.value)}
                            onKeyDown={(e2) => {
                              e2.stopPropagation();
                              if (e2.key === "Enter") { e2.preventDefault(); commitRename(); }
                              if (e2.key === "Escape") { e2.preventDefault(); cancelRename(); }
                            }}
                            onBlur={commitRename}
                            onClick={(e2) => e2.stopPropagation()}
                            className="flex-1 text-xs bg-[var(--bg-elevated)] border border-[var(--accent)] rounded px-1 py-0 outline-none text-[var(--text-primary)] min-w-0"
                          />
                        ) : (
                          <span
                            className={cn("truncate text-xs", entry.isHidden && "opacity-50", nameColor)}
                            onDoubleClick={(e2) => {
                              // Single double-click on already-selected row opens rename
                              if (selected && selection.size === 1) {
                                e2.stopPropagation();
                                e2.preventDefault();
                                startRename(entry);
                              }
                            }}
                          >
                            {displayName}
                          </span>
                        )}
                        {gitBadge && (
                          <span
                            className="shrink-0 text-[9px] font-bold px-1 rounded"
                            style={{ color: gitBadge.color, backgroundColor: `${gitBadge.color}22` }}
                          >
                            {gitBadge.label}
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (col.key === "modified") {
                    return (
                      <div key="modified" style={{ width: w }} className="px-2 text-xs text-[var(--text-secondary)] truncate shrink-0">
                        {formatDate(entry.modified)}
                      </div>
                    );
                  }

                  if (col.key === "type") {
                    return (
                      <div key="type" style={{ width: w }} className="px-2 text-xs text-[var(--text-muted)] truncate shrink-0">
                        {getFileTypeLabel(entry)}
                      </div>
                    );
                  }

                  if (col.key === "size") {
                    return (
                      <div key="size" style={{ width: w }} className="px-2 text-xs text-[var(--text-secondary)] text-right shrink-0">
                        {entry.isDir ? "" : formatSize(entry.size)}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}
        </div>

        {/* Lasso selection overlay */}
        {lasso && (() => {
          const scrollTop = parentRef.current?.scrollTop ?? 0;
          const x = Math.min(lasso.x1, lasso.x2);
          const y = Math.min(lasso.y1, lasso.y2) - scrollTop;
          const w = Math.abs(lasso.x2 - lasso.x1);
          const h = Math.abs(lasso.y2 - lasso.y1);
          return (
            <div
              style={{ position: "absolute", left: x, top: y, width: w, height: h, pointerEvents: "none" }}
              className="border border-[var(--accent)] bg-[var(--accent)]/10 z-20"
            />
          );
        })()}
      </div>
    </div>
  );
}
