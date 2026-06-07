import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboard() {
  const {
    activePaneId, navigateBack, navigateForward, navigateUp, refresh,
    openTab, closeTab, activeTabId, tabs, openPalette, selectAll,
    setViewMode, panes, setClipboard, pasteClipboard, clipboard,
    openQuickLook, toggleTerminal, toggleBulkRename, toggleDiskUsage,
  } = useStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); navigateBack(activePaneId); }
      else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); navigateForward(activePaneId); }
      else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); navigateUp(activePaneId); }
      else if (e.key === "F5") { e.preventDefault(); refresh(activePaneId); }
      else if (!isInput && e.ctrlKey && e.key === "t") { e.preventDefault(); openTab(); }
      else if (!isInput && e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (tabs.length > 1) closeTab(activeTabId);
      }
      else if (!isInput && (e.ctrlKey && e.key === "p" || e.key === "F3")) {
        e.preventDefault(); openPalette();
      }
      else if (!isInput && e.ctrlKey && e.key === "a") {
        e.preventDefault(); selectAll(activePaneId);
      }
      else if (!isInput && e.ctrlKey && e.key === "1") { setViewMode(activePaneId, "details"); }
      else if (!isInput && e.ctrlKey && e.key === "2") { setViewMode(activePaneId, "list"); }
      else if (!isInput && e.ctrlKey && e.key === "3") { setViewMode(activePaneId, "grid"); }
      // Clipboard
      else if (!isInput && e.ctrlKey && e.key === "c") {
        const sel = Array.from(panes[activePaneId]?.selection ?? []);
        if (sel.length) { e.preventDefault(); setClipboard(sel, "copy"); }
      }
      else if (!isInput && e.ctrlKey && e.key === "x") {
        const sel = Array.from(panes[activePaneId]?.selection ?? []);
        if (sel.length) { e.preventDefault(); setClipboard(sel, "cut"); }
      }
      else if (!isInput && e.ctrlKey && e.key === "v") {
        if (clipboard) { e.preventDefault(); pasteClipboard(activePaneId); }
      }
      // Quick Look
      else if (!isInput && e.key === " ") {
        e.preventDefault();
        const pane = panes[activePaneId];
        const sel = Array.from(pane?.selection ?? []);
        if (sel.length === 1) openQuickLook(sel[0]);
        else if (pane?.entries.length) openQuickLook(pane.entries[0].path);
      }
      // Terminal
      else if (e.ctrlKey && e.key === "`") { e.preventDefault(); toggleTerminal(); }
      // Panels
      else if (!isInput && e.ctrlKey && e.shiftKey && e.key === "R") { e.preventDefault(); toggleBulkRename(); }
      else if (!isInput && e.ctrlKey && e.shiftKey && e.key === "D") { e.preventDefault(); toggleDiskUsage(); }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePaneId, tabs, activeTabId, panes, clipboard]);
}
