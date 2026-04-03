import { useEffect, useRef, useState } from 'react';
import type { ImportSummary } from '../../../shared/types';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/button';
import { ImportErrorsPanel } from './ImportErrorsPanel';
import { ImportHistoryPanel } from './ImportHistoryPanel';
import { RuleManagementDialog } from './RuleManagementDialog';

interface PostImportCardProps {
  summary: ImportSummary;
  onDismiss: () => void;
}

export function PostImportCard({ summary, onDismiss }: PostImportCardProps) {
  const t = useI18n();
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorsOpen || historyOpen || rulesOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (cardRef.current?.contains(target)) {
        return;
      }

      onDismiss();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [errorsOpen, historyOpen, onDismiss]);

  return (
    <>
      <div
        ref={cardRef}
        className="fixed right-4 z-50 w-80 rounded-lg border bg-card shadow-md p-4 top-[calc(var(--toolbar-height,0px)+1rem)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t('import.summary.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('import.summary.profile')}: {summary.profileName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('import.summary.dismiss')}
            onClick={onDismiss}
          >
            ×
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <p>{summary.rowsImported} {t('import.summary.imported')}</p>
          <p>{summary.rowsOverwritten} {t('import.summary.overwritten')}</p>
          <p>{summary.rowsAutoCategorized} {t('import.summary.categorized')}</p>
          <p>{summary.rowsInOthers} {t('import.summary.others')}</p>
          <div className="flex items-start justify-between gap-3">
            <p>{summary.rowsFailed} {t('import.summary.failed')}</p>
            <div className="flex flex-col items-end gap-1">
              {summary.rowsFailed > 0 && (
                <Button variant="link" className="h-auto px-0 py-0" onClick={() => setErrorsOpen(true)}>
                  {t('import.summary.viewErrors')}
                </Button>
              )}
              {summary.rowsFailed > 0 && (
                <Button variant="link" className="h-auto px-0 py-0" onClick={() => setHistoryOpen(true)}>
                  {t('import.summary.viewHistory')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {summary.rowsInOthers > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              {t('import.summary.setUpRulesHint')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setRulesOpen(true)}
            >
              {t('import.summary.setUpRules')}
            </Button>
          </div>
        )}
      </div>

      <ImportErrorsPanel
        open={errorsOpen}
        failedRows={summary.failedRows}
        onClose={() => setErrorsOpen(false)}
      />
      <ImportHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <RuleManagementDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}