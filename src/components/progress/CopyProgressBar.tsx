import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { X } from "lucide-react";

export function CopyProgressBar() {
  const { copyProgress, setCopyProgress } = useStore();

  useEffect(() => {
    const unlisten = listen<any>("copy-progress", (event) => {
      const p = event.payload;
      setCopyProgress({
        current: p.current ?? 0,
        total: p.total ?? 1,
        file: p.file ?? "",
        done: p.done ?? false,
      });
      if (p.done) setTimeout(() => setCopyProgress(null), 1500);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  if (!copyProgress) return null;

  const pct = copyProgress.total > 0
    ? Math.round((copyProgress.current / copyProgress.total) * 100)
    : 0;

  return (
    <div className="fixed bottom-8 right-4 z-50 w-72 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {copyProgress.done ? "Copy complete" : `Copying ${copyProgress.current} of ${copyProgress.total}`}
          </p>
          {copyProgress.file && !copyProgress.done && (
            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{copyProgress.file.split(/[\\/]/).pop()}</p>
          )}
        </div>
        <button onClick={() => setCopyProgress(null)}
          className="shrink-0 ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={12} />
        </button>
      </div>
      <div className="w-full h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
          style={{ width: `${copyProgress.done ? 100 : pct}%` }}
        />
      </div>
      {!copyProgress.done && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">{pct}%</p>
      )}
    </div>
  );
}
