// src/core/persistence/manual-transactions.ts
// Electrobun-free: uses node:path and core helpers only.
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';
import { atomicWrite } from './utils';
import { generateImportFilename } from '../importer/ndjson-filename';
import { computeTransactionFingerprint } from '../dedup/index';
import { RuleEngine } from '../rules/rule-engine';
import type { Transaction } from '../../shared/types';

export interface ManualTransactionInput {
  date: string;       // ISO 8601: "YYYY-MM-DD"
  description: string;
  amount: number;     // Negative = expense, positive = income
  category: string;   // Already resolved by caller; 'Others' if not overridden
}

/**
 * Writes a single manually-entered transaction to data/manual/YYYY-MM-DD-NNN.ndjson via atomicWrite.
 * The directory is created automatically by atomicWrite if it doesn't exist.
 */
export async function writeManualTransaction(
  dataFolderPath: string,
  fields: ManualTransactionInput,
): Promise<Result<Transaction>> {
  const { date, description, amount, category } = fields;
  const manualPath = path.join(dataFolderPath, 'manual');
  const trimmedCategory = category.trim();

  const filenameResult = await generateImportFilename(manualPath);
  if (!filenameResult.ok) return err(filenameResult.error);

  const filename = filenameResult.data;
  const id = computeTransactionFingerprint(date, amount, description, 0);
  const matchedCategory = await RuleEngine.getInstance().applyRules(description);
  const resolvedCategory = trimmedCategory || matchedCategory || 'Others';

  const transaction: Transaction = {
    id,
    date,
    amount,
    description,
    category: resolvedCategory,
    accountId: '',
    importFile: filename,
    notes: '',
  };

  const writeResult = await atomicWrite(
    path.join(manualPath, filename),
    JSON.stringify(transaction),
  );

  if (!writeResult.ok) return err(writeResult.error);
  return ok(transaction);
}
