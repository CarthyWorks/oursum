import type { ImportFailureDetail } from '../../../shared/types';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface ImportErrorsPanelProps {
  open: boolean;
  failedRows: ImportFailureDetail[];
  onClose: () => void;
}

function reasonKey(reason: ImportFailureDetail['reason']): string {
  switch (reason) {
    case 'missing-columns':
      return 'import.errors.reason.missingColumns';
    case 'invalid-date':
      return 'import.errors.reason.invalidDate';
    case 'invalid-amount':
      return 'import.errors.reason.invalidAmount';
  }
}

export function ImportErrorsPanel({ open, failedRows, onClose }: ImportErrorsPanelProps) {
  const t = useI18n();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('import.errors.title')}</DialogTitle>
        </DialogHeader>

        {failedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('import.errors.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('import.errors.row')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.errors.reason')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.errors.values')}</th>
                </tr>
              </thead>
              <tbody>
                {failedRows.map((failedRow) => (
                  <tr
                    key={`${failedRow.rowNumber}-${failedRow.reason}-${failedRow.rawRow.join('|')}`}
                    className="border-t align-top"
                  >
                    <td className="px-4 py-2">{failedRow.rowNumber}</td>
                    <td className="px-4 py-2">{t(reasonKey(failedRow.reason))}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {failedRow.rawRow.join(' | ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>{t('import.errors.close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}