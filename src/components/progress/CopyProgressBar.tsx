// BUG-018/040 FIX: CopyProgressBar now derives state from the store's copyQueue
// rather than maintaining a separate copy-progress event listener (which expected
// a different payload shape). The CopyQueue's useCopyQueueListener feeds the store.
import { useStore } from "../../store";
import { X } from "lucide-react";

export function CopyProgressBar() {
  const { copyQueue } = useStore();

  // Show a simple bar for the first running/queued item when the full CopyQueue
  // panel is NOT in use (i.e. queue is empty or all done). This component acts
  // as a fallback minimal progress indicator.
  const running = copyQueue.find((i) => i.status === "running");
  if (!running) return null;

  const pct = running.bytesTotal > 0
    ? Math.round((running.bytesDone / running.bytesTotal) * 100)
    : 0;
  const fileName = running.currentFile?.split(/[\\/]/).pop() ?? "";

  return (
    <div className="fixed bottom-8 right-4 z-40 w-72 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {`Copying ${running.filesDone} of ${running.filesTotal}`}
          </p>
          {fileName && (
            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{fileName}</p>
          )}
        </div>
      </div>
      <div className="w-full h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">{pct}%</p>
    </div>
  );
}
