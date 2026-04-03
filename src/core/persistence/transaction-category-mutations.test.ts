import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RuleInput } from '../../shared/types';
import { withTestDataFolder } from './test-utils';
import {
  applyRuleToExistingTransactions,
  batchDeleteTransactions,
  batchUpdateTransactionCategories,
  deleteTransaction,
  previewRuleMatches,
  updateTransactionCategoryById,
} from './transaction-category-mutations';

const GROCERIES_TRANSACTION = JSON.stringify({
  id: '2026-01-01|-10|Shop|0',
  date: '2026-01-01',
  amount: -10,
  description: 'Coffee Bar',
  category: 'Groceries',
  accountId: '',
  importFile: 'test.ndjson',
  notes: '',
});

const OTHER_TRANSACTION = JSON.stringify({
  id: '2026-01-02|-5|Bus|0',
  date: '2026-01-02',
  amount: -5,
  description: 'Coffee Bar Downtown',
  category: 'Dining',
  accountId: '',
  importFile: 'manual.ndjson',
  notes: '',
});

describe('updateTransactionCategoryById()', () => {
  test('rewrites the owning NDJSON file for a single transaction id', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01-01-001.ndjson');
      await fs.writeFile(filePath, `${GROCERIES_TRANSACTION}\nnot-json\n`, 'utf-8');

      const result = await updateTransactionCategoryById(dir, '2026-01-01|-10|Shop|0', 'Dining');
      expect(result.ok).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('"category":"Dining"');
      expect(content).toContain('not-json');
    });
  });

  test('returns ok without mutation when the category is already the same', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01-01-001.ndjson');
      await fs.writeFile(filePath, `${GROCERIES_TRANSACTION}\n`, 'utf-8');
      const before = await fs.readFile(filePath, 'utf-8');

      const result = await updateTransactionCategoryById(dir, '2026-01-01|-10|Shop|0', 'Groceries');
      expect(result.ok).toBe(true);

      const after = await fs.readFile(filePath, 'utf-8');
      expect(after).toBe(before); // file not rewritten
    });
  });

  test('returns err when the transaction id is not found in any folder', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, '2026-01-01-001.ndjson'),
        `${GROCERIES_TRANSACTION}\n`,
        'utf-8',
      );

      const result = await updateTransactionCategoryById(dir, 'missing-id', 'Dining');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('TRANSACTION_NOT_FOUND');
    });
  });
});

describe('previewRuleMatches()', () => {
  test('returns all matching transactions across imports and manual folders', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(manualDir, { recursive: true });
      await fs.writeFile(path.join(importsDir, '2026-01-01-001.ndjson'), `${GROCERIES_TRANSACTION}\n`, 'utf-8');
      await fs.writeFile(path.join(manualDir, '2026-01-02-001.ndjson'), `${OTHER_TRANSACTION}\n`, 'utf-8');

      const input: RuleInput = {
        pattern: 'Coffee Bar',
        category: 'Transport',
        matchType: 'contains',
      };
      const result = await previewRuleMatches(dir, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(2);
    });
  });

  test('returns ok([]) when transaction folders are missing', async () => {
    await withTestDataFolder(async (dir) => {
      const result = await previewRuleMatches(dir, {
        pattern: 'Coffee',
        category: 'Dining',
        matchType: 'contains',
      });
      expect(result).toEqual({ ok: true, data: [] });
    });
  });
});

describe('applyRuleToExistingTransactions()', () => {
  test('updates only matching transactions and preserves malformed lines', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01-01-001.ndjson');
      await fs.writeFile(filePath, `${GROCERIES_TRANSACTION}\nnot-json\n`, 'utf-8');

      const result = await applyRuleToExistingTransactions(dir, {
        pattern: 'Coffee',
        category: 'Dining',
        matchType: 'contains',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.updatedCount).toBe(1);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('"category":"Dining"');
      expect(content).toContain('not-json');
    });
  });

  test('does not count rows already in the target category', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(path.join(importsDir, '2026-01-01-001.ndjson'), `${OTHER_TRANSACTION}\n`, 'utf-8');

      const result = await applyRuleToExistingTransactions(dir, {
        pattern: 'Coffee Bar',
        category: 'Dining',
        matchType: 'contains',
      });
      expect(result).toEqual({ ok: true, data: { updatedCount: 0 } });
    });
  });
});

const TX_A_ID = '2026-01-01|-10|Shop|0';
const TX_B_ID = '2026-01-02|-5|Bus|0';
const TX_A = JSON.stringify({
  id: TX_A_ID,
  date: '2026-01-01',
  amount: -10,
  description: 'Shop',
  category: 'Groceries',
  accountId: '',
  importFile: 'test.ndjson',
  notes: '',
});
const TX_B = JSON.stringify({
  id: TX_B_ID,
  date: '2026-01-02',
  amount: -5,
  description: 'Bus',
  category: 'Transport',
  accountId: '',
  importFile: 'test.ndjson',
  notes: '',
});

describe('deleteTransaction()', () => {
  test('AC1: removes matched line from imports/ file; other lines intact', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01.ndjson');
      await fs.writeFile(filePath, `${TX_A}\n${TX_B}\n`, 'utf-8');

      const result = await deleteTransaction(TX_A_ID, importsDir, manualDir);
      expect(result.ok).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).not.toContain(TX_A_ID);
      expect(content).toContain(TX_B_ID);
    });
  });

  test('AC2: removes matched line from manual/ file; other lines intact', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(manualDir, { recursive: true });
      const filePath = path.join(manualDir, '2026-01.ndjson');
      await fs.writeFile(filePath, `${TX_A}\n${TX_B}\n`, 'utf-8');

      const result = await deleteTransaction(TX_A_ID, importsDir, manualDir);
      expect(result.ok).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).not.toContain(TX_A_ID);
      expect(content).toContain(TX_B_ID);
    });
  });

  test('AC3: returns err when id not found in either directory; no files modified', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01.ndjson');
      await fs.writeFile(filePath, `${TX_B}\n`, 'utf-8');
      const before = await fs.readFile(filePath, 'utf-8');

      const result = await deleteTransaction('missing-id', importsDir, manualDir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('NOT_FOUND:missing-id');

      const after = await fs.readFile(filePath, 'utf-8');
      expect(after).toBe(before);
    });
  });

  test('AC4: malformed lines preserved as-is after matched line is removed', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      const filePath = path.join(importsDir, '2026-01.ndjson');
      await fs.writeFile(filePath, `${TX_A}\nnot-valid-json\n`, 'utf-8');

      const result = await deleteTransaction(TX_A_ID, importsDir, manualDir);
      expect(result.ok).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).not.toContain(TX_A_ID);
      expect(content).toContain('not-valid-json');
    });
  });

  test('edge: importsDir does not exist (ENOENT) — treated as empty, scans manualDir', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports-nonexistent');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(manualDir, { recursive: true });
      const filePath = path.join(manualDir, '2026-01.ndjson');
      await fs.writeFile(filePath, `${TX_A}\n`, 'utf-8');

      const result = await deleteTransaction(TX_A_ID, importsDir, manualDir);
      expect(result.ok).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).not.toContain(TX_A_ID);
    });
  });
});

// ── batchDeleteTransactions ──────────────────────────────────────────────────

const BATCH_TX_A = JSON.stringify({
  id: 'batch-tx-a',
  date: '2026-02-01',
  amount: -10,
  description: 'Alpha',
  category: 'Groceries',
  accountId: '',
  importFile: 'batch-2026-02.ndjson',
  notes: '',
});

const BATCH_TX_B = JSON.stringify({
  id: 'batch-tx-b',
  date: '2026-02-02',
  amount: -20,
  description: 'Beta',
  category: 'Transport',
  accountId: '',
  importFile: 'batch-2026-02.ndjson',
  notes: '',
});

describe('batchDeleteTransactions()', () => {
  test('all ids found: returns { deleted: N, failed: 0, errors: [] }', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(manualDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchDeleteTransactions(['batch-tx-a', 'batch-tx-b'], importsDir, manualDir);
      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      const content = await fs.readFile(path.join(importsDir, 'batch-2026-02.ndjson'), 'utf-8');
      expect(content).not.toContain('batch-tx-a');
      expect(content).not.toContain('batch-tx-b');
    });
  });

  test('one id not found: returns { deleted: N-1, failed: 1, errors: ["NOT_FOUND:missing"] }, continues processing', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(manualDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchDeleteTransactions(['batch-tx-a', 'batch-missing', 'batch-tx-b'], importsDir, manualDir);
      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('NOT_FOUND:batch-missing');

      // Both found ids were still deleted
      const content = await fs.readFile(path.join(importsDir, 'batch-2026-02.ndjson'), 'utf-8');
      expect(content).not.toContain('batch-tx-a');
      expect(content).not.toContain('batch-tx-b');
    });
  });

  test('sequential execution: all ids processed in input order', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(manualDir, { recursive: true });
      // Put both transactions in the SAME file to test sequential write safety
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchDeleteTransactions(['batch-tx-a', 'batch-tx-b'], importsDir, manualDir);
      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  test('never throws: returns summary even on full failure', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const manualDir = path.join(dir, 'manual');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(manualDir, { recursive: true });

      // No transactions written — all ids will fail with NOT_FOUND
      const result = await batchDeleteTransactions(['missing-1', 'missing-2'], importsDir, manualDir);
      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });
});

// ── batchUpdateTransactionCategories ────────────────────────────────────────

describe('batchUpdateTransactionCategories()', () => {
  test('all ids found: returns { updated: N, failed: 0, errors: [] }', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchUpdateTransactionCategories(['batch-tx-a', 'batch-tx-b'], 'Dining', dir);
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      const content = await fs.readFile(path.join(importsDir, 'batch-2026-02.ndjson'), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        const tx = JSON.parse(line) as { category: string };
        expect(tx.category).toBe('Dining');
      }
    });
  });

  test('one id not found: returns { updated: N-1, failed: 1 }, continues processing remaining ids', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchUpdateTransactionCategories(
        ['batch-tx-a', 'batch-missing', 'batch-tx-b'],
        'Dining',
        dir,
      );
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('TRANSACTION_NOT_FOUND');
    });
  });

  test('sequential execution: all ids in same NDJSON file processed correctly', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(
        path.join(importsDir, 'batch-2026-02.ndjson'),
        `${BATCH_TX_A}\n${BATCH_TX_B}\n`,
        'utf-8',
      );

      const result = await batchUpdateTransactionCategories(['batch-tx-a', 'batch-tx-b'], 'Income', dir);
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });
  });
});