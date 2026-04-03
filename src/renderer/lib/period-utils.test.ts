import { describe, expect, test } from 'bun:test';
import { SupportedLanguage, type LocaleSettings } from '../../core/i18n/types';
import {
  computePeriodBounds,
  firstDayOfMonth,
  formatMonthLabel,
  getLast24Months,
  lastDayOfMonth,
} from './period-utils';

const locale: LocaleSettings = {
  language: SupportedLanguage.EN,
  numberFormat: '1,234.56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
};

describe('period-utils', () => {
  test('computes this-month bounds', () => {
    expect(computePeriodBounds('this-month', new Date('2026-03-14T12:00:00Z'))).toEqual({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });
  });

  test('computes last-3-months bounds', () => {
    expect(computePeriodBounds('last-3-months', new Date('2026-03-14T12:00:00Z'))).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    });
  });

  test('computes this-year bounds', () => {
    expect(computePeriodBounds('this-year', new Date('2026-03-14T12:00:00Z'))).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
  });

  test('returns empty strings for all-time preset', () => {
    expect(computePeriodBounds('all-time')).toEqual({
      dateFrom: '',
      dateTo: '',
    });
  });

  test('formats month labels with Intl', () => {
    expect(formatMonthLabel(2026, 0, locale)).toBe('Jan 26');
  });

  test('returns the last 24 months in reverse chronological order', () => {
    const months = getLast24Months(new Date('2026-03-14T12:00:00Z'));
    expect(months).toHaveLength(24);
    expect(months[0]).toEqual({ year: 2026, month: 2 });
    expect(months[23]).toEqual({ year: 2024, month: 3 });
  });

  test('builds month boundary iso dates', () => {
    expect(firstDayOfMonth(2026, 1)).toBe('2026-02-01');
    expect(lastDayOfMonth(2026, 1)).toBe('2026-02-28');
  });
});