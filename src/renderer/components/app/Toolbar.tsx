// src/renderer/components/app/Toolbar.tsx
// RULE: Layout only — no state, no IPC, no business logic.
// RULE: Token-based Tailwind classes only — no raw hex/HSL.
import { useEffect, useRef } from 'react';
import { PreferencesPopover } from './PreferencesPopover';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';
import { webviewRPC } from '../../ipc/bridge';

interface ToolbarProps {
  /** Node.js platform string. Double-click maximize is only applied on macOS because
   *  on Windows the native title bar already handles this gesture. */
  platform?: string;
  dataFolderPath?: string;
  onDataFolderRelocated?: (newPath: string) => void;
  onUploadClick?: () => void;    // Story 3.1
  onAddTransaction?: () => void; // Story 3.1 (stub; wired in Story 3.7)
  onSplitCalculatorClick?: () => void; // Story 5.1
}

export function Toolbar({ platform, dataFolderPath, onDataFolderRelocated, onUploadClick, onAddTransaction, onSplitCalculatorClick }: ToolbarProps) {
  const t = useI18n();
  const headerRef = useRef<HTMLElement>(null);

  // Publish toolbar height as a CSS variable so dialog overlays can start below it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty('--toolbar-height', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // On macOS the titleBar is hidden (hiddenInset) so we must replicate the OS
  // double-click-to-zoom behaviour ourselves.
  // On Windows the native title bar owns that gesture — do not add a second handler.
  const handleDoubleClick = platform === 'darwin'
    ? () => webviewRPC.send.TOGGLE_MAXIMIZE({})
    : undefined;

  return (
    <header
      ref={headerRef}
      className="electrobun-webkit-app-region-drag relative flex items-center pl-20 pr-4 py-2 border-b border-border bg-card"
      onDoubleClick={handleDoubleClick}
    >
      <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground select-none pointer-events-none">{t('app.title')}</span>
      {/* stopPropagation prevents mousedown from reaching Electrobun's document-level drag listener */}
      <div className="ml-auto flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        {onUploadClick && (
          <Button variant="outline" size="sm" onClick={onUploadClick} aria-label={t('empty.cta.import')}>
            {t('empty.cta.import')}
          </Button>
        )}
        {onAddTransaction && (
          <Button variant="outline" size="sm" onClick={onAddTransaction} aria-label={t('toolbar.addTransaction')}>
            {t('toolbar.addTransaction')}
          </Button>
        )}
        {onSplitCalculatorClick && (
          <Button variant="outline" size="sm" onClick={onSplitCalculatorClick} aria-label={t('toolbar.splitCalculator')}>
            {t('toolbar.splitCalculator')}
          </Button>
        )}
        <PreferencesPopover
          platform={platform}
          dataFolderPath={dataFolderPath}
          onDataFolderRelocated={onDataFolderRelocated}
        />
      </div>
    </header>
  );
}
