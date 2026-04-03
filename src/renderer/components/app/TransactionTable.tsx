// src/renderer/components/app/TransactionTable.tsx
// RULE: useMemo on sortedTransactions, useCallback on handler (ADR-006).
// RULE: Transactions remain prop-driven; categories come from the report store for inline editing.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReportStore } from '../../store/report-store';
import { webviewRPC } from '../../ipc/bridge';
import { interpolate } from '../../lib/format-utils';
import type { RuleInput, Transaction } from '../../../shared/types';
import { TransactionRow } from './TransactionRow';
import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { InlineCategoryPicker } from './InlineCategoryPicker';
import { Button } from '../ui/button';
import { RulePreviewDialog } from './RulePreviewDialog';
import { Checkbox } from '../ui/checkbox';
import { useContextMenu } from '../../hooks/useContextMenu';
import { RowContextMenu } from './RowContextMenu';
import { SingleDeleteConfirmDialog } from './SingleDeleteConfirmDialog';

type SortColumn = 'date' | 'description' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';
type SortState = { column: SortColumn; direction: SortDirection } | null; // null = default (date desc)

type ColumnWidths = Record<SortColumn, number>;
type ResizeBoundary = 'date' | 'description' | 'category';

const DEFAULT_WIDTHS: ColumnWidths = {
  date: 120,
  description: 300,
  category: 160,
  amount: 160,
};

const MIN_WIDTHS: ColumnWidths = {
  date: 90,
  description: 120,
  category: 100,
  amount: 140,
};

const RESIZE_PAIRS: Record<ResizeBoundary, readonly [SortColumn, SortColumn]> = {
  date: ['date', 'description'],
  description: ['description', 'category'],
  category: ['category', 'amount'],
};

const CHECKBOX_COL_WIDTH = 40; // px, fixed, NOT part of resize system

interface TransactionTableProps {
  transactions: Transaction[];
}

type ApplyPromptState = {
  transaction: Transaction;
  nextCategory: string;
};

type PreviewState = {
  open: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  candidateRule: RuleInput | null;
  description: string;
  nextCategory: string;
  transactions: Transaction[];
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  const t = useI18n();
  const displayName = useCategoryDisplayName();
  const allCategories = useReportStore((state) => state.allCategories);
  const selectedTransactionIds = useReportStore((s) => s.selectedTransactionIds);
  const toggleTransactionSelection = useReportStore((s) => s.toggleTransactionSelection);
  const clearSelection = useReportStore((s) => s.clearSelection);
  const setSelection = useReportStore((s) => s.setSelection);
  const [sortState, setSortState] = useState<SortState>(null);
  const [colWidths, setColWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
  const [applyPrompt, setApplyPrompt] = useState<ApplyPromptState | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>({
    open: false,
    isLoading: false,
    isSubmitting: false,
    error: null,
    candidateRule: null,
    description: '',
    nextCategory: '',
    transactions: [],
  });

  // Context menu state (AC4, AC9)
  const { isOpen: ctxMenuOpen, position: ctxMenuPos, menuRef: ctxMenuRef, open: openCtxMenu, close: closeCtxMenu } = useContextMenu();
  const [ctxMenuTransactionId, setCtxMenuTransactionId] = useState<string | null>(null);

  // Single-transaction delete dialog state (AC3, AC6, AC10)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    boundary: ResizeBoundary;
    startX: number;
    leftColumn: SortColumn;
    rightColumn: SortColumn;
    leftWidth: number;
    rightWidth: number;
  } | null>(null);

  const handleColumnClick = useCallback((column: SortColumn) => {
    setSortState((prev) => {
      if (prev === null || prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      // Was desc — third click on same column resets to default
      return null;
    });
  }, []);

  const fitWidthsToContainer = useCallback((widths: ColumnWidths, containerWidth: number): ColumnWidths => {
    const total = widths.date + widths.description + widths.category + widths.amount;
    const delta = containerWidth - total;

    if (delta === 0) return widths;

    if (delta > 0) {
      return { ...widths, description: widths.description + delta };
    }

    const shrinkCapacity = widths.description - MIN_WIDTHS.description;
    const shrink = Math.min(shrinkCapacity, Math.abs(delta));
    return { ...widths, description: widths.description - shrink };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>, boundary: ResizeBoundary) => {
    e.stopPropagation();
    e.preventDefault();
    const [leftColumn, rightColumn] = RESIZE_PAIRS[boundary];
    dragRef.current = {
      boundary,
      startX: e.clientX,
      leftColumn,
      rightColumn,
      leftWidth: colWidths[leftColumn],
      rightWidth: colWidths[rightColumn],
    };
  }, [colWidths]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const { leftColumn, rightColumn, startX, leftWidth, rightWidth } = dragRef.current;
      const delta = event.clientX - startX;
      const pairTotal = leftWidth + rightWidth;
      const nextLeft = Math.max(
        MIN_WIDTHS[leftColumn],
        Math.min(leftWidth + delta, pairTotal - MIN_WIDTHS[rightColumn]),
      );
      const nextRight = pairTotal - nextLeft;

      setColWidths((prev) => ({
        ...prev,
        [leftColumn]: nextLeft,
        [rightColumn]: nextRight,
      }));
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const containerWidth = element.clientWidth;
      if (containerWidth === 0) return;
      setColWidths((current) => fitWidthsToContainer(current, containerWidth));
    });

    observer.observe(element);

    const containerWidth = element.clientWidth;
    if (containerWidth > 0) {
      setColWidths((current) => fitWidthsToContainer(current, containerWidth));
    }

    return () => {
      observer.disconnect();
    };
  }, [fitWidthsToContainer]);

  // Clear selection when the filtered transaction list changes (e.g. filter applied)
  useEffect(() => {
    clearSelection();
  }, [transactions, clearSelection]);

  const sortedTransactions = useMemo(() => {
    const copy = [...transactions];
    if (!sortState) {
      // Default: date descending (most recent first)
      return copy.sort((a, b) => b.date.localeCompare(a.date));
    }
    const { column, direction } = sortState;
    copy.sort((a, b) => {
      let cmp = 0;
      if (column === 'date') cmp = a.date.localeCompare(b.date);
      else if (column === 'description') cmp = a.description.localeCompare(b.description);
      else if (column === 'category') cmp = a.category.localeCompare(b.category);
      else if (column === 'amount') cmp = a.amount - b.amount;
      return direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortState]);

  const categoryOptions = useMemo(
    () => allCategories.map((category) => category.name),
    [allCategories],
  );

  const reloadTransactions = useCallback(async () => {
    const result = await webviewRPC.request.GET_TRANSACTIONS(undefined);
    if (!result.ok) {
      return result;
    }

    useReportStore.getState().setTransactions(result.transactions);
    return result;
  }, []);

  // Context menu handler (AC4, AC8, AC9)
  const handleContextMenu = useCallback((tx: Transaction, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (selectedTransactionIds.has(tx.id)) return; // AC8: suppress for selected rows
    setCtxMenuTransactionId(tx.id);
    openCtxMenu(e); // AC9: opening updates position, naturally handles re-open on another row
  }, [selectedTransactionIds, openCtxMenu]);

  // Single-delete open/confirm (AC3, AC6, AC10)
  const openDeleteDialog = useCallback((txId: string) => {
    setDeletingTransactionId(txId);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTransactionId) return;
    setIsDeleting(true);
    const result = await webviewRPC.request.DELETE_TRANSACTION({ id: deletingTransactionId });
    if (result.ok) {
      setDeleteDialogOpen(false);
      setDeletingTransactionId(null);
      setDeleteError(null);
      await reloadTransactions();
    } else {
      setDeleteError(result.error); // AC10: keep dialog open, show error
      console.error('[TransactionTable] DELETE_TRANSACTION failed:', result.error);
    }
    setIsDeleting(false);
  }, [deletingTransactionId, reloadTransactions]);

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setDeleteDialogOpen(false);
    setDeletingTransactionId(null);
    setDeleteError(null);
  }, [isDeleting]);

  // Context menu action handlers (AC5, AC6)
  const handleCtxMenuReassign = useCallback(() => {
    closeCtxMenu();
    if (ctxMenuTransactionId) {
      setInlineError(null);
      setEditingTransactionId(ctxMenuTransactionId);
    }
  }, [closeCtxMenu, ctxMenuTransactionId]);

  const handleCtxMenuDelete = useCallback(() => {
    closeCtxMenu();
    if (ctxMenuTransactionId) openDeleteDialog(ctxMenuTransactionId);
  }, [closeCtxMenu, ctxMenuTransactionId, openDeleteDialog]);

  const closePreview = useCallback(() => {
    setPreviewState({
      open: false,
      isLoading: false,
      isSubmitting: false,
      error: null,
      candidateRule: null,
      description: '',
      nextCategory: '',
      transactions: [],
    });
  }, []);

  const handleCategoryClick = useCallback((transaction: Transaction) => {
    setInlineError(null);
    setEditingTransactionId(transaction.id);
  }, []);

  const handleCategoryOpenChange = useCallback((transactionId: string, open: boolean) => {
    if (!open && editingTransactionId === transactionId) {
      setEditingTransactionId(null);
      setInlineError(null);
      setApplyPrompt(null); // picker dismissed without saving — clear stale rule suggestion
      return;
    }

    if (open) {
      setEditingTransactionId(transactionId);
      setInlineError(null);
    }
  }, [editingTransactionId]);

  const handleCategoryConfirm = useCallback(async (transaction: Transaction, nextCategory: string) => {
    if (transaction.category === nextCategory) {
      setEditingTransactionId(null);
      setInlineError(null);
      return;
    }

    setSavingTransactionId(transaction.id);
    setInlineError(null);

    const updateResult = await webviewRPC.request.UPDATE_TRANSACTION_CATEGORY({
      id: transaction.id,
      category: nextCategory,
    });

    if (!updateResult.ok) {
      setSavingTransactionId(null);
      setInlineError(updateResult.error);
      return;
    }

    const reloadResult = await reloadTransactions();
    setSavingTransactionId(null);
    if (!reloadResult.ok) {
      setInlineError(reloadResult.error);
      return;
    }

    setEditingTransactionId(null);
    setApplyPrompt({ transaction, nextCategory });
  }, [reloadTransactions]);

  const handleOpenPreview = useCallback(async () => {
    if (!applyPrompt) return;

    const candidateRule: RuleInput = {
      pattern: applyPrompt.transaction.description,
      category: applyPrompt.nextCategory,
      matchType: 'contains',
    };

    setPreviewState({
      open: true,
      isLoading: true,
      isSubmitting: false,
      error: null,
      candidateRule,
      description: applyPrompt.transaction.description,
      nextCategory: applyPrompt.nextCategory,
      transactions: [],
    });
    setApplyPrompt(null);

    const previewResult = await webviewRPC.request.PREVIEW_RULE_MATCHES(candidateRule);
    if (!previewResult.ok) {
      setPreviewState((currentState) => ({
        ...currentState,
        isLoading: false,
        error: previewResult.error,
      }));
      return;
    }

    setPreviewState((currentState) => ({
      ...currentState,
      isLoading: false,
      transactions: previewResult.transactions,
    }));
  }, [applyPrompt]);

  const handlePreviewConfirm = useCallback(async () => {
    if (!previewState.candidateRule) return;

    setPreviewState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: null,
    }));

    const saveResult = await webviewRPC.request.SAVE_RULE(previewState.candidateRule);
    if (!saveResult.ok) {
      setPreviewState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: saveResult.error,
      }));
      return;
    }

    const applyResult = await webviewRPC.request.APPLY_RULE_TO_EXISTING_TRANSACTIONS(previewState.candidateRule);
    if (!applyResult.ok) {
      // Some NDJSON files may have already been updated before the failure.
      // Delete the rule so future imports are not affected, then surface an
      // honest error telling the user to verify their transactions.
      const rollbackResult = await webviewRPC.request.DELETE_RULE({ id: saveResult.rule.id });
      setPreviewState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: rollbackResult.ok
          ? `Apply failed — some transactions may have been partially updated. Please verify your data. (${applyResult.error})`
          : `Apply failed — some transactions may have been partially updated. Rule rollback also failed: ${rollbackResult.error}`,
      }));
      return;
    }

    const reloadResult = await reloadTransactions();
    if (!reloadResult.ok) {
      setPreviewState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: reloadResult.error,
      }));
      return;
    }

    closePreview();
  }, [closePreview, previewState.candidateRule, reloadTransactions]);

  function getAriaSortAttr(column: SortColumn): 'ascending' | 'descending' | 'none' {
    if (!sortState || sortState.column !== column) return 'none';
    return sortState.direction === 'asc' ? 'ascending' : 'descending';
  }

  function getNextSortActionLabel(column: SortColumn): string {
    if (!sortState || sortState.column !== column) return t('report.table.sortAsc');
    return sortState.direction === 'asc'
      ? t('report.table.sortDesc')
      : t('report.table.sortDefault');
  }

  const tableWidth = colWidths.date + colWidths.description + colWidths.category + colWidths.amount;
  const totalWidth = CHECKBOX_COL_WIDTH + tableWidth;

  const allVisibleSelected =
    sortedTransactions.length > 0 &&
    sortedTransactions.every((tx) => selectedTransactionIds.has(tx.id));
  const someVisibleSelected =
    !allVisibleSelected && sortedTransactions.some((tx) => selectedTransactionIds.has(tx.id));

  const visibleIds = useMemo(
    () => sortedTransactions.map((tx) => tx.id),
    [sortedTransactions],
  );

  const columns: { key: SortColumn; label: string; align: string; resizeBoundary?: ResizeBoundary }[] = [
    { key: 'date', label: t('report.table.col.date'), align: 'text-left', resizeBoundary: 'date' },
    { key: 'description', label: t('report.table.col.description'), align: 'text-left', resizeBoundary: 'description' },
    { key: 'category', label: t('report.table.col.category'), align: 'text-left', resizeBoundary: 'category' },
    { key: 'amount', label: t('report.table.col.amount'), align: 'text-right' },
  ];

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
      onClick={(e) => {
        // Click on empty table area (not a checkbox or row) → clear selection
        const target = e.target as HTMLElement;
        if (!target.closest('[data-checkbox]') && !target.closest('tr')) {
          clearSelection();
        }
      }}
    >
      {applyPrompt && !editingTransactionId ? (
        <div className="border-b border-border bg-muted/30 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {interpolate(t('rules.apply.prompt'), {
                description: applyPrompt.transaction.description,
              })}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setApplyPrompt(null)}>
                {t('rules.apply.skip')}
              </Button>
              <Button type="button" size="sm" onClick={() => void handleOpenPreview()}>
                {t('rules.apply.confirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <table
        className="w-full text-sm border-collapse"
        style={{ tableLayout: 'fixed' }}
      >
        <colgroup>
          {/* Checkbox column — fixed, not part of resize system */}
          <col style={{ width: `${CHECKBOX_COL_WIDTH}px` }} />
          <col style={{ width: `${(colWidths.date / totalWidth) * 100}%` }} />
          <col style={{ width: `${(colWidths.description / totalWidth) * 100}%` }} />
          <col style={{ width: `${(colWidths.category / totalWidth) * 100}%` }} />
          <col style={{ width: `${(colWidths.amount / totalWidth) * 100}%` }} />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-card border-b border-border">
          <tr>
            {/* Select-all header checkbox */}
            <th className="w-10 px-2 py-2 text-center" data-checkbox>
              <Checkbox
                data-checkbox
                checked={allVisibleSelected}
                data-indeterminate={someVisibleSelected || undefined}
                onCheckedChange={() => undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (allVisibleSelected) {
                    clearSelection();
                  } else {
                    setSelection(new Set(visibleIds));
                  }
                }}
                aria-label="Select all visible transactions"
                className={someVisibleSelected ? 'opacity-60' : ''}
              />
            </th>
            {columns.map(({ key, label, align, resizeBoundary }) => (
              <th
                key={key}
                role="columnheader"
                aria-sort={getAriaSortAttr(key)}
                className={`relative text-xs font-semibold text-muted-foreground uppercase tracking-wide ${align}`}
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-1 px-3 py-2 select-none transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${align === 'text-right' ? 'justify-end pr-5 text-right' : 'justify-start pr-5 text-left'}`}
                  aria-label={`${label}. ${getNextSortActionLabel(key)}`}
                  onClick={() => handleColumnClick(key)}
                >
                  <span>{label}</span>
                  {sortState?.column === key && (
                    <span aria-hidden="true" className="ml-1">
                      {sortState.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                {resizeBoundary && (
                  <div
                    aria-hidden="true"
                    className="absolute -right-1 top-0 z-20 flex h-full w-3 cursor-col-resize touch-none items-center justify-center hover:bg-border/60 active:bg-primary/50 transition-colors"
                    onMouseDown={(e) => {
                      document.body.style.cursor = 'col-resize';
                      document.body.style.userSelect = 'none';
                      handleResizeStart(e, resizeBoundary);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="h-6 w-px rounded-full bg-border/80" />
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((transaction, index) => {
            const isEditing = editingTransactionId === transaction.id;
            const isSelected = selectedTransactionIds.has(transaction.id);

            return (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                isSelected={isSelected}
                categoryDisplayName={displayName(transaction.category)}
                onContextMenu={(e) => handleContextMenu(transaction, e)}
                onCheckboxClick={(isShift: boolean) => {
                  toggleTransactionSelection(transaction.id, index, isShift, visibleIds);
                }}
                categoryCell={(
                  <InlineCategoryPicker
                    open={isEditing}
                    currentCategory={transaction.category}
                    categories={categoryOptions}
                    displayName={displayName}
                    error={isEditing ? inlineError : null}
                    isSubmitting={savingTransactionId === transaction.id}
                    onOpenChange={(open) => handleCategoryOpenChange(transaction.id, open)}
                    onConfirm={(nextCategory) => handleCategoryConfirm(transaction, nextCategory)}
                    trigger={(
                      <button
                        type="button"
                        className="rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={interpolate(t('rules.inlinePicker.triggerAriaLabel'), {
                          category: transaction.category,
                        })}
                        onClick={() => handleCategoryClick(transaction)}
                      >
                        {displayName(transaction.category)}
                      </button>
                    )}
                  />
                )}
              />
            );
          })}
        </tbody>
      </table>

      <RulePreviewDialog
        open={previewState.open}
        description={previewState.description}
        error={previewState.error}
        nextCategory={previewState.nextCategory}
        onClose={closePreview}
        onConfirm={handlePreviewConfirm}
        transactions={previewState.transactions}
        isLoading={previewState.isLoading}
        isSubmitting={previewState.isSubmitting}
      />

      {/* Per-row context menu portal (AC4–AC9) */}
      {ctxMenuOpen && ctxMenuTransactionId && (
        <RowContextMenu
          position={ctxMenuPos}
          menuRef={ctxMenuRef}
          onReassign={handleCtxMenuReassign}
          onDelete={handleCtxMenuDelete}
        />
      )}

      {/* Single-transaction delete confirmation dialog (AC3, AC6, AC10) */}
      <SingleDeleteConfirmDialog
        open={deleteDialogOpen}
        onConfirm={() => { void handleConfirmDelete(); }}
        onCancel={handleCancelDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
