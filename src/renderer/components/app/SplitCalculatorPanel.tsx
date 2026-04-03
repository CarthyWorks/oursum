// src/renderer/components/app/SplitCalculatorPanel.tsx
// RULE: ADR-005 — lives in src/renderer/, zero imports from src/core/ or src/main/.
// RULE: Token-based Tailwind classes only — no raw hex/HSL.
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';
import { useFormatAmount } from '../../hooks/useFormatAmount';
import { useSplitCalculator, makeDefaultContributors, type SplitType, type Contributor } from '../../hooks/useSplitCalculator';
import { interpolate, parseFormattedNumber } from '../../lib/format-utils';
import { useLocale } from '../../context/locale-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface SplitCalculatorPanelProps {
  open: boolean;
  totalAmount: string;
  onTotalAmountChange: (value: string) => void;
  onClose: () => void;
  /** Hydrated contributors from App.tsx session state; null before first hydration → falls back to defaults. */
  initialContributors: Contributor[] | null;
  /** Notifies App.tsx whenever contributors change so it can save on close. */
  onContributorsChange: (contributors: Contributor[]) => void;
  /** Non-null when the saved config could not be loaded; panel shows a non-blocking inline warning. */
  configWarning: string | null;
}

export function SplitCalculatorPanel({
  open,
  totalAmount,
  onTotalAmountChange,
  onClose,
  initialContributors,
  onContributorsChange,
  configWarning,
}: SplitCalculatorPanelProps) {
  const t = useI18n();
  const formatAmount = useFormatAmount();
  const locale = useLocale();
  const total = parseFloat(totalAmount) || 0;
  const [totalInputFocused, setTotalInputFocused] = useState(false);
  const [displayTotal, setDisplayTotal] = useState<string>(() =>
    totalAmount ? formatAmount(parseFloat(totalAmount) || 0) : ''
  );
  const resolvedInitialContributors = useMemo(
    () => initialContributors ?? makeDefaultContributors(),
    [initialContributors]
  );
  const { contributors, addContributor, removeContributor, updateContributor, splitResult } = useSplitCalculator({
    total,
    initialContributors: resolvedInitialContributors,
    onContributorsChange,
  });
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const prevLengthRef = useRef(contributors.length);

  useEffect(() => {
    if (!totalInputFocused) {
      setDisplayTotal(formatAmount(total));
    }
    if (contributors.length > prevLengthRef.current) {
      const lastContributor = contributors[contributors.length - 1];
      if (lastContributor) {
        nameInputRefs.current.get(lastContributor.id)?.focus();
      }
    }

    prevLengthRef.current = contributors.length;
  }, [contributors]);

  const percentageSum = contributors
    .filter((contributor) => contributor.splitType === 'percentage')
    .reduce((sum, contributor) => sum + contributor.value, 0);
  const hasPercentageContributors = contributors.some((contributor) => contributor.splitType === 'percentage');
  const hasEqualContributors = contributors.some((contributor) => contributor.splitType === 'equal');
  const showPercentageIndicator = hasPercentageContributors && !hasEqualContributors && percentageSum < 100;
  const showAmountRemaining = splitResult.unallocated !== 0;
  const remainderClassName = splitResult.unallocated < 0 ? 'text-destructive' : 'text-amber-500';

  return (
    <Sheet modal={false} open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="right"
        showOverlay={false}
        showCloseButton={false}
        // w-[300px] is fixed-pixel — NOT percentage — to prevent the report table from
        // reflowing while the panel is open (UX spec requirement).
        // Also overrides shadcn's default sm:max-w-sm.
        className="w-[300px] flex flex-col gap-0 p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b border-border">
          <SheetTitle className="text-sm font-semibold">{t('split.panel.title')}</SheetTitle>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t('split.panel.closeAriaLabel')}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {/* Total amount section */}
        <div className="px-4 py-4 border-b border-border">
          <label htmlFor="split-total" className="text-xs text-muted-foreground block mb-1">
            {t('split.panel.totalLabel')}
          </label>
          <input
            id="split-total"
            type="text"
            value={displayTotal}
            onFocus={() => {
              setTotalInputFocused(true);
              // switch to an editable numeric representation
              setDisplayTotal((prev) => {
                const parsed = parseFormattedNumber(prev, locale.numberFormat);
                return parsed !== null ? parsed.toFixed(2) : '';
              });
            }}
            onBlur={() => {
              setTotalInputFocused(false);
              const parsed = parseFormattedNumber(displayTotal, locale.numberFormat);
              const valueToUse = parsed !== null ? parsed : 0;
              onTotalAmountChange(valueToUse.toFixed(2));
              setDisplayTotal(formatAmount(valueToUse));
            }}
            onChange={(e) => {
              const v = e.target.value;
              setDisplayTotal(v);
              const parsed = parseFormattedNumber(v, locale.numberFormat);
              if (parsed !== null) {
                onTotalAmountChange(parsed.toFixed(2));
              } else {
                onTotalAmountChange('');
              }
            }}
            className="w-full text-2xl font-semibold tabular-nums bg-transparent border-none outline-none text-foreground focus:ring-0"
            aria-label={t('split.panel.totalLabel')}
          />
        </div>

        {/* Non-blocking warning when saved config could not be loaded */}
        {configWarning !== null && (
          <div className="px-4 py-2 text-xs text-amber-500 border-b border-border">
            {t(configWarning)}
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {contributors.map((contributor) => {
            const settlement = splitResult.settlements.find((entry) => entry.id === contributor.id);

            return (
              <div key={contributor.id} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={(element) => {
                      if (element) {
                        nameInputRefs.current.set(contributor.id, element);
                        return;
                      }

                      nameInputRefs.current.delete(contributor.id);
                    }}
                    type="text"
                    value={contributor.name}
                    onChange={(event) => updateContributor(contributor.id, { name: event.target.value })}
                    placeholder={t('split.contributor.namePlaceholder')}
                    className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:ring-0 min-w-0"
                    aria-label={t('split.contributor.namePlaceholder')}
                  />
                  <button
                    type="button"
                    disabled={contributors.length <= 2}
                    onClick={() => removeContributor(contributor.id)}
                    className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    aria-label={t('split.contributor.remove')}
                  >
                    {t('split.contributor.remove')}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={contributor.splitType}
                    onValueChange={(value) => updateContributor(contributor.id, { splitType: value as SplitType, value: 0 })}
                  >
                    <SelectTrigger className="h-7 text-xs w-[110px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">{t('split.contributor.splitType.equal')}</SelectItem>
                      <SelectItem value="percentage">{t('split.contributor.splitType.percentage')}</SelectItem>
                      <SelectItem value="fixed">{t('split.contributor.splitType.fixed')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {contributor.splitType !== 'equal' && (
                    <input
                      type="number"
                      min="0"
                      step={contributor.splitType === 'percentage' ? '1' : '0.01'}
                      max={contributor.splitType === 'percentage' ? '100' : undefined}
                      value={contributor.value === 0 ? '' : contributor.value}
                      onChange={(event) => {
                        const raw = parseFloat(event.target.value) || 0;
                        updateContributor(contributor.id, { value: contributor.splitType === 'percentage' ? Math.min(raw, 100) : raw });
                      }}
                      placeholder={
                        contributor.splitType === 'percentage'
                          ? t('split.contributor.valuePlaceholder.percentage')
                          : t('split.contributor.valuePlaceholder.fixed')
                      }
                      className="flex-1 text-sm tabular-nums bg-transparent border-b border-border outline-none text-foreground placeholder:text-muted-foreground focus:ring-0 min-w-0"
                      aria-label={
                        contributor.splitType === 'percentage'
                          ? t('split.contributor.splitType.percentage')
                          : t('split.contributor.splitType.fixed')
                      }
                    />
                  )}
                  {contributor.splitType === 'percentage' && (
                    <span className="text-xs text-muted-foreground shrink-0">%</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatAmount(settlement?.amount ?? 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {(showPercentageIndicator || showAmountRemaining) && (
          <div className={`px-4 py-2 text-xs border-t border-border ${remainderClassName}`}>
            {showPercentageIndicator && interpolate(t('split.contributor.remaining.pct'), {
              pct: (100 - percentageSum).toFixed(1),
            })}
            {showPercentageIndicator && showAmountRemaining && <br />}
            {showAmountRemaining && interpolate(t('split.contributor.remaining.amount'), {
              amount: formatAmount(Math.abs(splitResult.unallocated)),
            })}
          </div>
        )}

        <div className="px-4 py-3 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addContributor}
          >
            {t('split.contributor.add')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
