import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ImportLogEntry } from '../../shared/types';
import { err, ok, type Result } from '../../shared/contracts/result';
import { parseImportLogEntry } from '../persistence/schemas';
import { atomicWrite } from '../persistence/utils';

export async function appendImportLog(
  entry: ImportLogEntry,
  dataFolderPath: string,
): Promise<Result<void>> {
  const logPath = path.join(dataFolderPath, 'import-log.ndjson');

  try {
    let existingContent = '';
    try {
      existingContent = await fs.readFile(logPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return await atomicWrite(logPath, `${existingContent}${JSON.stringify(entry)}\n`);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export async function readImportLog(dataFolderPath: string): Promise<Result<ImportLogEntry[]>> {
  const logPath = path.join(dataFolderPath, 'import-log.ndjson');

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const entries: ImportLogEntry[] = [];

    for (const line of content.split('\n')) {
      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as unknown;
        const result = parseImportLogEntry(parsed);
        if (result.ok) {
          entries.push(result.data);
        } else {
          console.warn('[import-log] Invalid log entry skipped:', result.error);
        }
      } catch (error) {
        console.warn('[import-log] Malformed log entry skipped:', error);
      }
    }

    return ok(entries.reverse());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([]);
    }
    return err(error instanceof Error ? error.message : String(error));
  }
}