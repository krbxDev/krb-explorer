import { useState, useEffect, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { X, Download, RefreshCw, CheckCircle, ArrowUpCircle } from "lucide-react";

type State =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "available"; version: string; notes: string | null | undefined }
  | { phase: "downloading"; pct: number }
  | { phase: "ready" }
  | { phase: "error"; message: string }
  | { phase: "up-to-date" };

interface Props {
  silent?: boolean;
  autoCheck?: boolean;
  onClose?: () => void;
}

export function UpdateChecker({ silent = false, autoCheck = false, onClose }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });

  const runCheck = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      const update = await check();
      if (!update?.available) {
        setState({ phase: "up-to-date" });
        return;
      }
      setState({ phase: "available", version: update.version, notes: update.body });
    } catch (err: any) {
      if (silent) {
        // Silent mode — network errors or missing manifest are expected (offline, no update)
        setState({ phase: "idle" });
      } else {
        setState({ phase: "error", message: String(err) });
      }
    }
  }, [silent]);

  useEffect(() => {
    if (silent || autoCheck) runCheck();
  }, []);

  const install = useCallback(async () => {
    setState({ phase: "downloading", pct: 0 });
    try {
      const update = await check();
      if (!update?.available) return;
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          setState({ phase: "downloading", pct });
        } else if (event.event === "Finished") {
          setState({ phase: "ready" });
        }
      });
    } catch (err: any) {
      setState({ phase: "error", message: String(err) });
    }
  }, []);

  // Silent mode — only render when there's something meaningful to show
  if (silent) {
    if (state.phase !== "available") return null;
    // Fall through to render the update-available dialog
  }

  // Manual mode without autoCheck — don't render until check has been triggered
  if (!silent && !autoCheck && state.phase === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[440px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Software Update</span>
          </div>
          {onClose && (
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {state.phase === "checking" && (
            <div className="flex items-center justify-center gap-3 py-4 text-[var(--text-secondary)]">
              <RefreshCw size={16} className="animate-spin text-[var(--accent)]" />
              <span className="text-sm">Checking for updates…</span>
            </div>
          )}

          {state.phase === "up-to-date" && (
            <div className="text-center py-2">
              <CheckCircle size={32} className="text-[var(--success)] mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--text-primary)]">You're up to date!</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">KRB Explorer is running the latest version.</p>
              {onClose && (
                <button onClick={onClose}
                  className="mt-4 px-4 py-1.5 text-xs border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
                  Close
                </button>
              )}
            </div>
          )}

          {state.phase === "available" && (
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center shrink-0">
                  <Download size={18} className="text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    KRB Explorer {state.version} is available
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    A new version is ready to download and install.
                  </p>
                </div>
              </div>
              {state.notes && (
                <div className="mb-4 p-3 bg-[var(--bg-base)] rounded border border-[var(--border)] max-h-32 overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Release Notes</p>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{state.notes}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                {onClose && (
                  <button onClick={onClose}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] transition-colors">
                    Later
                  </button>
                )}
                <button onClick={install}
                  className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5">
                  <Download size={12} />
                  Download &amp; Install
                </button>
              </div>
            </div>
          )}

          {state.phase === "downloading" && (
            <div>
              <p className="text-sm text-[var(--text-primary)] mb-3">Downloading update…</p>
              <div className="w-full h-2 bg-[var(--bg-overlay)] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                  style={{ width: `${state.pct}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] text-right">{state.pct}%</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                The app will restart automatically when the download is complete.
              </p>
            </div>
          )}

          {state.phase === "ready" && (
            <div className="text-center py-2">
              <CheckCircle size={32} className="text-[var(--success)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Update ready to install</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
                KRB Explorer will restart to apply the update.
              </p>
              <button onClick={() => relaunch()}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded hover:bg-[var(--accent-hover)] transition-colors">
                Restart Now
              </button>
            </div>
          )}

          {state.phase === "error" && (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Update check failed</p>
              <p className="text-xs text-[var(--text-muted)] mb-4 px-2">{state.message}</p>
              <div className="flex gap-2 justify-center">
                {onClose && (
                  <button onClick={onClose}
                    className="px-3 py-1.5 text-xs border border-[var(--border)] rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
                    Close
                  </button>
                )}
                <button onClick={runCheck}
                  className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
