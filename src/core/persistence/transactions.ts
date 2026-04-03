// src/core/persistence/transactions.ts
// Read-only aggregator for per-import NDJSON files.
// RULE: No Electrobun imports. NEVER throws. Returns Result<T>.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseTransaction } from './schemas';
import { err, ok, type Result } from '../../shared/contracts/result';
import type { Transaction } from '../../shared/types';

/**
 * Reads all `*.ndjson` files from `importsDir`, deduplicates transactions by
 * `id` using last-write-wins semantics (files sorted ascending by filename so
 * lexicographic order = chronological order given `YYYY-MM-DD-NNN.ndjson`
 * naming), and returns the flat deduplicated `Transaction[]`.
 *
 * - Empty or non-existent `importsDir` → `ok([])`
 * - Unexpected directory or file I/O failures → `err(...)`
 * - Malformed JSON lines or Zod failures → `console.warn` + skip; valid lines
 *   are still collected.
 * - NEVER throws.
 */
export async function loadTransactions(importsDir: string): Promise<Result<Transaction[]>> {
  let entries: string[];
  try {
    entries = await fs.readdir(importsDir);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([]);
    }
    console.warn('[transactions] Unexpected error reading importsDir:', e);
    return err(e instanceof Error ? e.message : String(e));
  }

  const ndjsonFiles = entries.filter(name => name.endsWith('.ndjson')).sort();

  if (ndjsonFiles.length === 0) {
    return ok([]);
  }

  const dedupeMap = new Map<string, Transaction>();
  const readResults = await Promise.all(
    ndjsonFiles.map(async (filename) => {
      const filePath = path.join(importsDir, filename);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { filename, content };
      } catch (e) {
        console.warn(`[transactions] Could not read file ${filename}:`, e);
        return { filename, error: e };
      }
    })
  );

  for (const readResult of readResults) {
    if ('error' in readResult) {
      return err(
        readResult.error instanceof Error
          ? readResult.error.message
          : String(readResult.error)
      );
    }

    const lines = readResult.content.split('\n').filter(line => line.trim() !== '');
    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        console.warn(`[transactions] Malformed JSON line in ${readResult.filename}:`, line);
        continue;
      }

      const result = parseTransaction(parsed);
      if (!result.ok) {
        console.warn(`[transactions] Schema validation failed in ${readResult.filename}:`, result.error);
        continue;
      }

      dedupeMap.set(result.data.id, result.data);
    }
  }

  return ok([...dedupeMap.values()]);
}

const TRANSACTION_SUBDIRECTORIES = ['imports', 'manual'] as const;

/**
 * Reads all `*.ndjson` files from both `imports/` and `manual/` subdirectories
 * under `dataFolderPath`. Missing subdirectories are silently skipped.
 * Deduplicates by `id` with last-write-wins semantics across all files.
 */
export async function loadAllTransactions(dataFolderPath: string): Promise<Result<Transaction[]>> {
  const dedupeMap = new Map<string, Transaction>();

  for (const subdirectory of TRANSACTION_SUBDIRECTORIES) {
    const dir = path.join(dataFolderPath, subdirectory);
    const result = await loadTransactions(dir);
    if (!result.ok) return result;
    for (const transaction of result.data) {
      dedupeMap.set(transaction.id, transaction);
    }
  }

  return ok([...dedupeMap.values()]);
}
