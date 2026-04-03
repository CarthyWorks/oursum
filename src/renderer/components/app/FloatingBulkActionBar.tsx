// src/renderer/components/app/FloatingBulkActionBar.tsx
// Portal-rendered floating action bar for bulk selection actions.
// RULE: Rendered via ReactDOM.createPortal to avoid z-index clipping from table overflow containers.
import { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useI18n } from '../../hooks/useI18n';
import { interpolate } from '../../lib/format-utils';
import { Button } from '../ui/button';

interface FloatingBulkActionBarProps {
  count: number;
  onDelete: () => void;
  onReassign: () => void;
  onClear: () => void;
  errorMessage?: string | null;
}

export function FloatingBulkActionBar({
  count,
  onDelete,
  onReassign,
  onClear,
  errorMessage,
}: FloatingBulkActionBarProps) {
  const t = useI18n();

  // Escape key → clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClear();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClear]);

  return ReactDOM.createPortal(
    <div
      role="toolbar"
      aria-label={t('bulk.bar.clearSelection')}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1"
    >
      {errorMessage ? (
        <p className="text-xs text-destructive bg-popover border border-border rounded-lg px-3 py-1 shadow">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 shadow-lg">
        <span className="text-sm text-foreground font-medium">
          {interpolate(t('bulk.bar.selected'), { count: String(count) })}
        </span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
        >
          {interpolate(t('bulk.bar.delete'), { count: String(count) })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReassign}
        >
          {t('bulk.bar.reassign')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('bulk.bar.clearSelection')}
          onClick={onClear}
        >
          ×
        </Button>
      </div>
    </div>,
    document.body,
  );
}
