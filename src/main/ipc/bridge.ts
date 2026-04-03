// src/main/ipc/bridge.ts — Electrobun framework layer ONLY.
// RULE: Business logic lives in src/core/. This file only wires IPC ↔ core.
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { AppRPCSchema } from "../../shared/contracts/ipc";
import { readPreferences, writePreferences } from "../../core/persistence/preferences";
import { readSplitCalculatorConfig, writeSplitCalculatorConfig } from '../../core/split/persistence';
import { ingestFile, ingestBuffer } from "../../core/parser";
import { matchProfileFromRows } from '../../core/parser/profile-fingerprint';
import { readProfiles, saveProfile } from '../../core/persistence/profiles';
import { detectOSLocale } from "../../core/i18n/locale-detect";
import { DEFAULT_PREFERENCES } from "../../core/persistence/defaults";
import { DataFolderConfig } from "../../core/persistence/config";
import { readAppSettings } from "../../core/persistence/app-config";
import { relocateDataFolder } from "../../core/persistence/relocate";
import { executeImport } from '../../core/importer';
import { readImportLog } from '../../core/importer/import-log';
import { loadAllTransactions } from '../../core/persistence/transactions';
import { readCategories, addCategory, renameCategory, deleteCategory, reassignTransactionCategories } from '../../core/persistence/categories';
import {
  applyRuleToExistingTransactions,
  batchDeleteTransactions,
  batchUpdateTransactionCategories,
  previewRuleMatches,
  updateTransactionCategoryById,
} from '../../core/persistence/transaction-category-mutations';
import { RuleEngine } from '../../core/rules/rule-engine';
import { writeManualTransaction } from '../../core/persistence/manual-transactions';
import { handleDeleteTransactionRequest } from './delete-transaction-request';
import path from 'node:path';

let _mainWindow: BrowserWindow | null = null;
export function setMainWindow(win: BrowserWindow | null) { _mainWindow = win; }

// Startup: load persisted custom data folder path before RPC handlers are invoked.
// Bun supports top-level await in ES modules — safe to await here before bunRPC is defined.
{
  const settings = await readAppSettings();
  if (settings.ok && settings.data.dataFolderPath) {
    DataFolderConfig.getInstance().setPath(settings.data.dataFolderPath);
  }
}

export const bunRPC = BrowserView.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {
      // Connectivity check — renderer can verify the IPC channel is alive
      PING: () => "PONG" as const,

      // Read a file by filesystem path — only Bun can access FS directly
      READ_FILE: async ({ path }: { path: string }) => {
        try {
          const content = await Bun.file(path).text();
          return { ok: true as const, content };
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return { ok: false as const, error };
        }
      },

      // Returns first-launch flag, OS-detected locale, and saved preferences
      GET_INITIAL_STATE: async () => {
        const detectedLocale = detectOSLocale();
        const result = await readPreferences();

        if (result.ok && result.data !== null) {
          return { firstLaunch: false, detectedLocale, savedPreferences: result.data, platform: process.platform, dataFolderPath: DataFolderConfig.getInstance().dataFolderPath };
        }

        // First launch (ok + null) OR malformed file (ok: false) → treat as first launch
        if (!result.ok) {
          console.warn('[IPC] GET_INITIAL_STATE: malformed preferences.json, treating as first launch');
        }
        return { firstLaunch: true, detectedLocale, savedPreferences: null, platform: process.platform, dataFolderPath: DataFolderConfig.getInstance().dataFolderPath };
      },

      // Saves the user-confirmed locale; wizard has no theme field — apply default
      SAVE_PREFERENCES: async ({ locale }) => {
        const prefs = { ...locale, theme: DEFAULT_PREFERENCES.theme };
        const result = await writePreferences(prefs);
        if (result.ok) return { ok: true as const };
        return { ok: false as const, error: result.error };
      },

      // Persists the full preferences object (locale + theme) from the popover
      UPDATE_PREFERENCES: async ({ preferences }) => {
        const result = await writePreferences(preferences);
        if (result.ok) return { ok: true as const };
        return { ok: false as const, error: result.error };
      },

      // Opens the OS native directory picker; filters Electrobun's empty-string cancel sentinel
      OPEN_FOLDER_PICKER: async () => {
        const paths = await Utils.openFileDialog({
          canChooseDirectory: true,
          canChooseFiles: false,
          allowsMultipleSelection: false,
        });
        const chosen = paths[0] ?? null;
        return { path: chosen && chosen.trim() !== '' ? chosen : null };
      },

      OPEN_DATA_FOLDER: async ({ path }) => {
        const opened = Utils.openPath(path);
        if (opened) return { ok: true as const };
        return { ok: false as const, error: 'OPEN_DATA_FOLDER_FAILED' };
      },

      // Opens OS file picker for CSV/XLSX selection
      OPEN_FILE_PICKER: async () => {
        const paths = await Utils.openFileDialog({
          canChooseDirectory: false,
          canChooseFiles: true,
          allowsMultipleSelection: false,
          // Note: Electrobun v1.15.1 — allowedFileTypes may not be supported;
          // omit to avoid crashes
        });
        const chosen = paths[0] ?? null;
        return { path: chosen && chosen.trim() !== '' ? chosen : null };
      },

      // Read, detect encoding, parse, and detect table start for a CSV/XLSX file
      INGEST_FILE: async ({ filePath, forcedHeaderRowOffset }) => {
        const result = await ingestFile(filePath, forcedHeaderRowOffset);
        if (result.ok) return { ok: true as const, result: result.data };
        return { ok: false as const, error: result.error };
      },

      // Same as INGEST_FILE but accepts file bytes as base64 — used for WKWebView drag-and-drop
      // where file.path is not exposed by the browser engine.
      INGEST_FILE_BYTES: async ({ base64, filename, forcedHeaderRowOffset }) => {
        const buf = new Uint8Array(Buffer.from(base64, 'base64'));
        const result = await ingestBuffer(buf, filename, forcedHeaderRowOffset);
        if (result.ok) return { ok: true as const, result: result.data };
        return { ok: false as const, error: result.error };
      },

      // Fingerprint the header row and match against saved profiles
      MATCH_IMPORT_PROFILE: async ({ headerRow, scannedRows }) => {
        const profilesResult = await readProfiles();
        if (!profilesResult.ok) return { ok: false as const, error: profilesResult.error };
        return { ok: true as const, result: matchProfileFromRows(headerRow, profilesResult.data, scannedRows) };
      },

      // Upsert a named import profile (add or replace by id) in profiles.json
      SAVE_PROFILE: async ({ profile }) => {
        const result = await saveProfile(profile);
        if (result.ok) return { ok: true as const };
        return { ok: false as const, error: result.error };
      },

      EXECUTE_IMPORT: async ({ rows, headerRow, profile, originalFilename }) => {
        const config = DataFolderConfig.getInstance();
        const result = await executeImport({
          rows,
          headerRow,
          profile,
          originalFilename,
          importsDir: config.importsPath,
          dataFolderPath: config.dataFolderPath,
        });
        if (result.ok) return { ok: true as const, summary: result.data };
        return { ok: false as const, error: result.error };
      },

      GET_IMPORT_HISTORY: async () => {
        const config = DataFolderConfig.getInstance();
        const result = await readImportLog(config.dataFolderPath);
        if (result.ok) return { ok: true as const, entries: result.data };
        return { ok: false as const, error: result.error };
      },

      GET_TRANSACTIONS: async () => {
        const result = await loadAllTransactions(DataFolderConfig.getInstance().dataFolderPath);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, transactions: result.data };
      },

      GET_CATEGORIES: async () => {
        const result = await readCategories();
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, categories: result.data };
      },

      ADD_CATEGORY: async ({ name }) => {
        const result = await addCategory(name);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, category: result.data };
      },

      RENAME_CATEGORY: async ({ oldName, newName }) => {
        const renameResult = await renameCategory(oldName, newName);
        if (!renameResult.ok) return { ok: false as const, error: renameResult.error };

        const importsDir = path.join(DataFolderConfig.getInstance().dataFolderPath, 'imports');
        const reassignResult = await reassignTransactionCategories(importsDir, oldName, newName);
        if (!reassignResult.ok) {
          const rollbackResult = await renameCategory(newName, oldName);
          if (!rollbackResult.ok) {
            return {
              ok: false as const,
              error: `RENAME_REASSIGN_FAILED:${reassignResult.error};ROLLBACK_FAILED:${rollbackResult.error}`,
            };
          }

          return {
            ok: false as const,
            error: `RENAME_REASSIGN_FAILED:${reassignResult.error}`,
          };
        }

        return { ok: true as const };
      },

      DELETE_CATEGORY: async ({ name, reassignTo }) => {
        const config = DataFolderConfig.getInstance();
        const importsDir = path.join(config.dataFolderPath, 'imports');
        const result = await deleteCategory(name, reassignTo, importsDir);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const };
      },

      GET_RULES: async () => {
        try {
          const rules = await RuleEngine.getInstance().getRules();
          return { ok: true as const, rules };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },

      SAVE_RULE: async (input) => {
        try {
          const result = await RuleEngine.getInstance().saveRule(input);
          if (!result.ok) return { ok: false as const, error: result.error };
          // getRules() returns a fresh copy; find by pattern (upsert key)
          const rules = await RuleEngine.getInstance().getRules();
          const savedRule = rules.find((r) => r.pattern === input.pattern);
          if (!savedRule) return { ok: false as const, error: 'RULE_NOT_FOUND_AFTER_SAVE' };
          return { ok: true as const, rule: savedRule };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },

      DELETE_RULE: async ({ id }) => {
        try {
          const rules = await RuleEngine.getInstance().getRules();
          const rule = rules.find((r) => r.id === id);
          if (!rule) return { ok: false as const, error: 'RULE_NOT_FOUND' };
          const result = await RuleEngine.getInstance().deleteRule(rule.pattern);
          if (!result.ok) return { ok: false as const, error: result.error };
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },

      UPDATE_TRANSACTION_CATEGORY: async ({ id, category }) => {
        const dataFolderPath = DataFolderConfig.getInstance().dataFolderPath;
        const result = await updateTransactionCategoryById(dataFolderPath, id, category);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const };
      },

      PREVIEW_RULE_MATCHES: async (input) => {
        const dataFolderPath = DataFolderConfig.getInstance().dataFolderPath;
        const result = await previewRuleMatches(dataFolderPath, input);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, transactions: result.data };
      },

      APPLY_RULE_TO_EXISTING_TRANSACTIONS: async (input) => {
        const dataFolderPath = DataFolderConfig.getInstance().dataFolderPath;
        const result = await applyRuleToExistingTransactions(dataFolderPath, input);
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, updatedCount: result.data.updatedCount };
      },

      // Moves all data files to newPath, updates DataFolderConfig and app-settings.json
      RELOCATE_DATA_FOLDER: async ({ newPath }) => {
        const result = await relocateDataFolder(newPath);
        if (result.ok) return { ok: true as const, newPath };
        return { ok: false as const, error: result.error };
      },

      CLOSE_WINDOW: async () => {
        if (!_mainWindow) {
          return { ok: false as const, error: 'NO_MAIN_WINDOW' };
        }

        if (process.platform !== 'darwin') {
          Utils.quit();
          return { ok: true as const };
        }

        _mainWindow.close();
        return { ok: true as const };
      },

      QUIT_APP: async () => {
        Utils.quit();
        return { ok: true as const };
      },

      MATCH_CATEGORY_FOR_DESCRIPTION: async ({ description }) => {
        const category = await RuleEngine.getInstance().applyRules(description);
        return { ok: true as const, category };
      },

      ADD_MANUAL_TRANSACTION: async ({ date, description, amount, category }) => {
        const dataFolderPath = DataFolderConfig.getInstance().dataFolderPath;
        const result = await writeManualTransaction(dataFolderPath, { date, description, amount, category });
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, transaction: result.data };
      },

      DELETE_TRANSACTION: handleDeleteTransactionRequest,

      BATCH_DELETE_TRANSACTIONS: async ({ ids }) => {
        try {
          const config = DataFolderConfig.getInstance();
          const result = await batchDeleteTransactions(ids, config.importsPath, config.manualPath);
          return { ok: true as const, ...result };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },

      BATCH_UPDATE_TRANSACTION_CATEGORIES: async ({ ids, category }) => {
        try {
          const dataFolderPath = DataFolderConfig.getInstance().dataFolderPath;
          const result = await batchUpdateTransactionCategories(ids, category, dataFolderPath);
          return { ok: true as const, ...result };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },

      GET_SPLIT_CALCULATOR_CONFIG: async () => {
        const result = await readSplitCalculatorConfig();
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, config: result.data };
      },

      SAVE_SPLIT_CALCULATOR_CONFIG: async ({ config }) => {
        const result = await writeSplitCalculatorConfig(config);
        if (result.ok) return { ok: true as const };
        return { ok: false as const, error: result.error };
      },
    },
    messages: {
      // File(s) dropped onto the webview — renderer calls INGEST_FILE request for actual processing
      FILE_DROPPED: ({ paths }: { paths: string[] }) => {
        console.log('[IPC] FILE_DROPPED (renderer will call INGEST_FILE):', paths);
      },
      // Toggle maximize/unmaximize — macOS double-click on drag area
      TOGGLE_MAXIMIZE: () => {
        if (!_mainWindow) return;
        if (_mainWindow.isMaximized()) {
          _mainWindow.unmaximize();
          return;
        }

        _mainWindow.maximize();
      },
    },
  },
});

