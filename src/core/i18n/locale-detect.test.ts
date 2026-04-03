// src/core/i18n/locale-detect.test.ts
import { describe, expect, test } from 'bun:test';
import { detectOSLocale } from './locale-detect';
import { SupportedLanguage } from './types';

describe('detectOSLocale()', () => {
  test('returns an object with all 4 LocaleSettings fields present', () => {
    const result = detectOSLocale();
    expect(result).toHaveProperty('language');
    expect(result).toHaveProperty('numberFormat');
    expect(result).toHaveProperty('dateFormat');
    expect(result).toHaveProperty('currencySymbol');
  });

  test('result.language is a valid SupportedLanguage enum value', () => {
    const result = detectOSLocale();
    const validValues = Object.values(SupportedLanguage);
    expect(validValues).toContain(result.language);
  });

  test('result.numberFormat is one of the 3 supported format strings', () => {
    const result = detectOSLocale();
    const validFormats = ['1,234.56', '1.234,56', '1 234,56'];
    expect(validFormats).toContain(result.numberFormat);
  });

  test('result.dateFormat is one of the 2 supported date format strings', () => {
    const result = detectOSLocale();
    const validFormats = ['dd/mm/yyyy', 'mm/dd/yyyy'];
    expect(validFormats).toContain(result.dateFormat);
  });

  test('result.currencySymbol is a non-undefined string', () => {
    const result = detectOSLocale();
    expect(typeof result.currencySymbol).toBe('string');
    expect(result.currencySymbol).not.toBeUndefined();
  });

  test('always returns a complete object (never throws)', () => {
    expect(() => detectOSLocale()).not.toThrow();
  });
});
