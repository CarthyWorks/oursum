import type { LocaleSettings } from '../../core/i18n/types';

export type PeriodPreset = 'this-month' | 'last-3-months' | 'this-year' | 'all-time';

type MonthRef = {
  year: number;
  month: number;
};

/** Maps two-letter language codes to full BCP-47 locale tags for Intl formatting. */
export const LOCALE_TAGS: Record<string, string> = {
  en: 'en-GB',
  it: 'it-IT',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function toISODateParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function getMonthBoundary(year: number, month: number): MonthRef {
  const normalized = new Date(Date.UTC(year, month, 1));
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth(),
  };
}

export function computePeriodBounds(
  preset: PeriodPreset,
  referenceDate: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  switch (preset) {
    case 'this-month':
      return {
        dateFrom: firstDayOfMonth(currentYear, currentMonth),
        dateTo: lastDayOfMonth(currentYear, currentMonth),
      };
    case 'last-3-months': {
      const start = getMonthBoundary(currentYear, currentMonth - 2);
      return {
        dateFrom: firstDayOfMonth(start.year, start.month),
        dateTo: lastDayOfMonth(currentYear, currentMonth),
      };
    }
    case 'this-year':
      return {
        dateFrom: `${currentYear}-01-01`,
        dateTo: `${currentYear}-12-31`,
      };
    case 'all-time':
      return { dateFrom: '', dateTo: '' };
  }
}

export function formatMonthLabel(year: number, month: number, locale: LocaleSettings): string {
  const localeTag = LOCALE_TAGS[locale.language] ?? locale.language;
  return new Intl.DateTimeFormat(localeTag, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, month, 1)))
    .replace(',', '');
}

export function getLast24Months(referenceDate: Date = new Date()): Array<{ year: number; month: number }> {
  const result: Array<{ year: number; month: number }> = [];

  for (let offset = 0; offset < 24; offset += 1) {
    const month = getMonthBoundary(referenceDate.getFullYear(), referenceDate.getMonth() - offset);
    result.push(month);
  }

  return result;
}

export function firstDayOfMonth(year: number, month: number): string {
  const normalized = getMonthBoundary(year, month);
  return toISODateParts(normalized.year, normalized.month, 1);
}

export function lastDayOfMonth(year: number, month: number): string {
  const normalized = getMonthBoundary(year, month);
  const lastDay = new Date(Date.UTC(normalized.year, normalized.month + 1, 0)).getUTCDate();
  return toISODateParts(normalized.year, normalized.month, lastDay);
}