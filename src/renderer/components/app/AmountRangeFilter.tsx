import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useLocale } from '../../context/locale-context';
import { useI18n } from '../../hooks/useI18n';
import { cn } from '../../lib/utils';
import { formatNumberValue } from '../../lib/format-utils';
import { useFilterStore } from '../../store/filter-store';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

function formatAmountValue(value: number, currencySymbol: string, locale: ReturnType<typeof useLocale>): string {
  const raw = formatNumberValue(value, locale.numberFormat);
  return currencySymbol ? `${currencySymbol}${raw}` : raw;
}

function parseAmountInput(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AmountRangeFilter() {
  const t = useI18n();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState('');
  const [localMax, setLocalMax] = useState('');

  const amountMin = useFilterStore((state) => state.amountMin);
  const amountMax = useFilterStore((state) => state.amountMax);
  const setAmountRange = useFilterStore((state) => state.setAmountRange);
  const clearAmountRange = useFilterStore((state) => state.clearAmountRange);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLocalMin(amountMin === null ? '' : amountMin.toString());
    setLocalMax(amountMax === null ? '' : amountMax.toString());
  }, [open, amountMin, amountMax]);

  const errorMessage = useMemo(() => {
    const parsedMin = parseAmountInput(localMin);
    const parsedMax = parseAmountInput(localMax);

    if ((localMin !== '' && parsedMin === null) || (localMax !== '' && parsedMax === null)) {
      return t('filter.amount.error.nonNegative');
    }

    if ((parsedMin ?? 0) < 0 || (parsedMax ?? 0) < 0) {
      return t('filter.amount.error.nonNegative');
    }

    if (parsedMin !== null && parsedMax !== null && parsedMax < parsedMin) {
      return t('filter.amount.error.range');
    }

    return null;
  }, [localMin, localMax, t]);

  const triggerLabel = useMemo(() => {
    if (amountMin !== null && amountMax !== null) {
      return `${t('filter.amount.label')}: ${formatAmountValue(amountMin, locale.currencySymbol, locale)}–${formatAmountValue(amountMax, locale.currencySymbol, locale)}`;
    }

    if (amountMin !== null) {
      return `${t('filter.amount.label')}: ≥ ${formatAmountValue(amountMin, locale.currencySymbol, locale)}`;
    }

    if (amountMax !== null) {
      return `${t('filter.amount.label')}: ≤ ${formatAmountValue(amountMax, locale.currencySymbol, locale)}`;
    }

    return t('filter.amount.label');
  }, [amountMin, amountMax, locale, t]);

  function handleApply() {
    const nextMin = parseAmountInput(localMin);
    const nextMax = parseAmountInput(localMax);

    if (errorMessage) {
      return;
    }

    setAmountRange(nextMin, nextMax);
    setOpen(false);
  }

  function handleClear() {
    clearAmountRange();
    setLocalMin('');
    setLocalMax('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{t('filter.amount.label')}</p>
          <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={handleClear}>
            {t('filter.amount.clear')}
          </Button>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{t('filter.amount.minPlaceholder')}</span>
            <div className={cn(
              'flex items-center gap-2 rounded-md border border-input bg-background px-3',
              errorMessage && 'border-destructive',
            )}>
              <span className="text-sm text-muted-foreground">{locale.currencySymbol}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={localMin}
                onChange={(event) => setLocalMin(event.target.value)}
                className={cn(
                  'h-10 w-full bg-transparent text-sm text-foreground outline-none [font-variant-numeric:tabular-nums]',
                  errorMessage && 'text-destructive',
                )}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'amount-range-error' : undefined}
                placeholder={t('filter.amount.minPlaceholder')}
              />
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{t('filter.amount.maxPlaceholder')}</span>
            <div className={cn(
              'flex items-center gap-2 rounded-md border border-input bg-background px-3',
              errorMessage && 'border-destructive',
            )}>
              <span className="text-sm text-muted-foreground">{locale.currencySymbol}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={localMax}
                onChange={(event) => setLocalMax(event.target.value)}
                className={cn(
                  'h-10 w-full bg-transparent text-sm text-foreground outline-none [font-variant-numeric:tabular-nums]',
                  errorMessage && 'text-destructive',
                )}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'amount-range-error' : undefined}
                placeholder={t('filter.amount.maxPlaceholder')}
              />
            </div>
          </label>

          {errorMessage && (
            <p id="amount-range-error" className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClear}>
              {t('filter.amount.clear')}
            </Button>
            <Button type="button" onClick={handleApply} disabled={Boolean(errorMessage)}>
              {t('filter.amount.apply')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}