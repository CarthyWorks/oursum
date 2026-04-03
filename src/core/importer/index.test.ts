import { beforeEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ImportProfile } from '../../shared/types';
import { withTestDataFolder } from '../persistence/test-utils';
import { atomicWrite } from '../persistence/utils';
import { RuleEngine } from '../rules/rule-engine';
import { localeFormatToDateFns, parseDateToISO, resolveBestDateFormat } from './date-parser';
import { parseAmountString } from './amount-parser';
import { generateImportFilename } from './ndjson-filename';
import { buildRoleIndex, mapColumns } from './column-mapper';
import { executeImport } from './index';
import { ingestFile } from '../parser';
import { computeFingerprint } from '../parser/profile-fingerprint';

beforeEach(() => {
  RuleEngine.reset();
});

function createProfile(overrides: Partial<ImportProfile> = {}): ImportProfile {
  return {
    id: 'profile-1',
    name: 'Test profile',
    bankName: 'Test Bank',
    csvDelimiter: ',',
    columnMap: {
      Date: 'date',
      Description: 'description',
      Amount: 'amount',
    },
    dateFormat: 'dd/mm/yyyy',
    amountMultiplier: 1,
    headerRowOffset: 0,
    fingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ...overrides,
  };
}

describe('localeFormatToDateFns', () => {
  test('maps supported locale formats and passes through unknown formats', () => {
    expect(localeFormatToDateFns('dd/mm/yyyy')).toBe('dd/MM/yyyy');
    expect(localeFormatToDateFns('mm/dd/yyyy')).toBe('MM/dd/yyyy');
    expect(localeFormatToDateFns('yyyy-mm-dd')).toBe('yyyy-MM-dd');
    expect(localeFormatToDateFns('custom-format')).toBe('custom-format');
  });
});

describe('parseDateToISO', () => {
  test('parses supported formats and returns null for invalid inputs', () => {
    expect(parseDateToISO('15/01/2025', 'dd/mm/yyyy')).toBe('2025-01-15');
    expect(parseDateToISO('01/15/2025', 'mm/dd/yyyy')).toBe('2025-01-15');
    expect(parseDateToISO('2025-01-15', 'yyyy-mm-dd')).toBe('2025-01-15');
    expect(parseDateToISO('not-a-date', 'dd/mm/yyyy')).toBeNull();
    expect(parseDateToISO('', 'dd/mm/yyyy')).toBeNull();
  });
});

describe('resolveBestDateFormat', () => {
  test('switches away from a stale saved format when another format fits more rows', () => {
    expect(
      resolveBestDateFormat(
        ['30/01/2026', '17/01/2026', '11/01/2026', '03/01/2026'],
        'mm/dd/yyyy',
      ),
    ).toBe('dd/mm/yyyy');
  });

  test('keeps the preferred format when parsing scores are tied', () => {
    expect(resolveBestDateFormat(['01/02/2026', '02/03/2026'], 'mm/dd/yyyy')).toBe('mm/dd/yyyy');
  });
});

describe('parseAmountString', () => {
  test('parses supported amount formats', () => {
    expect(parseAmountString('10.50')).toBe(10.5);
    expect(parseAmountString('10,50')).toBe(10.5);
    expect(parseAmountString('1.234,56')).toBe(1234.56);
    expect(parseAmountString('1,234.56')).toBe(1234.56);
    expect(parseAmountString('-42.00')).toBe(-42);
    expect(parseAmountString('0')).toBe(0);
    expect(parseAmountString('')).toBeNull();
    expect(parseAmountString('N/A')).toBeNull();
  });
});

describe('mapColumns', () => {
  test('maps single-amount mode and exposes role indices', () => {
    const headerRow = ['Date', 'Description', 'Amount'];
    const columnMap = {
      Date: 'date',
      Description: 'description',
      Amount: 'amount',
    };

    expect(buildRoleIndex(headerRow, columnMap)).toEqual({
      date: 0,
      description: 1,
      amount: 2,
    });

    const result = mapColumns(
      [['15/01/2025', 'Coffee Shop', '-4.50']],
      headerRow,
      columnMap,
    );

    expect(result.failedIndices).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowIndex: 0,
        rawDate: '15/01/2025',
        rawAmount: '-4.50',
        rawDebit: null,
        rawCredit: null,
        rawDescription: 'Coffee Shop',
      },
    ]);
  });

  test('maps split debit-credit mode', () => {
    const result = mapColumns(
      [['15/01/2025', 'Salary', '0', '1200']],
      ['Date', 'Description', 'Debit', 'Credit'],
      {
        Date: 'date',
        Description: 'description',
        Debit: 'debit',
        Credit: 'credit',
      },
    );

    expect(result.failedIndices).toEqual([]);
    expect(result.rows[0]).toEqual({
      sourceRowIndex: 0,
      rawDate: '15/01/2025',
      rawAmount: '',
      rawDebit: '0',
      rawCredit: '1200',
      rawDescription: 'Salary',
    });
  });

  test('tracks rows that cannot be mapped because required columns are missing', () => {
    const result = mapColumns(
      [['15/01/2025', 'Coffee Shop', '-4.50']],
      ['Date', 'Description', 'Amount'],
      {
        Date: 'date',
        Description: 'description',
        MissingAmount: 'amount',
      },
    );

    expect(result.rows).toEqual([]);
    expect(result.failedIndices).toEqual([0]);
  });
});

describe('generateImportFilename', () => {
  test('returns 001 for an empty directory', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await generateImportFilename(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(`${new Date().toISOString().slice(0, 10)}-001.ndjson`);
    });
  });

  test('increments the sequence for files from the current day', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      const today = new Date().toISOString().slice(0, 10);
      await fs.writeFile(path.join(importsDir, `${today}-001.ndjson`), '', 'utf-8');
      await fs.writeFile(path.join(importsDir, `${today}-007.ndjson`), '', 'utf-8');

      const result = await generateImportFilename(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(`${today}-008.ndjson`);
    });
  });

  test('ignores files from previous days when generating the sequence', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await fs.mkdir(importsDir, { recursive: true });
      await fs.writeFile(path.join(importsDir, '2025-01-01-042.ndjson'), '', 'utf-8');

      const result = await generateImportFilename(importsDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(`${new Date().toISOString().slice(0, 10)}-001.ndjson`);
    });
  });
});

describe('executeImport', () => {
  test('applies saved rules during import and updates categorization counts', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      await atomicWrite(
        path.join(dir, 'rules.json'),
        JSON.stringify([
          { id: 'rule-1', pattern: 'Coffee', category: 'Groceries', matchType: 'contains' },
        ]),
      );

      const result = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['16/01/2025', 'Lunch', '-12.00'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.data.rowsAutoCategorized).toBe(1);
      expect(result.data.rowsInOthers).toBe(1);

      const ndjsonContent = await fs.readFile(path.join(importsDir, result.data.ndjsonFilename), 'utf-8');
      const transactions = ndjsonContent
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { category: string; description: string });

      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toMatchObject({ category: 'Groceries', description: 'Coffee Shop' });
      expect(transactions[1]).toMatchObject({ category: 'Others', description: 'Lunch' });
    });
  });

  test('imports new rows, writes NDJSON, and appends the import log', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['16/01/2025', 'Lunch', '-12.00'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.data.rowsImported).toBe(2);
      expect(result.data.rowsOverwritten).toBe(0);
      expect(result.data.rowsFailed).toBe(0);
      expect(result.data.failedRows).toEqual([]);
      expect(result.data.rowsAutoCategorized).toBe(0);
      expect(result.data.rowsInOthers).toBe(2);

      const ndjsonPath = path.join(importsDir, result.data.ndjsonFilename);
      const ndjsonContent = await fs.readFile(ndjsonPath, 'utf-8');
      const lines = ndjsonContent.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).importFile).toBe(result.data.ndjsonFilename);

      const logContent = await fs.readFile(path.join(dir, 'import-log.ndjson'), 'utf-8');
      const logLines = logContent.trim().split('\n');
      expect(logLines).toHaveLength(1);
      expect(JSON.parse(logLines[0])).toMatchObject({
        originalFilename: 'bank-export.csv',
        profileName: 'Test profile',
        rowsImported: 2,
        rowsOverwritten: 0,
      });
    });
  });

  test('counts re-imported rows as overwrites and still writes a new NDJSON file', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const firstImport = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['16/01/2025', 'Lunch', '-12.00'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });
      expect(firstImport.ok).toBe(true);

      const secondImport = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['16/01/2025', 'Lunch', '-12.00'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(secondImport.ok).toBe(true);
      if (!secondImport.ok) {
        return;
      }

      expect(secondImport.data.rowsImported).toBe(0);
      expect(secondImport.data.rowsOverwritten).toBe(2);
      const files = await fs.readdir(importsDir);
      expect(files.filter((file) => file.endsWith('.ndjson')).length).toBe(2);
    });
  });

  test('drops rows with unparseable dates and records them as failures', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['not-a-date', 'Broken Row', '-12.00'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.data.rowsImported).toBe(1);
      expect(result.data.rowsFailed).toBe(1);
      expect(result.data.failedRows).toEqual([
        {
          rowNumber: 2,
          reason: 'invalid-date',
          rawRow: ['not-a-date', 'Broken Row', '-12.00'],
        },
      ]);

      const logContent = await fs.readFile(path.join(dir, 'import-log.ndjson'), 'utf-8');
      expect(JSON.parse(logContent.trim()).rowsFailed).toBe(1);
    });
  });

  test('recovers from a stale exact-match profile date format when the batch clearly fits another format', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await executeImport({
        rows: [
          ['30/01/2026', 'Coffee Shop', '-4.50'],
          ['17/01/2026', 'Lunch', '-12.00'],
          ['11/01/2026', 'Bakery', '-3.10'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile({ dateFormat: 'mm/dd/yyyy' }),
        originalFilename: 'cc_alessia_gennaio.xlsx',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.data.rowsImported).toBe(3);
      expect(result.data.rowsFailed).toBe(0);
      expect(result.data.failedRows).toEqual([]);

      const ndjsonPath = path.join(importsDir, result.data.ndjsonFilename);
      const ndjsonContent = await fs.readFile(ndjsonPath, 'utf-8');
      const firstRow = JSON.parse(ndjsonContent.split('\n')[0]) as { date: string };
      expect(firstRow.date).toBe('2026-01-30');
    });
  });

  test('captures invalid amount failures with row details', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await executeImport({
        rows: [
          ['15/01/2025', 'Coffee Shop', '-4.50'],
          ['16/01/2025', 'Broken Amount', 'N/A'],
        ],
        headerRow: ['Date', 'Description', 'Amount'],
        profile: createProfile(),
        originalFilename: 'bank-export.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.data.rowsImported).toBe(1);
      expect(result.data.failedRows).toEqual([
        {
          rowNumber: 2,
          reason: 'invalid-amount',
          rawRow: ['16/01/2025', 'Broken Amount', 'N/A'],
        },
      ]);
    });
  });

  test('imports split debit/credit rows where one column is blank per row', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const result = await executeImport({
        rows: [
          ['15/01/2025', 'Salary', '', '1200.00'],
          ['16/01/2025', 'Transfer out', '50.00', ''],
        ],
        headerRow: ['Date', 'Description', 'Debit', 'Credit'],
        profile: createProfile({
          columnMap: {
            Date: 'date',
            Description: 'description',
            Debit: 'debit',
            Credit: 'credit',
          },
        }),
        originalFilename: 'bank-split.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.rowsImported).toBe(2);
      expect(result.data.rowsFailed).toBe(0);
      const ndjsonContent = await fs.readFile(path.join(importsDir, result.data.ndjsonFilename), 'utf-8');
      const lines = ndjsonContent.split('\n').filter(Boolean);
      expect(lines).toHaveLength(2);
      expect((JSON.parse(lines[0]) as { amount: number }).amount).toBe(1200);
      expect((JSON.parse(lines[1]) as { amount: number }).amount).toBe(-50);
    });
  });
});

describe('Full pipeline integration (real fixture)', () => {
  const FIXTURE_PATH = path.resolve(
    import.meta.dir,
    '../../../data/test/import-fixtures/italian/Movimenti_CartaCredito_0000_20260101_20260131.csv',
  );

  function italianCardProfile(): ImportProfile {
    return {
      id: 'profile-italian-card',
      name: 'Italian Credit Card',
      bankName: 'Italian Bank',
      csvDelimiter: ';',
      columnMap: {
        'DATA OPERAZIONE': 'date',
        'DESCRIZIONE OPERAZIONE': 'description',
        'IMPORTO IN EURO': 'amount',
      },
      dateFormat: 'dd/mm/yyyy',
      amountMultiplier: 1,
      headerRowOffset: 0,
      fingerprint: computeFingerprint([
        'DATA OPERAZIONE',
        'DATA REGISTRAZIONE',
        'DESCRIZIONE OPERAZIONE',
        'IMPORTO IN EURO',
      ]),
    };
  }

  test('ingestFile parses the Italian CSV and executeImport applies a categorization rule', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');

      await atomicWrite(
        path.join(dir, 'rules.json'),
        JSON.stringify([
          { id: 'rule-cafetero', matchType: 'contains', pattern: 'CAFETERO', category: 'Restaurants' },
        ]),
      );

      const ingestResult = await ingestFile(FIXTURE_PATH);
      expect(ingestResult.ok).toBe(true);
      if (!ingestResult.ok) return;

      expect(ingestResult.data.rows.length).toBe(35);
      expect(ingestResult.data.confidence).toBe('high');
      expect(ingestResult.data.csvDelimiter).toBe(';');

      const result = await executeImport({
        rows: ingestResult.data.rows,
        headerRow: ingestResult.data.headerRow,
        profile: italianCardProfile(),
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.rowsImported).toBe(34);
      expect(result.data.rowsOverwritten).toBe(0);
      expect(result.data.rowsFailed).toBe(1); // summary row ";;Totale;-966,43" has no date
      expect(result.data.rowsAutoCategorized).toBe(1); // 'IL CAFETERO Milano'
      expect(result.data.rowsInOthers).toBe(33);
    });
  });

  test('second import of the same file counts all rows as overwrites due to deduplication', async () => {
    await withTestDataFolder(async (dir) => {
      const importsDir = path.join(dir, 'imports');
      const profile = italianCardProfile();

      const ingestResult = await ingestFile(FIXTURE_PATH);
      expect(ingestResult.ok).toBe(true);
      if (!ingestResult.ok) return;

      const { rows, headerRow } = ingestResult.data;

      const firstImport = await executeImport({
        rows,
        headerRow,
        profile,
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      });
      expect(firstImport.ok).toBe(true);
      if (!firstImport.ok) return;
      expect(firstImport.data.rowsImported).toBe(34);

      const secondImport = await executeImport({
        rows,
        headerRow,
        profile,
        originalFilename: 'Movimenti_CartaCredito_0000_20260101_20260131.csv',
        importsDir,
        dataFolderPath: dir,
      });
      expect(secondImport.ok).toBe(true);
      if (!secondImport.ok) return;

      expect(secondImport.data.rowsImported).toBe(0);
      expect(secondImport.data.rowsOverwritten).toBe(34);
      expect(secondImport.data.rowsFailed).toBe(1);
    });
  });
});