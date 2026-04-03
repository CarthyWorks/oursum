import { useEffect, useState } from 'react';
import type { ImportLogEntry } from '../../../shared/types';
import { webviewRPC } from '../../ipc/bridge';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface ImportHistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ImportHistoryPanel({ open, onClose }: ImportHistoryPanelProps) {
  const t = useI18n();
  const [entries, setEntries] = useState<ImportLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      const response = await webviewRPC.request.GET_IMPORT_HISTORY();
      if (isCancelled) {
        return;
      }

      if (!response.ok) {
        setEntries([]);
        setError('import.history.loadFailed');
      } else {
        setEntries(response.entries);
      }
      setLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [open]);

  const formatter = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('import.history.title')}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('import.ingesting')}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{t(error)}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('import.history.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('import.history.date')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.history.file')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.history.profile')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.history.imported')}</th>
                  <th className="px-4 py-2 font-medium">{t('import.history.overwritten')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={`${entry.importedAt}-${entry.ndjsonFilename}`} className="border-t">
                    <td className="px-4 py-2">{formatter.format(new Date(entry.importedAt))}</td>
                    <td className="px-4 py-2">{entry.originalFilename}</td>
                    <td className="px-4 py-2">{entry.profileName}</td>
                    <td className="px-4 py-2">{entry.rowsImported}</td>
                    <td className="px-4 py-2">{entry.rowsOverwritten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>{t('import.history.close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}