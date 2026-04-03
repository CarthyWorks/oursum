// src/renderer/components/app/CategoryManagementDialog.tsx
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { interpolate } from '../../lib/format-utils';
import { useReportStore } from '../../store/report-store';
import { useFilterStore } from '../../store/filter-store';
import { webviewRPC } from '../../ipc/bridge';

interface CategoryManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onCategoriesChanged: () => Promise<void>;
  onTransactionsReloaded: () => Promise<void>;
}

export function CategoryManagementDialog({
  open,
  onClose,
  onCategoriesChanged,
  onTransactionsReloaded,
}: CategoryManagementDialogProps) {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const allCategories = useReportStore((s) => s.allCategories);
  const allTransactions = useReportStore((s) => s.allTransactions);
  const isTransactionsLoaded = useReportStore((s) => s.isTransactionsLoaded);
  const selectedCategories = useFilterStore((s) => s.categories);
  const setCategories = useFilterStore((s) => s.setCategories);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const transactionCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of allTransactions) {
      counts.set(tx.category, (counts.get(tx.category) ?? 0) + 1);
    }
    return counts;
  }, [allTransactions]);

  async function handleAdd() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setIsBusy(true);
    setError(null);
    const result = await webviewRPC.request.ADD_CATEGORY({ name: trimmed });
    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewCategoryName('');
    await onCategoriesChanged();
  }

  async function handleRenameConfirm() {
    if (!editingName) return;
    setIsBusy(true);
    setError(null);
    const result = await webviewRPC.request.RENAME_CATEGORY({
      oldName: editingName,
      newName: editValue,
    });
    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (selectedCategories.includes(editingName)) {
      const nextCategories = selectedCategories
        .map((category) => (category === editingName ? editValue.trim() : category))
        .filter((category, index, values) => values.indexOf(category) === index)
        .sort((left, right) => left.localeCompare(right));
      setCategories(nextCategories);
    }

    setEditingName(null);
    await Promise.all([onCategoriesChanged(), onTransactionsReloaded()]);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsBusy(true);
    setError(null);
    const result = await webviewRPC.request.DELETE_CATEGORY({ name: deleteTarget });
    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (selectedCategories.includes(deleteTarget)) {
      setCategories(selectedCategories.filter((category) => category !== deleteTarget));
    }

    setDeleteTarget(null);
    setReassignTarget('');
    await Promise.all([onCategoriesChanged(), onTransactionsReloaded()]);
  }

  async function handleDeleteWithReassign() {
    if (!deleteTarget || !reassignTarget) return;
    setIsBusy(true);
    setError(null);
    const result = await webviewRPC.request.DELETE_CATEGORY({
      name: deleteTarget,
      reassignTo: reassignTarget,
    });
    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (selectedCategories.includes(deleteTarget)) {
      setCategories(selectedCategories.filter((category) => category !== deleteTarget));
    }

    setDeleteTarget(null);
    setReassignTarget('');
    await Promise.all([onCategoriesChanged(), onTransactionsReloaded()]);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('categories.management.title')}</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <ul
          className="max-h-80 overflow-y-auto space-y-1 pr-1"
          role="list"
        >
          {allCategories.map((cat) => {
            const isOthers = cat.name === 'Others';
            const isEditing = editingName === cat.name;
            const isDeleting = deleteTarget === cat.name;
            const txCount = transactionCountByCategory.get(cat.name) ?? 0;

            return (
              <li
                key={cat.id}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2"
              >
                {/* Row header */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRenameConfirm();
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isBusy}
                      aria-label={`${t('categories.rename.label')} ${cat.name}`}
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm text-foreground">{displayName(cat.name)}</span>
                  )}

                  {isOthers ? (
                    <span className="text-xs text-muted-foreground">
                      {t('categories.others.protected')}
                    </span>
                  ) : (
                    <>
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => void handleRenameConfirm()}
                            disabled={isBusy || !editValue.trim()}
                          >
                            {t('categories.rename.save')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingName(null)}
                            disabled={isBusy}
                          >
                            {t('categories.rename.cancel')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingName(cat.name);
                              setEditValue(cat.name);
                              setDeleteTarget(null);
                              setError(null);
                            }}
                            disabled={isBusy}
                            aria-label={`${t('categories.rename.label')} ${cat.name}`}
                          >
                            {t('categories.rename.label')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeleteTarget(cat.name);
                              setReassignTarget('');
                              setEditingName(null);
                              setError(null);
                            }}
                            disabled={isBusy || !isTransactionsLoaded}
                            aria-label={`${t('categories.delete.label')} ${cat.name}`}
                          >
                            {t('categories.delete.label')}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Inline delete confirmation */}
                {isDeleting && (
                  <div className="flex flex-col gap-2 pt-1 pl-1 border-t border-border mt-1">
                    {txCount === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {interpolate(t('categories.delete.confirm.noTransactions'), {
                            name: cat.name,
                          })}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteConfirm()}
                            disabled={isBusy}
                          >
                            {t('categories.delete.simple.action')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeleteTarget(null);
                              setReassignTarget('');
                            }}
                            disabled={isBusy}
                          >
                            {t('categories.rename.cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {interpolate(
                            t('categories.delete.confirm.withTransactions'),
                            { name: cat.name, count: txCount.toString() },
                          )}
                        </p>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium">
                            {t('categories.delete.reassign.label')}
                          </label>
                          <Select
                            value={reassignTarget}
                            onValueChange={setReassignTarget}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue
                                placeholder={t('categories.delete.reassign.placeholder')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {allCategories
                                .filter((c) => c.name !== cat.name)
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.name}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDeleteWithReassign()}
                              disabled={isBusy || !reassignTarget}
                            >
                              {t('categories.delete.action')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeleteTarget(null);
                                setReassignTarget('');
                              }}
                              disabled={isBusy}
                            >
                              {t('categories.rename.cancel')}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Add new category */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
            placeholder={t('categories.add.placeholder')}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isBusy}
            aria-label={t('categories.add.placeholder')}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleAdd()}
            disabled={isBusy || !newCategoryName.trim()}
          >
            {t('categories.add.button')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
