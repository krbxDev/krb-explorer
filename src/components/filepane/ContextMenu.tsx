import { useEffect, useRef } from "react";
import type { ContextMenuAction } from "../../lib/types";
import { cn } from "../../lib/utils";

interface Props {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 220;
  const menuH = actions.length * 28 + 8;
  const left = x + menuW > vw ? x - menuW : x;
  const top = y + menuH > vh ? y - menuH : y;

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, zIndex: 9999 }}
      className="w-[220px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] py-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {actions.map((action, i) => {
        if (action.separator) {
          return <div key={i} className="my-1 border-t border-[var(--border)]" />;
        }
        return (
          <button
            key={action.id}
            disabled={action.disabled}
            onClick={() => { action.action(); onClose(); }}
            className={cn(
              "w-full flex items-center justify-between px-3 h-7 text-xs transition-colors",
              action.danger
                ? "text-[var(--danger)] hover:bg-[var(--danger)]/10"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              action.disabled && "opacity-40 pointer-events-none"
            )}
          >
            <span>{action.label}</span>
            {action.shortcut && (
              <span className="text-[var(--text-muted)] text-[10px]">{action.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
