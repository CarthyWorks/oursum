// src/core/split/persistence.ts
// Read/write helpers for split-calculator.json.
// RULE: No Electrobun imports. No renderer imports.
import { promises as fs } from 'node:fs';
import { DataFolderConfig } from '../persistence/config';
import { atomicWrite } from '../persistence/utils';
import { parseSplitCalculatorConfig } from '../persistence/schemas';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { SplitCalculatorConfig } from '../../shared/types';

/**
 * Reads split-calculator.json from the data folder.
 * Returns ok(null) on first use (file not found).
 * Returns ok(config) on success.
 * Returns err(...) on schema violation or unexpected error.
 * NEVER throws.
 */
export async function readSplitCalculatorConfig(): Promise<Result<SplitCalculatorConfig | null>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('split-calculator.json');
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    let json: unknown;

    try {
      json = JSON.parse(raw);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn('[split-calculator] Invalid JSON in split-calculator.json:', error);
      return err(error);
    }

    const parsed = parseSplitCalculatorConfig(json);
    if (!parsed.ok) {
      console.warn('[split-calculator] Schema violation in split-calculator.json:', parsed.error);
      return err(parsed.error);
    }
    return ok(parsed.data as SplitCalculatorConfig);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      // First use — no file yet
      return ok(null);
    }

    const error = e instanceof Error ? e.message : String(e);
    console.warn('[split-calculator] Failed to read split-calculator.json:', error);
    return err(error);
  }
}

/**
 * Writes contributor configuration to split-calculator.json via atomic write.
 * Does NOT persist totalAmount or any computed UI state — contributors only.
 * Returns the Result<void> from atomicWrite.
 */
export async function writeSplitCalculatorConfig(config: SplitCalculatorConfig): Promise<Result<void>> {
  const filePath = DataFolderConfig.getInstance().configFilePath('split-calculator.json');
  const json = JSON.stringify(config, null, 2);
  return atomicWrite(filePath, json);
}
