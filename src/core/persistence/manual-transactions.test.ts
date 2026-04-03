// src/core/persistence/manual-transactions.test.ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RuleEngine } from '../rules/rule-engine';
import { withTestDataFolder } from './test-utils';
import { writeManualTransaction } from './manual-transactions';

beforeEach(() => {
  RuleEngine.reset();
});

describe('writeManualTransaction()', () => {
  it('happy path: creates file and returns correct Transaction shape', async () => {
    await withTestDataFolder(async (dir) => {
      const manualPath = path.join(dir, 'manual');
      await fs.mkdir(manualPath, { recursive: true });

      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Coffee',
        amount: -4.5,
        category: 'Others',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const tx = result.data;
      expect(tx.date).toBe('2026-03-15');
      expect(tx.description).toBe('Coffee');
      expect(tx.amount).toBe(-4.5);
      expect(tx.category).toBe('Others');
      expect(tx.accountId).toBe('');
      expect(tx.notes).toBe('');
      expect(tx.id).toBe('2026-03-15|-4.5|Coffee|0');
      expect(tx.importFile).toMatch(/^\d{4}-\d{2}-\d{2}-\d{3}\.ndjson$/);

      // Verify file was actually written on disk
      const filePath = path.join(manualPath, tx.importFile);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.id).toBe(tx.id);
      expect(parsed.description).toBe('Coffee');
    });
  });

  it('creates the manual/ directory automatically when it does not exist', async () => {
    await withTestDataFolder(async (dir) => {
      // Do NOT pre-create the manual/ directory
      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Rent',
        amount: -800,
        category: 'Housing',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Directory should now exist
      const manualPath = path.join(dir, 'manual');
      const stat = await fs.stat(manualPath);
      expect(stat.isDirectory()).toBe(true);

      // File should exist inside
      const filePath = path.join(manualPath, result.data.importFile);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.description).toBe('Rent');
    });
  });

  it('rule auto-categorization applied: passed category is preserved in the transaction', async () => {
    await withTestDataFolder(async (dir) => {
      const saveResult = await RuleEngine.getInstance().saveRule({
        pattern: 'Super',
        category: 'Transport',
        matchType: 'contains',
      });
      expect(saveResult.ok).toBe(true);

      // Simulate: caller resolved category via MATCH_CATEGORY_FOR_DESCRIPTION → 'Groceries'
      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Supermarket',
        amount: -55,
        category: 'Groceries',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.category).toBe('Groceries');
    });
  });

  it("Others fallback when no rule matches: category='Others' is preserved in the transaction", async () => {
    await withTestDataFolder(async (dir) => {
      const saveResult = await RuleEngine.getInstance().saveRule({
        pattern: 'Taxi',
        category: 'Transport',
        matchType: 'contains',
      });
      expect(saveResult.ok).toBe(true);

      // Simulate: no rule matched description → caller passes blank category and helper falls back
      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Unknown expense',
        amount: -10,
        category: '',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.category).toBe('Others');
    });
  });

  it('applies a saved rule when caller did not provide a category', async () => {
    await withTestDataFolder(async (dir) => {
      const saveResult = await RuleEngine.getInstance().saveRule({
        pattern: 'Coffee',
        category: 'Eating out',
        matchType: 'contains',
      });
      expect(saveResult.ok).toBe(true);

      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Coffee Shop',
        amount: -3.5,
        category: '',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.category).toBe('Eating out');
    });
  });

  it('returns err() when atomicWrite fails (filesystem error)', async () => {
    await withTestDataFolder(async (dir) => {
      // Point dataFolderPath to a file (not a directory) so mkdir inside atomicWrite fails
      const blockingFile = path.join(dir, 'manual');
      await fs.writeFile(blockingFile, 'not-a-dir', 'utf-8');

      const result = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Test',
        amount: -1,
        category: 'Others',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  it('second write on the same day produces a different filename (incrementing sequence)', async () => {
    await withTestDataFolder(async (dir) => {
      const result1 = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'First',
        amount: -10,
        category: 'Others',
      });

      const result2 = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Second',
        amount: -20,
        category: 'Others',
      });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (!result1.ok || !result2.ok) return;

      expect(result1.data.importFile).not.toBe(result2.data.importFile);
    });
  });
});
