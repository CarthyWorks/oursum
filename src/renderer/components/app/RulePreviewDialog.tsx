import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { interpolate } from '../../lib/format-utils';
import type { Transaction } from '../../../shared/types';
import { useFormatDate } from '../../hooks/useFormatDate';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface RulePreviewDialogProps {
  description: string;
  error: string | null;
  nextCategory: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  open: boolean;
  transactions: Transaction[];
  isLoading: boolean;
  isSubmitting: boolean;
}

export function RulePreviewDialog({
  description,
  error,
  nextCategory,
  onClose,
  onConfirm,
  open,
  transactions,
  isLoading,
  isSubmitting,
}: RulePreviewDialogProps) {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const formatDate = useFormatDate();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('rules.preview.title')}</DialogTitle>
          <DialogDescription>
            {interpolate(t('rules.preview.subtitle'), {
              count: transactions.length.toString(),
              description,
            })}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="max-h-[420px] overflow-auto rounded-md border border-border">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">
              {t('rules.preview.loading')}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {t('rules.preview.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.table.col.date')}</TableHead>
                  <TableHead>{t('report.table.col.description')}</TableHead>
                  <TableHead>{t('report.table.col.category')}</TableHead>
                  <TableHead>{t('rules.preview.nextCategory')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{displayName(transaction.category)}</TableCell>
                    <TableCell>{displayName(nextCategory)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('rules.preview.cancel')}
          </Button>
          <Button type="button" onClick={() => void onConfirm()} disabled={isLoading || isSubmitting}>
            {t('rules.preview.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}