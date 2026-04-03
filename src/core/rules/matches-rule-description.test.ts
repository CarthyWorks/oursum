import { describe, expect, test } from 'bun:test';
import { matchesRuleDescription } from './matches-rule-description';

describe('matchesRuleDescription()', () => {
  test('contains: matches when pattern is a substring (case-insensitive)', () => {
    expect(
      matchesRuleDescription('SUPERMERCATO COOP', { pattern: 'coop', matchType: 'contains' }),
    ).toBe(true);
  });

  test('contains: returns false when pattern is not present', () => {
    expect(
      matchesRuleDescription('Amazon Prime', { pattern: 'netflix', matchType: 'contains' }),
    ).toBe(false);
  });

  test('startsWith: matches when description begins with pattern (case-insensitive)', () => {
    expect(
      matchesRuleDescription('Amazon Prime', { pattern: 'amazon', matchType: 'startsWith' }),
    ).toBe(true);
  });

  test('startsWith: returns false when description does not start with pattern', () => {
    expect(
      matchesRuleDescription('Pay Amazon Prime', { pattern: 'amazon', matchType: 'startsWith' }),
    ).toBe(false);
  });

  test('regex: matches a valid pattern (case-insensitive)', () => {
    expect(
      matchesRuleDescription('SUPERMERCATO COOP', { pattern: '^supermercato', matchType: 'regex' }),
    ).toBe(true);
  });

  test('regex: returns false when description does not match pattern', () => {
    expect(
      matchesRuleDescription('Amazon Prime', { pattern: '^netflix', matchType: 'regex' }),
    ).toBe(false);
  });

  test('regex: invalid patterns fail closed and are cached as null', () => {
    const cache = new Map<string, RegExp | null>();

    expect(
      matchesRuleDescription('anything', { pattern: '[', matchType: 'regex' }, cache),
    ).toBe(false);
    expect(cache.get('[')).toBeNull();

    // Second call reuses cached null — no re-throw
    expect(
      matchesRuleDescription('anything', { pattern: '[', matchType: 'regex' }, cache),
    ).toBe(false);
  });

  test('contains: empty pattern matches every description', () => {
    expect(
      matchesRuleDescription('anything', { pattern: '', matchType: 'contains' }),
    ).toBe(true);
  });
});