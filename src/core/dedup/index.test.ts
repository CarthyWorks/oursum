// src/core/dedup/index.test.ts
import { describe, test, expect } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  computeTransactionFingerprint,
  assignOccurrenceIndices,
  loadExistingFingerprints,
  deduplicateRows,
} from './index';
import { withTestDataFolder } from '../persistence/test-utils';
import { atomicWrite } from '../persistence/utils';

// ── Task 2.1: computeTransactionFingerprint ───────────────────────────────────

describe('computeTransactionFingerprint', () => {
  test('returns correct format for index 0', () => {
    const result = computeTransactionFingerprint('2025-01-15', -42.5, 'Coffee Shop', 0);
    expect(result).toBe('2025-01-15|-42.5|Coffee Shop|0');
  });

  test('returns correct format for index 1', () => {
    const result = computeTransactionFingerprint('2025-01-15', -42.5, 'Coffee Shop', 1);
    expect(result).toBe('2025-01-15|-42.5|Coffee Shop|1');
  });

  test('handles positive amount (income)', () => {
    const result = computeTransactionFingerprint('2026-03-10', 1200, 'Salary', 0);
    expect(result).toBe('2026-03-10|1200|Salary|0');
  });

  test('preserves description exactly (no trimming or lowercasing)', () => {
    const result = computeTransactionFingerprint('2025-06-01', -10, '  RAW DESC  ', 0);
    expect(result).toBe('2025-06-01|-10|  RAW DESC  |0');
  });
});

// ── Task 2.2: assignOccurrenceIndices ─────────────────────────────────────────

describe('assignOccurrenceIndices', () => {
  test('single unique row gets occurrenceIndex 0', () => {
    const rows = [{ date: '2025-01-01', amount: -10, description: 'Coffee' }];
    const result = assignOccurrenceIndices(rows);
    expect(result).toEqual([{ row: rows[0], occurrenceIndex: 0 }]);
  });

  test('two rows with same triplet get indices 0 then 1', () => {
    const row = { date: '2025-01-01', amount: -10, description: 'Coffee' };
    const result = assignOccurrenceIndices([row, row]);
    expect(result[0].occurrenceIndex).toBe(0);
    expect(result[1].occurrenceIndex).toBe(1);
  });

  test('three rows: first two identical, third different → [0, 1, 0]', () => {
    const dupRow = { date: '2025-01-01', amount: -10, description: 'Coffee' };
    const uniqueRow = { date: '2025-01-02', amount: -20, description: 'Lunch' };
    const result = assignOccurrenceIndices([dupRow, dupRow, uniqueRow]);
    expect(result[0].occurrenceIndex).toBe(0);
    expect(result[1].occurrenceIndex).toBe(1);
    expect(result[2].occurrenceIndex).toBe(0);
  });

  test('empty array returns empty array', () => {
    expect(assignOccurrenceIndices([])).toEqual([]);
  });
});

// ── Task 2.3–2.7: loadExistingFingerprints ────────────────────────────────────

describe('loadExistingFingerprints', () => {
  test('2.3 — non-existent directory returns ok(empty Set)', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await loadExistingFingerprints(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.size).toBe(0);
    });
  });

  test('2.4 — single NDJSON file with 2 valid lines returns Set of 2 fingerprints', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const content =
        JSON.stringify({ id: '2025-01-01|-10|Coffee Shop|0' }) +
        '\n' +
        JSON.stringify({ id: '2025-01-02|-20|Lunch|0' });
      await atomicWrite(path.join(importsDir, '2025-01-01-001.ndjson'), content);

      const result = await loadExistingFingerprints(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.size).toBe(2);
      expect(result.data.has('2025-01-01|-10|Coffee Shop|0')).toBe(true);
      expect(result.data.has('2025-01-02|-20|Lunch|0')).toBe(true);
    });
  });

  test('2.5 — malformed JSON line is silently skipped; valid lines still collected', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const content =
        JSON.stringify({ id: '2025-01-01|-10|Coffee|0' }) + '\n' + 'NOT VALID JSON' + '\n';
      await atomicWrite(path.join(importsDir, '2025-01-01-001.ndjson'), content);

      const result = await loadExistingFingerprints(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.size).toBe(1);
      expect(result.data.has('2025-01-01|-10|Coffee|0')).toBe(true);
    });
  });

  test('2.6 — line whose id field is a number is silently skipped', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const content =
        JSON.stringify({ id: 42 }) + '\n' + JSON.stringify({ id: '2025-01-01|-10|Valid|0' });
      await atomicWrite(path.join(importsDir, 'test.ndjson'), content);

      const result = await loadExistingFingerprints(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.size).toBe(1);
      expect(result.data.has('2025-01-01|-10|Valid|0')).toBe(true);
    });
  });

  test('2.7 — multiple NDJSON files pool fingerprints into one Set', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await atomicWrite(
        path.join(importsDir, '2025-01-01-001.ndjson'),
        JSON.stringify({ id: '2025-01-01|-10|Coffee|0' }),
      );
      await atomicWrite(
        path.join(importsDir, '2025-01-02-001.ndjson'),
        JSON.stringify({ id: '2025-01-02|-20|Lunch|0' }),
      );

      const result = await loadExistingFingerprints(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.size).toBe(2);
      expect(result.data.has('2025-01-01|-10|Coffee|0')).toBe(true);
      expect(result.data.has('2025-01-02|-20|Lunch|0')).toBe(true);
    });
  });
});

// ── Task 2.8–2.10: deduplicateRows ───────────────────────────────────────────

describe('deduplicateRows', () => {
  test('2.8 — no existing files → all rows isOverwrite: false', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      // intentionally do NOT create the directory — should behave as empty

      const rows = [
        { date: '2025-01-01', amount: -10, description: 'Coffee' },
        { date: '2025-01-02', amount: -20, description: 'Lunch' },
      ];
      const result = await deduplicateRows(rows, importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.rows[0].isOverwrite).toBe(false);
      expect(result.data.rows[1].isOverwrite).toBe(false);
      expect(result.data.newCount).toBe(2);
      expect(result.data.overwriteCount).toBe(0);
    });
  });

  test('2.9 — re-importing exact same rows → all isOverwrite: true', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const existingLines = [
        JSON.stringify({ id: '2025-01-01|-10|Coffee|0' }),
        JSON.stringify({ id: '2025-01-02|-20|Lunch|0' }),
      ].join('\n');
      await atomicWrite(path.join(importsDir, '2025-01-01-001.ndjson'), existingLines);

      const rows = [
        { date: '2025-01-01', amount: -10, description: 'Coffee' },
        { date: '2025-01-02', amount: -20, description: 'Lunch' },
      ];
      const result = await deduplicateRows(rows, importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.rows[0].isOverwrite).toBe(true);
      expect(result.data.rows[1].isOverwrite).toBe(true);
      expect(result.data.overwriteCount).toBe(2);
      expect(result.data.newCount).toBe(0);
    });
  });

  test('2.10 — batch of two identical triplets, one fingerprint exists → first is overwrite, second is new', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      // Only store the |0 fingerprint in existing data
      await atomicWrite(
        path.join(importsDir, '2025-01-01-001.ndjson'),
        JSON.stringify({ id: '2025-01-01|-10|Coffee Shop|0' }),
      );

      const rows = [
        { date: '2025-01-01', amount: -10, description: 'Coffee Shop' },
        { date: '2025-01-01', amount: -10, description: 'Coffee Shop' },
      ];
      const result = await deduplicateRows(rows, importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // First row: fingerprint "...|0" → exists in file → overwrite
      expect(result.data.rows[0].isOverwrite).toBe(true);
      expect(result.data.rows[0].fingerprint).toBe('2025-01-01|-10|Coffee Shop|0');
      // Second row: fingerprint "...|1" → NOT in file → new
      expect(result.data.rows[1].isOverwrite).toBe(false);
      expect(result.data.rows[1].fingerprint).toBe('2025-01-01|-10|Coffee Shop|1');
      expect(result.data.overwriteCount).toBe(1);
      expect(result.data.newCount).toBe(1);
    });
  });

  test('deduplicateRows — correct fingerprints are assigned to rows', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const rows = [{ date: '2025-01-15', amount: -42.5, description: 'Coffee Shop' }];
      const result = await deduplicateRows(rows, importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.rows[0].fingerprint).toBe('2025-01-15|-42.5|Coffee Shop|0');
    });
  });
});
