import { describe, expect, test } from 'bun:test';
import type { Transaction } from '../../shared/types';
import {
  computeFilteredStats,
  filterTransactions,
  hasActiveTransactionFilters,
} from './useFilteredTransactions';

const transactions: Transaction[] = [
  {
    id: '1',
    date: '2026-03-05',
    amount: -50,
    description: 'Groceries',
    category: 'Groceries',
    accountId: '',
    importFile: 'sample.ndjson',
    notes: '',
  },
  {
    id: '2',
    date: '2026-02-15',
    amount: -20,
    description: 'Coffee',
    category: 'Dining',
    accountId: '',
    importFile: 'sample.ndjson',
    notes: '',
  },
  {
    id: '3',
    date: '2026-03-11',
    amount: 200,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: 'sample.ndjson',
    notes: '',
  },
];

describe('useFilteredTransactions helpers', () => {
  test('detects when filters are inactive', () => {
    expect(hasActiveTransactionFilters({
      dateFrom: null,
      dateTo: null,
      categories: [],
      amountMin: null,
      amountMax: null,
    })).toBe(false);
  });

  test('returns the original array when no filters are active', () => {
    const filtered = filterTransactions(transactions, {
      dateFrom: null,
      dateTo: null,
      categories: [],
      amountMin: null,
      amountMax: null,
    });

    expect(filtered).toBe(transactions);
  });

  test('applies period, category, and amount filters with AND logic', () => {
    const filtered = filterTransactions(transactions, {
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      categories: ['Groceries', 'Income'],
      amountMin: 40,
      amountMax: 60,
    });

    expect(filtered).toEqual([transactions[0]]);
  });

  test('computes filtered stats from the matching transactions', () => {
    expect(computeFilteredStats([transactions[0], transactions[2]])).toEqual({
      totalExpenses: 50,
      totalIncome: 200,
      netBalance: 150,
    });
  });

  test('amountMax = 0 matches expenses (signed <= 0)', () => {
    const filtered = filterTransactions(transactions, {
      dateFrom: null,
      dateTo: null,
      categories: [],
      amountMin: null,
      amountMax: 0,
    });

    expect(filtered).toEqual([transactions[0], transactions[1]]);
  });
});