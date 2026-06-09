import { useEffect, useRef } from "react";
import { X, Play, Pause, Trash2, ChevronDown, ChevronUp, Copy, Scissors } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { formatSize } from "../../lib/utils";
import { cn } from "../../lib/utils";
import type { CopyQueueItem } from "../../lib/types";
import { generateId } from "../../lib/utils";

// Listen for copy-progress events from Rust and update queue items
export function useCopyQueueListener() {
  const { updateCopyQueueItem } = useStore();
  const speedCalc = useRef<Record<string, { bytes: number; time: number }>>({});

  useEffect(() => {
    const unlisten = listen<any>("copy-progress", (ev) => {
      const { operation_id, bytes_done, bytes_total, files_done, files_total, file } = ev.payload;
      const now = Date.now();
      const prev = speedCalc.current[operation_id];
      let speed = 0;
      if (prev) {
        const dt = (now - prev.time) / 1000;
        speed = dt > 0 ? (bytes_done - prev.bytes) / dt : 0;
      }
      speedCalc.current[operation_id] = { bytes: bytes_done, time: now };
      updateCopyQueueItem(operation_id, {
        bytesDone: bytes_done,
        bytesTotal: bytes_total,
        filesDone: files_done,
        filesTotal: files_total,
        currentFile: file,
        status: "running",
        speed,
      });
    });
    const unlistenDone = listen<any>("copy-done", (ev) => {
      updateCopyQueueItem(ev.payload.operation_id, { status: "done", filesDone: ev.payload.files_total });
      delete speedCalc.current[ev.payload.operation_id];
    });
    const unlistenErr = listen<any>("copy-error", (ev) => {
      updateCopyQueueItem(ev.payload.operation_id, { status: "error", error: ev.payload.error });
    });
    return () => {
      unlisten.then((fn) => fn());
      unlistenDone.then((fn) => fn());
      unlistenErr.then((fn) => fn());
    };
  }, []);
}

export function CopyQueue() {
  const { copyQueue, copyQueueOpen, toggleCopyQueue, removeCopyQueueItem } = useStore();
  const activeItems = copyQueue.filter((i) => i.status !== "done");
  const doneCount = copyQueue.filter((i) => i.status === "done").length;

  if (copyQueue.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-50 w-[380px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Copy size={13} className="text-[var(--accent)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            File Operations
          </span>
          {doneCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">{doneCount} done</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleCopyQueue} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
            {copyQueueOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          <button
            onClick={() => copyQueue.filter((i) => i.status === "done").forEach((i) => removeCopyQueueItem(i.id))}
            className="text-[var(--text-muted)] hover:text-[var(--danger)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
            title="Clear completed"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {copyQueueOpen && (
        <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]">
          {copyQueue.map((item) => (
            <QueueItem key={item.id} item={item} onRemove={() => removeCopyQueueItem(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItem({ item, onRemove }: { item: CopyQueueItem; onRemove: () => void }) {
  const pct = item.bytesTotal > 0 ? Math.round((item.bytesDone / item.bytesTotal) * 100) : 0;
  const fileName = item.currentFile?.split(/[\\/]/).pop() ?? "";

  const statusColor = {
    queued: "text-[var(--text-muted)]",
    running: "text-[var(--accent)]",
    paused: "text-yellow-400",
    done: "text-green-400",
    error: "text-red-400",
  }[item.status];

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {item.mode === "copy" ? <Copy size={10} className="text-[var(--accent)] shrink-0" /> : <Scissors size={10} className="text-[var(--accent)] shrink-0" />}
            <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
              {item.sources.length === 1
                ? item.sources[0].split(/[\\/]/).pop()
                : `${item.sources.length} items`}
              {" → "}
              {item.destDir.split(/[\\/]/).pop()}
            </span>
          </div>

          {item.status === "running" && (
            <>
              <div className="h-1.5 rounded-full bg-[var(--bg-base)] overflow-hidden mb-1">
                <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span className="truncate max-w-[200px]">{fileName}</span>
                <span className="shrink-0 ml-2">
                  {pct}% · {item.speed ? formatSize(item.speed) + "/s" : ""}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {item.filesDone}/{item.filesTotal} files · {formatSize(item.bytesDone)} / {formatSize(item.bytesTotal)}
              </div>
            </>
          )}

          {item.status === "done" && (
            <div className="text-[10px] text-green-400">Completed — {item.filesTotal} files</div>
          )}

          {item.status === "error" && (
            <div className="text-[10px] text-red-400 truncate">{item.error}</div>
          )}

          {item.status === "queued" && (
            <div className="text-[10px] text-[var(--text-muted)]">Waiting…</div>
          )}
        </div>

        <button onClick={onRemove} className="shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
