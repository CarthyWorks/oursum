// src/renderer/store/report-store.ts
// Zustand store for the complete in-memory transaction dataset.
// RULE: Always use selector pattern — never subscribe to full store.
import { create } from 'zustand';
import type { Category, Transaction } from '../../shared/types';

interface ReportState {
  allTransactions: Transaction[];
  isTransactionsLoaded: boolean;
  setTransactions: (transactions: Transaction[]) => void;
  allCategories: Category[];
  isCategoriesLoaded: boolean;
  setAllCategories: (categories: Category[]) => void;
  // Multi-row selection state (Story 4.2)
  selectedTransactionIds: Set<string>;
  lastSelectedIndex: number | null;
  lastSelectedId: string | null;
  toggleTransactionSelection: (id: string, index: number, isShift: boolean, visibleIds: string[]) => void;
  clearSelection: () => void;
  setSelection: (ids: Set<string>) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  allTransactions: [],
  isTransactionsLoaded: false,
  setTransactions: (transactions) =>
    set({ allTransactions: transactions, isTransactionsLoaded: true }),
  allCategories: [],
  isCategoriesLoaded: false,
  setAllCategories: (categories) =>
    set({ allCategories: categories, isCategoriesLoaded: true }),
  // Multi-row selection
  selectedTransactionIds: new Set(),
  lastSelectedIndex: null,
  lastSelectedId: null,
  toggleTransactionSelection: (id, clickedIndex, isShift, visibleIds) =>
    set((state) => {
      const next = new Set(state.selectedTransactionIds);

      const anchorIndex =
        state.lastSelectedId !== null
          ? visibleIds.indexOf(state.lastSelectedId)
          : state.lastSelectedIndex;

      if (isShift && anchorIndex !== null && anchorIndex >= 0) {
        const from = Math.min(anchorIndex, clickedIndex);
        const to = Math.max(anchorIndex, clickedIndex);
        for (let i = from; i <= to; i++) {
          if (visibleIds[i]) next.add(visibleIds[i]);
        }
        // Do NOT update lastSelectedIndex on shift-click — anchor stays fixed
        return { selectedTransactionIds: next };
      }

      // Toggle single
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return {
        selectedTransactionIds: next,
        lastSelectedIndex: clickedIndex,
        lastSelectedId: id,
      };
    }),
  clearSelection: () =>
    set({ selectedTransactionIds: new Set(), lastSelectedIndex: null, lastSelectedId: null }),
  setSelection: (ids) =>
    set({ selectedTransactionIds: new Set(ids), lastSelectedIndex: null, lastSelectedId: null }),
}));
