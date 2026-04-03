// e2e/preferences-popover.spec.ts
import { test, expect, type Page } from '@playwright/test';

async function installIpcMock(page: Page) {
  await page.addInitScript(() => {
    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false as const, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: false,
          detectedLocale: {
            language: 'en',
            numberFormat: '1,234.56',
            dateFormat: 'dd/mm/yyyy',
            currencySymbol: '€',
          },
          savedPreferences: {
            language: 'en',
            numberFormat: '1,234.56',
            dateFormat: 'dd/mm/yyyy',
            currencySymbol: '€',
            theme: 'mountain',
          },
          platform: 'darwin',
          dataFolderPath: '/tmp/oursum-e2e',
        }),
        SAVE_PREFERENCES: () => ({ ok: true as const }),
        UPDATE_PREFERENCES: () => ({ ok: true as const }),
        OPEN_FOLDER_PICKER: () => ({ path: null }),
        OPEN_DATA_FOLDER: () => ({ ok: true as const }),
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true as const }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
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
        RELOCATE_DATA_FOLDER: () => ({ ok: false as const, error: 'RELOCATE_DATA_FOLDER_UNAVAILABLE_IN_E2E' }),
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
  });
}

test.describe('PreferencesPopover', () => {
  test.beforeEach(async ({ page }) => {
    await installIpcMock(page);
  });

  test('AC2: language change updates visible home-screen copy immediately', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.locator('select').first().selectOption('it');

    await expect(page.getByRole('heading', { name: 'Nessuna transazione' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carica spese' })).toBeVisible();
  });

  test('AC10: default data-theme is mountain on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('mountain');
  });

  test('AC11: gear button opens preferences popover', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const trigger = page.getByRole('button', { name: 'Preferences' });
    await trigger.click();
    // Radix Popover renders into a portal; locate by the Done button
    await expect(page.getByRole('button', { name: /done/i })).toBeVisible();
  });

  test('AC12: Seaside light button switches data-theme to seaside', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.getByRole('button', { name: /seaside light/i }).click();
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('seaside');
  });

  test('AC13: Done button closes the popover', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Preferences' }).click();
    const done = page.getByRole('button', { name: /done/i });
    await expect(done).toBeVisible();
    await done.click();
    await expect(done).not.toBeVisible();
  });
});
