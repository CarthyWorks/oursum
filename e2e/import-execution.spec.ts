import { expect, test, type Page } from '@playwright/test';

// ── Shared types ─────────────────────────────────────────────────────────────

type ImportProfile = {
  id: string;
  name: string;
  bankName: string;
  csvDelimiter: string;
  columnMap: Record<string, string>;
  dateFormat: string;
  amountMultiplier: number;
  headerRowOffset: number;
  fingerprint: string;
};

type ImportSummary = {
  rowsImported: number;
  rowsOverwritten: number;
  rowsFailed: number;
  failedRows: Array<{ rowNumber: number; reason: string; rawRow: string[] }>;
  rowsAutoCategorized: number;
  rowsInOthers: number;
  profileName: string;
  ndjsonFilename: string;
  importedAt: string;
};

type ImportLogEntry = {
  importedAt: string;
  originalFilename: string;
  ndjsonFilename: string;
  profileName: string;
  rowsImported: number;
  rowsOverwritten: number;
  rowsFailed: number;
  rowsAutoCategorized: number;
  rowsInOthers: number;
};

type IngestResult = {
  rows: string[][];
  headerRow: string[];
  headerRowOffset: number;
  confidence: 'high' | 'low';
  encoding: 'utf-8' | 'windows-1252' | 'iso-8859-1';
  fileType: 'csv' | 'xlsx';
  csvDelimiter: string | null;
  parseErrors: string[];
  scannedRows: string[][];
};

type MatchResponse =
  | { match: 'exact'; profile: ImportProfile }
  | { match: 'partial'; profile: ImportProfile }
  | { match: 'none' };

type E2EScenario = {
  pickerPath?: string | null;
  ingestResult?: IngestResult;
  matchResponse?: MatchResponse;
  executeImportResponse?: { ok: true; summary: ImportSummary } | { ok: false; error: string };
  importHistoryResponse?: { ok: true; entries: ImportLogEntry[] } | { ok: false; error: string };
};

// ── Test helpers ─────────────────────────────────────────────────────────────

async function installIpcMock(page: Page, scenario: E2EScenario) {
  await page.addInitScript((config: E2EScenario) => {
    const state = {
      executeImportCalls: [] as Array<{
        rows: string[][];
        headerRow: string[];
        profile: ImportProfile;
        originalFilename: string;
      }>,
      getImportHistoryCalls: 0,
      saveProfileCalls: [] as Array<{ profile: unknown }>,
    };

    (window as typeof window & { __OUR_EXPENSES_E2E_STATE__?: typeof state }).__OUR_EXPENSES_E2E_STATE__ = state;

    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: false,
          detectedLocale: {
            language: 'en',
            numberFormat: '1,234.56',
            dateFormat: 'dd/mm/yyyy',
            currencySymbol: '€',
          },
          savedPreferences: null,
          platform: 'darwin',
          dataFolderPath: '',
        }),
        SAVE_PREFERENCES: () => ({ ok: true }),
        UPDATE_PREFERENCES: () => ({ ok: true }),
        OPEN_FOLDER_PICKER: () => ({ path: null }),
        OPEN_DATA_FOLDER: () => ({ ok: true }),
        OPEN_FILE_PICKER: () => ({ path: config.pickerPath ?? null }),
        INGEST_FILE: () =>
          config.ingestResult
            ? { ok: true as const, result: config.ingestResult }
            : { ok: false as const, error: 'FILE_READ_FAILED' },
        MATCH_IMPORT_PROFILE: () => ({
          ok: true as const,
          result: config.matchResponse ?? { match: 'none' as const },
        }),
        SAVE_PROFILE: (params: { profile: unknown }) => {
          state.saveProfileCalls.push(params);
          return { ok: true };
        },
        EXECUTE_IMPORT: (params: {
          rows: string[][];
          headerRow: string[];
          profile: ImportProfile;
          originalFilename: string;
        }) => {
          state.executeImportCalls.push(params);
          return (
            config.executeImportResponse ?? {
              ok: true as const,
              summary: {
                rowsImported: 3,
                rowsOverwritten: 0,
                rowsFailed: 0,
                failedRows: [],
                rowsAutoCategorized: 0,
                rowsInOthers: 3,
                profileName: 'Everyday Bank',
                ndjsonFilename: '2026-01-10-001.ndjson',
                importedAt: '2026-01-10T10:00:00.000Z',
              },
            }
          );
        },
        GET_IMPORT_HISTORY: () => {
          state.getImportHistoryCalls++;
          return (
            config.importHistoryResponse ?? {
              ok: true as const,
              entries: [],
            }
          );
        },
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: [] }),
        GET_CATEGORIES: () => ({ ok: true as const, categories: [] }),
        ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_RULES: () => ({ ok: true as const, rules: [] }),
        SAVE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        UPDATE_TRANSACTION_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        PREVIEW_RULE_MATCHES: () => ({ ok: true as const, transactions: [] }),
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RELOCATE_DATA_FOLDER: () => ({
          ok: false,
          error: 'RELOCATE_DATA_FOLDER_UNAVAILABLE_IN_E2E',
        }),
        CLOSE_WINDOW: () => ({ ok: true as const }),
        QUIT_APP: () => ({ ok: true as const }),
        MATCH_CATEGORY_FOR_DESCRIPTION: () => ({ ok: true as const, category: null }),
        ADD_MANUAL_TRANSACTION: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_TRANSACTION: () => ({ ok: true as const }),
        BATCH_DELETE_TRANSACTIONS: () => ({ ok: true as const, deleted: 0, failed: 0, errors: [] }),
        BATCH_UPDATE_TRANSACTION_CATEGORIES: () => ({ ok: true as const, updated: 0, failed: 0, errors: [] }),
      },
      messages: {
        FILE_DROPPED: () => {},
        TOGGLE_MAXIMIZE: () => {},
      },
    };
  }, scenario);
}

async function readIpcState(page: Page) {
  return page.evaluate(() => {
    return (
      window as typeof window & {
        __OUR_EXPENSES_E2E_STATE__?: {
          executeImportCalls: Array<{
            rows: string[][];
            headerRow: string[];
            profile: ImportProfile;
            originalFilename: string;
          }>;
          getImportHistoryCalls: number;
          saveProfileCalls: Array<{ profile: unknown }>;
        };
      }
    ).__OUR_EXPENSES_E2E_STATE__;
  });
}

function buildIngestResult(overrides?: Partial<IngestResult>): IngestResult {
  return {
    rows: [
      ['2026-01-01', 'Coffee Shop', '-2.80'],
      ['2026-01-02', 'Groceries', '-41.20'],
      ['2026-01-03', 'Salary', '1200.00'],
    ],
    headerRow: ['Date', 'Description', 'Amount'],
    headerRowOffset: 0,
    confidence: 'high',
    encoding: 'utf-8',
    fileType: 'csv',
    csvDelimiter: ',',
    parseErrors: [],
    scannedRows: [
      ['Date', 'Description', 'Amount'],
      ['2026-01-01', 'Coffee Shop', '-2.80'],
      ['2026-01-02', 'Groceries', '-41.20'],
      ['2026-01-03', 'Salary', '1200.00'],
    ],
    ...overrides,
  };
}

function buildProfile(overrides?: Partial<ImportProfile>): ImportProfile {
  return {
    id: 'profile-1',
    name: 'Everyday Bank',
    bankName: 'Everyday Bank',
    csvDelimiter: ',',
    columnMap: {
      Date: 'date',
      Description: 'description',
      Amount: 'amount',
    },
    dateFormat: 'dd/mm/yyyy',
    amountMultiplier: 1,
    headerRowOffset: 0,
    fingerprint: 'a'.repeat(64),
    ...overrides,
  };
}

async function chooseOption(page: Page, comboIndex: number, optionName: string) {
  await page.getByRole('combobox').nth(comboIndex).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

// ── Story 2.5 tests ───────────────────────────────────────────────────────────

test.describe('Story 2.5: import execution, summary card & history', () => {
  test('AC2: exact-match flow shows Import button and calls EXECUTE_IMPORT on click', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await expect(page.getByRole('heading', { name: 'Profile matched' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    const state = await readIpcState(page);
    expect(state?.executeImportCalls).toHaveLength(1);
    expect(state?.executeImportCalls[0]).toMatchObject({
      headerRow: ['Date', 'Description', 'Amount'],
      originalFilename: 'bank-export.csv',
    });
    expect(state?.executeImportCalls[0].rows).toHaveLength(3);
  });

  test('AC2: wizard closes after successful import from exact-match screen', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await expect(page.getByRole('heading', { name: 'Profile matched' })).toBeVisible();

    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Profile matched' })).not.toBeVisible();
  });

  test('AC4: post-import summary card shows exact counts after exact-match import', async ({ page }) => {
    const summary: ImportSummary = {
      rowsImported: 3,
      rowsOverwritten: 1,
      rowsFailed: 0,
      failedRows: [],
      rowsAutoCategorized: 0,
      rowsInOthers: 3,
      profileName: 'Everyday Bank',
      ndjsonFilename: '2026-01-10-001.ndjson',
      importedAt: '2026-01-10T10:00:00.000Z',
    };

    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: { ok: true, summary },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText('Import complete')).toBeVisible();
    await expect(page.getByText('Profile: Everyday Bank')).toBeVisible();
    await expect(page.getByText(/3\s+rows imported/i)).toBeVisible();
    await expect(page.getByText(/1\s+rows? overwritten/i)).toBeVisible();
    await expect(page.getByText(/3\s+rows in Others/i)).toBeVisible();
    await expect(page.getByText(/0\s+rows? failed/i)).toBeVisible();
  });

  test('AC5: "Others" count shown as plain text without navigation', async ({ page }) => {
    const summary: ImportSummary = {
      rowsImported: 2,
      rowsOverwritten: 0,
      rowsFailed: 0,
      failedRows: [],
      rowsAutoCategorized: 0,
      rowsInOthers: 2,
      profileName: 'Everyday Bank',
      ndjsonFilename: '2026-01-10-001.ndjson',
      importedAt: '2026-01-10T10:00:00.000Z',
    };

    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: { ok: true, summary },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText(/2\s+rows in Others/i)).toBeVisible();
    // The Others count must NOT be a link
    await expect(page.getByRole('link', { name: /Others/i })).not.toBeVisible();
  });

  test('AC6: "View import history" link hidden when rowsFailed is 0', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: {
        ok: true,
        summary: {
          rowsImported: 3,
          rowsOverwritten: 0,
          rowsFailed: 0,
          failedRows: [],
          rowsAutoCategorized: 0,
          rowsInOthers: 3,
          profileName: 'Everyday Bank',
          ndjsonFilename: '2026-01-10-001.ndjson',
          importedAt: '2026-01-10T10:00:00.000Z',
        },
      },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText('Import complete')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View import history' })).not.toBeVisible();
  });

  test('AC6: "View import history" link shown when rowsFailed > 0', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: {
        ok: true,
        summary: {
          rowsImported: 2,
          rowsOverwritten: 0,
          rowsFailed: 1,
          failedRows: [{ rowNumber: 3, reason: 'invalid-date', rawRow: ['bad', 'Salary', '1200.00'] }],
          rowsAutoCategorized: 0,
          rowsInOthers: 2,
          profileName: 'Everyday Bank',
          ndjsonFilename: '2026-01-10-001.ndjson',
          importedAt: '2026-01-10T10:00:00.000Z',
        },
      },
      importHistoryResponse: { ok: true, entries: [] },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText(/1\s+rows? failed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'View import history' })).toBeVisible();
  });

  test('AC7: opening import history calls GET_IMPORT_HISTORY and renders entries', async ({ page }) => {
    const entries: ImportLogEntry[] = [
      {
        importedAt: '2026-01-10T10:00:00.000Z',
        originalFilename: 'bank-export.csv',
        ndjsonFilename: '2026-01-10-001.ndjson',
        profileName: 'Everyday Bank',
        rowsImported: 2,
        rowsOverwritten: 0,
        rowsFailed: 1,
        rowsAutoCategorized: 0,
        rowsInOthers: 2,
      },
    ];

    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: {
        ok: true,
        summary: {
          rowsImported: 2,
          rowsOverwritten: 0,
          rowsFailed: 1,
          failedRows: [{ rowNumber: 3, reason: 'invalid-date', rawRow: ['bad', 'Salary', '1200.00'] }],
          rowsAutoCategorized: 0,
          rowsInOthers: 2,
          profileName: 'Everyday Bank',
          ndjsonFilename: '2026-01-10-001.ndjson',
          importedAt: '2026-01-10T10:00:00.000Z',
        },
      },
      importHistoryResponse: { ok: true, entries },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await page.getByRole('button', { name: 'View import history' }).click();

    const state = await readIpcState(page);
    expect(state?.getImportHistoryCalls).toBe(1);

    await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'bank-export.csv' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Everyday Bank' })).toBeVisible();
  });

  test('AC7: import history panel shows empty state when no imports exist', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: {
        ok: true,
        summary: {
          rowsImported: 0,
          rowsOverwritten: 0,
          rowsFailed: 1,
          failedRows: [{ rowNumber: 1, reason: 'invalid-date', rawRow: ['bad'] }],
          rowsAutoCategorized: 0,
          rowsInOthers: 0,
          profileName: 'Everyday Bank',
          ndjsonFilename: '2026-01-10-001.ndjson',
          importedAt: '2026-01-10T10:00:00.000Z',
        },
      },
      importHistoryResponse: { ok: true, entries: [] },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.getByRole('button', { name: 'View import history' }).click();

    await expect(page.getByText('No imports yet')).toBeVisible();
  });

  test('AC9: dismiss button closes the post-import summary card', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText('Import complete')).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByText('Import complete')).not.toBeVisible();
  });

  test('AC9: clicking elsewhere in the workspace closes the post-import summary card', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByText('Import complete')).toBeVisible();

    await page.getByRole('region', { name: 'Summary statistics' }).click();

    await expect(page.getByText('Import complete')).not.toBeVisible();
  });

  test('EXECUTE_IMPORT error: wizard stays open with error message', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/bank-export.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'exact', profile: buildProfile() },
      executeImportResponse: { ok: false, error: 'DISK_FULL' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await expect(page.getByRole('heading', { name: 'Profile matched' })).toBeVisible();

    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Profile matched' })).toBeVisible();
    await expect(page.getByText('Import failed. Please try again.')).toBeVisible();
  });

  test('AC2 + AC4: column-mapping → Save & Import flow calls EXECUTE_IMPORT and shows summary', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResult: buildIngestResult(),
      matchResponse: { match: 'none' },
      executeImportResponse: {
        ok: true,
        summary: {
          rowsImported: 3,
          rowsOverwritten: 0,
          rowsFailed: 0,
          failedRows: [],
          rowsAutoCategorized: 0,
          rowsInOthers: 3,
          profileName: 'Movimenti_CartaCredito_Gennaio',
          ndjsonFilename: '2026-01-10-001.ndjson',
          importedAt: '2026-01-10T10:00:00.000Z',
        },
      },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();
    await chooseOption(page, 0, 'Date');
    await chooseOption(page, 1, 'Description');
    await chooseOption(page, 2, 'Amount');
    await page.getByRole('button', { name: 'Next: name this profile →' }).click();
    await page.getByRole('button', { name: 'Save & Import' }).click();

    const state = await readIpcState(page);
    expect(state?.executeImportCalls).toHaveLength(1);
    expect(state?.saveProfileCalls).toHaveLength(1);

    await expect(page.getByText('Import complete')).toBeVisible();
    await expect(page.getByText(/3\s+rows imported/i)).toBeVisible();
  });
});
