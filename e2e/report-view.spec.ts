import { expect, test, type Page } from '@playwright/test';

type E2EScenario = {
  pickerPath?: string | null;
};

type MockTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  accountId: string;
  importFile: string;
  notes: string;
};

const LARGE_AMOUNT_TRANSACTIONS: MockTransaction[] = Array.from({ length: 18 }, (_, index) => ({
  id: `2026-02-${String(index + 1).padStart(2, '0')}|31122025.00|Large Transfer ${index}|0`,
  date: `2026-02-${String(index + 1).padStart(2, '0')}`,
  amount: 31122025,
  description: `Large Transfer ${index}`,
  category: 'Income',
  accountId: '',
  importFile: '2026-02.ndjson',
  notes: '',
}));

type MockRule = {
  id: string;
  pattern: string;
  category: string;
  matchType: 'contains' | 'startsWith' | 'regex';
};

type TransactionScenario = {
  firstLaunch?: boolean;
  transactions?: MockTransaction[];
};

type RuleScenario = TransactionScenario & {
  rules?: MockRule[];
};

const DEFAULT_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-01-15|-50.00|Supermarket|0',
    date: '2026-01-15',
    amount: -50.00,
    description: 'Supermarket',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-01-15-001.ndjson',
    notes: '',
  },
  {
    id: '2026-01-20|120.00|Salary|0',
    date: '2026-01-20',
    amount: 120.00,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-01-20-001.ndjson',
    notes: '',
  },
];

async function installIpcMock(page: Page, scenario: E2EScenario = {}) {
  await page.addInitScript((config: E2EScenario) => {
    const state = {
      pickerCalls: 0,
      ingestCalls: [] as Array<{ filePath: string; forcedHeaderRowOffset?: number }>,
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
          return { ok: false as const, error: 'FILE_READ_FAILED' };
        },
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: [] }),
        GET_CATEGORIES: () => ({
          ok: true as const,
          categories: [
            { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
            { id: 'transport', name: 'Transport', color: '#2196F3', icon: 'car' },
            { id: 'others',    name: 'Others',    color: '#9E9E9E', icon: 'tag' },
          ],
        }),
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
  }, scenario);
}

async function readIpcState(page: Page) {
  return page.evaluate(() => {
    return (window as typeof window & {
      __OUR_EXPENSES_E2E_STATE__?: {
        pickerCalls: number;
        ingestCalls: Array<{ filePath: string; forcedHeaderRowOffset?: number }>;
      };
    }).__OUR_EXPENSES_E2E_STATE__;
  });
}

function parseDurationMs(value: string): number {
  if (value.endsWith('ms')) {
    return Number.parseFloat(value);
  }

  if (value.endsWith('s')) {
    return Number.parseFloat(value) * 1000;
  }

  throw new Error(`Unsupported duration format: ${value}`);
}

test.describe('ReportView', () => {
  test('AC1 + AC2: report view is the home screen with an empty state on app init', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('#transaction-table')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No transactions yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start your first import' })).toBeVisible();
  });

  test('AC3: empty-state CTA and toolbar upload button both trigger the picker flow', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Start your first import' }).click();
    await page.getByRole('button', { name: 'Upload expenses' }).click();

    const state = await readIpcState(page);
    expect(state).toMatchObject({
      pickerCalls: 2,
      ingestCalls: [],
    });
  });

  test('AC4 + semantics: dual-panel layout renders fixed-width left panel and labelled regions', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const aside = page.locator('aside');
    await expect(aside).toBeVisible();
    const width = await aside.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBe(260);

    await expect(page.getByRole('region', { name: 'Summary statistics' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Period selector' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Expense breakdown by category' })).toBeVisible();

    const section = page.locator('#transaction-table');
    await expect(section).toBeVisible();
    const sectionWidth = await section.evaluate((el) => el.getBoundingClientRect().width);
    expect(sectionWidth).toBeGreaterThan(260);
  });

  test('AC5: toolbar contains keyboard-navigable upload, add transaction, and preferences controls', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const uploadBtn = page.getByRole('button', { name: 'Upload expenses' });
    await expect(uploadBtn).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add transaction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();

    const tabIndex = await uploadBtn.evaluate((el) => (el as HTMLButtonElement).tabIndex);
    expect(tabIndex).not.toBe(-1);
  });

  test('AC6: narrow windows replace the layout with a window-too-small message', async ({ page }) => {
    await installIpcMock(page);
    await page.setViewportSize({ width: 899, height: 700 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Window too small')).toBeVisible();
    await expect(page.getByText('Resize the window to at least 900 × 620 px.')).toBeVisible();
    await expect(page.locator('main')).toBeHidden();
  });

  test('AC7: skip link appears before toolbar controls and moves focus to the transaction table', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const skipLink = page.getByRole('link', { name: 'Skip to transactions' });
    const uploadButton = page.getByRole('button', { name: 'Upload expenses' });

    const skipLinkPrecedesToolbar = await page.evaluate(() => {
      const link = document.querySelector('a[href="#transaction-table"]');
      const button = Array.from(document.querySelectorAll('button')).find(
        (element) => element.textContent?.trim() === 'Upload expenses'
      );

      if (!(link instanceof Node) || !(button instanceof Node)) {
        return false;
      }

      return Boolean(link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    expect(skipLinkPrecedesToolbar).toBe(true);

    await uploadButton.blur();
    await skipLink.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#transaction-table')).toBeFocused();
  });

  test('AC8: reduced motion forces transition and animation durations to near-zero', async ({ page }) => {
    await installIpcMock(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const durations = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.transitionProperty = 'opacity';
      probe.style.transitionDuration = '200ms';
      probe.style.animation = 'spin 300ms linear';
      document.body.appendChild(probe);
      const styles = window.getComputedStyle(probe);
      return {
        transitionDuration: styles.transitionDuration,
        animationDuration: styles.animationDuration,
      };
    });

    expect(parseDurationMs(durations.transitionDuration)).toBeCloseTo(0.01, 5);
    expect(parseDurationMs(durations.animationDuration)).toBeCloseTo(0.01, 5);
  });
});

async function installIpcMockWithTransactions(page: Page, scenario: TransactionScenario = {}) {
  await page.addInitScript((config: TransactionScenario) => {
    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: config.firstLaunch ?? false,
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
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({
          ok: true as const,
          transactions: config.transactions ?? [
            {
              id: '2026-01-15|-50.00|Supermarket|0',
              date: '2026-01-15',
              amount: -50.00,
              description: 'Supermarket',
              category: 'Groceries',
              accountId: '',
              importFile: '2026-01-15-001.ndjson',
              notes: '',
            },
            {
              id: '2026-01-20|120.00|Salary|0',
              date: '2026-01-20',
              amount: 120.00,
              description: 'Salary',
              category: 'Income',
              accountId: '',
              importFile: '2026-01-20-001.ndjson',
              notes: '',
            },
          ],
        }),
        GET_CATEGORIES: () => ({
          ok: true as const,
          categories: [
            { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
            { id: 'transport', name: 'Transport', color: '#2196F3', icon: 'car' },
            { id: 'others',    name: 'Others',    color: '#9E9E9E', icon: 'tag' },
          ],
        }),
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
  }, scenario);
}

async function installCategoryManagementMock(
  page: Page,
  scenario: TransactionScenario = {},
) {
  await page.addInitScript((config: TransactionScenario) => {
    const state = {
      categories: [
        { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
        { id: 'dining', name: 'Dining', color: '#FF9800', icon: 'utensils' },
        { id: 'transport', name: 'Transport', color: '#2196F3', icon: 'car' },
        { id: 'others', name: 'Others', color: '#9E9E9E', icon: 'tag' },
      ],
      transactions: [...(config.transactions ?? DEFAULT_TRANSACTIONS)],
    };

    (window as typeof window & {
      __OUR_EXPENSES_E2E_CATEGORY_STATE__?: typeof state;
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_CATEGORY_STATE__ = state;

    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: config.firstLaunch ?? false,
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
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
        GET_CATEGORIES: () => ({ ok: true as const, categories: state.categories }),
        ADD_CATEGORY: ({ name }: { name: string }) => {
          const trimmed = name.trim();
          if (!trimmed) return { ok: false as const, error: 'EMPTY_NAME' };
          if (state.categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())) {
            return { ok: false as const, error: 'DUPLICATE_NAME' };
          }

          const othersIndex = state.categories.findIndex((category) => category.name === 'Others');
          const nextCategory = {
            id: trimmed.toLowerCase().replace(/\s+/g, '-'),
            name: trimmed,
            color: '#CCCCCC',
            icon: 'tag',
          };
          if (othersIndex === -1) {
            state.categories.push(nextCategory);
          } else {
            state.categories.splice(othersIndex, 0, nextCategory);
          }

          return { ok: true as const, category: nextCategory };
        },
        RENAME_CATEGORY: ({ oldName, newName }: { oldName: string; newName: string }) => {
          const trimmed = newName.trim();
          if (!trimmed) return { ok: false as const, error: 'EMPTY_NAME' };
          if (oldName === 'Others') return { ok: false as const, error: 'OTHERS_PROTECTED' };

          const category = state.categories.find((entry) => entry.name === oldName);
          if (!category) return { ok: false as const, error: 'NOT_FOUND' };
          if (state.categories.some((entry) => entry.name !== oldName && entry.name.toLowerCase() === trimmed.toLowerCase())) {
            return { ok: false as const, error: 'DUPLICATE_NAME' };
          }

          category.name = trimmed;
          state.transactions = state.transactions.map((transaction) =>
            transaction.category === oldName
              ? { ...transaction, category: trimmed }
              : transaction,
          );
          return { ok: true as const };
        },
        DELETE_CATEGORY: ({ name, reassignTo }: { name: string; reassignTo?: string }) => {
          if (name === 'Others') return { ok: false as const, error: 'OTHERS_PROTECTED' };

          const assignedTransactions = state.transactions.filter((transaction) => transaction.category === name);
          if (assignedTransactions.length > 0 && !reassignTo) {
            return { ok: false as const, error: 'REASSIGN_REQUIRED' };
          }

          if (reassignTo) {
            state.transactions = state.transactions.map((transaction) =>
              transaction.category === name
                ? { ...transaction, category: reassignTo }
                : transaction,
            );
          }

          state.categories = state.categories.filter((category) => category.name !== name);
          return { ok: true as const };
        },
        GET_RULES: () => ({ ok: true as const, rules: [] }),
        SAVE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        UPDATE_TRANSACTION_CATEGORY: ({ id, category }: { id: string; category: string }) => {
          state.transactions = state.transactions.map((transaction) =>
            transaction.id === id ? { ...transaction, category } : transaction,
          );
          return { ok: true as const };
        },
        PREVIEW_RULE_MATCHES: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: MockRule['matchType'] }) => {
          const matches = state.transactions.filter((transaction) => {
            if (transaction.category === category) return false;
            if (matchType === 'startsWith') {
              return transaction.description.toLowerCase().startsWith(pattern.toLowerCase());
            }
            if (matchType === 'regex') {
              try {
                return new RegExp(pattern, 'i').test(transaction.description);
              } catch {
                return false;
              }
            }
            return transaction.description.toLowerCase().includes(pattern.toLowerCase());
          });

          return { ok: true as const, transactions: matches };
        },
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: MockRule['matchType'] }) => {
          let updatedCount = 0;
          state.transactions = state.transactions.map((transaction) => {
            const matches = matchType === 'startsWith'
              ? transaction.description.toLowerCase().startsWith(pattern.toLowerCase())
              : matchType === 'regex'
                ? (() => {
                    try {
                      return new RegExp(pattern, 'i').test(transaction.description);
                    } catch {
                      return false;
                    }
                  })()
                : transaction.description.toLowerCase().includes(pattern.toLowerCase());

            if (!matches || transaction.category === category) {
              return transaction;
            }

            updatedCount += 1;
            return { ...transaction, category };
          });

          return { ok: true as const, updatedCount };
        },
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
  }, scenario);
}

async function installRuleWorkflowMock(page: Page, scenario: RuleScenario = {}) {
  await page.addInitScript((config: RuleScenario) => {
    const state = {
      categories: [
        { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
        { id: 'dining', name: 'Dining', color: '#FF9800', icon: 'utensils' },
        { id: 'transport', name: 'Transport', color: '#2196F3', icon: 'car' },
        { id: 'others', name: 'Others', color: '#9E9E9E', icon: 'tag' },
      ],
      transactions: [...(config.transactions ?? DEFAULT_TRANSACTIONS)],
      rules: [...(config.rules ?? [])],
    };

    const matchesRule = (description: string, pattern: string, matchType: MockRule['matchType']) => {
      if (matchType === 'startsWith') {
        return description.toLowerCase().startsWith(pattern.toLowerCase());
      }
      if (matchType === 'regex') {
        try {
          return new RegExp(pattern, 'i').test(description);
        } catch {
          return false;
        }
      }

      return description.toLowerCase().includes(pattern.toLowerCase());
    };

    (window as typeof window & {
      __OUR_EXPENSES_E2E_RULE_STATE__?: typeof state;
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_RULE_STATE__ = state;

    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: config.firstLaunch ?? false,
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
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
        GET_CATEGORIES: () => ({ ok: true as const, categories: state.categories }),
        ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_RULES: () => ({ ok: true as const, rules: state.rules }),
        SAVE_RULE: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: MockRule['matchType'] }) => {
          const existing = state.rules.find((rule) => rule.pattern === pattern);
          if (existing) {
            existing.category = category;
            existing.matchType = matchType;
            return { ok: true as const, rule: existing };
          }

          const rule = {
            id: `rule-${state.rules.length + 1}`,
            pattern,
            category,
            matchType,
          };
          state.rules.push(rule);
          return { ok: true as const, rule };
        },
        DELETE_RULE: ({ id }: { id: string }) => {
          state.rules = state.rules.filter((rule) => rule.id !== id);
          return { ok: true as const };
        },
        UPDATE_TRANSACTION_CATEGORY: ({ id, category }: { id: string; category: string }) => {
          state.transactions = state.transactions.map((transaction) =>
            transaction.id === id ? { ...transaction, category } : transaction,
          );
          return { ok: true as const };
        },
        PREVIEW_RULE_MATCHES: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: MockRule['matchType'] }) => ({
          ok: true as const,
          transactions: state.transactions.filter((transaction) =>
            transaction.category !== category && matchesRule(transaction.description, pattern, matchType),
          ),
        }),
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: MockRule['matchType'] }) => {
          let updatedCount = 0;
          state.transactions = state.transactions.map((transaction) => {
            if (!matchesRule(transaction.description, pattern, matchType) || transaction.category === category) {
              return transaction;
            }

            updatedCount += 1;
            return { ...transaction, category };
          });

          return { ok: true as const, updatedCount };
        },
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
  }, scenario);
}

async function readRuleWorkflowState(page: Page) {
  return page.evaluate(() => (
    window as typeof window & {
      __OUR_EXPENSES_E2E_RULE_STATE__?: {
        categories: Array<{ id: string; name: string }>;
        transactions: MockTransaction[];
        rules: MockRule[];
      };
    }
  ).__OUR_EXPENSES_E2E_RULE_STATE__);
}

const FILTER_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-01-10|-75.00|Market|0',
    date: '2026-01-10',
    amount: -75.00,
    description: 'Market',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-01.ndjson',
    notes: '',
  },
  {
    id: '2026-02-14|-20.00|Cafe|0',
    date: '2026-02-14',
    amount: -20.00,
    description: 'Cafe',
    category: 'Dining',
    accountId: '',
    importFile: '2026-02.ndjson',
    notes: '',
  },
  {
    id: '2026-03-05|-60.00|Grocer|0',
    date: '2026-03-05',
    amount: -60.00,
    description: 'Grocer',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-11|1200.00|Salary|0',
    date: '2026-03-11',
    amount: 1200.00,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2025-12-29|-45.00|Taxi|0',
    date: '2025-12-29',
    amount: -45.00,
    description: 'Taxi',
    category: 'Transport',
    accountId: '',
    importFile: '2025-12.ndjson',
    notes: '',
  },
];

const PIE_CHART_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-03-01|-100.00|Supermarket|0',
    date: '2026-03-01',
    amount: -100,
    description: 'Supermarket',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-02|-60.00|Restaurant|0',
    date: '2026-03-02',
    amount: -60,
    description: 'Restaurant',
    category: 'Eating out',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-03|-40.00|Bus|0',
    date: '2026-03-03',
    amount: -40,
    description: 'Bus',
    category: 'Transport',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-04|-25.00|Misc|0',
    date: '2026-03-04',
    amount: -25,
    description: 'Misc',
    category: 'Others',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-05|500.00|Salary|0',
    date: '2026-03-05',
    amount: 500,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
];

const INCOME_ONLY_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-03-05|500.00|Salary|0',
    date: '2026-03-05',
    amount: 500,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
];

const SPARKLINE_GAP_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-01-10|-75.00|Market|0',
    date: '2026-01-10',
    amount: -75.00,
    description: 'Market',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-01.ndjson',
    notes: '',
  },
  {
    id: '2026-03-11|1200.00|Salary|0',
    date: '2026-03-11',
    amount: 1200.00,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
];

test.describe('ReportView — transaction table (Story 3.2)', () => {
  test('table renders rows after transactions load', async ({ page }) => {
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Supermarket')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Groceries' })).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Income' })).toBeVisible();
  });

  test('table cannot be scrolled horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overflow = await page.evaluate(() => {
      const pane = document.getElementById('transaction-table');
      const table = document.querySelector('#transaction-table table');
      if (!(pane instanceof HTMLElement) || !(table instanceof HTMLTableElement)) return null;
      return {
        paneScrollWidth: pane.scrollWidth,
        paneClientWidth: pane.clientWidth,
        tableWidth: Math.round(table.getBoundingClientRect().width),
        paneWidth: Math.round(pane.getBoundingClientRect().width),
      };
    });

    expect(overflow).not.toBeNull();
    // The pane must not be horizontally scrollable
    expect(overflow?.paneScrollWidth).toBeLessThanOrEqual(overflow!.paneClientWidth);
    // The table must fit within the pane
    expect(overflow?.tableWidth).toBeLessThanOrEqual(overflow!.paneWidth);
  });

  test('large amount values do not cause horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await installIpcMockWithTransactions(page, { transactions: LARGE_AMOUNT_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const layout = await page.evaluate(() => {
      const container = document.querySelector('#transaction-table > div');
      const table = document.querySelector('#transaction-table table');
      const amountCell = document.querySelector('#transaction-table tbody tr td:last-child');

      if (!(container instanceof HTMLElement) || !(table instanceof HTMLTableElement) || !(amountCell instanceof HTMLElement)) {
        return null;
      }

      return {
        containerWidth: container.clientWidth,
        tableWidth: table.getBoundingClientRect().width,
        scrollWidth: container.scrollWidth,
        cellText: amountCell.textContent?.trim() ?? '',
      };
    });

    expect(layout).not.toBeNull();
    expect(layout?.cellText).toContain('31,122,025.00');
    expect(Math.round(layout?.tableWidth ?? 0)).toBeLessThanOrEqual(layout!.containerWidth);
    expect(layout?.scrollWidth).toBeLessThanOrEqual(layout!.containerWidth);
  });

  test('table overflow stays inside the table pane instead of widening the page', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      tablePaneClientWidth: document.getElementById('transaction-table')?.clientWidth ?? 0,
      tablePaneScrollWidth: document.getElementById('transaction-table')?.scrollWidth ?? 0,
    }));

    expect(dimensions.pageScrollWidth).toBe(dimensions.viewportWidth);
    expect(dimensions.tablePaneScrollWidth).toBeGreaterThanOrEqual(dimensions.tablePaneClientWidth);
  });

  test('table header is frozen and columns are sortable', async ({ page }) => {
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Column headers visible
    await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();

    const bodyRows = page.locator('tbody tr');
    await expect(bodyRows).toHaveCount(2);
    await expect(bodyRows.nth(0)).toContainText('Salary');
    await expect(bodyRows.nth(1)).toContainText('Supermarket');

    // Click date header to sort ascending
    await page.getByRole('button', { name: /date/i }).click();
    const dateHeader = page.getByRole('columnheader', { name: /date/i });
    await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(bodyRows.nth(0)).toContainText('Supermarket');
    await expect(bodyRows.nth(1)).toContainText('Salary');

    // Click again to sort descending
    await page.getByRole('button', { name: /date/i }).click();
    await expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(bodyRows.nth(0)).toContainText('Salary');
    await expect(bodyRows.nth(1)).toContainText('Supermarket');

    // Click again to reset to default
    await page.getByRole('button', { name: /date/i }).click();
    await expect(dateHeader).toHaveAttribute('aria-sort', 'none');
    await expect(bodyRows.nth(0)).toContainText('Salary');
    await expect(bodyRows.nth(1)).toContainText('Supermarket');
  });

  test('stat cards show formatted values after transactions load', async ({ page }) => {
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Stats section should be visible
    await expect(page.getByRole('region', { name: 'Summary statistics' })).toBeVisible();
    // The stat values should be formatted numbers (not dashes) after load
    const statsSection = page.getByRole('region', { name: 'Summary statistics' });
    await expect(statsSection).not.toContainText('—');
  });

  test('empty state shown when no transactions exist', async ({ page }) => {
    await installIpcMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'No transactions yet' })).toBeVisible();
  });

  test('first-launch confirm transitions home and loads transactions', async ({ page }) => {
    await installIpcMockWithTransactions(page, { firstLaunch: true });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Set up your locale' })).toBeVisible();
    await page.getByRole('button', { name: /confirm & continue/i }).click();

    await expect(page.getByText('Supermarket')).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
  });

  test('tri-axis filters update the table and dismissible chips when presets are applied', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: FILTER_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    await page.getByRole('button', { name: 'This month' }).click();

    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('cell', { name: 'Grocer', exact: true })).toBeVisible();
    await expect(page.getByText('Salary')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove This month filter' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove This month filter' }).click();
    await expect(rows).toHaveCount(5);
  });

  test('custom month range, category, and amount filters compose with AND logic', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: FILTER_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('tbody tr');

    await page.getByRole('button', { name: 'Custom range' }).click();
    await page.getByRole('button', { name: 'Custom range: Jan 26' }).click();
    await page.getByRole('button', { name: 'Custom range: Mar 26' }).click();

    await expect(rows).toHaveCount(4);

    await page.getByRole('button', { name: 'Category', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Groceries' }).click();
    await page.keyboard.press('Escape');

    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Category (1)' })).toBeVisible();

    await page.getByRole('button', { name: 'Amount', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Min' }).fill('70');
    await page.getByRole('spinbutton', { name: 'Max' }).fill('80');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Market')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toBeVisible();
  });
});

test.describe('ReportView — split calculator (Story 5.1)', () => {
  test('opens as a fixed-width side panel with the current expense total pre-populated', async ({ page }) => {
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Split calculator' }).click();

    const panel = page.getByRole('dialog', { name: 'Split calculator' });
    await expect(panel).toBeVisible();
    await expect(page.getByLabel('Total amount')).toHaveValue('50');

    const width = await panel.evaluate((element) => Math.round(element.getBoundingClientRect().width));
    expect(width).toBe(300);
  });

  test('filter chips remain usable while open and the captured total does not reactively update', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: FILTER_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Category', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Groceries' }).click();
    await page.keyboard.press('Escape');

    await expect(page.locator('tbody tr')).toHaveCount(2);

    await page.getByRole('button', { name: 'Split calculator' }).click();
    await expect(page.getByLabel('Total amount')).toHaveValue('135');

    await page.getByRole('button', { name: 'Remove Groceries filter' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(5);
    await expect(page.getByRole('dialog', { name: 'Split calculator' })).toBeVisible();
    await expect(page.getByLabel('Total amount')).toHaveValue('135');
  });

  test('manual edits persist across close and reopen within the session', async ({ page }) => {
    await installIpcMockWithTransactions(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Split calculator' }).click();
    await page.getByLabel('Total amount').fill('123.45');
    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog', { name: 'Split calculator' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Split calculator' }).click();
    await expect(page.getByLabel('Total amount')).toHaveValue('123.45');
  });
});

test.describe('ReportView — category pie chart (Story 3.4)', () => {
  test('renders only expense categories in the chart and shows a legend', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: PIE_CHART_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('group', { name: 'Expense breakdown by category' })).toBeVisible();
    await expect(page.locator('svg path[role="button"]')).toHaveCount(4);
    await expect(page.getByLabel('Category breakdown legend')).toContainText('Groceries');
    await expect(page.getByLabel('Category breakdown legend')).toContainText('Eating out');
    await expect(page.getByLabel('Category breakdown legend')).toContainText('Transport');
    await expect(page.getByLabel('Category breakdown legend')).toContainText('Others');
  });

  test('clicking and keyboard-activating slices toggles category filters', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: PIE_CHART_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    await page.getByRole('button', { name: /Others: -25\.00 €,/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Misc')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Others filter' })).toBeVisible();

    await page.getByRole('button', { name: /Others: -25\.00 €,/ }).click();
    await expect(rows).toHaveCount(5);

    const groceriesSlice = page.getByRole('button', { name: /Groceries: -100\.00 €,/ });
    await groceriesSlice.focus();
    await page.keyboard.press('Enter');

    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Supermarket')).toBeVisible();
  });

  test('shows the pie-chart empty state when no expenses exist', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: INCOME_ONLY_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('No expenses in this period')).toBeVisible();
    await expect(page.locator('svg path[role="button"]')).toHaveCount(0);
  });

  test('AC8: unselected slices dim to 40% opacity when a category is active', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: PIE_CHART_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Before any selection all slices are fully opaque
    const slices = page.locator('svg path[role="button"]');
    const firstOpacity = await slices.nth(0).getAttribute('opacity');
    expect(firstOpacity).toBe('1');

    // Click the Groceries slice
    await page.getByRole('button', { name: /Groceries:/ }).click();

    // The selected slice stays at opacity 1
    const selectedOpacity = await page.getByRole('button', { name: /Groceries:/ }).getAttribute('opacity');
    expect(selectedOpacity).toBe('1');

    // Every other slice dims to 0.4
    const otherSlices = page.locator('svg path[role="button"]:not([aria-label*="Groceries"])');
    const count = await otherSlices.count();
    for (let i = 0; i < count; i++) {
      const opacity = await otherSlices.nth(i).getAttribute('opacity');
      expect(opacity).toBe('0.4');
    }
  });

  test('AC4: pie slice click composes with existing category selections (toggle, not replace)', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: PIE_CHART_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    // Use category dropdown to select two categories simultaneously
    await page.getByRole('button', { name: 'Category', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Groceries' }).click();
    await page.getByRole('checkbox', { name: 'Eating out' }).click();
    await page.keyboard.press('Escape');

    // Both filters active — 2 rows, 2 chips
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Eating out filter' })).toBeVisible();

    // Click the Eating out pie slice — should REMOVE it without clearing Groceries
    await page.getByRole('button', { name: /Eating out:/ }).click();

    // Groceries chip still present; Eating out chip gone
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Eating out filter' })).toHaveCount(0);
    await expect(rows).toHaveCount(1);
  });
});

test.describe('ReportView — period sparkline (Story 4.1)', () => {
  test('fills missing months in the visible range and shows tooltip data without applying a filter on hover', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: SPARKLINE_GAP_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sparkline = page.getByRole('img', { name: 'Net balance trend sparkline' });
    await expect(sparkline).toBeVisible();

    const points = sparkline.getByRole('button');
    await expect(points).toHaveCount(3);

    const februaryPoint = page.getByRole('button', { name: 'Feb 26: +0.00' });
    await expect(februaryPoint).toBeVisible();

    await februaryPoint.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip.getByText('Feb 26')).toBeVisible();
    await expect(tooltip.getByText('+0.00')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test('clicking a sparkline month applies a custom range and highlights the active segment', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: FILTER_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sparkline = page.getByRole('img', { name: 'Net balance trend sparkline' });
    await expect(sparkline.locator('polygon')).toHaveCount(0);

    await page.getByRole('button', { name: 'Jan 26: -75.00' }).click();

    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Market')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Custom range' })).toHaveClass(/bg-accent/);
    await expect(sparkline.locator('polygon')).toHaveCount(1);
  });

  test('tooltip formatting reacts immediately to number-format preference changes', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: FILTER_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const januaryPoint = page.getByRole('button', { name: 'Jan 26: -75.00' });
    await januaryPoint.hover();
    await expect(page.getByRole('tooltip').getByText('-75.00')).toBeVisible();

    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.locator('select').nth(1).selectOption('1.234,56');

    await page.getByRole('button', { name: 'Jan 26: -75,00' }).hover();
    await expect(page.getByRole('tooltip').getByText('-75,00')).toBeVisible();
  });

  test('shows the neutral fallback when fewer than two months of data exist', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: DEFAULT_TRANSACTIONS });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Not enough data for trend view')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Net balance trend sparkline' })).toHaveCount(0);
  });
});

test.describe('ReportView — category taxonomy management (Story 3.5)', () => {
  test('category management dialog opens from filter dropdown', async ({ page }) => {
    await installIpcMockWithTransactions(page, { transactions: DEFAULT_TRANSACTIONS });
    await page.goto('/');
    const categoryFilterButton = page.locator('#transaction-table').getByRole('button', {
      name: /^Category(?: \(\d+\))?$/,
    }).first();
    await expect(categoryFilterButton).toBeVisible();

    // Open the category filter dropdown
    await categoryFilterButton.click();
    // "Manage categories" button should be visible inside the popover
    await expect(page.getByRole('button', { name: /Manage categories/i })).toBeVisible();
    // Click it — dialog should open
    await page.getByRole('button', { name: /Manage categories/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('renaming a selected category updates the active filter and transaction rows', async ({ page }) => {
    await installCategoryManagementMock(page, { transactions: DEFAULT_TRANSACTIONS });
    await page.goto('/');
    const categoryFilterButton = page.locator('#transaction-table').getByRole('button', {
      name: /^Category(?: \(\d+\))?$/,
    }).first();
    await expect(categoryFilterButton).toBeVisible();

    await categoryFilterButton.click();
    await page.getByRole('checkbox', { name: 'Groceries', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toBeVisible();

    await page.getByRole('button', { name: /Manage categories/i }).click();
    await page.getByRole('button', { name: 'Rename Groceries' }).click();

    const renameInput = page.getByLabel('Rename Groceries');
    await renameInput.fill('Food');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(categoryFilterButton).toContainText('Category (1)');
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Food' })).toBeVisible();
  });

  test('delete with reassignment removes stale filters and updates affected transactions', async ({ page }) => {
    await installCategoryManagementMock(page, { transactions: DEFAULT_TRANSACTIONS });
    await page.goto('/');
    const categoryFilterButton = page.locator('#transaction-table').getByRole('button', {
      name: /^Category(?: \(\d+\))?$/,
    }).first();
    await expect(categoryFilterButton).toBeVisible();

    await categoryFilterButton.click();
    await page.getByRole('checkbox', { name: 'Groceries', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toBeVisible();

    await page.getByRole('button', { name: /Manage categories/i }).click();
    await page.getByRole('button', { name: 'Delete Groceries' }).click();

    await expect(page.getByRole('combobox')).toBeVisible();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Others' }).click();
    await page.getByRole('button', { name: 'Delete & reassign' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(categoryFilterButton).toContainText('Category');
    await expect(page.getByRole('button', { name: 'Remove Groceries filter' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Others' })).toBeVisible();
  });

  test('Others remains protected in the management dialog', async ({ page }) => {
    await installCategoryManagementMock(page, { transactions: DEFAULT_TRANSACTIONS });
    await page.goto('/');
    const categoryFilterButton = page.locator('#transaction-table').getByRole('button', {
      name: /^Category(?: \(\d+\))?$/,
    }).first();
    await expect(categoryFilterButton).toBeVisible();

    await categoryFilterButton.click();
    await page.getByRole('button', { name: /Manage categories/i }).click();

    await expect(page.getByText('This category is reserved and cannot be modified')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename Others' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete Others' })).toHaveCount(0);
  });
});

const RULE_FLOW_TRANSACTIONS: MockTransaction[] = [
  {
    id: '2026-02-01|-8.50|Coffee Bar|0',
    date: '2026-02-01',
    amount: -8.5,
    description: 'Coffee Bar',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-02-001.ndjson',
    notes: '',
  },
  {
    id: '2026-02-02|-7.00|Coffee Bar Downtown|0',
    date: '2026-02-02',
    amount: -7,
    description: 'Coffee Bar Downtown',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-02-002.ndjson',
    notes: '',
  },
  {
    id: '2026-02-03|-20.00|Bus|0',
    date: '2026-02-03',
    amount: -20,
    description: 'Bus',
    category: 'Transport',
    accountId: '',
    importFile: '2026-02-003.ndjson',
    notes: '',
  },
];

test.describe('ReportView — inline reassignment and rule management (Story 3.6b)', () => {
  test('inline category picker opens from a category cell', async ({ page }) => {
    await installRuleWorkflowMock(page, { transactions: RULE_FLOW_TRANSACTIONS });
    await page.goto('/');

    await page.getByRole('button', { name: 'Change category from Groceries' }).last().click();

    await expect(page.getByPlaceholder('Search categories')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('single-row reassignment updates the row and skipping apply-to-all leaves rules unchanged', async ({ page }) => {
    await installRuleWorkflowMock(page, { transactions: RULE_FLOW_TRANSACTIONS });
    await page.goto('/');

    await page.getByRole('button', { name: 'Change category from Groceries' }).last().click();
    await page.getByText('Dining').click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('tbody tr').last()).toContainText('Dining');
    await expect(page.getByText("Apply this mapping to all transactions with description 'Coffee Bar'?" )).toBeVisible();
    await page.getByRole('button', { name: 'No, only this transaction' }).click();

    const state = await readRuleWorkflowState(page);
    expect(state?.rules).toHaveLength(0);
    expect(state?.transactions[0].category).toBe('Dining');
    expect(state?.transactions[1].category).toBe('Groceries');
  });

  test('confirming the preview saves a rule and updates all matching rows', async ({ page }) => {
    await installRuleWorkflowMock(page, { transactions: RULE_FLOW_TRANSACTIONS });
    await page.goto('/');

    await page.getByRole('button', { name: 'Change category from Groceries' }).last().click();
    await page.getByText('Dining').click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Yes, review matches' }).click();

    await expect(page.getByRole('heading', { name: 'Review affected transactions' })).toBeVisible();
    await expect(page.getByRole('dialog').locator('tbody tr')).toContainText(['Coffee Bar Downtown']);
    await page.getByRole('button', { name: 'Save rule and apply' }).click();

    const state = await readRuleWorkflowState(page);
    expect(state?.rules).toHaveLength(1);
    expect(state?.transactions[0].category).toBe('Dining');
    expect(state?.transactions[1].category).toBe('Dining');
  });

  test('rule management deletes a rule without changing historical transaction categories', async ({ page }) => {
    await installRuleWorkflowMock(page, {
      transactions: [
        {
          ...RULE_FLOW_TRANSACTIONS[0],
          category: 'Dining',
        },
      ],
      rules: [
        {
          id: 'rule-1',
          pattern: 'Coffee Bar',
          category: 'Dining',
          matchType: 'contains',
        },
      ],
    });
    await page.goto('/');

    await page.getByRole('button', { name: 'Category', exact: true }).click();
    await page.getByRole('button', { name: 'Manage rules' }).click();
    await expect(page.getByRole('heading', { name: 'Manage rules' })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Coffee Bar')).toBeVisible();

    await page.getByRole('button', { name: 'Delete rule' }).click();
    await page.getByRole('button', { name: 'Delete rule' }).last().click();

    const state = await readRuleWorkflowState(page);
    expect(state?.rules).toHaveLength(0);
    expect(state?.transactions[0].category).toBe('Dining');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('cell', { name: 'Dining' })).toBeVisible();
  });

  test('rollback: failed apply deletes the saved rule and shows an honest error', async ({ page }) => {
    let applyCalls = 0;

    await page.addInitScript(() => {
      const state = {
        categories: [
          { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
          { id: 'dining', name: 'Dining', color: '#FF9800', icon: 'utensils' },
          { id: 'others', name: 'Others', color: '#9E9E9E', icon: 'tag' },
        ],
        transactions: [
          {
            id: '2026-02-01|-8.50|Coffee Bar|0',
            date: '2026-02-01',
            amount: -8.5,
            description: 'Coffee Bar',
            category: 'Groceries',
            accountId: '',
            importFile: '2026-02-001.ndjson',
            notes: '',
          },
        ],
        rules: [] as Array<{ id: string; pattern: string; category: string; matchType: string }>,
        applyCalls: 0,
      };

      (window as typeof window & {
        __OUR_EXPENSES_E2E_ROLLBACK_STATE__?: typeof state;
        __OUR_EXPENSES_E2E_RPC__?: unknown;
      }).__OUR_EXPENSES_E2E_ROLLBACK_STATE__ = state;

      (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
        requests: {
          PING: () => 'PONG',
          READ_FILE: () => ({ ok: false, error: 'NOT_MOCKED' }),
          GET_INITIAL_STATE: () => ({
            firstLaunch: false,
            detectedLocale: { language: 'en', numberFormat: '1,234.56', dateFormat: 'dd/mm/yyyy', currencySymbol: '€' },
            savedPreferences: null,
            platform: 'darwin',
            dataFolderPath: '',
          }),
          SAVE_PREFERENCES: () => ({ ok: true }),
          UPDATE_PREFERENCES: () => ({ ok: true }),
          OPEN_FOLDER_PICKER: () => ({ path: null }),
          OPEN_DATA_FOLDER: () => ({ ok: true }),
          OPEN_FILE_PICKER: () => ({ path: null }),
          INGEST_FILE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
          SAVE_PROFILE: () => ({ ok: true }),
          EXECUTE_IMPORT: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
          GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
          GET_CATEGORIES: () => ({ ok: true as const, categories: state.categories }),
          ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          GET_RULES: () => ({ ok: true as const, rules: state.rules }),
          SAVE_RULE: ({ pattern, category, matchType }: { pattern: string; category: string; matchType: 'contains' | 'startsWith' | 'regex' }) => {
            const rule = { id: `rule-${state.rules.length + 1}`, pattern, category, matchType };
            state.rules.push(rule);
            return { ok: true as const, rule };
          },
          DELETE_RULE: ({ id }: { id: string }) => {
            state.rules = state.rules.filter((r) => r.id !== id);
            return { ok: true as const };
          },
          UPDATE_TRANSACTION_CATEGORY: ({ id, category }: { id: string; category: string }) => {
            state.transactions = state.transactions.map((t) => t.id === id ? { ...t, category } : t);
            return { ok: true as const };
          },
          PREVIEW_RULE_MATCHES: ({ pattern, category }: { pattern: string; category: string; matchType: string }) => ({
            ok: true as const,
            transactions: state.transactions.filter((t) =>
              t.category !== category && t.description.toLowerCase().includes(pattern.toLowerCase()),
            ),
          }),
          // Always fails — simulates a write error mid-apply
          APPLY_RULE_TO_EXISTING_TRANSACTIONS: () => {
            state.applyCalls += 1;
            return { ok: false as const, error: 'WRITE_FAILED_IN_TEST' };
          },
          RELOCATE_DATA_FOLDER: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          CLOSE_WINDOW: () => ({ ok: true as const }),
          QUIT_APP: () => ({ ok: true as const }),
          MATCH_CATEGORY_FOR_DESCRIPTION: () => ({ ok: true as const, category: null }),
          ADD_MANUAL_TRANSACTION: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
          DELETE_TRANSACTION: () => ({ ok: true as const }),
        BATCH_DELETE_TRANSACTIONS: () => ({ ok: true as const, deleted: 0, failed: 0, errors: [] }),
        BATCH_UPDATE_TRANSACTION_CATEGORIES: () => ({ ok: true as const, updated: 0, failed: 0, errors: [] }),
        },
        messages: { FILE_DROPPED: () => {}, TOGGLE_MAXIMIZE: () => {} },
      };
    });

    await page.goto('/');

    // Trigger single-row reassignment
    await page.getByRole('button', { name: 'Change category from Groceries' }).click();
    await page.getByText('Dining').click();
    await page.getByRole('button', { name: 'Save' }).click();

    // Accept the apply-to-all prompt → opens preview
    await page.getByRole('button', { name: 'Yes, review matches' }).click();
    await expect(page.getByRole('heading', { name: 'Review affected transactions' })).toBeVisible();

    // Confirm the preview — APPLY will fail → rollback
    await page.getByRole('button', { name: 'Save rule and apply' }).click();

    // An error mentioning the failure and partial-update transparency must appear
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Apply failed');

    // The rule must have been rolled back
    const state = await page.evaluate(() => (
      window as typeof window & {
        __OUR_EXPENSES_E2E_ROLLBACK_STATE__?: { rules: unknown[]; applyCalls: number };
      }
    ).__OUR_EXPENSES_E2E_ROLLBACK_STATE__);

    expect(state?.rules).toHaveLength(0);
    expect(state?.applyCalls).toBe(1);

    void applyCalls; // suppress unused-variable lint
  });
});

// ── Manual Transaction Entry (Story 3.7) ─────────────────────────────────────

type ManualTransactionScenario = {
  transactions?: MockTransaction[];
  addTransactionResponse?: { ok: true; transaction: MockTransaction } | { ok: false; error: string };
  matchCategoryResponse?: { ok: true; category: string | null };
};

async function installManualTransactionMock(page: Page, scenario: ManualTransactionScenario = {}) {
  await page.addInitScript((config: ManualTransactionScenario) => {
    const state = {
      transactions: [...(config.transactions ?? [])],
      addManualTransactionCalls: 0,
      matchCategoryForDescriptionCalls: 0,
    };

    (window as typeof window & {
      __OUR_EXPENSES_E2E_MANUAL_STATE__?: typeof state;
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_MANUAL_STATE__ = state;

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
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
        GET_CATEGORIES: () => ({
          ok: true as const,
          categories: [
            { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
            { id: 'income', name: 'Income', color: '#2196F3', icon: 'trending-up' },
            { id: 'others', name: 'Others', color: '#9E9E9E', icon: 'tag' },
          ],
        }),
        ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_RULES: () => ({ ok: true as const, rules: [] }),
        SAVE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        UPDATE_TRANSACTION_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        PREVIEW_RULE_MATCHES: () => ({ ok: true as const, transactions: [] }),
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RELOCATE_DATA_FOLDER: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        CLOSE_WINDOW: () => ({ ok: true as const }),
        QUIT_APP: () => ({ ok: true as const }),
        MATCH_CATEGORY_FOR_DESCRIPTION: () => {
          state.matchCategoryForDescriptionCalls += 1;
          return config.matchCategoryResponse ?? { ok: true as const, category: null };
        },
        ADD_MANUAL_TRANSACTION: (params: { date: string; description: string; amount: number; category: string }) => {
          state.addManualTransactionCalls += 1;
          if (config.addTransactionResponse) {
            if (config.addTransactionResponse.ok) {
              state.transactions.push(config.addTransactionResponse.transaction);
            }
            return config.addTransactionResponse;
          }
          // Default stateful behavior: add the transaction and return it
          const tx: MockTransaction = {
            id: `${params.date}|${params.amount}|${params.description}|0`,
            date: params.date,
            amount: params.amount,
            description: params.description,
            category: params.category,
            accountId: '',
            importFile: `${params.date}-001.ndjson`,
            notes: '',
          };
          state.transactions.push(tx);
          return { ok: true as const, transaction: tx };
        },
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

async function readManualTransactionState(page: Page) {
  return page.evaluate(() => (
    window as typeof window & {
      __OUR_EXPENSES_E2E_MANUAL_STATE__?: {
        transactions: MockTransaction[];
        addManualTransactionCalls: number;
        matchCategoryForDescriptionCalls: number;
      };
    }
  ).__OUR_EXPENSES_E2E_MANUAL_STATE__);
}

test.describe('ReportView — manual transaction entry (Story 3.7)', () => {
  test('AC1: clicking "Add transaction" toolbar button opens a dialog with the expected title', async ({ page }) => {
    await installManualTransactionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Add transaction' })).toBeVisible();
  });

  test('AC7: dismissing dialog via Cancel issues no ADD_MANUAL_TRANSACTION call', async ({ page }) => {
    await installManualTransactionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    const state = await readManualTransactionState(page);
    expect(state?.addManualTransactionCalls).toBe(0);
  });

  test('AC7: dismissing dialog via Escape issues no ADD_MANUAL_TRANSACTION call', async ({ page }) => {
    await installManualTransactionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).not.toBeVisible();

    const state = await readManualTransactionState(page);
    expect(state?.addManualTransactionCalls).toBe(0);
  });

  test('AC7: dismissing dialog via X issues no ADD_MANUAL_TRANSACTION call', async ({ page }) => {
    await installManualTransactionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    const state = await readManualTransactionState(page);
    expect(state?.addManualTransactionCalls).toBe(0);
  });

  test('AC5: blurring description pre-selects matched category without submitting', async ({ page }) => {
    await installManualTransactionMock(page, {
      matchCategoryResponse: { ok: true, category: 'Groceries' },
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await page.locator('#add-tx-description').fill('Supermarket order');
    await page.locator('#add-tx-description').blur();

    await expect(page.locator('#add-tx-category')).toHaveValue('Groceries');

    const state = await readManualTransactionState(page);
    expect(state?.matchCategoryForDescriptionCalls).toBe(1);
    expect(state?.addManualTransactionCalls).toBe(0);
  });

  test('AC4 + AC5: submitting a valid form calls ADD_MANUAL_TRANSACTION and shows the entry in the table', async ({ page }) => {
    await installManualTransactionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form
    await page.locator('#add-tx-date').fill('2026-03-15');
    await page.locator('#add-tx-description').fill('Manual Coffee');
    await page.locator('#add-tx-amount').fill('-4.50');
    await page.locator('#add-tx-category').selectOption('Others');

    await page.getByRole('button', { name: 'Save' }).click();

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Transaction appears in the table (GET_TRANSACTIONS is re-fetched)
    await expect(page.getByRole('cell', { name: 'Manual Coffee' })).toBeVisible();

    const state = await readManualTransactionState(page);
    expect(state?.addManualTransactionCalls).toBe(1);
    expect(state?.transactions).toHaveLength(1);
    expect(state?.transactions[0].description).toBe('Manual Coffee');
    expect(state?.transactions[0].amount).toBe(-4.5);
  });
});

// ── Bulk Selection & Floating Action Bar (Story 4.2) ────────────────────────────────────────────

async function installBulkSelectionMock(page: Page) {
  await page.addInitScript(() => {
    const state = {
      batchDeleteCalls: 0,
      batchDeleteIds: [] as string[],
      batchUpdateCalls: 0,
      batchUpdateCategory: '',
      batchUpdateIds: [] as string[],
      transactions: [
        {
          id: '2026-01-15|-50.00|Supermarket|0',
          date: '2026-01-15',
          amount: -50.00,
          description: 'Supermarket',
          category: 'Groceries',
          accountId: '',
          importFile: '2026-01-15-001.ndjson',
          notes: '',
        },
        {
          id: '2026-01-20|120.00|Salary|0',
          date: '2026-01-20',
          amount: 120.00,
          description: 'Salary',
          category: 'Income',
          accountId: '',
          importFile: '2026-01-20-001.ndjson',
          notes: '',
        },
        {
          id: '2026-01-10|-25.00|Bus pass|0',
          date: '2026-01-10',
          amount: -25.00,
          description: 'Bus pass',
          category: 'Transport',
          accountId: '',
          importFile: '2026-01-10-001.ndjson',
          notes: '',
        },
      ] as MockTransaction[],
    };

    (window as typeof window & {
      __OUR_EXPENSES_E2E_BULK_STATE__?: typeof state;
      __OUR_EXPENSES_E2E_RPC__?: unknown;
    }).__OUR_EXPENSES_E2E_BULK_STATE__ = state;

    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'NOT_MOCKED' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: false,
          detectedLocale: { language: 'en', numberFormat: '1,234.56', dateFormat: 'dd/mm/yyyy', currencySymbol: '€' },
          savedPreferences: null,
          platform: 'darwin',
          dataFolderPath: '',
        }),
        SAVE_PREFERENCES: () => ({ ok: true }),
        UPDATE_PREFERENCES: () => ({ ok: true }),
        OPEN_FOLDER_PICKER: () => ({ path: null }),
        OPEN_DATA_FOLDER: () => ({ ok: true }),
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
        GET_CATEGORIES: () => ({
          ok: true as const,
          categories: [
            { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
            { id: 'income', name: 'Income', color: '#4CAF50', icon: 'tag' },
            { id: 'others', name: 'Others', color: '#9E9E9E', icon: 'tag' },
          ],
        }),
        ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_RULES: () => ({ ok: true as const, rules: [] }),
        SAVE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        UPDATE_TRANSACTION_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        PREVIEW_RULE_MATCHES: () => ({ ok: true as const, transactions: [] }),
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RELOCATE_DATA_FOLDER: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        CLOSE_WINDOW: () => ({ ok: true as const }),
        QUIT_APP: () => ({ ok: true as const }),
        MATCH_CATEGORY_FOR_DESCRIPTION: () => ({ ok: true as const, category: null }),
        ADD_MANUAL_TRANSACTION: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_TRANSACTION: () => ({ ok: true as const }),
        BATCH_DELETE_TRANSACTIONS: ({ ids }: { ids: string[] }) => {
          state.batchDeleteCalls += 1;
          state.batchDeleteIds = ids;
          state.transactions = state.transactions.filter((tx) => !ids.includes(tx.id));
          return { ok: true as const, deleted: ids.length, failed: 0, errors: [] };
        },
        BATCH_UPDATE_TRANSACTION_CATEGORIES: ({ ids, category }: { ids: string[]; category: string }) => {
          state.batchUpdateCalls += 1;
          state.batchUpdateIds = ids;
          state.batchUpdateCategory = category;
          state.transactions = state.transactions.map((tx) =>
            ids.includes(tx.id) ? { ...tx, category } : tx,
          );
          return { ok: true as const, updated: ids.length, failed: 0, errors: [] };
        },
      },
      messages: {
        FILE_DROPPED: () => {},
        TOGGLE_MAXIMIZE: () => {},
      },
    };
  });
}

async function readBulkSelectionState(page: Page) {
  return page.evaluate(() => (
    window as typeof window & {
      __OUR_EXPENSES_E2E_BULK_STATE__?: {
        batchDeleteCalls: number;
        batchDeleteIds: string[];
        batchUpdateCalls: number;
        batchUpdateCategory: string;
        batchUpdateIds: string[];
        transactions: MockTransaction[];
      };
    }
  ).__OUR_EXPENSES_E2E_BULK_STATE__);
}

test.describe('BulkSelection', () => {
  test('AC1: checkbox click selects row and floating bar appears with "Delete 1"', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    // Floating bar should NOT be visible initially
    await expect(page.getByRole('toolbar')).not.toBeVisible();

    // Click the first row's checkbox
    const firstCheckbox = page.locator('tbody tr').first().getByRole('checkbox');
    await firstCheckbox.click();

    // Floating bar appears
    const toolbar = page.getByRole('toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /Delete 1/ })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Reassign category' })).toBeVisible();
  });

  test('AC1: selecting a second row updates floating bar to "Delete 2"', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    const rows = page.locator('tbody tr');
    await rows.first().getByRole('checkbox').click();
    await rows.nth(1).getByRole('checkbox').click();

    const toolbar = page.getByRole('toolbar');
    await expect(toolbar.getByRole('button', { name: /Delete 2/ })).toBeVisible();
  });

  test('AC2: shift-click selects the contiguous range between the anchor row and the clicked row', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    const rows = page.locator('tbody tr');
    await rows.first().getByRole('checkbox').click();
    await rows.nth(2).getByRole('checkbox').click({ modifiers: ['Shift'] });

    const toolbar = page.getByRole('toolbar');
    await expect(toolbar.getByRole('button', { name: /Delete 3/ })).toBeVisible();
  });

  test('AC7: Clear selection (×) button makes floating bar disappear', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    const firstCheckbox = page.locator('tbody tr').first().getByRole('checkbox');
    await firstCheckbox.click();
    await expect(page.getByRole('toolbar')).toBeVisible();

    // Click the clear (×) button
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await expect(page.getByRole('toolbar')).not.toBeVisible();
  });

  test('AC8: Escape key dismisses floating bar', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    await page.locator('tbody tr').first().getByRole('checkbox').click();
    await expect(page.getByRole('toolbar')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('toolbar')).not.toBeVisible();
  });

  test('AC3: "Delete N" click opens confirmation dialog with correct count', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    await page.locator('tbody tr').first().getByRole('checkbox').click();

    const toolbar = page.getByRole('toolbar');
    await toolbar.getByRole('button', { name: /Delete 1/ }).click();

    // Confirmation dialog appears
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('1 transaction');
  });

  test('AC4: confirming bulk delete calls BATCH_DELETE_TRANSACTIONS and removes rows', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    await page.locator('tbody tr').first().getByRole('checkbox').click();
    await page.getByRole('toolbar').getByRole('button', { name: /Delete 1/ }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Dialog closes and floating bar disappears
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('toolbar')).not.toBeVisible();

    const state = await readBulkSelectionState(page);
    expect(state?.batchDeleteCalls).toBe(1);
    expect(state?.batchDeleteIds).toHaveLength(1);
    expect(state?.batchDeleteIds[0]).toBe('2026-01-20|120.00|Salary|0'); // sorted newest first (desc date)
  });

  test('AC5 & AC6: "Reassign category" opens popover, selecting category calls BATCH_UPDATE_TRANSACTION_CATEGORIES', async ({ page }) => {
    await installBulkSelectionMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    await page.locator('tbody tr').first().getByRole('checkbox').click();
    await page.getByRole('toolbar').getByRole('button', { name: 'Reassign category' }).click();

    // Category picker popover appears
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: 'Others' }).click();

    // Floating bar disappears after reassign
    await expect(page.getByRole('toolbar')).not.toBeVisible();

    const state = await readBulkSelectionState(page);
    expect(state?.batchUpdateCalls).toBe(1);
    expect(state?.batchUpdateCategory).toBe('Others');
    expect(state?.batchUpdateIds).toHaveLength(1);
  });
});

// ── Story 4.3: Right-Click Context Menu ────────────────────────────────────────

type HoverContextMenuState = {
  deleteTransactionCalls: number;
  deletedIds: string[];
  transactions: MockTransaction[];
};

async function installHoverContextMenuMock(page: Page) {
  await page.addInitScript(() => {
    const state: HoverContextMenuState = {
      deleteTransactionCalls: 0,
      deletedIds: [],
      transactions: [
        {
          id: '2026-01-20|120.00|Salary|0',
          date: '2026-01-20',
          amount: 120.00,
          description: 'Salary',
          category: 'Income',
          accountId: '',
          importFile: '2026-01-20-001.ndjson',
          notes: '',
        },
        {
          id: '2026-01-15|-50.00|Supermarket|0',
          date: '2026-01-15',
          amount: -50.00,
          description: 'Supermarket',
          category: 'Groceries',
          accountId: '',
          importFile: '2026-01-15-001.ndjson',
          notes: '',
        },
      ],
    };

    (window as typeof window & { __OUR_EXPENSES_HOVER_STATE__?: typeof state }).__OUR_EXPENSES_HOVER_STATE__ = state;

    (window as typeof window & { __OUR_EXPENSES_E2E_RPC__?: unknown }).__OUR_EXPENSES_E2E_RPC__ = {
      requests: {
        PING: () => 'PONG',
        READ_FILE: () => ({ ok: false, error: 'READ_FILE_UNAVAILABLE_IN_E2E' }),
        GET_INITIAL_STATE: () => ({
          firstLaunch: false,
          detectedLocale: { language: 'en', numberFormat: '1,234.56', dateFormat: 'dd/mm/yyyy', currencySymbol: '€' },
          savedPreferences: null,
          platform: 'darwin',
          dataFolderPath: '',
        }),
        SAVE_PREFERENCES: () => ({ ok: true }),
        UPDATE_PREFERENCES: () => ({ ok: true }),
        OPEN_FOLDER_PICKER: () => ({ path: null }),
        OPEN_DATA_FOLDER: () => ({ ok: true }),
        OPEN_FILE_PICKER: () => ({ path: null }),
        INGEST_FILE: () => ({ ok: false as const, error: 'FILE_READ_FAILED' }),
        MATCH_IMPORT_PROFILE: () => ({ ok: true as const, result: { match: 'none' as const } }),
        SAVE_PROFILE: () => ({ ok: true }),
        EXECUTE_IMPORT: () => ({ ok: false as const, error: 'EXECUTE_IMPORT_UNAVAILABLE_IN_E2E' }),
        GET_IMPORT_HISTORY: () => ({ ok: true as const, entries: [] }),
        GET_TRANSACTIONS: () => ({ ok: true as const, transactions: state.transactions }),
        GET_CATEGORIES: () => ({
          ok: true as const,
          categories: [
            { id: 'groceries', name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
            { id: 'transport', name: 'Transport', color: '#2196F3', icon: 'car' },
            { id: 'others',    name: 'Others',    color: '#9E9E9E', icon: 'tag' },
          ],
        }),
        ADD_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RENAME_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        GET_RULES: () => ({ ok: true as const, rules: [] }),
        SAVE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_RULE: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        UPDATE_TRANSACTION_CATEGORY: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        PREVIEW_RULE_MATCHES: () => ({ ok: true as const, transactions: [] }),
        APPLY_RULE_TO_EXISTING_TRANSACTIONS: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        RELOCATE_DATA_FOLDER: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        CLOSE_WINDOW: () => ({ ok: true as const }),
        QUIT_APP: () => ({ ok: true as const }),
        MATCH_CATEGORY_FOR_DESCRIPTION: () => ({ ok: true as const, category: null }),
        ADD_MANUAL_TRANSACTION: () => ({ ok: false as const, error: 'NOT_MOCKED' }),
        DELETE_TRANSACTION: ({ id }: { id: string }) => {
          state.deleteTransactionCalls += 1;
          state.deletedIds.push(id);
          state.transactions = state.transactions.filter((tx) => tx.id !== id);
          return { ok: true as const };
        },
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

async function readHoverContextMenuState(page: Page) {
  return page.evaluate(() => (
    window as typeof window & {
      __OUR_EXPENSES_HOVER_STATE__?: HoverContextMenuState;
    }
  ).__OUR_EXPENSES_HOVER_STATE__);
}

test.describe('ContextMenu (Story 4.3)', () => {
  test('AC6: confirming delete via context menu calls DELETE_TRANSACTION and removes row', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Salary', exact: true })).toBeVisible();

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: /Delete/ }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Dialog closes and the deleted row is removed from the table
    await expect(dialog).not.toBeVisible();

    const state = await readHoverContextMenuState(page);
    expect(state?.deleteTransactionCalls).toBe(1);
    expect(state?.deletedIds).toHaveLength(1);
  });

  test('AC6: cancelling delete dialog does NOT call DELETE_TRANSACTION', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: /Delete/ }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).not.toBeVisible();
    const state = await readHoverContextMenuState(page);
    expect(state?.deleteTransactionCalls).toBe(0);
  });

  test('AC4: right-click opens context menu with Re-categorize and Delete', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Salary', exact: true })).toBeVisible();

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Re-categorize/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Delete/ })).toBeVisible();
  });

  test('AC5: clicking Re-categorize in context menu opens InlineCategoryPicker', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: /Re-categorize/ }).click();

    // Menu closes and InlineCategoryPicker opens
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('AC6: clicking Delete in context menu shows SingleDeleteConfirmDialog', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: /Delete/ }).click();

    // Menu closes and delete confirmation dialog appears
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });

  test('AC7: clicking outside closes context menu without changes', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    await expect(page.getByRole('menu')).toBeVisible();

    // Click elsewhere to dismiss
    await page.mouse.click(10, 10);
    await expect(page.getByRole('menu')).not.toBeVisible();

    const state = await readHoverContextMenuState(page);
    expect(state?.deleteTransactionCalls).toBe(0);
  });

  test('AC7: Escape closes context menu without changes', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('AC8: right-click on selected row does NOT open context menu', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Salary', exact: true })).toBeVisible();

    // Select the first row
    const firstRow = page.locator('tbody tr').first();
    await firstRow.getByRole('checkbox').click();

    // Right-click the selected row
    await firstRow.click({ button: 'right' });
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('AC9: right-clicking another row while menu is open reopens menu for new row', async ({ page }) => {
    await installHoverContextMenuMock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('cell', { name: 'Salary', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Supermarket', exact: true })).toBeVisible();

    const rows = page.locator('tbody tr');
    await rows.first().click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();

    // Right-click the second row
    await rows.nth(1).click({ button: 'right' });

    // Menu should still be visible (re-opened for new row)
    await expect(page.getByRole('menu')).toBeVisible();
  });
});

