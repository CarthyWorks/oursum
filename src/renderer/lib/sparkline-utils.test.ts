import { describe, expect, test } from 'bun:test';
import type { Transaction } from '../../shared/types';
import {
  computeSparklineData,
  hasEnoughSparklineData,
  getSparklineBounds,
} from './sparkline-utils';

function makeTx(date: string, amount: number): Transaction {
  return {
    id: `${date}|${amount}|test|0`,
    date,
    amount,
    description: 'test',
    category: 'Test',
    accountId: '',
    importFile: 'test.ndjson',
    notes: '',
  };
}

describe('computeSparklineData', () => {
  test('returns empty array for empty input', () => {
    expect(computeSparklineData([])).toEqual([]);
  });

  test('returns one point for a single transaction', () => {
    const result = computeSparklineData([makeTx('2026-03-15', -50)]);
    expect(result).toEqual([{ year: 2026, month: 2, net: -50 }]);
  });

  test('groups multiple transactions in the same month', () => {
    const txs = [
      makeTx('2026-03-01', -100),
      makeTx('2026-03-15', 200),
      makeTx('2026-03-31', -25),
    ];
    const result = computeSparklineData(txs);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ year: 2026, month: 2, net: 75 });
  });

  test('sorts points chronologically when months are not in order', () => {
    const txs = [
      makeTx('2026-05-01', 10),
      makeTx('2026-03-01', 20),
      makeTx('2026-04-01', 30),
    ];
    const result = computeSparklineData(txs);
    expect(result.map((p) => p.month)).toEqual([2, 3, 4]);
  });

  test('handles mixed income and expense months', () => {
    const txs = [
      makeTx('2026-01-10', 1000), // income
      makeTx('2026-02-05', -300), // expense
      makeTx('2026-02-20', -150), // expense
    ];
    const result = computeSparklineData(txs);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ year: 2026, month: 0, net: 1000 });
    expect(result[1]).toMatchObject({ year: 2026, month: 1, net: -450 });
  });

  test('fills missing calendar months in the visible range with zero-net points', () => {
    const txs = [
      makeTx('2026-01-10', -75),
      makeTx('2026-03-11', 1200),
    ];

    expect(computeSparklineData(txs)).toEqual([
      { year: 2026, month: 0, net: -75 },
      { year: 2026, month: 1, net: 0 },
      { year: 2026, month: 2, net: 1200 },
    ]);
  });

  test('handles two months with identical sign (all expenses)', () => {
    const txs = [
      makeTx('2026-01-01', -200),
      makeTx('2026-02-01', -300),
    ];
    const result = computeSparklineData(txs);
    expect(result[0].net).toBe(-200);
    expect(result[1].net).toBe(-300);
  });

  test('groups last day of one month and first day of next month separately', () => {
    const txs = [
      makeTx('2026-01-31', -100), // January
      makeTx('2026-02-01', -200), // February
    ];
    const result = computeSparklineData(txs);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ year: 2026, month: 0, net: -100 });
    expect(result[1]).toMatchObject({ year: 2026, month: 1, net: -200 });
  });

  test('sorts correctly across year boundaries', () => {
    const txs = [
      makeTx('2027-01-01', 50),
      makeTx('2026-12-01', 60),
    ];
    const result = computeSparklineData(txs);
    expect(result[0]).toMatchObject({ year: 2026, month: 11 });
    expect(result[1]).toMatchObject({ year: 2027, month: 0 });
  });
});

describe('hasEnoughSparklineData', () => {
  test('returns false for empty array', () => {
    expect(hasEnoughSparklineData([])).toBe(false);
  });

  test('returns false for single point', () => {
    expect(hasEnoughSparklineData([{ year: 2026, month: 0, net: 100 }])).toBe(false);
  });

  test('returns true for two points', () => {
    const points = [
      { year: 2026, month: 0, net: 100 },
      { year: 2026, month: 1, net: -50 },
    ];
    expect(hasEnoughSparklineData(points)).toBe(true);
  });

  test('returns true for more than two points', () => {
    const points = [
      { year: 2026, month: 0, net: 100 },
      { year: 2026, month: 1, net: -50 },
      { year: 2026, month: 2, net: 200 },
    ];
    expect(hasEnoughSparklineData(points)).toBe(true);
  });
});

describe('getSparklineBounds', () => {
  test('returns correct min and max for mixed values', () => {
    const points = [
      { year: 2026, month: 0, net: 100 },
      { year: 2026, month: 1, net: -50 },
      { year: 2026, month: 2, net: 200 },
    ];
    expect(getSparklineBounds(points)).toEqual({ min: -50, max: 200 });
  });

  test('expands by ±1 when all values are equal (prevents division by zero)', () => {
    const points = [
      { year: 2026, month: 0, net: 100 },
      { year: 2026, month: 1, net: 100 },
    ];
    expect(getSparklineBounds(points)).toEqual({ min: 99, max: 101 });
  });

  test('expands by ±1 when all values are equal to zero', () => {
    const points = [
      { year: 2026, month: 0, net: 0 },
      { year: 2026, month: 1, net: 0 },
    ];
    expect(getSparklineBounds(points)).toEqual({ min: -1, max: 1 });
  });

  test('handles all-negative values', () => {
    const points = [
      { year: 2026, month: 0, net: -300 },
      { year: 2026, month: 1, net: -100 },
    ];
    expect(getSparklineBounds(points)).toEqual({ min: -300, max: -100 });
  });
});
