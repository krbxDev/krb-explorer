import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { FileIcon } from "./FileIcon";
import { formatSize, formatDate, cn } from "../../lib/utils";
import type { FileEntry } from "../../lib/types";

interface Props {
  paneId: string;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}

interface Column {
  path: string;
  entries: FileEntry[];
  selected: string | null;
  loading: boolean;
}

export function MillerView({ paneId, onOpen, onContextMenu }: Props) {
  const { panes } = useStore();
  const pane = panes[paneId];
  const scrollRef = useRef<HTMLDivElement>(null);
  // BUG-013 FIX: cancellation ref to abort stale buildColumns calls
  const cancelRef = useRef(0);

  const buildColumns = useCallback(async (path: string, token: number): Promise<void> => {
    const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
    let cumPath = "";
    const paths: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i === 0) cumPath = parts[0] + "\\";
      else cumPath = cumPath.replace(/[\\/]+$/, "") + "\\" + parts[i];
      paths.push(cumPath);
    }

    const cols: Column[] = [];
    for (let i = 0; i < paths.length - 1; i++) {
      if (cancelRef.current !== token) return; // stale — abort
      try {
        const entries = await fs.listDirectory(paths[i], false);
        if (cancelRef.current !== token) return;
        const selected = paths[i + 1]
          ? entries.find((e) => paths[i + 1].startsWith(e.path.replace(/[\\/]+$/, "")))?.path ?? null
          : null;
        cols.push({ path: paths[i], entries, selected, loading: false });
      } catch {}
    }

    if (cancelRef.current !== token) return;
    try {
      const entries = await fs.listDirectory(paths[paths.length - 1], false);
      if (cancelRef.current !== token) return;
      cols.push({ path, entries, selected: null, loading: false });
    } catch {}

    if (cancelRef.current === token) setColumns(cols);
  }, []);

  const [columns, setColumns] = useState<Column[]>([]);

  useEffect(() => {
    if (!pane?.path || pane.path.startsWith("::")) return;
    const token = ++cancelRef.current;
    buildColumns(pane.path, token);
  }, [pane?.path]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [columns.length]);

  const handleSelect = async (colIdx: number, entry: FileEntry) => {
    if (entry.isDir) {
      setColumns((prev) => prev.map((c, i) => i === colIdx ? { ...c, selected: entry.path } : c));
      try {
        const entries = await fs.listDirectory(entry.path, false);
        const newCol: Column = { path: entry.path, entries, selected: null, loading: false };
        setColumns((prev) => [...prev.slice(0, colIdx + 1), newCol]);
      } catch {}
      // BUG-033 FIX: navigate silently by updating path/history without pushing duplicate entries.
      // Use navigate but it already guards against duplicate history pushes.
      useStore.getState().navigate(paneId, entry.path);
    } else {
      onOpen(entry);
    }
  };

  if (!pane || pane.path.startsWith("::")) return null;

  return (
    <div ref={scrollRef} className="flex-1 flex overflow-x-auto overflow-y-hidden h-full bg-[var(--bg-base)]">
      {columns.map((col, colIdx) => (
        <div key={col.path} className="flex-shrink-0 w-[220px] border-r border-[var(--border)] flex flex-col overflow-hidden">
          <div className="h-6 px-2 flex items-center bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
            <span className="text-[10px] text-[var(--text-muted)] truncate">{col.path.split(/[\\/]/).pop() || col.path}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {col.entries.map((entry) => {
              const isSelected = col.selected === entry.path;
              return (
                <div
                  key={entry.path}
                  onClick={() => handleSelect(colIdx, entry)}
                  onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, entry); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-xs h-[26px]",
                    isSelected
                      ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
                      : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  )}
                >
                  <FileIcon entry={entry} size={13} />
                  <span className={cn("truncate flex-1", entry.isHidden && "opacity-50")}>{entry.name}</span>
                  {entry.isDir && <ChevronRight size={10} className="shrink-0 text-[var(--text-muted)]" />}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Preview column for selected file in last column */}
      {columns.length > 0 && (() => {
        const lastCol = columns[columns.length - 1];
        const selPath = lastCol.selected;
        const selEntry = selPath ? lastCol.entries.find((e) => e.path === selPath) : null;
        if (!selEntry || selEntry.isDir) return null;
        return (
          <div className="flex-shrink-0 w-[240px] flex flex-col overflow-hidden bg-[var(--bg-base)]">
            <div className="h-6 px-2 flex items-center bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
              <span className="text-[10px] text-[var(--text-muted)]">Preview</span>
            </div>
            <div className="flex-1 p-3 overflow-auto">
              <div className="flex flex-col items-center gap-3">
                <FileIcon entry={selEntry} size={48} />
                <div className="text-center">
                  <div className="text-xs font-medium text-[var(--text-primary)] break-all">{selEntry.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">{formatSize(selEntry.size)}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{formatDate(selEntry.modified)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
