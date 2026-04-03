// src/core/i18n/loader.test.ts
import { describe, test, expect } from 'bun:test';
import { loadDictionary, type Dictionary } from './loader';
import { SupportedLanguage } from './types';
import type { Result } from '../../shared/contracts/result';

describe('loadDictionary', () => {
  test('loads English dictionary successfully', async () => {
    const result = await loadDictionary(SupportedLanguage.EN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data).toBe('object');
    expect(Object.keys(result.data).length).toBeGreaterThan(0);
  });

  test('loads Italian dictionary successfully', async () => {
    const result = await loadDictionary(SupportedLanguage.IT);
    expect(result.ok).toBe(true);
  });

  test('loads German dictionary successfully', async () => {
    const result = await loadDictionary(SupportedLanguage.DE);
    expect(result.ok).toBe(true);
  });

  test('loads French dictionary successfully', async () => {
    const result = await loadDictionary(SupportedLanguage.FR);
    expect(result.ok).toBe(true);
  });

  test('loads Spanish dictionary successfully', async () => {
    const result = await loadDictionary(SupportedLanguage.ES);
    expect(result.ok).toBe(true);
  });

  test('all dictionaries have identical key sets', async () => {
    const results = await Promise.all(
      Object.values(SupportedLanguage).map((lang) => loadDictionary(lang))
    );
    const keys = results.map((r: Result<Dictionary>) => {
      expect(r.ok).toBe(true);
      if (!r.ok) return '';
      return Object.keys(r.data).sort().join(',');
    });
    const allMatch = keys.every((k: string) => k === keys[0]);
    expect(allMatch).toBe(true);
  });

  test('all dictionary values are strings', async () => {
    const result = await loadDictionary(SupportedLanguage.EN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allStrings = Object.values(result.data).every((v) => typeof v === 'string');
    expect(allStrings).toBe(true);
  });
});
