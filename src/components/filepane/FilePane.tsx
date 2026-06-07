import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Loader2, AlertCircle, Search, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import { DetailsView } from "./DetailsView";
import { GridView } from "./GridView";
import { ContextMenu } from "./ContextMenu";
import type { FileEntry, ContextMenuAction } from "../../lib/types";
import { cn, ARCHIVE_EXTS } from "../../lib/utils";

interface Props { paneId: string; }
interface CtxMenuState { x: number; y: number; entry: FileEntry }

export function FilePane({ paneId }: Props) {
  const {
    panes, navigate, openPreview, setSelection, clearSelection, selectAll,
    addFavorite, refresh, setClipboard, pasteClipboard, clipboard,
    openQuickLook, activePaneId, setActivePane, toggleBulkRename,
  } = useStore();
  const pane = panes[paneId];
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [localSearch, setLocalSearch] = useState("");
  const [dropTarget, setDropTarget] = useState(false);
  const isActive = activePaneId === paneId;
  const containerRef = useRef<HTMLDivElement>(null);

  // File watcher — auto-refresh on changes
  useEffect(() => {
    if (!pane?.path) return;
    const unlisten = listen<any>("fs-change", (event) => {
      if (event.payload?.path === pane.path) {
        refresh(paneId);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [pane?.path, paneId]);

  const displayEntries = useMemo(() => {
    if (!pane) return [];
    const q = localSearch.toLowerCase();
    if (!q) return pane.entries;
    return pane.entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [pane?.entries, localSearch]);

  const handleOpen = useCallback(async (entry: FileEntry) => {
    if (entry.isDir) {
      navigate(paneId, entry.path);
    } else if (ARCHIVE_EXTS.has(entry.extension?.toLowerCase() ?? "")) {
      navigate(paneId, entry.path);
    } else {
      openQuickLook(entry.path);
    }
  }, [paneId, navigate, openQuickLook]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  // Drag & drop — drop onto this pane
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("nova/paths")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
      setDropTarget(true);
    }
  };

  const handleDragLeave = () => setDropTarget(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(false);
    const raw = e.dataTransfer.getData("nova/paths");
    if (!raw || !pane) return;
    try {
      const paths: string[] = JSON.parse(raw);
      if (e.ctrlKey) {
        await fs.copyItems(paths, pane.path);
      } else {
        await fs.moveItems(paths, pane.path);
      }
      refresh(paneId);
    } catch (err) {
      console.error("Drop failed:", err);
    }
  };

  const buildContextActions = (entry: FileEntry): ContextMenuAction[] => {
    const sel = Array.from(pane?.selection ?? []);
    const targets = sel.length > 1 ? sel : [entry.path];

    return [
      {
        id: "open", label: entry.isDir ? "Open" : "Quick Look (Space)",
        action: () => handleOpen(entry),
      },
      {
        id: "open-new-tab", label: "Open in new tab",
        action: () => useStore.getState().openTab(entry.path),
      },
      {
        id: "preview", label: "Show in preview panel",
        action: () => openPreview(entry.path),
      },
      { id: "sep0", label: "", separator: true, action: () => {} },
      {
        id: "copy", label: "Copy", shortcut: "Ctrl+C",
        action: () => setClipboard(targets, "copy"),
      },
      {
        id: "cut", label: "Cut", shortcut: "Ctrl+X",
        action: () => setClipboard(targets, "cut"),
      },
      {
        id: "paste", label: "Paste", shortcut: "Ctrl+V",
        disabled: !clipboard,
        action: () => pasteClipboard(paneId),
      },
      { id: "sep1", label: "", separator: true, action: () => {} },
      {
        id: "copy-path", label: "Copy path",
        action: () => navigator.clipboard.writeText(targets.join("\n")),
      },
      {
        id: "rename", label: "Rename", shortcut: "F2",
        disabled: targets.length > 1,
        action: async () => {
          const newName = prompt("Rename to:", entry.name);
          if (newName && newName !== entry.name) {
            await fs.renameItem(entry.path, newName);
            refresh(paneId);
          }
        },
      },
      {
        id: "bulk-rename", label: "Bulk rename…",
        disabled: targets.length < 2,
        action: () => { setSelection(paneId, targets); toggleBulkRename(); },
      },
      { id: "sep2", label: "", separator: true, action: () => {} },
      {
        id: "fav", label: "Add to Favorites",
        action: () => addFavorite(entry.path, entry.name),
      },
      {
        id: "vscode", label: "Open in VS Code",
        disabled: !entry.isDir,
        action: () => fs.openInVscode(entry.path),
      },
      {
        id: "terminal", label: "Open terminal here",
        disabled: !entry.isDir,
        action: () => fs.openTerminalAt(entry.path),
      },
      ...(ARCHIVE_EXTS.has(entry.extension?.toLowerCase() ?? "") ? [{
        id: "extract", label: "Extract archive here",
        action: async () => {
          const { archive } = await import("../../lib/invoke");
          await archive.extract(entry.path, pane?.path ?? "");
          refresh(paneId);
        },
      }] : []),
      { id: "sep3", label: "", separator: true, action: () => {} },
      {
        id: "delete", label: "Move to Recycle Bin", shortcut: "Del", danger: true,
        action: async () => {
          if (confirm(`Delete ${targets.length} item(s)?`)) {
            await fs.deleteItems(targets, true);
            refresh(paneId);
          }
        },
      },
      {
        id: "delete-perm", label: "Delete Permanently", shortcut: "Shift+Del", danger: true,
        action: async () => {
          if (confirm(`Permanently delete ${targets.length} item(s)? This cannot be undone.`)) {
            await fs.deleteItems(targets, false);
            refresh(paneId);
          }
        },
      },
    ];
  };

  if (!pane) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-[var(--bg-base)] relative outline-none",
        dropTarget && "ring-2 ring-inset ring-[var(--accent)]",
        isActive && "ring-1 ring-inset ring-[var(--accent)]/20"
      )}
      onClick={() => { clearSelection(paneId); setActivePane(paneId); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={(e) => {
        if (e.key === "a" && e.ctrlKey) { e.preventDefault(); selectAll(paneId); }
        if (e.key === "F5") refresh(paneId);
        if (e.key === "c" && e.ctrlKey) {
          const sel = Array.from(pane.selection);
          if (sel.length) setClipboard(sel, "copy");
        }
        if (e.key === "x" && e.ctrlKey) {
          const sel = Array.from(pane.selection);
          if (sel.length) setClipboard(sel, "cut");
        }
        if (e.key === "v" && e.ctrlKey) pasteClipboard(paneId);
        if (e.key === " " && !e.ctrlKey) {
          e.preventDefault();
          const sel = Array.from(pane.selection);
          if (sel.length === 1) openQuickLook(sel[0]);
          else if (sel.length === 0 && displayEntries.length > 0) openQuickLook(displayEntries[0].path);
        }
        if (e.key === "Delete") {
          const sel = Array.from(pane.selection);
          if (sel.length && confirm(`Delete ${sel.length} item(s)?`)) {
            fs.deleteItems(sel, !e.shiftKey).then(() => refresh(paneId));
          }
        }
      }}
      tabIndex={0}
    >
      {/* Local search / filter bar */}
      <div className="flex items-center h-8 px-2 border-b border-[var(--border)] gap-2 shrink-0">
        <Search size={12} className="text-[var(--text-muted)] shrink-0" />
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Filter in folder…"
          className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          onClick={(e) => e.stopPropagation()}
        />
        {localSearch && (
          <button onClick={() => setLocalSearch("")}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={12} />
          </button>
        )}
        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
          {displayEntries.length} item{displayEntries.length !== 1 ? "s" : ""}
        </span>
        {clipboard && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] shrink-0">
            {clipboard.mode === "cut" ? "✂" : "📋"} {clipboard.paths.length}
          </span>
        )}
      </div>

      {/* Loading overlay */}
      {pane.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)]/80 z-10 pointer-events-none">
          <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
        </div>
      )}

      {/* Error state */}
      {pane.error && !pane.loading && (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--danger)]">
          <AlertCircle size={32} />
          <p className="text-sm text-center px-8">{pane.error}</p>
        </div>
      )}

      {/* Empty state */}
      {!pane.loading && !pane.error && displayEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-muted)]">
          <span className="text-4xl">📁</span>
          <p className="text-sm">{localSearch ? "No matches found" : "This folder is empty"}</p>
        </div>
      )}

      {/* Drop overlay label */}
      {dropTarget && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
            Drop to move here (hold Ctrl to copy)
          </div>
        </div>
      )}

      {/* File list */}
      {!pane.error && displayEntries.length > 0 && (
        <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {pane.viewMode === "grid" ? (
            <GridView paneId={paneId} entries={displayEntries} onOpen={handleOpen} onContextMenu={handleContextMenu} />
          ) : (
            <DetailsView paneId={paneId} entries={displayEntries} onOpen={handleOpen} onContextMenu={handleContextMenu} />
          )}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          actions={buildContextActions(ctxMenu.entry)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
