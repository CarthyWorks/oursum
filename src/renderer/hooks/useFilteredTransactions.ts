import { useMemo } from 'react';
import type { Transaction } from '../../shared/types';
import { useFilterStore } from '../store/filter-store';
import { useReportStore } from '../store/report-store';

export interface ActiveTransactionFilters {
  dateFrom: string | null;
  dateTo: string | null;
  categories: string[];
  amountMin: number | null;
  amountMax: number | null;
}

export interface FilteredStats {
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
}

export function hasActiveTransactionFilters(filters: ActiveTransactionFilters): boolean {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.categories.length > 0 ||
      filters.amountMin !== null ||
      filters.amountMax !== null,
  );
}

export function filterTransactions(
  transactions: Transaction[],
  filters: ActiveTransactionFilters,
): Transaction[] {
  if (!hasActiveTransactionFilters(filters)) {
    return transactions;
  }

  return transactions.filter((transaction) => {
    if (filters.dateFrom && transaction.date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && transaction.date > filters.dateTo) {
      return false;
    }

    if (filters.categories.length > 0 && !filters.categories.includes(transaction.category)) {
      return false;
    }

    // Special-case: when user sets a single-sided filter to 0 we interpret
    // that as "signed" zero bound. E.g. amountMax === 0 should match
    // transactions with amount <= 0 (expenses), and amountMin === 0 should
    // match transactions with amount >= 0 (income). This preserves the
    // existing magnitude-based behavior for other ranges.
    if (filters.amountMin === null && filters.amountMax === 0) {
      if (transaction.amount > 0) {
        return false;
      }
      return true;
    }

    if (filters.amountMax === null && filters.amountMin === 0) {
      if (transaction.amount < 0) {
        return false;
      }
      return true;
    }

    const absoluteAmount = Math.abs(transaction.amount);

    if (filters.amountMin !== null && absoluteAmount < filters.amountMin) {
      return false;
    }

    if (filters.amountMax !== null && absoluteAmount > filters.amountMax) {
      return false;
    }

    return true;
  });
}

export function computeFilteredStats(transactions: Transaction[]): FilteredStats {
  let totalExpenses = 0;
  let totalIncome = 0;

  for (const transaction of transactions) {
    if (transaction.amount < 0) {
      totalExpenses += Math.abs(transaction.amount);
    } else {
      totalIncome += transaction.amount;
    }
  }

  return {
    totalExpenses,
    totalIncome,
    netBalance: totalIncome - totalExpenses,
  };
}

export function useFilteredTransactions(): Transaction[] {
  const transactions = useReportStore((state) => state.allTransactions);
  const dateFrom = useFilterStore((state) => state.dateFrom);
  const dateTo = useFilterStore((state) => state.dateTo);
  const categories = useFilterStore((state) => state.categories);
  const amountMin = useFilterStore((state) => state.amountMin);
  const amountMax = useFilterStore((state) => state.amountMax);

  return useMemo(
    () => filterTransactions(transactions, { dateFrom, dateTo, categories, amountMin, amountMax }),
    [transactions, dateFrom, dateTo, categories, amountMin, amountMax],
  );
}

export function useFilteredStats(filteredTransactions: Transaction[]): FilteredStats {
  return useMemo(
    () => computeFilteredStats(filteredTransactions),
    [filteredTransactions],
  );
}