// src/core/persistence/categories.test.ts
import { describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CATEGORIES } from './defaults';
import {
  addCategory,
  deleteCategory,
  readCategories,
  reassignTransactionCategories,
  renameCategory,
  writeCategories,
} from './categories';
import { withTestDataFolder } from './test-utils';

const SAMPLE_NDJSON_LINE =
  '{"id":"2026-01-01|-10|Shop|0","date":"2026-01-01","amount":-10,"description":"Shop","category":"Groceries","accountId":"","importFile":"test.ndjson","notes":""}';

describe('readCategories()', () => {
  it('returns ok(DEFAULT_CATEGORIES) when no categories.json exists', async () => {
    await withTestDataFolder(async () => {
      const result = await readCategories();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual(DEFAULT_CATEGORIES);
    });
  });

  it('returns ok(categories) after a round-trip write', async () => {
    await withTestDataFolder(async () => {
      const categories = DEFAULT_CATEGORIES.slice(0, 2);
      await writeCategories(categories);
      const result = await readCategories();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual(categories);
    });
  });

  it('returns err when categories.json contains an invalid schema', async () => {
    await withTestDataFolder(async (dir) => {
      await fs.writeFile(path.join(dir, 'categories.json'), '[{"bad":true}]', 'utf-8');
      const result = await readCategories();
      expect(result.ok).toBe(false);
    });
  });
});

describe('addCategory()', () => {
  it('appends a new category; readCategories afterwards returns it in the list', async () => {
    await withTestDataFolder(async () => {
      const result = await addCategory('Holidays');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.name).toBe('Holidays');

      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      expect(cats.data.some((c) => c.name === 'Holidays')).toBe(true);
    });
  });

  it('returns err("EMPTY_NAME") when name is blank', async () => {
    await withTestDataFolder(async () => {
      const result = await addCategory('   ');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('EMPTY_NAME');
    });
  });

  it('returns err("DUPLICATE_NAME") when the name (case-insensitive) already exists', async () => {
    await withTestDataFolder(async () => {
      const result = await addCategory('groceries'); // matches existing 'Groceries'
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('DUPLICATE_NAME');
    });
  });

  it('inserts new category before Others', async () => {
    await withTestDataFolder(async () => {
      await addCategory('NewCat');
      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      const names = cats.data.map((c) => c.name);
      const newCatIndex = names.indexOf('NewCat');
      const othersIndex = names.indexOf('Others');
      expect(newCatIndex).toBeLessThan(othersIndex);
    });
  });
});

describe('renameCategory()', () => {
  it('updates the category name; readCategories reflects new name', async () => {
    await withTestDataFolder(async () => {
      const result = await renameCategory('Groceries', 'Food');
      expect(result.ok).toBe(true);

      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      expect(cats.data.some((c) => c.name === 'Food')).toBe(true);
      expect(cats.data.some((c) => c.name === 'Groceries')).toBe(false);
    });
  });

  it('returns err("OTHERS_PROTECTED") when renaming "Others"', async () => {
    await withTestDataFolder(async () => {
      const result = await renameCategory('Others', 'Misc');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('OTHERS_PROTECTED');
    });
  });

  it('returns err("NOT_FOUND") when oldName does not exist', async () => {
    await withTestDataFolder(async () => {
      const result = await renameCategory('NonExistent', 'Something');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('NOT_FOUND');
    });
  });

  it('returns err("DUPLICATE_NAME") when newName conflicts with another category', async () => {
    await withTestDataFolder(async () => {
      const result = await renameCategory('Groceries', 'transport'); // case-insensitive
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('DUPLICATE_NAME');
    });
  });
});

describe('reassignTransactionCategories()', () => {
  it('updates transactions in NDJSON files whose category matches fromCategory; others untouched', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const ndjsonPath = path.join(importsDir, 'test.ndjson');
      const otherLine =
        '{"id":"2026-01-02|-5|Bus|0","date":"2026-01-02","amount":-5,"description":"Bus","category":"Transport","accountId":"","importFile":"test.ndjson","notes":""}';
      await fs.writeFile(ndjsonPath, SAMPLE_NDJSON_LINE + '\n' + otherLine + '\n', 'utf-8');

      const result = await reassignTransactionCategories(importsDir, 'Groceries', 'Food');
      expect(result.ok).toBe(true);

      const content = await fs.readFile(ndjsonPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim() !== '');
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0]) as { category: string };
      const second = JSON.parse(lines[1]) as { category: string };
      expect(first.category).toBe('Food');
      expect(second.category).toBe('Transport');
    });
  });

  it('returns ok(undefined) when importsDir does not exist (ENOENT — no imports yet)', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports-missing');
      const result = await reassignTransactionCategories(importsDir, 'Groceries', 'Food');
      expect(result.ok).toBe(true);
    });
  });
});

describe('deleteCategory()', () => {
  it('removes category from list when no reassignTo given (zero-transaction path)', async () => {
    await withTestDataFolder(async () => {
      const result = await deleteCategory('Groceries');
      expect(result.ok).toBe(true);

      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      expect(cats.data.some((c) => c.name === 'Groceries')).toBe(false);
    });
  });

  it('reassigns transactions and removes category when reassignTo and importsDir provided', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const ndjsonPath = path.join(importsDir, 'test.ndjson');
      await fs.writeFile(ndjsonPath, SAMPLE_NDJSON_LINE + '\n', 'utf-8');

      const result = await deleteCategory('Groceries', 'Others', importsDir);
      expect(result.ok).toBe(true);

      const content = await fs.readFile(ndjsonPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim() !== '');
      const tx = JSON.parse(lines[0]) as { category: string };
      expect(tx.category).toBe('Others');

      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      expect(cats.data.some((c) => c.name === 'Groceries')).toBe(false);
    });
  });

  it('returns err("OTHERS_PROTECTED") when attempting to delete "Others"', async () => {
    await withTestDataFolder(async () => {
      const result = await deleteCategory('Others');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('OTHERS_PROTECTED');
    });
  });

  it('returns err("REASSIGN_REQUIRED") when deleting a populated category without reassignTo', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const ndjsonPath = path.join(importsDir, 'test.ndjson');
      await fs.writeFile(ndjsonPath, SAMPLE_NDJSON_LINE + '\n', 'utf-8');

      const result = await deleteCategory('Groceries', undefined, importsDir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('REASSIGN_REQUIRED');

      const cats = await readCategories();
      expect(cats.ok).toBe(true);
      if (!cats.ok) return;
      expect(cats.data.some((c) => c.name === 'Groceries')).toBe(true);
    });
  });
});
