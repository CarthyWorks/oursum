// src/core/i18n/format.ts
// RULE: No Intl.* APIs anywhere in this file — pure string manipulation only.
import type { LocaleSettings } from './types';

function parseFormatSeparators(template: string): { thousands: string; decimal: string } {
  // Template is always one of: '1,234.56' | '1.234,56' | '1 234,56'
  // Position [1] is always the thousands separator character
  // Position [5] is always the decimal separator character
  return { thousands: template[1], decimal: template[5] };
}

export function formatAmount(amount: number, locale: LocaleSettings): string {
  const { thousands, decimal } = parseFormatSeparators(locale.numberFormat);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);           // e.g. "42.50" or "1234.56"
  const [intPart, fracPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const formatted = `${intFormatted}${decimal}${fracPart}`;
  const withSign = negative ? `-${formatted}` : formatted;
  return locale.currencySymbol
    ? `${withSign} ${locale.currencySymbol}`
    : withSign;
}

export function formatDate(isoDate: string, locale: LocaleSettings): string {
  // isoDate is always "YYYY-MM-DD" — split to get parts
  const [year, month, day] = isoDate.split('-');
  switch (locale.dateFormat) {
    case 'dd/mm/yyyy': return `${day}/${month}/${year}`;
    case 'mm/dd/yyyy': return `${month}/${day}/${year}`;
    case 'yyyy-mm-dd': return isoDate;
    default:           return isoDate;
  }
}
