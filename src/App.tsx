import { useEffect, useState } from "react";
import { TitleBar } from "./components/titlebar/TitleBar";
import { TabBar } from "./components/tabs/TabBar";
import { Toolbar } from "./components/toolbar/Toolbar";
import { Sidebar } from "./components/sidebar/Sidebar";
import { FilePane } from "./components/filepane/FilePane";
import { PreviewPanel } from "./components/preview/PreviewPanel";
import { CommandPalette } from "./components/palette/CommandPalette";
import { StatusBar } from "./components/statusbar/StatusBar";
import { QuickLook } from "./components/quicklook/QuickLook";
import { BulkRenameModal } from "./components/bulkrename/BulkRenameModal";
import { DiskUsageModal } from "./components/diskusage/DiskUsageModal";
import { CopyProgressBar } from "./components/progress/CopyProgressBar";
import { TerminalPanel } from "./components/terminal/TerminalPanel";
import { UpdateChecker } from "./components/updater/UpdateChecker";
import { useStore } from "./store";
import { useKeyboard } from "./hooks/useKeyboard";

export function App() {
  const {
    activePaneId, panes, splitMode, tabs, activeTabId,
    navigate, loadDrives, loadFavorites, previewOpen,
    sidebarCollapsed, terminalOpen,
  } = useStore();

  const [updateOpen, setUpdateOpen] = useState(false);

  // Expose manual trigger globally so TitleBar / menu can call it
  useEffect(() => {
    (window as any).__openUpdateChecker = () => setUpdateOpen(true);
    return () => { delete (window as any).__openUpdateChecker; };
  }, []);

  useKeyboard();

  useEffect(() => {
    loadDrives();
    loadFavorites();
    const initialPaneId = Object.keys(panes)[0];
    if (initialPaneId) navigate(initialPaneId, panes[initialPaneId].path);
  }, []);

  const paneIds = Object.keys(panes);
  const secondPaneId = paneIds.find((id) => id !== activePaneId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] overflow-hidden">
      <TitleBar />
      <TabBar />
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed && <Sidebar />}

        <div className={`flex flex-1 overflow-hidden ${splitMode === "vertical" ? "flex-col" : "flex-row"}`}>
          {splitMode === "none" && (
            <div className="flex-1 overflow-hidden">
              {activeTab && <FilePane paneId={activeTab.paneId} />}
            </div>
          )}

          {splitMode !== "none" && (
            <>
              <div className="flex-1 overflow-hidden">
                <FilePane paneId={activePaneId} />
              </div>
              <div className={splitMode === "horizontal" ? "w-px bg-[var(--border)]" : "h-px bg-[var(--border)]"} />
              {secondPaneId && (
                <div className="flex-1 overflow-hidden">
                  <FilePane paneId={secondPaneId} />
                </div>
              )}
            </>
          )}
        </div>

        {previewOpen && <PreviewPanel />}
      </div>

      {terminalOpen && <TerminalPanel />}
      <StatusBar />
      <CommandPalette />
      <QuickLook />
      <BulkRenameModal />
      <DiskUsageModal />
      <CopyProgressBar />

      {/* Silent startup check — only renders UI when update is available */}
      <UpdateChecker silent />

      {/* Manual check triggered from menu/titlebar */}
      {updateOpen && <UpdateChecker onClose={() => setUpdateOpen(false)} />}
    </div>
  );
}

export default App;
