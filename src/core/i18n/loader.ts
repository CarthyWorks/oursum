// src/core/i18n/loader.ts
// RULE: Zero Electrobun imports — testable with plain `bun test src/core/`.
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { SupportedLanguage } from './types';

export type Dictionary = Record<string, string>;

export async function loadDictionary(language: SupportedLanguage): Promise<Result<Dictionary>> {
  const filePath = path.join(import.meta.dir, 'dictionaries', `${language}.json`);
  try {
    const data = await Bun.file(filePath).json() as Dictionary;
    return ok(data);
  } catch (e) {
    return err(`Failed to load dictionary for "${language}": ${String(e)}`);
  }
}
