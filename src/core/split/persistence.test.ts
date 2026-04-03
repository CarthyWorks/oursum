// src/core/split/persistence.test.ts
import { describe, test, expect } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readSplitCalculatorConfig, writeSplitCalculatorConfig } from './persistence';
import { withTestDataFolder } from '../persistence/test-utils';
import type { SplitCalculatorConfig } from '../../shared/types';

const FIXTURE_CONFIG: SplitCalculatorConfig = {
  contributors: [
    { id: 'a1b2', name: 'Alice', splitType: 'equal', value: 0 },
    { id: 'c3d4', name: 'Bob', splitType: 'percentage', value: 40 },
  ],
};

// ── readSplitCalculatorConfig ─────────────────────────────────────────────────

describe('readSplitCalculatorConfig', () => {
  test('missing file returns ok(null)', async () => {
    await withTestDataFolder(async () => {
      const result = await readSplitCalculatorConfig();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBeNull();
    });
  });

  test('valid file round-trips exactly', async () => {
    await withTestDataFolder(async (dir) => {
      const filePath = path.join(dir, 'split-calculator.json');
      await fs.writeFile(filePath, JSON.stringify(FIXTURE_CONFIG), 'utf-8');

      const result = await readSplitCalculatorConfig();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual(FIXTURE_CONFIG);
    });
  });

  test('invalid schema (old proportion shape) returns err', async () => {
    await withTestDataFolder(async (dir) => {
      const filePath = path.join(dir, 'split-calculator.json');
      const staleShape = {
        contributors: [{ name: 'Alice', proportion: 0.5 }],
      };
      await fs.writeFile(filePath, JSON.stringify(staleShape), 'utf-8');

      const result = await readSplitCalculatorConfig();
      expect(result.ok).toBe(false);
    });
  });

  test('malformed JSON returns err', async () => {
    await withTestDataFolder(async (dir) => {
      const filePath = path.join(dir, 'split-calculator.json');
      await fs.writeFile(filePath, '{ broken json', 'utf-8');

      const result = await readSplitCalculatorConfig();
      expect(result.ok).toBe(false);
    });
  });

  test('malformed JSON logs a targeted warning', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      await withTestDataFolder(async (dir) => {
        const filePath = path.join(dir, 'split-calculator.json');
        await fs.writeFile(filePath, '{ broken json', 'utf-8');

        const result = await readSplitCalculatorConfig();
        expect(result.ok).toBe(false);
      });

      expect(warnings.some((args) => args[0] === '[split-calculator] Invalid JSON in split-calculator.json:')).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ── writeSplitCalculatorConfig ────────────────────────────────────────────────

describe('writeSplitCalculatorConfig', () => {
  test('write then read returns the same config', async () => {
    await withTestDataFolder(async () => {
      const writeResult = await writeSplitCalculatorConfig(FIXTURE_CONFIG);
      expect(writeResult.ok).toBe(true);

      const readResult = await readSplitCalculatorConfig();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data).toEqual(FIXTURE_CONFIG);
    });
  });

  test('second write fully replaces the previous file (no merging)', async () => {
    await withTestDataFolder(async () => {
      await writeSplitCalculatorConfig(FIXTURE_CONFIG);

      const updated: SplitCalculatorConfig = {
        contributors: [{ id: 'x1y2', name: 'Carol', splitType: 'fixed', value: 30 }],
      };
      await writeSplitCalculatorConfig(updated);

      const readResult = await readSplitCalculatorConfig();
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.data).toEqual(updated);
      expect(readResult.data?.contributors).toHaveLength(1);
    });
  });

  test('does not persist a totalAmount field', async () => {
    await withTestDataFolder(async (dir) => {
      await writeSplitCalculatorConfig(FIXTURE_CONFIG);
      const raw = await fs.readFile(path.join(dir, 'split-calculator.json'), 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('totalAmount');
    });
  });
});
