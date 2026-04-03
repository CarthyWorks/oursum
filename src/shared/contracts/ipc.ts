// src/shared/contracts/ipc.ts
// Electrobun-compatible RPC schema — shared between src/main/ and src/renderer/.
// RULE: No imports from electrobun/* here — this file is imported by both layers.
//       Shape must satisfy ElectrobunRPCSchema { bun: RPCSchema; webview: RPCSchema }.
import type { LocaleSettings } from '../../core/i18n/types';
import type {
  Category,
  ImportLogEntry,
  ImportProfile,
  ImportSummary,
  IngestResult,
  Preferences,
  ProfileMatchResult,
  Rule,
  RuleInput,
  SplitCalculatorConfig,
  Transaction,
} from '../types';

export type AppRPCSchema = {
  bun: {
    /** Requests that the Bun process handles (sent FROM renderer) */
    requests: {
      /** Simple round-trip connectivity check */
      PING: { params: void; response: "PONG" };
      /** Read a file by path — only Bun can access the filesystem */
      READ_FILE: {
        params: { path: string };
        response: { ok: true; content: string } | { ok: false; error: string };
      };
      /** Returns first-launch flag, OS-detected locale, saved preferences, and runtime platform */
      GET_INITIAL_STATE: {
        params: void;
        response: {
          firstLaunch: boolean;
          detectedLocale: LocaleSettings;
          savedPreferences: Preferences | null;
          /** Node.js platform string — drives OS-specific UI behaviour in the renderer */
          platform: NodeJS.Platform;
          /** Absolute path of the currently active data folder — shown in preferences popover */
          dataFolderPath: string;
        };
      };
      /** Saves the user-confirmed locale (wizard completion) */
      SAVE_PREFERENCES: {
        params: { locale: LocaleSettings };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Persists the full preferences object (locale + theme) from the preferences popover */
      UPDATE_PREFERENCES: {
        params: { preferences: Preferences };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Opens a native OS directory picker; returns the chosen absolute path or null if cancelled */
      OPEN_FOLDER_PICKER: {
        params: void;
        response: { path: string | null };
      };
      /** Opens the current data folder in the OS file manager */
      OPEN_DATA_FOLDER: {
        params: { path: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Opens a native OS file picker for CSV/XLSX selection; returns the chosen absolute path or null if cancelled */
      OPEN_FILE_PICKER: {
        params: void;
        response: { path: string | null };
      };
      /** Reads and parses a CSV or XLSX file: detects encoding, parses to string[][], detects table start */
      INGEST_FILE: {
        params: { filePath: string; forcedHeaderRowOffset?: number };
        response: { ok: true; result: IngestResult } | { ok: false; error: string };
      };
      /**
       * Same as INGEST_FILE but accepts raw file bytes as a base64 string.
       * Used when a filesystem path is not available (e.g. WKWebView drag-and-drop).
       */
      INGEST_FILE_BYTES: {
        params: { base64: string; filename: string; forcedHeaderRowOffset?: number };
        response: { ok: true; result: IngestResult } | { ok: false; error: string };
      };
      /**
       * Computes SHA-256 fingerprint of headerRow and matches it against saved profiles.
       * When scannedRows are provided, saved headerRowOffset values are applied before fingerprinting.
       * Returns the best match: 'exact' (same fingerprint), 'partial' (same column count,
       * different hash), or 'none'. Reads profiles.json from the data folder on each call.
       * Returns ok:false when profiles.json cannot be read (e.g. schema violation).
       */
      MATCH_IMPORT_PROFILE: {
        params: { headerRow: string[]; scannedRows?: string[][] };
        response: { ok: true; result: ProfileMatchResult } | { ok: false; error: string };
      };
      /** Upserts a named import profile (add or replace by id) in profiles.json */
      SAVE_PROFILE: {
        params: { profile: ImportProfile };
        response: { ok: true } | { ok: false; error: string };
      };
      /**
       * Executes the full import pipeline: column-map → date/amount parse → dedup → rule engine →
       * write NDJSON → append import log. Returns ImportSummary on success.
       */
      EXECUTE_IMPORT: {
        params: {
          rows: string[][];
          headerRow: string[];
          profile: ImportProfile;
          originalFilename: string;
        };
        response: { ok: true; summary: ImportSummary } | { ok: false; error: string };
      };
      /** Returns the full import log in reverse-chronological order. */
      GET_IMPORT_HISTORY: {
        params: void;
        response: { ok: true; entries: ImportLogEntry[] } | { ok: false; error: string };
      };
      /** Returns all transactions aggregated from all per-import NDJSON files (last-write-wins dedup). */
      GET_TRANSACTIONS: {
        params: void;
        response: { ok: true; transactions: Transaction[] } | { ok: false; error: string };
      };
      /** Returns all categories from categories.json (falls back to DEFAULT_CATEGORIES on first launch). */
      GET_CATEGORIES: {
        params: void;
        response: { ok: true; categories: Category[] } | { ok: false; error: string };
      };
      /** Adds a new category to categories.json. Returns err if name is blank or already exists. */
      ADD_CATEGORY: {
        params: { name: string };
        response: { ok: true; category: Category } | { ok: false; error: string };
      };
      /**
       * Renames a category in categories.json AND atomically reassigns all matching transactions
       * in imports/ NDJSON files. "Others" is protected — returns err('OTHERS_PROTECTED').
       */
      RENAME_CATEGORY: {
        params: { oldName: string; newName: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /**
       * Deletes a category. If reassignTo is provided, transactions in the deleted category
       * are reassigned to reassignTo before deletion. "Others" is protected.
       */
      DELETE_CATEGORY: {
        params: { name: string; reassignTo?: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Returns all saved categorization rules in insertion order. */
      GET_RULES: {
        params: void;
        response: { ok: true; rules: Rule[] } | { ok: false; error: string };
      };
      /**
       * Saves (upserts by pattern) a categorization rule.
       * If a rule with the same pattern already exists, it is updated (id preserved).
       * Returns the saved rule with its generated id.
       */
      SAVE_RULE: {
        params: RuleInput;
        response: { ok: true; rule: Rule } | { ok: false; error: string };
      };
      /**
       * Deletes a categorization rule by id.
       * Existing transactions are NOT retroactively re-categorized — only future imports are affected.
       */
      DELETE_RULE: {
        params: { id: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Updates a single persisted transaction category by transaction id. */
      UPDATE_TRANSACTION_CATEGORY: {
        params: { id: string; category: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Returns the existing persisted transactions that would be affected by a candidate rule. */
      PREVIEW_RULE_MATCHES: {
        params: RuleInput;
        response:
          | { ok: true; transactions: Transaction[] }
          | { ok: false; error: string };
      };
      /** Applies a candidate rule to all existing persisted transactions that currently match it. */
      APPLY_RULE_TO_EXISTING_TRANSACTIONS: {
        params: RuleInput;
        response:
          | { ok: true; updatedCount: number }
          | { ok: false; error: string };
      };
      /** Moves all data files to newPath, updates DataFolderConfig and app-settings.json */
      RELOCATE_DATA_FOLDER: {
        params: { newPath: string };
        response: { ok: true; newPath: string } | { ok: false; error: string };
      };
      /** Closes the focused app window. */
      CLOSE_WINDOW: {
        params: void;
        response: { ok: true } | { ok: false; error: string };
      };
      /** Quits the desktop app through Electrobun's lifecycle. */
      QUIT_APP: {
        params: void;
        response: { ok: true };
      };
      /** Evaluates all saved categorization rules against a description string. Returns the matched category or null. */
      MATCH_CATEGORY_FOR_DESCRIPTION: {
        params: { description: string };
        response: { ok: true; category: string | null };
      };
      /** Writes a single manually-entered transaction to data/manual/ via atomicWrite. */
      ADD_MANUAL_TRANSACTION: {
        params: {
          date: string;        // ISO 8601
          description: string;
          amount: number;
          category: string;
        };
        response: { ok: true; transaction: Transaction } | { ok: false; error: string };
      };
      /** Deletes a single transaction by id, scanning both imports/ and manual/ directories. */
      DELETE_TRANSACTION: {
        params: { id: string };
        response: { ok: true } | { ok: false; error: string };
      };
      /** Deletes multiple transactions by id, sequentially, scanning both imports/ and manual/ directories. */
      BATCH_DELETE_TRANSACTIONS: {
        params: { ids: string[] };
        response: { ok: true; deleted: number; failed: number; errors: string[] } | { ok: false; error: string };
      };
      /** Batch-updates the category of multiple transactions by id, sequentially. */
      BATCH_UPDATE_TRANSACTION_CATEGORIES: {
        params: { ids: string[]; category: string };
        response: { ok: true; updated: number; failed: number; errors: string[] } | { ok: false; error: string };
      };
      /** Reads saved contributor configuration from split-calculator.json. Returns ok(null) on first use. */
      GET_SPLIT_CALCULATOR_CONFIG: {
        params: void;
        response: { ok: true; config: SplitCalculatorConfig | null } | { ok: false; error: string };
      };
      /** Persists contributor configuration to split-calculator.json via atomicWrite. */
      SAVE_SPLIT_CALCULATOR_CONFIG: {
        params: { config: SplitCalculatorConfig };
        response: { ok: true } | { ok: false; error: string };
      };
    };
    /** Fire-and-forget messages that Bun receives (sent FROM renderer) */
    messages: {
      FILE_DROPPED: { paths: string[] };
      /** Toggle maximize/unmaximize — sent on double-click of the drag area */
      TOGGLE_MAXIMIZE: Record<string, never>;
    };
  };
  webview: {
    /** Requests that the renderer handles (sent FROM Bun) — empty for now */
    requests: Record<string, never>;
    /** Fire-and-forget messages the renderer receives (sent FROM Bun) — empty for now */
    messages: Record<string, never>;
  };
};
