// src/core/integration/import-pipeline.test.ts
// End-to-end integration test for the full import pipeline.
// ADR-005: NO imports from electrobun/*, src/renderer/, or src/main/.
import { describe, test, expect, beforeEach } from 'bun:test';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { ingestFile } from '../parser/index';
import { computeFingerprint, matchProfile } from '../parser/profile-fingerprint';
import { deduplicateRows, type DeduplicateInput } from '../dedup/index';
import { executeImport } from '../importer/index';
import { mapColumns } from '../importer/column-mapper';
import { parseAmountString } from '../importer/amount-parser';
import { parseDateToISO, resolveBestDateFormat } from '../importer/date-parser';
import { loadTransactions, loadAllTransactions } from '../persistence/transactions';
import { writeManualTransaction } from '../persistence/manual-transactions';
import { withTestDataFolder } from '../persistence/test-utils';
import { RuleEngine } from '../rules/rule-engine';
import type { ImportProfile } from '../../shared/types';

// ---------------------------------------------------------------------------
// Fixture + constants
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.resolve(
  import.meta.dir,   // src/core/integration/
  '../../../',        // repo root
  'data/test/import-fixtures/italian/Movimenti_CartaCredito_0000_20260101_20260131.csv',
);

const EXPECTED_HEADER_ROW = [
  'DATA OPERAZIONE',
  'DATA REGISTRAZIONE',
  'DESCRIZIONE OPERAZIONE',
  'IMPORTO IN EURO',
];

// Pre-known fingerprint of the first data row — format: date|amount|description|occurrenceIndex
const FIRST_ROW_FINGERPRINT = '2026-01-29|-2.8|Operazione presso IL CAFETERO Milano|0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTestProfile(fingerprint: string): ImportProfile {
  return {
    id: 'cc-elena-integration-test',
    name: 'CC Test Profile',
    bankName: 'Test Bank',
    csvDelimiter: ';',
    columnMap: {
      'DATA OPERAZIONE': 'date',
      'DESCRIZIONE OPERAZIONE': 'description',
      'IMPORTO IN EURO': 'amount',
    },
    dateFormat: 'dd/mm/yyyy',
    amountMultiplier: 1,
    headerRowOffset: 0,
    fingerprint,
  };
}

function buildDeduplicateInputFromIngest(
  rows: string[][],
  headerRow: string[],
  profile: ImportProfile,
): DeduplicateInput[] {
  const columnMapResult = mapColumns(rows, headerRow, profile.columnMap);
  const effectiveDateFormat = resolveBestDateFormat(
    columnMapResult.rows.map((row) => row.rawDate),
    profile.dateFormat,
  );

  const parsedRows: DeduplicateInput[] = [];

  for (const row of columnMapResult.rows) {
    const date = parseDateToISO(row.rawDate, effectiveDateFormat);
    if (date === null) {
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
        continue;
      }

      amount = creditValue - debitValue;
    } else {
      const parsedAmount = parseAmountString(row.rawAmount);
      if (parsedAmount === null) {
        continue;
      }

      amount = parsedAmount * profile.amountMultiplier;
    }

    parsedRows.push({
      date,
      amount,
      description: row.rawDescription.trim(),
    });
  }

  return parsedRows;
}

// ---------------------------------------------------------------------------
// Task 1.2: RuleEngine singleton guard
// ---------------------------------------------------------------------------

beforeEach(() => {
  RuleEngine.reset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Import Pipeline Integration', () => {
  // Task 2 — AC2: ingestFile stage
  test('AC2: ingestFile parses Italian credit card fixture', async () => {
    const result = await ingestFile(FIXTURE_PATH);
    if (!result.ok) throw new Error(`ingestFile failed: ${result.error}`);

    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.headerRow).toEqual(EXPECTED_HEADER_ROW);
  });

  // Task 3 — AC3: matchProfile exact match
  test('AC3: matchProfile returns exact match for correct profile', async () => {
    const ingestResult = await ingestFile(FIXTURE_PATH);
    if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

    const profile = buildTestProfile(computeFingerprint(ingestResult.data.headerRow));
    const match = matchProfile(ingestResult.data.headerRow, [profile]);

    expect(match).toEqual({ match: 'exact', profile });
  });

  // Task 3 — AC4: matchProfile no match
  test('AC4: matchProfile returns none for empty profiles list', async () => {
    const ingestResult = await ingestFile(FIXTURE_PATH);
    if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

    const match = matchProfile(ingestResult.data.headerRow, []);
    expect(match).toEqual({ match: 'none' });
  });

  // Task 4 — AC5: deduplicateRows with seeded NDJSON
  test('AC5: deduplicateRows detects seeded pre-existing fingerprint', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });

      const ingestResult = await ingestFile(FIXTURE_PATH);
      if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

      const profile = buildTestProfile(computeFingerprint(ingestResult.data.headerRow));
      const dedupeInput = buildDeduplicateInputFromIngest(
        ingestResult.data.rows,
        ingestResult.data.headerRow,
        profile,
      );

      // Seed one NDJSON line whose `id` matches the first fixture row's fingerprint
      const seededLine = JSON.stringify({
        id: FIRST_ROW_FINGERPRINT,
        date: '2026-01-29',
        amount: -2.8,
        description: 'Operazione presso IL CAFETERO Milano',
        category: 'Others',
        accountId: '',
        importFile: '2026-01-29-001.ndjson',
        notes: '',
      });
      await fs.writeFile(path.join(importsDir, '2026-01-29-001.ndjson'), seededLine, 'utf-8');

      const result = await deduplicateRows(dedupeInput, importsDir);
      if (!result.ok) throw new Error(`deduplicateRows failed: ${result.error}`);

      expect(result.data.overwriteCount).toBe(1);
      expect(result.data.newCount).toBe(dedupeInput.length - 1);
    });
  });

  // Task 5 — AC6+7: executeImport end-to-end write + loadTransactions roundtrip
  test('AC6+7: executeImport writes NDJSON and loadTransactions returns imported rows', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');

      const ingestResult = await ingestFile(FIXTURE_PATH);
      if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

      const profile = buildTestProfile(computeFingerprint(ingestResult.data.headerRow));

      const importResult = await executeImport({
        rows: ingestResult.data.rows,
        headerRow: ingestResult.data.headerRow,
        profile,
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      });
      if (!importResult.ok) throw new Error(`executeImport failed: ${importResult.error}`);

      // AC6: universal accounting — imported + overwritten + failed == total rows from ingest
      const { rowsImported, rowsOverwritten, rowsFailed } = importResult.data;
      expect(rowsImported + rowsOverwritten + rowsFailed).toBe(ingestResult.data.rows.length);
      // The fixture's trailing totals row (;;Totale;-966,43) fails date parse
      expect(rowsFailed).toBe(1);
      expect(rowsImported).toBe(ingestResult.data.rows.length - 1);

      // AC6: at least one .ndjson file written inside importsDir
      const files = await fs.readdir(importsDir);
      expect(files.some((f) => f.endsWith('.ndjson'))).toBe(true);

      // AC7: loadTransactions count matches rowsImported (last-write-wins dedup by id)
      const loadResult = await loadTransactions(importsDir);
      if (!loadResult.ok) throw new Error(`loadTransactions failed: ${loadResult.error}`);
      expect(loadResult.data.length).toBe(rowsImported);
    });
  });

  // Task 6 — AC8: loadAllTransactions covers both imports/ and manual/ directories
  test('AC8: loadAllTransactions includes manual transaction alongside imported ones', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');

      const ingestResult = await ingestFile(FIXTURE_PATH);
      if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

      const profile = buildTestProfile(computeFingerprint(ingestResult.data.headerRow));

      const importResult = await executeImport({
        rows: ingestResult.data.rows,
        headerRow: ingestResult.data.headerRow,
        profile,
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      });
      if (!importResult.ok) throw new Error(`executeImport failed: ${importResult.error}`);

      // Write a manual transaction into manual/
      const manualResult = await writeManualTransaction(dir, {
        date: '2026-03-15',
        description: 'Cash withdrawal',
        amount: -50,
        category: 'Others',
      });
      if (!manualResult.ok) throw new Error(`writeManualTransaction failed: ${manualResult.error}`);

      const allResult = await loadAllTransactions(dir);
      if (!allResult.ok) throw new Error(`loadAllTransactions failed: ${allResult.error}`);

      expect(allResult.data.some((t) => t.id === manualResult.data.id)).toBe(true);
      expect(allResult.data.length).toBe(importResult.data.rowsImported + 1);
    });
  });

  // Task 7 — AC9: second import of same file produces overwrites only
  test('AC9: second import of same rows produces 0 new and all overwrites', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');

      const ingestResult = await ingestFile(FIXTURE_PATH);
      if (!ingestResult.ok) throw new Error(`ingestFile failed: ${ingestResult.error}`);

      const profile = buildTestProfile(computeFingerprint(ingestResult.data.headerRow));
      const params = {
        rows: ingestResult.data.rows,
        headerRow: ingestResult.data.headerRow,
        profile,
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      };

      // First import — establishes fingerprints on disk
      const firstResult = await executeImport(params);
      if (!firstResult.ok) throw new Error(`First executeImport failed: ${firstResult.error}`);
      const totalValidRows = firstResult.data.rowsImported;

      // Second import with identical rows — all existing fingerprints match
      RuleEngine.reset(); // keep singleton clean between calls
      const secondResult = await executeImport(params);
      if (!secondResult.ok) throw new Error(`Second executeImport failed: ${secondResult.error}`);

      expect(secondResult.data.rowsImported).toBe(0);
      expect(secondResult.data.rowsOverwritten).toBe(totalValidRows);
    });
  });
});
