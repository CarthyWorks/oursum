// src/shared/types/index.ts
// Domain entity interfaces — zero runtime code here.
// These types are used across src/core/, src/main/, and src/renderer/.

export interface Transaction {
  id: string; // "<date>|<amount>|<description>|<dedupeIndex>"
  date: string; // ISO 8601 date string — "YYYY-MM-DD"
  amount: number; // Negative = expense, positive = income
  description: string;
  category: string;
  accountId: string;
  importFile: string;
  notes: string;
}

export interface Rule {
  id: string;
  pattern: string; // Regex or glob pattern matched against description
  category: string;
  matchType: 'contains' | 'startsWith' | 'regex';
}

/** The subset of Rule fields a caller provides when creating or updating a rule — id is generated internally. */
export type RuleInput = Pick<Rule, 'pattern' | 'category' | 'matchType'>;

export interface ImportProfile {
  id: string;
  name: string;
  bankName: string;
  csvDelimiter: string;
  columnMap: Record<string, string>; // Maps profile column names → Transaction field names
  dateFormat: string; // e.g. "DD/MM/YYYY"
  amountMultiplier: number; // 1 or -1 to flip sign if needed
  headerRowOffset: number;
  // SHA-256 hex hash of normalized, sorted column names — used for auto-match
  fingerprint: string;
}

export interface Category {
  id: string;
  name: string;
  color: string; // CSS hex color string e.g. "#FF5733"
  icon: string; // Icon name/identifier
}

export interface Preferences {
  language: string;             // 'en' | 'it' | 'de' | 'fr' | 'es' (enforced by schema, not type)
  numberFormat: string;         // '1,234.56' | '1.234,56' | '1 234,56'
  dateFormat: string;           // 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'
  currencySymbol: string;       // '€' | '$' | '£' | etc.
  theme: 'mountain' | 'seaside';
}

export interface IngestResult {
  /** Data rows starting from headerRowOffset + 1 (frontmatter and header row excluded) */
  rows: string[][];
  /** The detected or forced header row (column names) */
  headerRow: string[];
  /** 0-based index of the header row in the original file */
  headerRowOffset: number;
  /** 'high' = auto-detected with ≥3 consistent data rows; 'low' = fewer than 3; always 'high' if forced */
  confidence: 'high' | 'low';
  /** Detected encoding (XLSX always reports 'utf-8' — SheetJS handles encoding internally) */
  encoding: 'utf-8' | 'windows-1252' | 'iso-8859-1';
  fileType: 'csv' | 'xlsx';
  /** Detected CSV delimiter when fileType is csv; null for xlsx */
  csvDelimiter: string | null;
  /** Non-fatal per-row parse failures collected during CSV parsing */
  parseErrors: string[];
  /** First ≤30 rows of the file (including frontmatter + header row) — used for low-confidence override UI */
  scannedRows: string[][];
}

export type ProfileMatchResult =
  | { match: 'exact'; profile: ImportProfile }
  | { match: 'partial'; profile: ImportProfile }
  | { match: 'none' };

export interface ImportFailureDetail {
  rowNumber: number;
  reason: 'missing-columns' | 'invalid-date' | 'invalid-amount';
  rawRow: string[];
}

export interface ImportSummary {
  rowsImported: number;
  rowsOverwritten: number;
  rowsFailed: number;
  failedRows: ImportFailureDetail[];
  rowsAutoCategorized: number;
  rowsInOthers: number;
  profileName: string;
  ndjsonFilename: string;
  importedAt: string;
}

export interface ImportLogEntry {
  importedAt: string;
  originalFilename: string;
  ndjsonFilename: string;
  profileName: string;
  rowsImported: number;
  rowsOverwritten: number;
  rowsFailed: number;
  rowsAutoCategorized: number;
  rowsInOthers: number;
}

// ── Split Calculator ─────────────────────────────────────────────────────────

export type SplitType = 'equal' | 'percentage' | 'fixed';

export interface SplitContributorConfig {
  id: string;
  name: string;
  splitType: SplitType;
  value: number;
}

export interface SplitCalculatorConfig {
  contributors: SplitContributorConfig[];
}
