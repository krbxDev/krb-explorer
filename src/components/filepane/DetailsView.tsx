import { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";
import { ArrowUp, ArrowDown, GripVertical, ChevronDown, FolderOpen } from "lucide-react";
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

// ROW_HEIGHT is dynamic per rowDensity; default 26
const MIN_COL = 40;

const ALL_COLS = [
  { key: "name" as SortKey, label: "Name", defaultWidth: 400, flex: true },
  { key: "modified" as SortKey, label: "Date modified", defaultWidth: 144, flex: false },
  { key: "type" as SortKey, label: "Type", defaultWidth: 96, flex: false },
  { key: "size" as SortKey, label: "Size", defaultWidth: 80, flex: false },
  { key: "attributes" as any, label: "Attributes", defaultWidth: 72, flex: false },
];

function getGroupLabel(entry: FileEntry, groupBy: string): string {
  if (groupBy === "type") return entry.isDir ? "Folder" : (entry.extension?.toUpperCase() ?? "File");
  if (groupBy === "size") {
    if (entry.isDir) return "Folder";
    const s = entry.size ?? 0;
    if (s === 0) return "Empty";
    if (s < 1024 * 16) return "Tiny (< 16 KB)";
    if (s < 1024 * 1024) return "Small (< 1 MB)";
    if (s < 1024 * 1024 * 100) return "Medium (< 100 MB)";
    return "Large (> 100 MB)";
  }
  if (groupBy === "modified") {
    if (!entry.modified) return "Unknown";
    // BUG-051 FIX: compare local calendar dates, not raw 24-hour deltas
    const d = new Date(entry.modified as string);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = (nowDay.getTime() - dDay.getTime()) / 86400000;
    if (diffDays < 1) return "Today";
    if (diffDays < 7) return "This week";
    if (diffDays < 30) return "This month";
    if (diffDays < 365) return "This year";
    return "Older";
  }
  return "";
}

export function DetailsView({ paneId, entries, onOpen, onContextMenu, onRenameCommit }: Props) {
  const {
    panes, setSelection, toggleSelection, setSort, columnWidths, setColumnWidth,
    columnOrder, setColumnOrder, checkboxMode, showExtensions,
    pushUndo, refresh, clipboard, hiddenColumns, setHiddenColumns, groupBy,
    showFolderSizes, rowDensity, folderColors,
  } = useStore();

  const rowHeight = rowDensity === "compact" ? 20 : rowDensity === "spacious" ? 34 : 26;
  const pane = panes[paneId];
  const selection = pane?.selection ?? new Set();
  const sortKey = pane?.sortKey ?? "name";
  const sortAsc = pane?.sortAsc ?? true;

  // Column chooser popover
  const [colChooserOpen, setColChooserOpen] = useState(false);
  const colChooserBtnRef = useRef<HTMLDivElement>(null);

  // BUG-025 FIX: close column chooser on click outside
  useEffect(() => {
    if (!colChooserOpen) return;
    const handler = (e: MouseEvent) => {
      if (colChooserBtnRef.current && !colChooserBtnRef.current.contains(e.target as Node)) {
        setColChooserOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colChooserOpen]);
  // Folder sizes cache
  const [folderSizeMap, setFolderSizeMap] = useState<Record<string, number>>({});

  const parentRef = useRef<HTMLDivElement>(null);

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
    .filter(Boolean)
    .filter((c) => !hiddenColumns.includes(c!.key)) as typeof ALL_COLS;

  // Load folder sizes when enabled
  useEffect(() => {
    if (!showFolderSizes) return;
    const dirs = entries.filter((e) => e.isDir).map((e) => e.path);
    if (dirs.length === 0) return;
    const missing = dirs.filter((p) => folderSizeMap[p] === undefined);
    if (missing.length === 0) return;
    // batch in groups of 10
    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += 10) batches.push(missing.slice(i, i + 10));
    (async () => {
      for (const batch of batches) {
        try {
          const results = await fs.getFolderSizes(batch);
          setFolderSizeMap((prev) => {
            const next = { ...prev };
            for (const [p, sz] of results) next[p] = sz;
            return next;
          });
        } catch {}
      }
    })();
  }, [entries, showFolderSizes]);

  // Reset folder sizes when navigating away
  useEffect(() => { setFolderSizeMap({}); }, [pane?.path]);

  // Focus management
  useEffect(() => {
    if (focusedIdx >= entries.length) setFocusedIdx(Math.max(0, entries.length - 1));
  }, [entries.length]);

  useEffect(() => {
    if (focusedIdx >= 0 && focusedIdx < entries.length && parentRef.current) {
      const rowEl = parentRef.current.querySelector(`[data-index="${focusedIdx}"]`);
      rowEl?.scrollIntoView({ block: "nearest" });
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
          const rowTop = idx * rowHeight;
          const rowBot = rowTop + rowHeight;
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
      <div className="flex items-center h-7 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0 select-none relative">
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
                onClick={() => setSort(paneId, col.key as SortKey, sortKey === col.key ? !sortAsc : true)}
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
        {/* Column chooser button */}
        <div ref={colChooserBtnRef} className="relative ml-auto shrink-0">
          <button
            onClick={() => setColChooserOpen((v) => !v)}
            title="Choose columns"
            className="h-7 w-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ChevronDown size={10} />
          </button>
          {colChooserOpen && (
            <div
              className="absolute right-0 top-7 z-30 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] mb-1">
                Show / hide columns
              </div>
              {ALL_COLS.filter(c => c.key !== "name").map((c) => {
                const visible = !hiddenColumns.includes(c.key);
                return (
                  <label key={c.key} className="flex items-center gap-2 px-3 py-1 hover:bg-[var(--bg-hover)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => {
                        setHiddenColumns(visible
                          ? [...hiddenColumns, c.key]
                          : hiddenColumns.filter((k) => k !== c.key)
                        );
                      }}
                      className="w-3 h-3 accent-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">{c.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative select-none"
        onMouseDown={handleMouseDown}
        onClick={() => setColChooserOpen(false)}
      >
        {/* Grouping: build flat list with group headers */}
        {(() => {
          // Build a flat renderable list
          type RowItem = { type: "entry"; entry: FileEntry; origIdx: number } | { type: "group"; label: string };
          let flatList: RowItem[] = [];
          if (groupBy) {
            // BUG-046 FIX: store index alongside entry to avoid O(n²) indexOf later
            const groups = new Map<string, { entry: FileEntry; origIdx: number }[]>();
            entries.forEach((e, i) => {
              const label = getGroupLabel(e, groupBy);
              if (!groups.has(label)) groups.set(label, []);
              groups.get(label)!.push({ entry: e, origIdx: i });
            });
            for (const [label, groupEntries] of groups) {
              flatList.push({ type: "group", label });
              groupEntries.forEach(({ entry: e, origIdx }) => {
                flatList.push({ type: "entry", entry: e, origIdx });
              });
            }
          } else {
            flatList = entries.map((e, i) => ({ type: "entry" as const, entry: e, origIdx: i }));
          }

          const cutPaths = clipboard?.mode === "cut" ? new Set(clipboard.paths) : new Set<string>();

          return (
            <div style={{ position: "relative" }}>
              {flatList.map((row, flatIdx) => {
                if (row.type === "group") {
                  return (
                    <div
                      key={`group-${row.label}`}
                      className="flex items-center gap-2 px-3 py-0.5 h-6 bg-[var(--bg-surface)] border-b border-[var(--border)] select-none"
                    >
                      <FolderOpen size={11} className="text-[var(--accent)]" />
                      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{row.label}</span>
                    </div>
                  );
                }

                const { entry, origIdx } = row;
                const selected = selection.has(entry.path);
                const focused = focusedIdx === origIdx;
                const gitBadge = entry.gitStatus ? GIT_BADGE[entry.gitStatus] : null;
                const isCut = cutPaths.has(entry.path);

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
                    key={entry.path}
                    data-row="true"
                    data-index={origIdx}
                    onClick={(e) => { e.stopPropagation(); handleClick(e, entry, origIdx); }}
                    onDoubleClick={() => {
                      if (renamingPath === entry.path) return;
                      onOpen(entry);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selection.has(entry.path)) handleClick(e, entry, origIdx);
                      onContextMenu(e, entry);
                    }}
                    draggable={renamingPath !== entry.path}
                    onDragStart={(e) => {
                      const paths = selected ? Array.from(selection) : [entry.path];
                      e.dataTransfer.setData("nova/paths", JSON.stringify(paths));
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    className={cn(
                      "flex items-center cursor-default transition-colors",
                      isCut && "opacity-50",
                      selected
                        ? "bg-[var(--bg-selected)] hover:bg-[var(--bg-selected-hover)]"
                        : origIdx % 2 === 0
                          ? "bg-[var(--bg-base)]/60 hover:bg-[var(--bg-hover)]"
                          : "hover:bg-[var(--bg-hover)]",
                      focused && !selected && "ring-1 ring-inset ring-[var(--accent)]/40"
                    )}
                    style={{
                      height: rowHeight,
                      ...(folderColors[entry.path] && !selected ? { borderLeft: `3px solid ${folderColors[entry.path]}` } : {}),
                    }}
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
                                onBlur={cancelRename}
                                onClick={(e2) => e2.stopPropagation()}
                                className="flex-1 text-xs bg-[var(--bg-elevated)] border border-[var(--accent)] rounded px-1 py-0 outline-none text-[var(--text-primary)] min-w-0"
                              />
                            ) : (
                              <span
                                className={cn("truncate text-xs", entry.isHidden && "opacity-50", nameColor)}
                                onDoubleClick={(e2) => {
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
                        const sz = entry.isDir
                          ? (showFolderSizes
                            ? (folderSizeMap[entry.path] !== undefined ? formatSize(folderSizeMap[entry.path]) : "…")
                            : "")
                          : formatSize(entry.size);
                        return (
                          <div key="size" style={{ width: w }} className="px-2 text-xs text-[var(--text-secondary)] text-right shrink-0">
                            {sz}
                          </div>
                        );
                      }

                      if (col.key === "attributes") {
                        const attrs = [
                          entry.readonly ? "R" : "",
                          entry.isHidden ? "H" : "",
                          (entry as any).isSystem ? "S" : "",
                        ].filter(Boolean).join(" ");
                        return (
                          <div key="attributes" style={{ width: w }} className="px-2 text-xs text-[var(--text-muted)] text-center shrink-0 font-mono tracking-wider">
                            {attrs}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                );
              })}
            </div>
          );
        })()}


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
