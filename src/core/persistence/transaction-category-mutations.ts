import { promises as fs } from 'node:fs';
import path from 'node:path';
import { err, ok, type Result } from '../../shared/contracts/result';
import type { RuleInput, Transaction } from '../../shared/types';
import { parseTransaction } from './schemas';
import { atomicWrite } from './utils';
import { matchesRuleDescription } from '../rules/matches-rule-description';

const TRANSACTION_SUBDIRECTORIES = ['imports', 'manual'] as const;

async function listTransactionFiles(dataFolderPath: string): Promise<Result<string[]>> {
  const filePaths: string[] = [];

  for (const subdirectory of TRANSACTION_SUBDIRECTORIES) {
    const directoryPath = path.join(dataFolderPath, subdirectory);
    let entries: string[];
    try {
      entries = await fs.readdir(directoryPath);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      return err(e instanceof Error ? e.message : String(e));
    }

    for (const entry of entries.filter((name) => name.endsWith('.ndjson')).sort()) {
      filePaths.push(path.join(directoryPath, entry));
    }
  }

  return ok(filePaths);
}

function parseNdjsonLines(content: string): string[] {
  return content.split('\n').filter((line) => line.trim() !== '');
}

async function readTransactionFile(filePath: string): Promise<Result<string>> {
  try {
    return ok(await fs.readFile(filePath, 'utf-8'));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok('');
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function updateTransactionCategoryById(
  dataFolderPath: string,
  transactionId: string,
  nextCategory: string,
): Promise<Result<void>> {
  const filePathsResult = await listTransactionFiles(dataFolderPath);
  if (!filePathsResult.ok) return err(filePathsResult.error);

  for (const filePath of filePathsResult.data) {
    const contentResult = await readTransactionFile(filePath);
    if (!contentResult.ok) return err(contentResult.error);
    if (!contentResult.data) continue;

    let found = false;
    let changed = false;
    const updatedLines = parseNdjsonLines(contentResult.data).map((line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return line;
      }

      const result = parseTransaction(parsed);
      if (!result.ok) return line;
      if (result.data.id !== transactionId) return line;

      found = true;
      if (result.data.category === nextCategory) return line;

      changed = true;
      return JSON.stringify({ ...result.data, category: nextCategory });
    });

    if (!found) {
      continue;
    }

    if (!changed) {
      return ok(undefined);
    }

    const writeResult = await atomicWrite(filePath, `${updatedLines.join('\n')}\n`);
    if (!writeResult.ok) return err(writeResult.error);
    return ok(undefined);
  }

  return err('TRANSACTION_NOT_FOUND');
}

export async function previewRuleMatches(
  dataFolderPath: string,
  input: RuleInput,
): Promise<Result<Transaction[]>> {
  const filePathsResult = await listTransactionFiles(dataFolderPath);
  if (!filePathsResult.ok) return err(filePathsResult.error);

  const matches: Transaction[] = [];
  const regexCache = new Map<string, RegExp | null>();

  for (const filePath of filePathsResult.data) {
    const contentResult = await readTransactionFile(filePath);
    if (!contentResult.ok) return err(contentResult.error);
    if (!contentResult.data) continue;

    for (const line of parseNdjsonLines(contentResult.data)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      const result = parseTransaction(parsed);
      if (!result.ok) continue;

      if (
        result.data.category !== input.category &&
        matchesRuleDescription(result.data.description, input, regexCache)
      ) {
        matches.push(result.data);
      }
    }
  }

  return ok(matches);
}

export async function deleteTransaction(
  id: string,
  importsDir: string,
  manualDir: string,
): Promise<Result<void>> {
  for (const dir of [importsDir, manualDir]) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return err(e instanceof Error ? e.message : String(e));
    }

    const ndjsonFiles = entries.filter((f) => f.endsWith('.ndjson')).sort();

    for (const filename of ndjsonFiles) {
      const filePath = path.join(dir, filename);
      const contentResult = await readTransactionFile(filePath);
      if (!contentResult.ok) return err(contentResult.error);
      if (!contentResult.data) continue;

      let found = false;
      const updatedLines = parseNdjsonLines(contentResult.data).filter((line) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return true; // preserve malformed lines
        }

        const result = parseTransaction(parsed);
        if (!result.ok) return true; // preserve unrecognised shapes

        if (result.data.id === id) {
          found = true;
          return false; // drop matched line
        }
        return true;
      });

      if (!found) continue;

      const writeResult = await atomicWrite(filePath, `${updatedLines.join('\n')}\n`);
      if (!writeResult.ok) return err(writeResult.error);
      return ok(undefined);
    }
  }

  return err(`NOT_FOUND:${id}`);
}

export async function applyRuleToExistingTransactions(
  dataFolderPath: string,
  input: RuleInput,
): Promise<Result<{ updatedCount: number }>> {
  const filePathsResult = await listTransactionFiles(dataFolderPath);
  if (!filePathsResult.ok) return err(filePathsResult.error);

  const regexCache = new Map<string, RegExp | null>();
  let updatedCount = 0;

  for (const filePath of filePathsResult.data) {
    const contentResult = await readTransactionFile(filePath);
    if (!contentResult.ok) return err(contentResult.error);
    if (!contentResult.data) continue;

    let changed = false;
    const updatedLines = parseNdjsonLines(contentResult.data).map((line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return line;
      }

      const result = parseTransaction(parsed);
      if (!result.ok) return line;
      if (result.data.category === input.category) return line;
      if (!matchesRuleDescription(result.data.description, input, regexCache)) return line;

      changed = true;
      updatedCount += 1;
      return JSON.stringify({ ...result.data, category: input.category });
    });

    if (!changed) continue;

    const writeResult = await atomicWrite(filePath, `${updatedLines.join('\n')}\n`);
    if (!writeResult.ok) return err(writeResult.error);
  }

  return ok({ updatedCount });
}

export async function batchDeleteTransactions(
  ids: string[],
  importsDir: string,
  manualDir: string,
): Promise<{ deleted: number; failed: number; errors: string[] }> {
  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const result = await deleteTransaction(id, importsDir, manualDir);
    if (result.ok) {
      deleted += 1;
    } else {
      failed += 1;
      errors.push(result.error);
    }
  }

  return { deleted, failed, errors };
}

export async function batchUpdateTransactionCategories(
  ids: string[],
  category: string,
  dataFolderPath: string,
): Promise<{ updated: number; failed: number; errors: string[] }> {
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const result = await updateTransactionCategoryById(dataFolderPath, id, category);
    if (result.ok) {
      updated += 1;
    } else {
      failed += 1;
      errors.push(result.error);
    }
  }

  return { updated, failed, errors };
}