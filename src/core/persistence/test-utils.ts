// src/core/persistence/test-utils.ts
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataFolderConfig } from './config';

/**
 * @internal — import ONLY in *.test.ts files; never in production code.
 * Creates an isolated temp data folder for the duration of fn, then tears it down.
 * Guarantees DataFolderConfig is reset after fn, even on error.
 */
export async function withTestDataFolder<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-test-'));
  try {
    return await DataFolderConfig.runWithTestPath(dir, () => fn(dir));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
