import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [pos, setPos] = useState({ left: x, top: y, visible: false });

  // After the menu renders, measure its actual size and clamp to viewport
  useLayoutEffect(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 6;
    let left = x;
    let top = y;
    if (left + w + MARGIN > vw) left = Math.max(MARGIN, x - w);
    if (top + h + MARGIN > vh) top = Math.max(MARGIN, vh - h - MARGIN);
    if (top < MARGIN) top = MARGIN;
    setPos({ left, top, visible: true });
  }, [x, y]);

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

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 9999,
        visibility: pos.visible ? "visible" : "hidden",
      }}
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
