// src/renderer/components/app/ReportView.tsx
// Updated in Story 3.2: Zustand store reads + stat computation + conditional table.
// Updated in Story 4.2: Bulk selection wiring — FloatingBulkActionBar, BulkDeleteConfirmDialog, BulkReassignPopover.
// RULE: Token-based Tailwind classes only — no raw hex/HSL.
import { useState } from 'react';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';
import { useFormatAmount } from '../../hooks/useFormatAmount';
import { useReportStore } from '../../store/report-store';
import { useFilterStore } from '../../store/filter-store';
import {
  hasActiveTransactionFilters,
  useFilteredStats,
  useFilteredTransactions,
} from '../../hooks/useFilteredTransactions';
import { FilterBar } from './FilterBar';
import { CategoryPieChart } from './CategoryPieChart';
import { PeriodSelector } from './PeriodSelector';
import { TransactionTable } from './TransactionTable';
import { FloatingBulkActionBar } from './FloatingBulkActionBar';
import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';
import { BulkReassignPopover } from './BulkReassignPopover';
import { webviewRPC } from '../../ipc/bridge';
import { interpolate } from '../../lib/format-utils';
import { useLoadTransactions } from '../../hooks/useLoadTransactions';

interface ReportViewProps {
  onUploadClick: () => void;
  onAddTransaction?: () => void; // stub — Story 3.7 implements manual entry
}

export function ReportViewSkipLink() {
  const t = useI18n();

  return (
    <a
      href="#transaction-table"
      className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50
                 focus:px-4 focus:py-2 focus:bg-card focus:text-foreground
                 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t('a11y.skipToTransactions')}
    </a>
  );
}

export function ReportView({ onUploadClick }: ReportViewProps) {
  const t = useI18n();
  const formatAmount = useFormatAmount();

  const allTransactions = useReportStore((s) => s.allTransactions);
  const isLoaded = useReportStore((s) => s.isTransactionsLoaded);
  const selectedTransactionIds = useReportStore((s) => s.selectedTransactionIds);
  const clearSelection = useReportStore((s) => s.clearSelection);
  const filteredTransactions = useFilteredTransactions();
  const stats = useFilteredStats(filteredTransactions);
  const dateFrom = useFilterStore((state) => state.dateFrom);
  const dateTo = useFilterStore((state) => state.dateTo);
  const categories = useFilterStore((state) => state.categories);
  const amountMin = useFilterStore((state) => state.amountMin);
  const amountMax = useFilterStore((state) => state.amountMax);

  const loadAllTransactions = useLoadTransactions();

  // Bulk action state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const selectionCount = selectedTransactionIds.size;

  const hasActiveFilters = hasActiveTransactionFilters({
    dateFrom,
    dateTo,
    categories,
    amountMin,
    amountMax,
  });

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setBulkError(null);
    const result = await webviewRPC.request.BATCH_DELETE_TRANSACTIONS({
      ids: [...selectedTransactionIds],
    });
    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (!result.ok) {
      setBulkError(result.error);
      return;
    }

    if (result.failed > 0) {
      setBulkError(
        interpolate(t('bulk.delete.error'), {
          deleted: String(result.deleted),
          failed: String(result.failed),
        }),
      );
    }
    clearSelection();
    await loadAllTransactions();
  };

  const handleBulkReassign = async (category: string) => {
    setIsReassigning(true);
    setBulkError(null);
    const result = await webviewRPC.request.BATCH_UPDATE_TRANSACTION_CATEGORIES({
      ids: [...selectedTransactionIds],
      category,
    });
    setIsReassigning(false);

    if (!result.ok) {
      setBulkError(result.error);
      return;
    }

    if (result.failed > 0) {
      setBulkError(
        interpolate(t('bulk.reassign.error'), {
          updated: String(result.updated),
          failed: String(result.failed),
        }),
      );
    }
    clearSelection();
    await loadAllTransactions();
  };

  const handleClearSelection = () => {
    clearSelection();
    setBulkError(null);
  };

  const statCards = [
    {
      labelKey: 'report.stat.totalExpenses' as const,
      value: isLoaded ? formatAmount(stats.totalExpenses) : '—',
    },
    {
      labelKey: 'report.stat.totalIncome' as const,
      value: isLoaded ? formatAmount(stats.totalIncome) : '—',
    },
    {
      labelKey: 'report.stat.netBalance' as const,
      value: isLoaded ? formatAmount(stats.netBalance) : '—',
    },
  ];

  return (
    <>
      {/* Window too-small message — CSS-only, no JS listener required */}
      <div className="max-[899px]:flex min-[900px]:hidden flex-1 items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="font-semibold text-foreground">{t('report.windowTooSmall.heading')}</p>
          <p className="text-sm text-muted-foreground">{t('report.windowTooSmall.body')}</p>
        </div>
      </div>

      {/* Main dual-panel layout — hidden below 900px */}
      <main className="min-[900px]:flex max-[899px]:hidden flex-1 overflow-hidden min-w-0">
        {/* Left panel: stat cards + period selector + pie chart */}
        <aside
          className="w-[260px] flex-shrink-0 border-r border-border flex flex-col overflow-auto"
          aria-label={t('report.leftPanel.label')}
        >
          {/* Stat cards area */}
          <section className="p-4 border-b border-border" aria-label={t('report.statsArea.label')}>
            {statCards.map(({ labelKey, value }) => (
              <div key={labelKey} className="py-2">
                <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </section>

          {/* Period selector area — Story 3.3 fills in */}
          <section className="border-b border-border" aria-label={t('a11y.periodSelector')}>
            <PeriodSelector />
          </section>

          <section className="flex-1 flex flex-col overflow-hidden" aria-label={t('report.pieArea.label')}>
            <CategoryPieChart transactions={filteredTransactions} allTransactions={allTransactions} />
          </section>
        </aside>

        {/* Right panel: transaction table area */}
        <section
          id="transaction-table"
          tabIndex={-1}
          className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden outline-none"
          aria-label={t('report.transactionArea.label')}
        >
          <FilterBar />
          {allTransactions.length > 0 ? (
            filteredTransactions.length > 0 ? (
              <TransactionTable transactions={filteredTransactions} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">{t('filter.noResults')}</h2>
                  {hasActiveFilters && (
                    <p className="text-sm text-muted-foreground">{t('filter.clear')}</p>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="flex flex-col items-center text-center space-y-4 max-w-xs">
                <div className="text-4xl" role="img" aria-label="empty">💸</div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{t('report.emptyTable.heading')}</h2>
                  <p className="text-sm text-muted-foreground">{t('report.emptyTable.body')}</p>
                </div>
                <Button onClick={onUploadClick} className="w-full max-w-[220px]">
                  {t('report.emptyTable.cta')}
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Floating bulk action bar — portal-rendered, appears when 1+ rows selected */}
      {selectionCount > 0 && (
        <FloatingBulkActionBar
          count={selectionCount}
          onDelete={() => setDeleteDialogOpen(true)}
          onReassign={() => setReassignOpen(true)}
          onClear={handleClearSelection}
          errorMessage={bulkError}
        />
      )}

      {/* Bulk reassign popover — headless, anchored at bottom-center via PopoverAnchor */}
      <BulkReassignPopover
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        onSelect={(category) => void handleBulkReassign(category)}
        isSubmitting={isReassigning}
      />

      <BulkDeleteConfirmDialog
        open={deleteDialogOpen}
        count={selectionCount}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setDeleteDialogOpen(false)}
        isDeleting={isDeleting}
      />
    </>
  );
}

