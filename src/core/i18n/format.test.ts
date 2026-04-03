// src/core/i18n/format.test.ts
import { describe, test, expect } from 'bun:test';
import { formatAmount, formatDate } from './format';
import { SupportedLanguage, type LocaleSettings } from './types';

const italianLocale: LocaleSettings = {
  language: SupportedLanguage.IT,
  numberFormat: '1.234,56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
};

const englishLocale: LocaleSettings = {
  language: SupportedLanguage.EN,
  numberFormat: '1,234.56',
  dateFormat: 'mm/dd/yyyy',
  currencySymbol: '',
};

const frenchLocale: LocaleSettings = {
  language: SupportedLanguage.FR,
  numberFormat: '1 234,56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
};

describe('formatAmount', () => {
  test('negative Italian amount with currency symbol', () => {
    expect(formatAmount(-42.50, italianLocale)).toBe('-42,50 €');
  });
  test('positive English amount without currency symbol', () => {
    expect(formatAmount(1234.56, englishLocale)).toBe('1,234.56');
  });
  test('large number with multiple thousands groups (Italian)', () => {
    expect(formatAmount(1234567.89, italianLocale)).toBe('1.234.567,89 €');
  });
  test('zero amount (Italian)', () => {
    expect(formatAmount(0, italianLocale)).toBe('0,00 €');
  });
  test('French space thousands separator', () => {
    expect(formatAmount(1234.50, frenchLocale)).toBe('1 234,50 €');
  });
  test('currency symbol appended with space', () => {
    expect(formatAmount(1234.56, { ...englishLocale, currencySymbol: '$' })).toBe('1,234.56 $');
  });
});

describe('formatDate', () => {
  test('dd/mm/yyyy format', () => {
    expect(formatDate('2025-03-07', { ...italianLocale, dateFormat: 'dd/mm/yyyy' })).toBe('07/03/2025');
  });
  test('mm/dd/yyyy format', () => {
    expect(formatDate('2025-03-07', { ...englishLocale, dateFormat: 'mm/dd/yyyy' })).toBe('03/07/2025');
  });
  test('yyyy-mm-dd format — ISO passthrough', () => {
    expect(formatDate('2025-03-07', { ...italianLocale, dateFormat: 'yyyy-mm-dd' })).toBe('2025-03-07');
  });
  test('December date — two-digit month and day', () => {
    expect(formatDate('2025-12-25', { ...italianLocale, dateFormat: 'dd/mm/yyyy' })).toBe('25/12/2025');
  });
});
