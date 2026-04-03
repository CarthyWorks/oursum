// src/renderer/components/app/BulkDeleteConfirmDialog.tsx
// Confirmation dialog before bulk deleting transactions.
// RULE: Must not be dismissable by clicking outside while deletion is in progress.
import { useI18n } from '../../hooks/useI18n';
import { interpolate } from '../../lib/format-utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function BulkDeleteConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
  isDeleting,
}: BulkDeleteConfirmDialogProps) {
  const t = useI18n();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent closing while deletion is in progress
        if (isDeleting) return;
        if (!nextOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('bulk.delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {interpolate(t('bulk.delete.description'), { count: String(count) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t('bulk.delete.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '…' : t('bulk.delete.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
