// src/renderer/lib/sparkline-utils.ts
// Pure sparkline computation — no imports from src/core/ (ADR-005 boundary).
// No React — renderer-only transforms on in-memory data.
import type { Transaction } from '../../shared/types';

export type SparklinePoint = {
  year: number;
  month: number; // 0-indexed (0 = January … 11 = December)
  net: number;
};

/**
 * Groups transactions by calendar month and returns one SparklinePoint per
 * month sorted chronologically (oldest → newest).
 *
 * Grouping key: `transaction.date.substring(0, 7)` → "YYYY-MM"
 * Net per month: sum of all amounts (sign-preserving — negatives subtract).
 */
export function computeSparklineData(transactions: Transaction[]): SparklinePoint[] {
  const monthMap = new Map<number, number>();

  for (const t of transactions) {
    const year = Number(t.date.substring(0, 4));
    const month = Number(t.date.substring(5, 7)) - 1; // convert 1-indexed to 0-indexed
    const key = year * 12 + month;
    monthMap.set(key, (monthMap.get(key) ?? 0) + t.amount);
  }

  if (monthMap.size === 0) {
    return [];
  }

  const monthKeys = Array.from(monthMap.keys()).sort((left, right) => left - right);
  const firstKey = monthKeys[0];
  const lastKey = monthKeys[monthKeys.length - 1];
  const points: SparklinePoint[] = [];

  for (let key = firstKey; key <= lastKey; key += 1) {
    points.push({
      year: Math.floor(key / 12),
      month: key % 12,
      net: monthMap.get(key) ?? 0,
    });
  }

  return points;
}

/**
 * Returns true only when there are at least 2 data points — the minimum
 * required to draw a meaningful sparkline (AC5 empty-state gate).
 */
export function hasEnoughSparklineData(points: SparklinePoint[]): boolean {
  return points.length >= 2;
}

/**
 * Returns the min/max net values across all points, used to normalise the
 * Y-axis in SVG rendering. Expands by ±1 when all values are equal to
 * prevent division-by-zero during coordinate normalisation.
 */
export function getSparklineBounds(points: SparklinePoint[]): { min: number; max: number } {
  const nets = points.map((p) => p.net);
  const min = Math.min(...nets);
  const max = Math.max(...nets);

  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  return { min, max };
}
