// src/renderer/hooks/useContextMenu.ts
// Hook produced by spike 4-0c.
//
// Spike finding (2026-03-28):
//   - contextmenu DOM event fires in Electrobun WKWebView — BEST CASE applies.
//   - e.preventDefault() suppresses the native macOS context menu; no workaround needed.
//   - e.clientX / e.clientY are viewport-relative; position:fixed portal lands correctly.
//   - Ctrl+click fires the same contextmenu event — no special handling required.
//   - @radix-ui/react-context-menu (already installed) provides a drop-in alternative for
//     Story 4.3 if a fully accessible Radix solution is preferred over a raw portal.
//
// Story 4.3 should prefer the existing Radix context-menu wrapper for keyboard navigation,
// focus management, and dismiss semantics. If a custom anchored overlay is still needed,
// this hook provides the spike-confirmed coordinate capture plus close-on-Escape and
// outside-click behavior.
//
// ADR-005: renderer-only — zero IPC, zero core imports.

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseContextMenuReturn {
  isOpen: boolean;
  position: ContextMenuPosition;
  menuRef: React.MutableRefObject<HTMLElement | null>;
  open: (e: React.MouseEvent) => void;
  close: () => void;
}

type ContainsTarget = {
  contains: (node: Node | null) => boolean;
};

export function getContextMenuPosition(event: Pick<React.MouseEvent, 'clientX' | 'clientY'>): ContextMenuPosition {
  return { x: event.clientX, y: event.clientY };
}

export function isContextMenuDismissKey(key: string): boolean {
  return key === 'Escape';
}

export function isContextMenuEventInsideMenu(
  target: EventTarget | null,
  menuElement: ContainsTarget | null,
): boolean {
  if (!menuElement || target === null) {
    return false;
  }

  return menuElement.contains(target as Node | null);
}

export function useContextMenu(): UseContextMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLElement | null>(null);

  // Spike-confirmed: e.preventDefault() is sufficient to suppress native macOS context menu
  // in Electrobun WKWebView. No mousedown/button===2 fallback is required.
  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPosition(getContextMenuPosition(e));
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isContextMenuEventInsideMenu(event.target, menuRef.current)) {
        return;
      }

      close();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (isContextMenuEventInsideMenu(event.target, menuRef.current)) {
        return;
      }

      close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isContextMenuDismissKey(event.key)) {
        close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, isOpen]);

  return { isOpen, position, menuRef, open, close };
}
