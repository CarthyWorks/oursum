// src/core/persistence/profiles.ts
// Read/write helpers for profiles.json.
// RULE: No Electrobun imports. No renderer imports. NEVER throws.
import { promises as fs } from 'node:fs';
import { DataFolderConfig } from './config';
import { atomicWrite } from './utils';
import { parseProfiles } from './schemas';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { ImportProfile } from '../../shared/types';

/**
 * Reads profiles.json from the data folder.
 * Returns ok([]) on first launch (file not found — not an error).
 * Returns ok(profiles) on success.
 * Returns err(...) on schema violation or unexpected error.
 * NEVER throws.
 */
export async function readProfiles(): Promise<Result<ImportProfile[]>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('profiles.json');
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = parseProfiles(JSON.parse(raw));
    if (!parsed.ok) {
      console.warn('[profiles] Schema violation in profiles.json:', parsed.error);
      return err(parsed.error);
    }
    return ok(parsed.data as ImportProfile[]);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      // First launch — no profiles file yet
      return ok([]);
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Upserts a named import profile (add or replace by id) in profiles.json.
 * Returns the Result<void> from atomicWrite.
 * NEVER throws.
 */
export async function saveProfile(profile: ImportProfile): Promise<Result<void>> {
  const readResult = await readProfiles();
  if (!readResult.ok) return err(readResult.error);

  const existing = readResult.data;
  const idx = existing.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    existing[idx] = profile;
  } else {
    existing.push(profile);
  }

  const filePath = DataFolderConfig.getInstance().configFilePath('profiles.json');
  return atomicWrite(filePath, JSON.stringify(existing, null, 2));
}
