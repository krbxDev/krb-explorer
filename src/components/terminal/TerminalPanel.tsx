import { useEffect, useRef, useCallback } from "react";
import { X, ExternalLink, Terminal } from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const { terminalOpen, toggleTerminal, activePaneId, panes } = useStore();
  const pane = panes[activePaneId];
  const path = pane?.path ?? "C:\\";

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const spawnPty = useCallback(async (term: XTerm, fit: FitAddon) => {
    // Clean up previous listeners
    unlistenOutputRef.current?.();
    unlistenExitRef.current?.();

    // Calculate current size
    fit.fit();
    const cols = term.cols;
    const rows = term.rows;

    // Listen for output
    unlistenOutputRef.current = await listen<string>("pty://output", (e) => {
      term.write(e.payload);
    });

    // Listen for process exit
    unlistenExitRef.current = await listen("pty://exit", () => {
      term.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
    });

    try {
      await invoke("pty_spawn", { path: pathRef.current, cols, rows });
    } catch (e) {
      term.writeln(`\r\n\x1b[31mFailed to start terminal: ${e}\x1b[0m`);
    }
  }, []);

  // Mount xterm once
  useEffect(() => {
    if (!terminalOpen || !containerRef.current) return;

    const term = new XTerm({
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: "#0d0d0f",
        foreground: "#e2e2e5",
        cursor: "#7c8cf8",
        selectionBackground: "#3b4166",
        black:   "#1a1a2e", brightBlack:   "#555570",
        red:     "#f87171", brightRed:     "#fc8181",
        green:   "#4ade80", brightGreen:   "#86efac",
        yellow:  "#fbbf24", brightYellow:  "#fcd34d",
        blue:    "#60a5fa", brightBlue:    "#93c5fd",
        magenta: "#c084fc", brightMagenta: "#d8b4fe",
        cyan:    "#22d3ee", brightCyan:    "#67e8f9",
        white:   "#e2e2e5", brightWhite:   "#ffffff",
      },
      cursorBlink: true,
      allowTransparency: false,
      scrollback: 5000,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();

    xtermRef.current = term;
    fitAddonRef.current = fit;

    // Forward keystrokes to PTY
    term.onData((data) => {
      invoke("pty_write", { data }).catch(() => {});
    });

    spawnPty(term, fit);

    // Resize observer
    const ro = new ResizeObserver(() => {
      fit.fit();
      invoke("pty_resize", { cols: term.cols, rows: term.rows }).catch(() => {});
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      unlistenOutputRef.current?.();
      unlistenExitRef.current?.();
      invoke("pty_kill").catch(() => {});
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalOpen]);

  // Re-spawn when the active pane path changes (user navigated)
  useEffect(() => {
    if (!terminalOpen || !xtermRef.current || !fitAddonRef.current) return;
    const term = xtermRef.current;
    const fit = fitAddonRef.current;
    term.writeln(`\r\n\x1b[90m[cd ${path}]\x1b[0m\r`);
    invoke("pty_kill").catch(() => {});
    spawnPty(term, fit);
  }, [path, terminalOpen]);

  if (!terminalOpen) return null;

  return (
    <div className="h-52 border-t border-[var(--border)] bg-[#0d0d0f] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Terminal size={12} />
          <span className="font-mono text-[var(--text-muted)] truncate max-w-xs">{path}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fs.openTerminalAt(path)}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] px-2 py-0.5 rounded hover:bg-[var(--accent-dim)] transition-colors"
            title="Pop out to Windows Terminal"
          >
            <ExternalLink size={11} /> Open external
          </button>
          <button
            onClick={toggleTerminal}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* xterm.js container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-1 pt-1"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
