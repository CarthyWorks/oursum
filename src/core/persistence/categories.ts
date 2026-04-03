// src/core/persistence/categories.ts
// Electrobun-free: pure Bun-native + Node.js fs. No electrobun/* imports.
// All functions follow the Result<T> pattern — no throws.
import { promises as fs } from 'node:fs';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { Category } from '../../shared/types';
import { DataFolderConfig } from './config';
import { DEFAULT_CATEGORIES } from './defaults';
import { parseCategories, parseTransaction } from './schemas';
import { loadTransactions } from './transactions';
import { atomicWrite } from './utils';

export async function readCategories(): Promise<Result<Category[]>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('categories.json');
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok(DEFAULT_CATEGORIES);
    }
    return err(e instanceof Error ? e.message : String(e));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err('INVALID_JSON');
  }

  const result = parseCategories(parsed);
  if (!result.ok) {
    console.warn('[categories] schema violation:', result.error);
    return err(result.error);
  }
  return ok(result.data);
}

export async function writeCategories(categories: Category[]): Promise<Result<void>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('categories.json');
  const content = JSON.stringify(categories, null, 2);
  return atomicWrite(filePath, content);
}

export async function addCategory(name: string): Promise<Result<Category>> {
  const trimmed = name.trim();
  if (!trimmed) return err('EMPTY_NAME');

  const readResult = await readCategories();
  if (!readResult.ok) return err(readResult.error);

  const existing = readResult.data;
  const isDuplicate = existing.some(
    (cat) => cat.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (isDuplicate) return err('DUPLICATE_NAME');

  const newCategory: Category = {
    id: crypto.randomUUID(),
    name: trimmed,
    color: '',
    icon: '',
  };

  // Insert before the "Others" entry to keep Others last
  const othersIndex = existing.findIndex((cat) => cat.name === 'Others');
  const updatedList =
    othersIndex === -1
      ? [...existing, newCategory]
      : [
          ...existing.slice(0, othersIndex),
          newCategory,
          ...existing.slice(othersIndex),
        ];

  const writeResult = await writeCategories(updatedList);
  if (!writeResult.ok) return err(writeResult.error);

  return ok(newCategory);
}

export async function renameCategory(
  oldName: string,
  newName: string,
): Promise<Result<void>> {
  const trimmed = newName.trim();
  if (!trimmed) return err('EMPTY_NAME');
  if (oldName === 'Others') return err('OTHERS_PROTECTED');

  const readResult = await readCategories();
  if (!readResult.ok) return err(readResult.error);

  const existing = readResult.data;
  const targetIndex = existing.findIndex((cat) => cat.name === oldName);
  if (targetIndex === -1) return err('NOT_FOUND');

  const isDuplicate = existing.some(
    (cat) =>
      cat.name !== oldName &&
      cat.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (isDuplicate) return err('DUPLICATE_NAME');

  const updatedList = existing.map((cat) =>
    cat.name === oldName ? { ...cat, name: trimmed } : cat,
  );

  return writeCategories(updatedList);
}

export async function reassignTransactionCategories(
  importsDir: string,
  fromCategory: string,
  toCategory: string,
): Promise<Result<void>> {
  let entries: string[];
  try {
    entries = await fs.readdir(importsDir);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok(undefined);
    }
    return err(e instanceof Error ? e.message : String(e));
  }

  const ndjsonFiles = entries.filter((f) => f.endsWith('.ndjson'));

  for (const filename of ndjsonFiles) {
    const filePath = `${importsDir}/${filename}`;
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return err(e instanceof Error ? e.message : String(e));
    }

    const updatedLines = content
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return line; // keep malformed lines intact
        }
        const result = parseTransaction(parsed);
        if (!result.ok) return line; // keep schema-invalid lines intact
        if (result.data.category !== fromCategory) return line;
        return JSON.stringify({ ...result.data, category: toCategory });
      })
      .join('\n');

    const writeResult = await atomicWrite(filePath, updatedLines + '\n');
    if (!writeResult.ok) return err(writeResult.error);
  }

  return ok(undefined);
}

export async function deleteCategory(
  name: string,
  reassignTo?: string,
  importsDir?: string,
): Promise<Result<void>> {
  if (name === 'Others') return err('OTHERS_PROTECTED');

  if (importsDir !== undefined) {
    const transactionsResult = await loadTransactions(importsDir);
    if (!transactionsResult.ok) return err(transactionsResult.error);

    const assignedCount = transactionsResult.data.filter(
      (transaction) => transaction.category === name,
    ).length;

    if (assignedCount > 0 && reassignTo === undefined) {
      return err('REASSIGN_REQUIRED');
    }
  }

  if (reassignTo !== undefined && importsDir !== undefined) {
    const reassignResult = await reassignTransactionCategories(
      importsDir,
      name,
      reassignTo,
    );
    if (!reassignResult.ok) return err(reassignResult.error);
  }

  const readResult = await readCategories();
  if (!readResult.ok) return err(readResult.error);

  const filtered = readResult.data.filter((cat) => cat.name !== name);
  return writeCategories(filtered);
}
