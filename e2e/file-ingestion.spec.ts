import { expect, test, type Page } from '@playwright/test';

type IngestResponse =
  | {
      ok: true;
      result: {
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
    }
  | {
      ok: false;
      error: string;
    };

type MatchResponse =
  | { match: 'exact'; profile: ImportProfile }
  | { match: 'partial'; profile: ImportProfile }
  | { match: 'none' };

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

type E2EScenario = {
  pickerPath?: string | null;
  ingestResponses: IngestResponse[];
  matchResponse?: MatchResponse;
  saveProfileError?: string;
};

async function installIpcMock(page: Page, scenario: E2EScenario) {
  await page.addInitScript((config: E2EScenario) => {
    const queue = [...config.ingestResponses];
    const state = {
      pickerCalls: 0,
      ingestCalls: [] as Array<{ filePath: string; forcedHeaderRowOffset?: number }>,
      droppedPaths: [] as string[][],
      saveProfileCalls: [] as Array<{ profile: unknown }>,
    };

    (window as typeof window & {
      __OUR_EXPENSES_E2E_STATE__?: typeof state;
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_STATE__ = state;

    (window as typeof window & {
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_RPC__ = {
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
        OPEN_FILE_PICKER: () => {
          state.pickerCalls += 1;
          return { path: config.pickerPath ?? null };
        },
        INGEST_FILE: (params: { filePath: string; forcedHeaderRowOffset?: number }) => {
          state.ingestCalls.push(params);
          return queue.shift() ?? { ok: false, error: 'FILE_READ_FAILED' };
        },
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: config.matchResponse ?? { match: 'none' as const } }),
        SAVE_PROFILE: (params: { profile: unknown }) => {
          state.saveProfileCalls.push(params);
          return config.saveProfileError
            ? { ok: false, error: config.saveProfileError }
            : { ok: true };
        },
        EXECUTE_IMPORT: () => ({
          ok: true as const,
          summary: {
            rowsImported: 3,
            rowsOverwritten: 0,
            rowsFailed: 0,
            failedRows: [],
            rowsAutoCategorized: 0,
            rowsInOthers: 3,
            profileName: 'E2E Profile',
            ndjsonFilename: '2026-01-10-001.ndjson',
            importedAt: '2026-01-10T10:00:00.000Z',
          },
        }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
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
        RELOCATE_DATA_FOLDER: () => ({ ok: false, error: 'RELOCATE_DATA_FOLDER_UNAVAILABLE_IN_E2E' }),
        CLOSE_WINDOW: () => ({ ok: true as const }),
        QUIT_APP: () => ({ ok: true as const }),
        MATCH_CATEGORY_FOR_DESCRIPTION: () => ({ ok: true as const, category: null }),
        ADD_MANUAL_TRANSACTION: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_TRANSACTION: () => ({ ok: true as const }),
        BATCH_DELETE_TRANSACTIONS: () => ({ ok: true as const, deleted: 0, failed: 0, errors: [] }),
        BATCH_UPDATE_TRANSACTION_CATEGORIES: () => ({ ok: true as const, updated: 0, failed: 0, errors: [] }),
      },
      messages: {
        FILE_DROPPED: ({ paths }: { paths: string[] }) => {
          state.droppedPaths.push(paths);
        },
        TOGGLE_MAXIMIZE: () => {},
      },
    };
  }, scenario);
}

async function readIpcState(page: Page) {
  return page.evaluate(() => {
    return (window as typeof window & {
      __OUR_EXPENSES_E2E_STATE__?: {
        pickerCalls: number;
        ingestCalls: Array<{ filePath: string; forcedHeaderRowOffset?: number }>;
        droppedPaths: string[][];
        saveProfileCalls: Array<{ profile: unknown }>;
      };
    }).__OUR_EXPENSES_E2E_STATE__;
  });
}

async function dispatchDroppedFile(page: Page, filePath: string) {
  await page.evaluate((path) => {
    const file = new File(['header1,header2'], path.split('/').pop() ?? 'import.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'path', { value: path });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  }, filePath);
}

function buildIngestResult(overrides?: Partial<Extract<IngestResponse, { ok: true }>['result']>) {
  return {
    rows: [
      ['2026-01-01', 'Coffee Shop', '-2.80'],
      ['2026-01-02', 'Groceries', '-41.20'],
      ['2026-01-03', 'Salary', '1200.00'],
    ],
    headerRow: ['Date', 'Description', 'Amount'],
    headerRowOffset: 0,
    confidence: 'high' as const,
    encoding: 'utf-8' as const,
    fileType: 'csv' as const,
    csvDelimiter: ',' as const,
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

test.describe('Story 2.1 file ingestion', () => {
  test('AC2 + AC7: upload button forwards picker path and opens ready wizard for high-confidence import', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();

    await expect(page.getByText('Movimenti_CartaCredito_Gennaio.csv')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New file format detected' })).toBeVisible();
    await expect(page.getByText('No saved profile matched this file.')).toBeVisible();
    await expect(page.getByText('Not assigned yet')).toHaveCount(3);

    const state = await readIpcState(page);
    expect(state).toMatchObject({
      pickerCalls: 1,
      ingestCalls: [{ filePath: pickerPath }],
      droppedPaths: [],
    });
    expect(state?.saveProfileCalls).toHaveLength(0);
  });

  test('AC1 + AC8: dropping a file anywhere forwards its path and allows low-confidence override', async ({ page }) => {
    const droppedPath = '/fixtures/cc_elena_dicembre.csv';
    await installIpcMock(page, {
      ingestResponses: [
        {
          ok: true,
          result: buildIngestResult({
            headerRowOffset: 1,
            confidence: 'low',
            scannedRows: [
              ['Generated by bank'],
              ['Date', 'Description', 'Amount'],
              ['2026-01-01', 'Coffee Shop', '-2.80'],
              ['2026-01-02', 'Groceries', '-41.20'],
            ],
          }),
        },
        {
          ok: true,
          result: buildIngestResult({ headerRowOffset: 2, confidence: 'high' }),
        },
      ],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await dispatchDroppedFile(page, droppedPath);

    await expect(page.getByRole('heading', { name: 'Is this the right starting row?' })).toBeVisible();

    await page.getByRole('row').nth(2).click();
    await page.getByRole('button', { name: 'Confirm row' }).click();

    await expect(page.getByRole('heading', { name: 'New file format detected' })).toBeVisible();

    const state = await readIpcState(page);
    expect(state).toMatchObject({
      pickerCalls: 0,
      ingestCalls: [
        { filePath: droppedPath },
        { filePath: droppedPath, forcedHeaderRowOffset: 2 },
      ],
      droppedPaths: [[droppedPath]],
    });
    expect(state?.saveProfileCalls).toHaveLength(0);
  });

  test('AC9: no detectable table shows a user-facing error', async ({ page }) => {
    const droppedPath = '/fixtures/not-a-table.csv';
    await installIpcMock(page, {
      ingestResponses: [{ ok: false, error: 'NO_TABLE_FOUND' }],
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await dispatchDroppedFile(page, droppedPath);

    await expect(page.getByRole('heading', { name: 'No data table found in this file' })).toBeVisible();
    await expect(page.getByText('Try a different file or verify it contains tabular data')).toBeVisible();

    const state = await readIpcState(page);
    expect(state?.ingestCalls).toEqual([{ filePath: droppedPath }]);
    expect(state?.droppedPaths).toEqual([[droppedPath]]);
  });

  test('Story 2.2 AC2: exact profile match bypasses column mapping and shows confirmation copy', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'exact', profile: buildProfile() },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();

    await expect(page.getByRole('heading', { name: 'Profile matched' })).toBeVisible();
    await expect(page.getByText('This looks like')).toBeVisible();
    await expect(page.getByText('Everyday Bank')).toBeVisible();
    await expect(page.getByText(/3\s+rows ready to import/i)).toBeVisible();
    await expect(page.getByText('The saved profile fingerprint matched exactly, so the column mapping wizard is skipped.')).toBeVisible();
  });

  test('Story 2.2 AC3: partial profile match opens pre-filled mapping state', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: {
        match: 'partial',
        profile: buildProfile({
          columnMap: {
            BookingDate: 'date',
            Narrative: 'description',
            SignedAmount: 'amount',
          },
        }),
      },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();

    await expect(page.getByRole('heading', { name: 'Similar profile found' })).toBeVisible();
    await expect(page.getByText('This file resembles')).toBeVisible();
    await expect(page.getByText('but some columns may have changed.')).toBeVisible();
    await expect(page.getByText('BookingDate')).toBeVisible();
    await expect(page.getByText('Narrative')).toBeVisible();
    await expect(page.getByText('SignedAmount')).toBeVisible();
  });
});

test.describe('Story 2.3 column mapping wizard', () => {
  async function chooseOption(page: Page, comboIndex: number, optionName: string) {
    await page.getByRole('combobox').nth(comboIndex).click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }

  test('AC8 — no-match → column mapping opens with blank dropdowns', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();

    await expect(page.getByRole('heading', { name: 'New file format detected' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();
    await expect(page.getByRole('heading', { name: 'Map your columns' })).toBeVisible();

    // Preview table should show sample rows
    await expect(page.getByText('Coffee Shop')).toBeVisible();
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();

    // Dropdowns should show unassigned (placeholder text visible)
    await expect(page.getByText('Select column for dates')).toBeVisible();
  });

  test('AC2 — selecting Date column → live preview updates', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();
    await expect(page.getByRole('heading', { name: 'Map your columns' })).toBeVisible();

    // Select the Date column
    await chooseOption(page, 0, 'Date');

    // Preview table header should update to show 'Date'
    await expect(page.getByRole('columnheader', { name: 'Date' }).nth(1)).toBeVisible();
    // At least one date value from sample rows should appear
    await expect(page.getByRole('cell', { name: '2026-01-01' }).nth(1)).toBeVisible();
  });

  test('AC6 — Next blocked until all columns assigned, then proceeds to profile naming', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();
    await expect(page.getByRole('heading', { name: 'Map your columns' })).toBeVisible();

    const nextButton = page.getByRole('button', { name: 'Next: name this profile →' });
    await expect(nextButton).toBeDisabled();

    // Assign all 3 columns
    await chooseOption(page, 0, 'Date');
    await chooseOption(page, 1, 'Description');
    await chooseOption(page, 2, 'Amount');

    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(page.getByRole('heading', { name: 'Save import profile' })).toBeVisible();
  });

  test('AC7 — profile naming step saves profile and closes wizard', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();

    await chooseOption(page, 0, 'Date');
    await chooseOption(page, 1, 'Description');
    await chooseOption(page, 2, 'Amount');

    await page.getByRole('button', { name: 'Next: name this profile →' }).click();
    await expect(page.getByRole('heading', { name: 'Save import profile' })).toBeVisible();

    // Profile name input should be pre-filled with the filename (without extension)
    const nameInput = page.getByRole('textbox', { name: 'Profile name' });
    await expect(nameInput).toHaveValue('Movimenti_CartaCredito_Gennaio');

    await page.getByRole('button', { name: 'Save & Import' }).click();

    const state = await readIpcState(page);
    expect(state?.saveProfileCalls).toHaveLength(1);
    // Wizard should be gone
    await expect(page.getByRole('heading', { name: 'Save import profile' })).not.toBeVisible();
  });

  test('AC7 — profile naming step stays open when SAVE_PROFILE fails', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
      saveProfileError: 'SAVE_PROFILE_FAILED',
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

    await expect(page.getByRole('heading', { name: 'Save import profile' })).toBeVisible();
    await expect(page.getByText('Could not save the import profile. Try again.')).toBeVisible();

    const state = await readIpcState(page);
    expect(state?.saveProfileCalls).toHaveLength(1);
  });

  test('AC9 — cancel mid-wizard → SAVE_PROFILE not called', async ({ page }) => {
    const pickerPath = '/fixtures/Movimenti_CartaCredito_Gennaio.csv';
    await installIpcMock(page, {
      pickerPath,
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();
    await expect(page.getByRole('heading', { name: 'Map your columns' })).toBeVisible();

    // Go back to summary
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page.getByRole('heading', { name: 'New file format detected' })).toBeVisible();

    // Close the wizard
    await page.getByRole('button', { name: 'Close' }).first().click();

    const state = await readIpcState(page);
    expect(state?.saveProfileCalls).toHaveLength(0);
  });

  test('AC5 — split debit/credit mode → merged amounts in preview', async ({ page }) => {
    const splitIngestResult = buildIngestResult({
      headerRow: ['Date', 'Description', 'Debit', 'Credit'],
      csvDelimiter: ',',
      rows: [
        ['2026-01-01', 'Coffee Shop', '2.80', ''],
        ['2026-01-02', 'Groceries', '41.20', ''],
        ['2026-01-03', 'Salary', '', '1200.00'],
      ],
    });
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResponses: [{ ok: true, result: splitIngestResult }],
      matchResponse: { match: 'none' },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await page.getByRole('button', { name: 'Continue to column mapping →' }).click();

    // Switch to split mode
    await page.getByLabel('Separate Debit / Credit columns').click();

    // Assign Debit and Credit columns
    await chooseOption(page, 2, 'Debit');
    await chooseOption(page, 3, 'Credit');

    // Coffee Shop: debit=2.80, credit=0 → 0 - 2.80 = -2.80
    await expect(page.getByText('-2.80')).toBeVisible();
    // Salary: debit=0, credit=1200 → 1200 - 0 = 1200.00
    await expect(page.getByRole('cell', { name: '1200.00' }).nth(1)).toBeVisible();
  });

  test('AC8 — partial-match → column mapping opens with pre-filled dropdowns', async ({ page }) => {
    await installIpcMock(page, {
      pickerPath: '/fixtures/Movimenti_CartaCredito_Gennaio.csv',
      ingestResponses: [{ ok: true, result: buildIngestResult() }],
      matchResponse: {
        match: 'partial',
        profile: buildProfile({
          columnMap: { BookingDate: 'date', Narrative: 'description', SignedAmount: 'amount' },
        }),
      },
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Upload expenses' }).click();
    await expect(page.getByRole('heading', { name: 'Similar profile found' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue with pre-filled mapping →' }).click();
    await expect(page.getByRole('heading', { name: 'Map your columns' })).toBeVisible();

    await expect(page.getByRole('combobox').nth(0)).toContainText('BookingDate');
    await expect(page.getByRole('combobox').nth(1)).toContainText('Narrative');
    await expect(page.getByRole('combobox').nth(2)).toContainText('SignedAmount');
    await expect(page.getByRole('button', { name: 'Next: name this profile →' })).toBeDisabled();
  });
});