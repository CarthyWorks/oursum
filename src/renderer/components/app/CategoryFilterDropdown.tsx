import { useCallback, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { interpolate } from '../../lib/format-utils';
import { useReportStore } from '../../store/report-store';
import { useFilterStore } from '../../store/filter-store';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { webviewRPC } from '../../ipc/bridge';
import { CategoryManagementDialog } from './CategoryManagementDialog';
import { RuleManagementDialog } from './RuleManagementDialog';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';

export function CategoryFilterDropdown() {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const allTransactions = useReportStore((state) => state.allTransactions);
  const selectedCategories = useFilterStore((state) => state.categories);
  const setCategories = useFilterStore((state) => state.setCategories);
  const clearCategories = useFilterStore((state) => state.clearCategories);

  const [isManaging, setIsManaging] = useState(false);
  const [isManagingRules, setIsManagingRules] = useState(false);

  const availableCategories = useMemo(
    () => [...new Set(allTransactions.map((transaction) => transaction.category))].sort((left, right) => displayName(left).localeCompare(displayName(right))),
    [allTransactions, displayName],
  );

  const triggerLabel = selectedCategories.length === 0
    ? t('filter.category.label')
    : interpolate(t('filter.category.placeholder'), { count: selectedCategories.length.toString() });

  function toggleCategory(category: string) {
    if (selectedCategories.includes(category)) {
      setCategories(selectedCategories.filter((value) => value !== category));
      return;
    }

    setCategories([...selectedCategories, category].sort((left, right) => left.localeCompare(right)));
  }

  const handleCategoriesChanged = useCallback(async () => {
    const result = await webviewRPC.request.GET_CATEGORIES();
    if (result.ok) useReportStore.getState().setAllCategories(result.categories);
  }, []);

  const handleTransactionsReloaded = useCallback(async () => {
    const result = await webviewRPC.request.GET_TRANSACTIONS();
    if (result.ok) useReportStore.getState().setTransactions(result.transactions);
  }, []);

  return (
    <>
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Filter className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-foreground">{t('filter.category.label')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            disabled={selectedCategories.length === 0}
            onClick={clearCategories}
          >
            {t('filter.clear')}
          </Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {availableCategories.map((category) => {
            const checked = selectedCategories.includes(category);

            return (
              <label
                key={category}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleCategory(category)}
                  aria-label={displayName(category)}
                />
                <span className="text-sm text-foreground">{displayName(category)}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => setIsManaging(true)}
          >
            {t('categories.management.trigger')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-xs"
            onClick={() => setIsManagingRules(true)}
          >
            {t('rules.management.trigger')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <CategoryManagementDialog
      open={isManaging}
      onClose={() => setIsManaging(false)}
      onCategoriesChanged={handleCategoriesChanged}
      onTransactionsReloaded={handleTransactionsReloaded}
    />

    <RuleManagementDialog
      open={isManagingRules}
      onClose={() => setIsManagingRules(false)}
    />
    </>
  );
}