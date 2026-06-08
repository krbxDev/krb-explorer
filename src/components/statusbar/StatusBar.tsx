import { useStore } from "../../store";
import { formatSize } from "../../lib/utils";

export function StatusBar() {
  const { activePaneId, panes, drives } = useStore();
  const pane = panes[activePaneId];
  if (!pane) return null;

  const selCount = pane.selection.size;
  const totalCount = pane.entries.length;
  const dirCount = pane.entries.filter((e) => e.isDir).length;
  const fileCount = pane.entries.filter((e) => !e.isDir).length;
  const selSize = Array.from(pane.selection)
    .map((p) => pane.entries.find((e) => e.path === p)?.size ?? 0)
    .reduce((a, b) => a + b, 0);

  // Find drive for current path
  const driveLetter = pane.path.match(/^([A-Za-z]:)/)?.[1]?.toUpperCase();
  const drive = drives.find((d) => d.name.toUpperCase().startsWith(driveLetter ?? "__"));

  return (
    <div className="flex items-center justify-between h-6 px-3 bg-[var(--bg-surface)] border-t border-[var(--border)] shrink-0 text-[10px] text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        {selCount > 0 ? (
          <span>{selCount} item{selCount !== 1 ? "s" : ""} selected{selSize > 0 ? ` · ${formatSize(selSize)}` : ""}</span>
        ) : (
          <span>
            {dirCount > 0 && `${dirCount} folder${dirCount !== 1 ? "s" : ""}`}
            {dirCount > 0 && fileCount > 0 && ", "}
            {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
            {dirCount === 0 && fileCount === 0 && "0 items"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {drive && drive.totalSpace > 0 && (
          <span title={`${formatSize(drive.freeSpace)} free of ${formatSize(drive.totalSpace)}`}>
            {formatSize(drive.freeSpace)} free
          </span>
        )}
        <span className="text-[var(--text-muted)] truncate max-w-[300px]" title={pane.path}>{pane.path}</span>
      </div>
    </div>
  );
}
