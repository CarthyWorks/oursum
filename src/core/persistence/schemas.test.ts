// src/core/persistence/schemas.test.ts
import { describe, test, expect } from 'bun:test';
import {
  parseCategories,
  parsePreferences,
  parseRules,
  parseProfiles,
} from './schemas';

describe('parseCategories', () => {
  test('valid category array returns ok with typed data', () => {
    const raw = [
      { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
    ];
    const result = parseCategories(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].id).toBe('groceries');
    }
  });

  test('category missing color field returns err', () => {
    const raw = [{ id: 'groceries', name: 'Groceries', icon: 'shopping-cart' }];
    const result = parseCategories(raw);
    expect(result.ok).toBe(false);
  });
});

describe('parsePreferences', () => {
  test('preferences missing theme field returns err', () => {
    const raw = {
      language: 'en',
      numberFormat: '1,234.56',
      dateFormat: 'dd/mm/yyyy',
      currencySymbol: '€',
      // theme missing
    };
    const result = parsePreferences(raw);
    expect(result.ok).toBe(false);
  });

  test('preferences with unknown extra field succeeds (strip by default)', () => {
    const raw = {
      language: 'en',
      numberFormat: '1,234.56',
      dateFormat: 'dd/mm/yyyy',
      currencySymbol: '€',
      theme: 'mountain',
      unknownField: 'extra',
    };
    const result = parsePreferences(raw);
    expect(result.ok).toBe(true);
  });
});

describe('parseRules', () => {
  test('rule with invalid matchType value returns err', () => {
    const raw = [
      {
        id: 'r1',
        pattern: 'amazon',
        category: 'shopping',
        matchType: 'invalidType',
      },
    ];
    const result = parseRules(raw);
    expect(result.ok).toBe(false);
  });

  test('rule with valid matchType returns ok', () => {
    const raw = [
      {
        id: 'r1',
        pattern: 'amazon',
        category: 'shopping',
        matchType: 'contains',
      },
    ];
    const result = parseRules(raw);
    expect(result.ok).toBe(true);
  });
});

describe('parseProfiles', () => {
  test('profile with headerRowOffset: 0 returns ok', () => {
    const raw = [
      {
        id: 'p1',
        name: 'My Bank',
        bankName: 'My Bank',
        csvDelimiter: ',',
        columnMap: { date: 'Date', amount: 'Amount' },
        dateFormat: 'dd/mm/yyyy',
        amountMultiplier: 1,
        headerRowOffset: 0,
        fingerprint: 'a'.repeat(64), // SHA-256 hex placeholder (64 chars)
      },
    ];
    const result = parseProfiles(raw);
    expect(result.ok).toBe(true);
  });
});
