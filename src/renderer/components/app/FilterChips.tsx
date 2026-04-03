import { X } from 'lucide-react';
import { useLocale } from '../../context/locale-context';
import { useI18n } from '../../hooks/useI18n';
import { interpolate, formatNumberValue } from '../../lib/format-utils';
import { LOCALE_TAGS } from '../../lib/period-utils';
import { useFilterStore } from '../../store/filter-store';
import { Badge } from '../ui/badge';

function formatAmountLabel(value: number, currencySymbol: string, locale: ReturnType<typeof useLocale>): string {
  const raw = formatNumberValue(value, locale.numberFormat);
  return currencySymbol ? `${currencySymbol}${raw}` : raw;
}

function formatPeriodLabel(
  preset: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  locale: ReturnType<typeof useLocale>,
  t: ReturnType<typeof useI18n>,
): string | null {
  if (preset) {
    return t(`filter.period.${preset}`);
  }

  if (!dateFrom && !dateTo) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale.language] ?? locale.language, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

  const fromLabel = dateFrom ? formatter.format(new Date(`${dateFrom}T00:00:00Z`)).replace(',', '') : '…';
  const toLabel = dateTo ? formatter.format(new Date(`${dateTo}T00:00:00Z`)).replace(',', '') : '…';

  return `${fromLabel} – ${toLabel}`;
}

export function FilterChips() {
  const t = useI18n();
  const locale = useLocale();
  const periodPreset = useFilterStore((state) => state.periodPreset);
  const dateFrom = useFilterStore((state) => state.dateFrom);
  const dateTo = useFilterStore((state) => state.dateTo);
  const categories = useFilterStore((state) => state.categories);
  const amountMin = useFilterStore((state) => state.amountMin);
  const amountMax = useFilterStore((state) => state.amountMax);
  const clearPeriod = useFilterStore((state) => state.clearPeriod);
  const setCategories = useFilterStore((state) => state.setCategories);
  const clearCategories = useFilterStore((state) => state.clearCategories);
  const clearAmountRange = useFilterStore((state) => state.clearAmountRange);

  const periodLabel = formatPeriodLabel(periodPreset, dateFrom, dateTo, locale, t);
  const amountLabel = (() => {
    if (amountMin !== null && amountMax !== null) {
      return `${formatAmountLabel(amountMin, locale.currencySymbol, locale)} – ${formatAmountLabel(amountMax, locale.currencySymbol, locale)}`;
    }

    if (amountMin !== null) {
      return `≥ ${formatAmountLabel(amountMin, locale.currencySymbol, locale)}`;
    }

    if (amountMax !== null) {
      return `≤ ${formatAmountLabel(amountMax, locale.currencySymbol, locale)}`;
    }

    return null;
  })();

  if (!periodLabel && categories.length === 0 && !amountLabel) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periodLabel && (
        <Badge variant="secondary" className="gap-1 px-2 py-1 pr-1">
          <span>{periodLabel}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={interpolate(t('filter.chip.removeAriaLabel'), { filter: periodLabel })}
            onClick={clearPeriod}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </Badge>
      )}

      {categories.length > 2 ? (
        <Badge variant="secondary" className="gap-1 px-2 py-1 pr-1">
          <span>{interpolate(t('filter.chip.categories'), { count: categories.length.toString() })}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={interpolate(t('filter.chip.removeAriaLabel'), { filter: t('filter.category.label') })}
            onClick={clearCategories}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </Badge>
      ) : (
        categories.map((category) => (
          <Badge key={category} variant="secondary" className="gap-1 px-2 py-1 pr-1">
            <span>{category}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={interpolate(t('filter.chip.removeAriaLabel'), { filter: category })}
              onClick={() => setCategories(categories.filter((value) => value !== category))}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Badge>
        ))
      )}

      {amountLabel && (
        <Badge variant="secondary" className="gap-1 px-2 py-1 pr-1">
          <span>{amountLabel}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={interpolate(t('filter.chip.removeAriaLabel'), { filter: amountLabel })}
            onClick={clearAmountRange}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </Badge>
      )}
    </div>
  );
}