// src/core/persistence/preferences.ts
// Read/write helpers for preferences.json.
// RULE: No Electrobun imports. No renderer imports.
import { promises as fs } from 'node:fs';
import { DataFolderConfig } from './config';
import { atomicWrite } from './utils';
import { parsePreferences } from './schemas';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { Preferences } from '../../shared/types';

/**
 * Reads preferences.json from the data folder.
 * Returns ok(null) on first launch (file not found).
 * Returns ok(parsed) on success.
 * Returns err(...) on schema violation or unexpected error.
 * NEVER throws.
 */
export async function readPreferences(): Promise<Result<Preferences | null>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('preferences.json');
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = parsePreferences(JSON.parse(raw));
    if (!parsed.ok) {
      console.warn('[preferences] Schema violation in preferences.json:', parsed.error);
      return err(parsed.error);
    }
    return ok(parsed.data as Preferences);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      // First launch — no preferences file yet
      return ok(null);
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Writes preferences to preferences.json via atomic write.
 * Returns the Result<void> from atomicWrite.
 */
export async function writePreferences(prefs: Preferences): Promise<Result<void>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('preferences.json');
  const json = JSON.stringify(prefs, null, 2);
  return atomicWrite(filePath, json);
}
