// src/renderer/components/app/AddTransactionDialog.tsx
import { useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { webviewRPC } from '../../ipc/bridge';
import { useReportStore } from '../../store/report-store';
import type { Category } from '../../../shared/types';

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormFields {
  date: string;
  description: string;
  amount: string;
  category: string;
}

interface FormErrors {
  date?: string;
  description?: string;
  amount?: string;
  category?: string;
  submit?: string;
}

export function AddTransactionDialog({ open, onOpenChange, onSuccess }: AddTransactionDialogProps) {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const allCategories = useReportStore((s) => s.allCategories);

  const [fields, setFields] = useState<FormFields>({
    date: '',
    description: '',
    amount: '',
    category: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tracks whether the user has manually changed the category, in which case rule suggestion is suppressed
  const [categoryUserChanged, setCategoryUserChanged] = useState(false);
  const categoryUserChangedRef = useRef(false);
  const matchRequestIdRef = useRef(0);

  function resetForm() {
    setFields({ date: '', description: '', amount: '', category: '' });
    setErrors({});
    setIsSubmitting(false);
    setCategoryUserChanged(false);
    categoryUserChangedRef.current = false;
    matchRequestIdRef.current += 1;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleDescriptionBlur() {
    const desc = fields.description.trim();
    if (!desc || categoryUserChanged) return;

    const requestId = matchRequestIdRef.current + 1;
    matchRequestIdRef.current = requestId;

    void (async () => {
      const result = await webviewRPC.request.MATCH_CATEGORY_FOR_DESCRIPTION({ description: desc });
      if (
        result.ok &&
        result.category !== null &&
        !categoryUserChangedRef.current &&
        matchRequestIdRef.current === requestId
      ) {
        const matchedCategory = result.category;
        setFields((prev) => {
          if (prev.description.trim() !== desc) return prev;
          return { ...prev, category: matchedCategory };
        });
      }
    })();
  }

  function handleCategoryChange(value: string) {
    setCategoryUserChanged(true);
    categoryUserChangedRef.current = true;
    setFields((prev) => ({ ...prev, category: value }));
    setErrors((prev) => ({ ...prev, category: undefined }));
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!fields.date) errs.date = t('addTransaction.error.dateRequired');
    if (!fields.description.trim()) errs.description = t('addTransaction.error.descriptionRequired');
    const amountNum = Number(fields.amount);
    if (!fields.amount || Number.isNaN(amountNum) || amountNum === 0) {
      errs.amount = t('addTransaction.error.amountRequired');
    }
    if (!fields.category) errs.category = t('addTransaction.error.categoryRequired');
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const result = await webviewRPC.request.ADD_MANUAL_TRANSACTION({
      date: fields.date,
      description: fields.description.trim(),
      amount: Number(fields.amount),
      category: fields.category,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setErrors({ submit: t('addTransaction.error.saveFailed') });
      return;
    }

    resetForm();
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addTransaction.dialog.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="grid gap-4 py-2">
          {/* Date */}
          <div className="grid gap-1.5">
            <label htmlFor="add-tx-date" className="text-sm font-medium">
              {t('addTransaction.date.label')}
            </label>
            <input
              id="add-tx-date"
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={fields.date}
              onChange={(e) => setFields((prev) => ({ ...prev, date: e.target.value }))}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <label htmlFor="add-tx-description" className="text-sm font-medium">
              {t('addTransaction.description.label')}
            </label>
            <input
              id="add-tx-description"
              type="text"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t('addTransaction.description.placeholder')}
              value={fields.description}
              onChange={(e) => setFields((prev) => ({ ...prev, description: e.target.value }))}
              onBlur={handleDescriptionBlur}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Amount */}
          <div className="grid gap-1.5">
            <label htmlFor="add-tx-amount" className="text-sm font-medium">
              {t('addTransaction.amount.label')}
            </label>
            <input
              id="add-tx-amount"
              type="number"
              step="0.01"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={fields.amount}
              onChange={(e) => setFields((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t('addTransaction.amount.hint')}</p>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Category */}
          <div className="grid gap-1.5">
            <label htmlFor="add-tx-category" className="text-sm font-medium">
              {t('addTransaction.category.label')}
            </label>
            <select
              id="add-tx-category"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={fields.category || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="" disabled>
                {t('addTransaction.category.placeholder')}
              </option>
              {allCategories.map((cat: Category) => (
                <option key={cat.id} value={cat.name}>
                  {displayName(cat.name)}
                </option>
              ))}
              {allCategories.length === 0 && (
                <option value="Others">Others</option>
              )}
            </select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>

          {/* Submit error */}
          {errors.submit && (
            <p className="text-xs text-destructive">{errors.submit}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('addTransaction.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('addTransaction.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
