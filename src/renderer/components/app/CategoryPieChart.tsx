import React, { useMemo } from 'react';
import type { Transaction } from '../../../shared/types';
import { useFormatAmount } from '../../hooks/useFormatAmount';
import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { computePieSlices, buildColorMap, sliceToPath } from '../../lib/pie-utils';
import { useFilterStore } from '../../store/filter-store';

interface CategoryPieChartProps {
  transactions: Transaction[];
  allTransactions: Transaction[];
}

export const CategoryPieChart = React.memo(function CategoryPieChart({
  transactions,
  allTransactions,
}: CategoryPieChartProps) {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const formatAmount = useFormatAmount();
  const colorMap = useMemo(() => buildColorMap(allTransactions), [allTransactions]);
  const slices = useMemo(() => computePieSlices(transactions, colorMap), [transactions, colorMap]);
  const categories = useFilterStore((s) => s.categories);
  const setCategories = useFilterStore((s) => s.setCategories);

  function handleSliceClick(category: string) {
    if (categories.includes(category)) {
      setCategories(categories.filter((c) => c !== category));
      return;
    }

    setCategories([...categories, category]);
  }

  function getSliceOpacity(category: string): number {
    if (categories.length === 0) return 1;
    return categories.includes(category) ? 1 : 0.4;
  }

  if (slices.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-center text-xs text-muted-foreground">
          {t('report.pieChart.emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-2 px-2 py-3 min-h-0">
      <svg
        width="160"
        height="160"
        viewBox="0 0 180 180"
        aria-label={t('report.pieArea.label')}
        role="group"
      >
        {slices.map((slice) => (
          <path
            key={slice.category}
            d={sliceToPath(slice, 90, 90, 78)}
            fill={`hsl(var(--chart-${slice.colorIndex + 1}))`}
            opacity={getSliceOpacity(slice.category)}
            role="button"
            tabIndex={0}
            aria-label={`${displayName(slice.category)}: ${formatAmount(-slice.amount)}, ${slice.percentage.toFixed(1)}%`}
            className="cursor-pointer transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={() => handleSliceClick(slice.category)}
            onKeyDown={(e: React.KeyboardEvent<SVGPathElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSliceClick(slice.category);
              }
            }}
          >
            <title>
              {displayName(slice.category)}: {formatAmount(-slice.amount)} ({slice.percentage.toFixed(1)}%)
            </title>
          </path>
        ))}
        <circle cx={90} cy={90} r={40} className="fill-background pointer-events-none" />
      </svg>

      <ul className="flex-1 w-full overflow-y-auto space-y-1 px-1 min-h-0" aria-label={t('report.pieChart.legendLabel')}>
        {slices.map((slice) => (
          <li key={slice.category}>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs text-foreground transition-opacity duration-150 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ opacity: getSliceOpacity(slice.category) }}
              onClick={() => handleSliceClick(slice.category)}
              aria-pressed={categories.includes(slice.category)}
            >
              <span
                className="inline-block h-2 w-2 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: `hsl(var(--chart-${slice.colorIndex + 1}))` }}
                aria-hidden="true"
              />
              <span className="truncate">{displayName(slice.category)}</span>
              <span className="ml-auto flex-shrink-0 tabular-nums text-muted-foreground">
                {slice.percentage.toFixed(1)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});