import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLocale } from '../../context/locale-context';
import { useI18n } from '../../hooks/useI18n';
import {
  firstDayOfMonth,
  formatMonthLabel,
  getLast24Months,
  lastDayOfMonth,
  type PeriodPreset,
} from '../../lib/period-utils';
import { useFilterStore } from '../../store/filter-store';
import { useReportStore } from '../../store/report-store';
import { computeSparklineData } from '../../lib/sparkline-utils';
import type { SparklinePoint } from '../../lib/sparkline-utils';
import { Sparkline } from './Sparkline';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type MonthRef = {
  year: number;
  month: number;
};

const PRESETS: PeriodPreset[] = ['this-month', 'last-3-months', 'this-year', 'all-time'];

function monthKey(month: MonthRef): number {
  return month.year * 12 + month.month;
}

function toMonthRef(isoDate: string | null): MonthRef | null {
  if (!isoDate) {
    return null;
  }

  const [year, month] = isoDate.split('-').map(Number);

  return {
    year,
    month: month - 1,
  };
}

function isMonthInRange(month: MonthRef, start: MonthRef | null, end: MonthRef | null): boolean {
  if (!start || !end) {
    return false;
  }

  const value = monthKey(month);
  return value >= monthKey(start) && value <= monthKey(end);
}

function isSameMonth(left: MonthRef | null, right: MonthRef): boolean {
  return Boolean(left && left.year === right.year && left.month === right.month);
}

export function PeriodSelector() {
  const t = useI18n();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [startMonth, setStartMonth] = useState<MonthRef | null>(null);
  const [endMonth, setEndMonth] = useState<MonthRef | null>(null);
  const [hoverMonth, setHoverMonth] = useState<MonthRef | null>(null);

  const periodPreset = useFilterStore((state) => state.periodPreset);
  const dateFrom = useFilterStore((state) => state.dateFrom);
  const dateTo = useFilterStore((state) => state.dateTo);
  const setPeriodPreset = useFilterStore((state) => state.setPeriodPreset);
  const setCustomDateRange = useFilterStore((state) => state.setCustomDateRange);

  const isCustomRangeActive = periodPreset === null && Boolean(dateFrom && dateTo);
  const months = getLast24Months();

  const allTransactions = useReportStore((state) => state.allTransactions);
  const sparklinePoints = useMemo(
    () => computeSparklineData(allTransactions),
    [allTransactions],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isCustomRangeActive) {
      setStartMonth(toMonthRef(dateFrom));
      setEndMonth(toMonthRef(dateTo));
      return;
    }

    setStartMonth(null);
    setEndMonth(null);
  }, [open, isCustomRangeActive, dateFrom, dateTo]);

  function handlePresetSelect(preset: PeriodPreset) {
    setPeriodPreset(preset);
    setOpen(false);
    setStartMonth(null);
    setEndMonth(null);
  }

  const handleSparklineMonthClick = useCallback((point: SparklinePoint) => {
    setCustomDateRange(
      firstDayOfMonth(point.year, point.month),
      lastDayOfMonth(point.year, point.month),
    );
    setOpen(false);
  }, [setCustomDateRange]);

  function handleMonthClick(month: MonthRef) {
    if (!startMonth || (startMonth && endMonth)) {
      setStartMonth(month);
      setEndMonth(null);
      setHoverMonth(null);
      return;
    }

    const clickedKey = monthKey(month);
    const startKey = monthKey(startMonth);

    const rangeStart = clickedKey < startKey ? month : startMonth;
    const rangeEnd = clickedKey < startKey ? startMonth : month;

    setStartMonth(rangeStart);
    setEndMonth(rangeEnd);
    setCustomDateRange(
      firstDayOfMonth(rangeStart.year, rangeStart.month),
      lastDayOfMonth(rangeEnd.year, rangeEnd.month),
    );
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {PRESETS.map((preset) => {
        const isActive = periodPreset === preset;

        return (
          <Button
            key={preset}
            type="button"
            variant="ghost"
            className={cn(
              'w-full justify-start',
              isActive && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            onClick={() => handlePresetSelect(preset)}
          >
            {t(`filter.period.${preset}`)}
          </Button>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'w-full justify-between',
              isCustomRangeActive && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              {t('filter.period.custom')}
            </span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t('filter.period.label')}</p>
            <p className="text-xs text-muted-foreground">{t('filter.period.custom')}</p>
          </div>
          <div
            className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1"
            onMouseLeave={() => setHoverMonth(null)}
          >
            {months.map((month) => {
              const label = formatMonthLabel(month.year, month.month, locale);
              const isStart = isSameMonth(startMonth, month);
              const isEnd = isSameMonth(endMonth, month);
              const isInRange = isMonthInRange(month, startMonth, endMonth);

              // While the user has picked a start but not yet committed an end,
              // show a live preview of the range as the mouse moves.
              const isPicking = Boolean(startMonth && !endMonth);
              const hoverRangeStart = isPicking && hoverMonth
                ? (monthKey(hoverMonth) < monthKey(startMonth!) ? hoverMonth : startMonth)
                : null;
              const hoverRangeEnd = isPicking && hoverMonth
                ? (monthKey(hoverMonth) < monthKey(startMonth!) ? startMonth : hoverMonth)
                : null;
              const isHoverStart = isPicking && isSameMonth(hoverRangeStart, month);
              const isHoverEnd = isPicking && isSameMonth(hoverRangeEnd, month);
              const isInHoverRange = isPicking && isMonthInRange(month, hoverRangeStart, hoverRangeEnd);

              return (
                <button
                  key={`${month.year}-${month.month}`}
                  type="button"
                  className={cn(
                    'rounded-md border border-border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    // Committed selection
                    (isStart || isEnd) && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                    !isStart && !isEnd && isInRange && 'border-accent bg-accent text-accent-foreground hover:bg-accent/90',
                    // Hover preview (only when picking, no committed end yet)
                    !isStart && !isEnd && !isInRange && (isHoverStart || isHoverEnd) && 'border-primary bg-primary text-primary-foreground',
                    !isStart && !isEnd && !isInRange && !isHoverStart && !isHoverEnd && isInHoverRange && 'border-accent bg-accent/60 text-accent-foreground',
                    // Default hover when nothing special applies
                    !isStart && !isEnd && !isInRange && !isHoverStart && !isHoverEnd && !isInHoverRange && 'hover:bg-muted',
                  )}
                  aria-label={`${t('filter.period.custom')}: ${label}`}
                  onMouseEnter={() => isPicking && setHoverMonth(month)}
                  onClick={() => handleMonthClick(month)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Sparkline
        points={sparklinePoints}
        activeFrom={dateFrom}
        activeTo={dateTo}
        onMonthClick={handleSparklineMonthClick}
      />
    </div>
  );
}