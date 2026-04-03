// src/renderer/store/filter-store.ts
// Zustand filter state — which transactions are visible.
// RULE: Always use selectors — never subscribe to full store.
import { create } from "zustand";
import { computePeriodBounds, type PeriodPreset } from '../lib/period-utils';

interface FilterState {
  dateFrom: string | null;
  dateTo: string | null;
  categories: string[];
  searchQuery: string;
  periodPreset: PeriodPreset | null;
  amountMin: number | null;
  amountMax: number | null;
  setDateFrom: (date: string | null) => void;
  setDateTo: (date: string | null) => void;
  setCategories: (categories: string[]) => void;
  setSearchQuery: (query: string) => void;
  setPeriodPreset: (preset: PeriodPreset) => void;
  setCustomDateRange: (from: string, to: string) => void;
  setAmountRange: (min: number | null, max: number | null) => void;
  clearPeriod: () => void;
  clearCategories: () => void;
  clearAmountRange: () => void;
  resetFilters: () => void;
}

const initialState = {
  dateFrom: null,
  dateTo: null,
  categories: [] as string[],
  searchQuery: "",
  periodPreset: null as PeriodPreset | null,
  amountMin: null as number | null,
  amountMax: null as number | null,
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  setDateFrom: (date) => set({ dateFrom: date }),
  setDateTo: (date) => set({ dateTo: date }),
  setCategories: (categories) => set({ categories }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPeriodPreset: (preset) => {
    const { dateFrom, dateTo } = computePeriodBounds(preset);
    set({
      periodPreset: preset,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  },
  setCustomDateRange: (from, to) => set({
    periodPreset: null,
    dateFrom: from,
    dateTo: to,
  }),
  setAmountRange: (min, max) => set({ amountMin: min, amountMax: max }),
  clearPeriod: () => set({ periodPreset: null, dateFrom: null, dateTo: null }),
  clearCategories: () => set({ categories: [] }),
  clearAmountRange: () => set({ amountMin: null, amountMax: null }),
  resetFilters: () => set(initialState),
}));
