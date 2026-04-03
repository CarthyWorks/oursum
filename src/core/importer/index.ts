import path from 'node:path';
import { deduplicateRows, type DeduplicateInput } from '../dedup';
import { atomicWrite } from '../persistence/utils';
import type {
  ImportFailureDetail,
  ImportLogEntry,
  ImportProfile,
  ImportSummary,
  Transaction,
} from '../../shared/types';
import { err, ok, type Result } from '../../shared/contracts/result';
import { parseAmountString } from './amount-parser';
import { mapColumns } from './column-mapper';
import { parseDateToISO, resolveBestDateFormat } from './date-parser';
import { appendImportLog } from './import-log';
import { generateImportFilename } from './ndjson-filename';
import { RuleEngine } from '../rules/rule-engine';

export interface ExecuteImportParams {
  rows: string[][];
  headerRow: string[];
  profile: ImportProfile;
  originalFilename: string;
  importsDir: string;
  dataFolderPath: string;
}

type ParsedImportRow = {
  date: string;
  amount: number;
  description: string;
};

export async function executeImport(
  params: ExecuteImportParams,
): Promise<Result<ImportSummary>> {
  const columnMapResult = mapColumns(params.rows, params.headerRow, params.profile.columnMap);
  const effectiveDateFormat = resolveBestDateFormat(
    columnMapResult.rows.map((row) => row.rawDate),
    params.profile.dateFormat,
  );
  const parsedRows: ParsedImportRow[] = [];
  const failedRows: ImportFailureDetail[] = columnMapResult.failedIndices.map((rowIndex) => ({
    rowNumber: rowIndex + 1,
    reason: 'missing-columns',
    rawRow: params.rows[rowIndex] ?? [],
  }));

  for (const row of columnMapResult.rows) {
    const date = parseDateToISO(row.rawDate, effectiveDateFormat);
    if (date === null) {
      failedRows.push({
        rowNumber: row.sourceRowIndex + 1,
        reason: 'invalid-date',
        rawRow: params.rows[row.sourceRowIndex] ?? [],
      });
      continue;
    }

    let amount: number | null;
    if (row.rawDebit !== null || row.rawCredit !== null) {
      const parseOrZero = (raw: string | null): number | null => {
        if (!raw || raw.trim() === '') return 0;
        return parseAmountString(raw);
      };
      const creditValue = parseOrZero(row.rawCredit);
      const debitValue = parseOrZero(row.rawDebit);
      if (creditValue === null || debitValue === null) {
        failedRows.push({
          rowNumber: row.sourceRowIndex + 1,
          reason: 'invalid-amount',
          rawRow: params.rows[row.sourceRowIndex] ?? [],
        });
        continue;
      }
      amount = creditValue - debitValue;
    } else {
      const parsedAmount = parseAmountString(row.rawAmount);
      if (parsedAmount === null) {
        failedRows.push({
          rowNumber: row.sourceRowIndex + 1,
          reason: 'invalid-amount',
          rawRow: params.rows[row.sourceRowIndex] ?? [],
        });
        continue;
      }
      amount = parsedAmount * params.profile.amountMultiplier;
    }

    parsedRows.push({
      date,
      amount,
      description: row.rawDescription.trim(),
    });
  }

  const deduplicateInputs: DeduplicateInput[] = parsedRows.map((row) => ({
    date: row.date,
    amount: row.amount,
    description: row.description,
  }));
  const deduplicationResult = await deduplicateRows(deduplicateInputs, params.importsDir);
  if (!deduplicationResult.ok) {
    return err(deduplicationResult.error);
  }

  const filenameResult = await generateImportFilename(params.importsDir);
  if (!filenameResult.ok) {
    return err(filenameResult.error);
  }
  const filename = filenameResult.data;
  let rowsAutoCategorized = 0;
  let rowsInOthers = 0;

  const transactions: Transaction[] = [];
  for (let index = 0; index < parsedRows.length; index++) {
    const row = parsedRows[index];
    const category = (await RuleEngine.getInstance().applyRules(row.description)) ?? 'Others';
    if (category === 'Others') {
      rowsInOthers++;
    } else {
      rowsAutoCategorized++;
    }
    transactions.push({
      id: deduplicationResult.data.rows[index].fingerprint,
      date: row.date,
      amount: row.amount,
      description: row.description,
      category,
      accountId: '',
      importFile: filename,
      notes: '',
    });
  }

  const writeResult = await atomicWrite(
    path.join(params.importsDir, filename),
    transactions.map((transaction) => JSON.stringify(transaction)).join('\n'),
  );
  if (!writeResult.ok) {
    return err(writeResult.error);
  }

  const importedAt = new Date().toISOString();
  const rowsFailed = failedRows.length;
  const importLogEntry: ImportLogEntry = {
    importedAt,
    originalFilename: params.originalFilename,
    ndjsonFilename: filename,
    profileName: params.profile.name,
    rowsImported: deduplicationResult.data.newCount,
    rowsOverwritten: deduplicationResult.data.overwriteCount,
    rowsFailed,
    rowsAutoCategorized,
    rowsInOthers,
  };
  const logResult = await appendImportLog(importLogEntry, params.dataFolderPath);
  if (!logResult.ok) {
    console.warn('[executeImport] Failed to append import log:', logResult.error);
  }

  return ok({
    rowsImported: deduplicationResult.data.newCount,
    rowsOverwritten: deduplicationResult.data.overwriteCount,
    rowsFailed,
    failedRows,
    rowsAutoCategorized,
    rowsInOthers,
    profileName: params.profile.name,
    ndjsonFilename: filename,
    importedAt,
  });
}