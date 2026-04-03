// src/renderer/hooks/useFormatAmount.ts
import { useCallback } from 'react';
import { useLocale } from '../context/locale-context';
import { formatAmount } from '../../core/i18n/format';

/**
 * Returns a stable formatter function bound to the current locale.
 * Re-creates when locale changes; stable while locale is unchanged.
 */
export function useFormatAmount(): (amount: number) => string {
  const locale = useLocale();
  return useCallback((amount: number) => formatAmount(amount, locale), [locale]);
}
