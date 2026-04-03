import { describe, expect, test } from 'bun:test';
import {
  getContextMenuPosition,
  isContextMenuDismissKey,
  isContextMenuEventInsideMenu,
} from './useContextMenu';

describe('useContextMenu helpers', () => {
  test('captures viewport-relative coordinates from the contextmenu event', () => {
    expect(getContextMenuPosition({ clientX: 128, clientY: 256 } as never)).toEqual({ x: 128, y: 256 });
  });

  test('treats Escape as the dismiss key', () => {
    expect(isContextMenuDismissKey('Escape')).toBe(true);
    expect(isContextMenuDismissKey('Enter')).toBe(false);
  });

  test('detects whether an event target is inside the rendered menu element', () => {
    const insideTarget = { id: 'inside' };
    const outsideTarget = { id: 'outside' };
    const menuElement = {
      contains: (node: unknown) => node === insideTarget,
    };

    expect(isContextMenuEventInsideMenu(insideTarget as never, menuElement)).toBe(true);
    expect(isContextMenuEventInsideMenu(outsideTarget as never, menuElement)).toBe(false);
    expect(isContextMenuEventInsideMenu(null, menuElement)).toBe(false);
  });
});