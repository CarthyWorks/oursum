// src/renderer/components/app/SingleDeleteConfirmDialog.tsx
// Confirmation dialog for single-transaction deletion (Story 4.3).
// Distinct from BulkDeleteConfirmDialog — no count, different i18n keys.
// ADR-005: renderer-only — no IPC, no core imports.
import { useI18n } from '../../hooks/useI18n';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';

interface SingleDeleteConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function SingleDeleteConfirmDialog({
  open,
  onConfirm,
  onCancel,
  isDeleting,
  error,
}: SingleDeleteConfirmDialogProps) {
  const t = useI18n();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent closing while deletion is in progress (NFR9)
        if (isDeleting) return;
        if (!nextOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('row.delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('row.delete.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* AC10: show error inline without closing the dialog */}
        {error !== null && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t('row.delete.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '…' : t('row.delete.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
