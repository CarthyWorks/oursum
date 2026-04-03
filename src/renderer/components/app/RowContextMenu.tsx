// src/renderer/components/app/RowContextMenu.tsx
// Portal-based context menu for per-row actions (Story 4.3).
// Positioned at fixed cursor coordinates (spike 4-0c confirmed position:fixed works in Electrobun WKWebView).
// ADR-005: renderer-only — no IPC, no core imports.
// Dismiss (outside pointerdown, contextmenu outside, Escape) is handled entirely by the
// useContextMenu hook via the menuRef it owns — no duplicate dismiss logic here.
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Tags, Trash2 } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface RowContextMenuProps {
  position: { x: number; y: number };
  menuRef: MutableRefObject<HTMLElement | null>;
  onReassign: () => void;
  onDelete: () => void;
}

export function RowContextMenu({ position, menuRef, onReassign, onDelete }: RowContextMenuProps) {
  const t = useI18n();

  // Clamp to viewport so the menu never renders partially off-screen near right/bottom edges.
  // 168 = min-width(160) + 8 px safety margin; 80 ≈ 2 items × 36 px + padding.
  const top = Math.min(position.y, window.innerHeight - 80);
  const left = Math.min(position.x, window.innerWidth - 168);

  return createPortal(
    <div
      ref={(el: HTMLDivElement | null) => { menuRef.current = el; }}
      role="menu"
      className="fixed z-[9999] rounded-md border border-border bg-popover shadow-md py-1 min-w-[160px]"
      style={{ top, left }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none cursor-default"
        onClick={onReassign}
      >
        <Tags className="h-4 w-4" aria-hidden />
        {t('row.contextmenu.reassign')}
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none cursor-default"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {t('row.contextmenu.delete')}
      </button>
    </div>,
    document.body,
  );
}
