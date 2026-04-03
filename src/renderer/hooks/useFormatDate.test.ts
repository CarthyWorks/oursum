import { describe, expect, test } from 'bun:test';
import { formatDateForDisplay } from './useFormatDate';
import { SupportedLanguage, type LocaleSettings } from '../../core/i18n/types';

const baseLocale: LocaleSettings = {
  language: SupportedLanguage.EN,
  numberFormat: '1,234.56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
};

describe('formatDateForDisplay', () => {
  test('renders dd/mm/yyyy when that format is selected', () => {
    expect(formatDateForDisplay('2025-03-07', baseLocale)).toBe('07/03/2025');
  });

  test('renders mm/dd/yyyy when that format is selected', () => {
    expect(
      formatDateForDisplay('2025-03-07', {
        ...baseLocale,
        dateFormat: 'mm/dd/yyyy',
      })
    ).toBe('03/07/2025');
  });

  test('renders yyyy-mm-dd when that format is selected', () => {
    expect(
      formatDateForDisplay('2025-03-07', {
        ...baseLocale,
        dateFormat: 'yyyy-mm-dd',
      })
    ).toBe('2025-03-07');
  });
});