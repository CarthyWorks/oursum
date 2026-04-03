// src/core/persistence/transactions.test.ts
import { describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadTransactions } from './transactions';
import { withTestDataFolder } from './test-utils';
import type { Transaction } from '../../shared/types';

function makeTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: '2026-01-01|100|test-desc|0',
    date: '2026-01-01',
    amount: -100,
    description: 'test-desc',
    category: 'Others',
    accountId: 'acc-1',
    importFile: '2026-01-01-001.ndjson',
    notes: '',
    ...overrides,
  };
}

async function writeNdjson(dir: string, filename: string, rows: Transaction[]): Promise<void> {
  await fs.writeFile(path.join(dir, filename), rows.map(r => JSON.stringify(r)).join('\n'), 'utf-8');
}

// ── loadTransactions ─────────────────────────────────────────────────────────

describe('loadTransactions()', () => {
  // AC 3: Empty folder
  it('returns ok([]) when importsDir exists but contains no .ndjson files', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(0);
    });
  });

  // AC 3: Non-existent dir
  it('returns ok([]) when importsDir does not exist', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'does-not-exist');

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(0);
    });
  });

  it('returns err(...) when importsDir is not a directory', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'not-a-directory');
      await fs.writeFile(importsDir, 'not a directory', 'utf-8');

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  // AC 2 + 6: Single file with multiple valid lines
  it('returns all transactions from a single file', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const txns = [
        makeTransaction({ id: 'a', description: 'Alpha' }),
        makeTransaction({ id: 'b', description: 'Beta' }),
        makeTransaction({ id: 'c', description: 'Gamma' }),
      ];
      await writeNdjson(importsDir, '2026-01-01-001.ndjson', txns);

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(3);
      const ids = result.data.map(t => t.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  // AC 2: Multi-file dedup — latter file wins for same id
  it('deduplicates by id, keeping latter file version (last-write-wins)', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const firstVersion = makeTransaction({ id: 'dup-id', description: 'First', importFile: '2026-01-01-001.ndjson' });
      const secondVersion = makeTransaction({ id: 'dup-id', description: 'Second', importFile: '2026-01-02-001.ndjson' });

      await writeNdjson(importsDir, '2026-01-01-001.ndjson', [firstVersion]);
      await writeNdjson(importsDir, '2026-01-02-001.ndjson', [secondVersion]);

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].description).toBe('Second');
    });
  });

  // AC 2: Last-write-wins correctness — mutated field reflects second import
  it('last-write-wins: mutated category in second import file is reflected in result', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const firstImport = makeTransaction({ id: 'shared-id', category: 'Others' });
      const secondImport = makeTransaction({ id: 'shared-id', category: 'Food' });

      await writeNdjson(importsDir, '2026-01-01-001.ndjson', [firstImport]);
      await writeNdjson(importsDir, '2026-01-02-001.ndjson', [secondImport]);

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe('Food');
    });
  });

  // AC 4: Malformed line skipped, valid lines still collected
  it('skips malformed JSON lines and collects valid transactions', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const validA = makeTransaction({ id: 'valid-a' });
      const validB = makeTransaction({ id: 'valid-b' });
      const fileContent = [
        JSON.stringify(validA),
        'THIS IS NOT JSON {{{',
        JSON.stringify(validB),
      ].join('\n');

      await fs.writeFile(path.join(importsDir, '2026-01-01-001.ndjson'), fileContent, 'utf-8');

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(2);
      const ids = result.data.map(t => t.id).sort();
      expect(ids).toEqual(['valid-a', 'valid-b']);
    });
  });

  it('skips schema-invalid JSON lines and collects valid transactions', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const validA = makeTransaction({ id: 'valid-a' });
      const invalid = {
        ...makeTransaction({ id: 'invalid-row' }),
        amount: 'not-a-number',
      };
      const validB = makeTransaction({ id: 'valid-b' });
      const fileContent = [
        JSON.stringify(validA),
        JSON.stringify(invalid),
        JSON.stringify(validB),
      ].join('\n');

      await fs.writeFile(path.join(importsDir, '2026-01-01-001.ndjson'), fileContent, 'utf-8');

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(2);
      const ids = result.data.map(t => t.id).sort();
      expect(ids).toEqual(['valid-a', 'valid-b']);
    });
  });

  it('returns err(...) when a discovered .ndjson entry cannot be read', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.mkdir(path.join(importsDir, '2026-01-01-001.ndjson'));

      const result = await loadTransactions(importsDir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  // AC 5: Benchmark — 10,000 transactions across 5 files < 300ms
  it('benchmark: 10k rows across 5 files load in under 300ms', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      for (let f = 0; f < 5; f++) {
        const rows = Array.from({ length: 2000 }, (_, i) => {
          const idx = f * 2000 + i;
          const t: Transaction = {
            id: `2026-01-01|${idx}|desc-${idx}|0`,
            date: '2026-01-01',
            amount: -(idx + 1),
            description: `desc-${idx}`,
            category: 'Others',
            accountId: '',
            importFile: `2026-01-0${f + 1}-001.ndjson`,
            notes: '',
          };
          return JSON.stringify(t);
        }).join('\n');

        await fs.writeFile(path.join(importsDir, `2026-01-0${f + 1}-001.ndjson`), rows, 'utf-8');
      }

      const t0 = performance.now();
      const result = await loadTransactions(importsDir);
      const elapsed = performance.now() - t0;

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(10000);
      expect(elapsed).toBeLessThan(300);
    });
  });
});
