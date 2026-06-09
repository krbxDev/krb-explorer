import { useEffect, useState } from "react";
import { TitleBar } from "./components/titlebar/TitleBar";
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
import { UpdateChecker } from "./components/updater/UpdateChecker";
import { PropertiesDialog } from "./components/filepane/PropertiesDialog";
import { ConflictDialog } from "./components/filepane/ConflictDialog";
import { OpenWithDialog } from "./components/filepane/OpenWithDialog";
import { NetworkDriveDialog } from "./components/dialogs/NetworkDriveDialog";
import { DuplicateFinderModal } from "./components/dialogs/DuplicateFinderModal";
import { CopyQueue } from "./components/progress/CopyQueue";
import { FileVaultDialog } from "./components/dialogs/FileVaultDialog";
import { LargeFilesModal } from "./components/dialogs/LargeFilesModal";
import { ActivityLogModal } from "./components/dialogs/ActivityLogModal";
import { WorkspacesModal } from "./components/dialogs/WorkspacesModal";
import { IndexedSearchModal } from "./components/dialogs/IndexedSearchModal";
import { AiAssistantModal } from "./components/dialogs/AiAssistantModal";
import { FtpPanel } from "./components/dialogs/FtpPanel";
import { PermissionsModal } from "./components/dialogs/PermissionsModal";
import { FileTimelineModal } from "./components/dialogs/FileTimelineModal";
import { useStore } from "./store";
import { useKeyboard } from "./hooks/useKeyboard";

export function App() {
  const {
    activePaneId, panes, splitMode, splitPaneIds, tabs, activeTabId,
    navigate, loadDrives, loadFavorites, previewOpen,
    sidebarCollapsed,
    restoreSession, loadWslDistros, loadFolderColors,
    workspaces,
  } = useStore();

  const [updateOpen, setUpdateOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Expose manual trigger globally so TitleBar / menu can call it
  useEffect(() => {
    (window as any).__openUpdateChecker = () => setUpdateOpen(true);
    (window as any).__openWorkspaces = () => setWorkspacesOpen(true);
    (window as any).__openTimeline = () => setTimelineOpen(true);
    return () => {
      delete (window as any).__openUpdateChecker;
      delete (window as any).__openWorkspaces;
      delete (window as any).__openTimeline;
    };
  }, []);

  useKeyboard();

  useEffect(() => {
    loadDrives();
    loadFavorites();
    loadWslDistros();
    loadFolderColors();

    const initialPaneId = Object.keys(panes)[0];
    // Support ?path=... for "Open in new window"
    const urlPath = new URLSearchParams(window.location.search).get("path");

    // BUG-029 FIX: only navigate to URL/default if session restore didn't set a path
    if (urlPath) {
      // Explicit URL param always wins
      navigate(initialPaneId, decodeURIComponent(urlPath));
    } else {
      // Try session restore first; if it has no data, navigate to home
      restoreSession();
      const afterRestore = useStore.getState().panes[initialPaneId]?.path;
      if (!afterRestore || afterRestore === "::home") {
        navigate(initialPaneId, "::home");
      }
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const leftPaneId  = splitPaneIds?.[0] ?? activePaneId;
  const rightPaneId = splitPaneIds?.[1];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] overflow-hidden">
      <TitleBar />
      <Toolbar onOpenWorkspaces={() => setWorkspacesOpen(true)} onOpenTimeline={() => setTimelineOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed && splitMode === "none" && <Sidebar />}

        <div className={`flex flex-1 overflow-hidden ${splitMode === "vertical" ? "flex-col" : "flex-row"}`}>
          {splitMode === "none" && (
            <div className="flex-1 overflow-hidden">
              {activeTab && <FilePane paneId={activeTab.paneId} />}
            </div>
          )}

          {splitMode !== "none" && (
            <>
              <div className="flex-1 overflow-hidden min-w-0 min-h-0">
                <FilePane paneId={leftPaneId} showNavBar />
              </div>
              <div className={splitMode === "horizontal" ? "w-px bg-[var(--border)]" : "h-px bg-[var(--border)]"} />
              {rightPaneId && (
                <div className="flex-1 overflow-hidden min-w-0 min-h-0">
                  <FilePane paneId={rightPaneId} showNavBar />
                </div>
              )}
            </>
          )}
        </div>

        {previewOpen && <PreviewPanel />}
      </div>

      <StatusBar />
      <CommandPalette />
      <QuickLook />
      <BulkRenameModal />
      <DiskUsageModal />
      <CopyProgressBar />

      {/* Global dialogs */}
      <PropertiesDialog />
      <ConflictDialog />
      <OpenWithDialog />
      <NetworkDriveDialog />
      <DuplicateFinderModal />

      {/* Advanced feature modals */}
      <CopyQueue />
      <FileVaultDialog />
      <LargeFilesModal />
      <ActivityLogModal />
      <IndexedSearchModal />
      <AiAssistantModal />
      <FtpPanel />
      <PermissionsModal />
      <WorkspacesModal open={workspacesOpen} onClose={() => setWorkspacesOpen(false)} />
      <FileTimelineModal open={timelineOpen} onClose={() => setTimelineOpen(false)} />

      {/* Silent startup check — only renders UI when update is available */}
      <UpdateChecker silent />

      {/* Manual check triggered from menu/titlebar — BUG-030 FIX: stable key */}
      {updateOpen && <UpdateChecker key="manual-update-checker" onClose={() => setUpdateOpen(false)} autoCheck />}
    </div>
  );
}

export default App;
