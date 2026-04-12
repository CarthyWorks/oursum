// src/core/persistence/schemas.ts
// Structural-only Zod schemas — no .refine(), .superRefine(), or .transform() for business rules.
import { z } from 'zod';
import { ok, err, type Result } from '../../shared/contracts/result';

// ── Category ────────────────────────────────────────────────────────────────
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
});

export const CategoriesFileSchema = z.array(CategorySchema);

export function parseCategories(raw: unknown): Result<z.infer<typeof CategoriesFileSchema>> {
  const result = CategoriesFileSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── Rule ─────────────────────────────────────────────────────────────────────
export const RuleSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  category: z.string(),
  matchType: z.enum(['contains', 'startsWith', 'regex']), // REQUIRED from v1 (ADR-002)
});

export const RulesFileSchema = z.array(RuleSchema);

export function parseRules(raw: unknown): Result<z.infer<typeof RulesFileSchema>> {
  const result = RulesFileSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── ImportProfile ────────────────────────────────────────────────────────────
export const ImportProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  bankName: z.string(),
  csvDelimiter: z.string(),
  columnMap: z.record(z.string(), z.string()),
  dateFormat: z.string(),
  amountMultiplier: z.number(),
  headerRowOffset: z.number().int().nonnegative(), // REQUIRED — parser Story 2.1 depends on this
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/, 'fingerprint must be a 64-char lowercase hex string'), // REQUIRED — SHA-256 hex
});

export const ProfilesFileSchema = z.array(ImportProfileSchema);

export function parseProfiles(raw: unknown): Result<z.infer<typeof ProfilesFileSchema>> {
  const result = ProfilesFileSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── Preferences ──────────────────────────────────────────────────────────────
export const PreferencesSchema = z.object({
  language: z.string(),
  numberFormat: z.string(),
  dateFormat: z.string(),
  currencySymbol: z.string(),
  theme: z.enum(['mountain', 'seaside']),
});

export function parsePreferences(raw: unknown): Result<z.infer<typeof PreferencesSchema>> {
  const result = PreferencesSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── AppSettings ─────────────────────────────────────────────────────────────
export const AppSettingsSchema = z.object({
  dataFolderPath: z.string().optional(),
});

export function parseAppSettings(raw: unknown): Result<z.infer<typeof AppSettingsSchema>> {
  const result = AppSettingsSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── SplitCalculatorConfig ────────────────────────────────────────────────────
export const SplitCalculatorConfigSchema = z.object({
  contributors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      splitType: z.enum(['equal', 'percentage', 'fixed']),
      value: z.number(),
    })
  ),
});

export function parseSplitCalculatorConfig(raw: unknown): Result<z.infer<typeof SplitCalculatorConfigSchema>> {
  const result = SplitCalculatorConfigSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── ImportLogEntry ──────────────────────────────────────────────────────────
export const ImportLogEntrySchema = z.object({
  importedAt: z.string(),
  originalFilename: z.string(),
  ndjsonFilename: z.string(),
  profileName: z.string(),
  rowsImported: z.number().int().nonnegative(),
  rowsOverwritten: z.number().int().nonnegative(),
  rowsFailed: z.number().int().nonnegative(),
  rowsAutoCategorized: z.number().int().nonnegative(),
  rowsInOthers: z.number().int().nonnegative(),
});

export function parseImportLogEntry(raw: unknown): Result<z.infer<typeof ImportLogEntrySchema>> {
  const result = ImportLogEntrySchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}

// ── Transaction ──────────────────────────────────────────────────────────────
export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  description: z.string(),
  category: z.string(),
  accountId: z.string(),
  importFile: z.string(),
  notes: z.string(),
});

export function parseTransaction(raw: unknown): Result<z.infer<typeof TransactionSchema>> {
  const result = TransactionSchema.safeParse(raw);
  return result.success ? ok(result.data) : err(result.error.message);
}
