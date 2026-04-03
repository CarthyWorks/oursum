// src/core/persistence/defaults.ts
// Zero side effects: no file I/O, no require(), no dynamic imports, no network.
import type { Category, Preferences } from '../../shared/types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries',     name: 'Groceries',     color: '#4CAF50', icon: 'shopping-cart' },
  { id: 'transport',     name: 'Transport',      color: '#2196F3', icon: 'car' },
  { id: 'eating-out',    name: 'Eating out',     color: '#FF9800', icon: 'utensils' },
  { id: 'entertainment', name: 'Entertainment',  color: '#9C27B0', icon: 'film' },
  { id: 'health',        name: 'Health',         color: '#F44336', icon: 'heart' },
  { id: 'housing',       name: 'Housing',        color: '#607D8B', icon: 'home' },
  { id: 'others',        name: 'Others',         color: '#9E9E9E', icon: 'tag' }, // MUST be last — reserved catch-all (FR13)
];

export const DEFAULT_PREFERENCES: Preferences = {
  language: 'en',
  numberFormat: '1,234.56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
  theme: 'mountain',
};
