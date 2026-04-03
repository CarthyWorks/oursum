import { promises as fs } from 'node:fs';
import { err, ok, type Result } from '../../shared/contracts/result';

export async function generateImportFilename(importsDir: string): Promise<Result<string>> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const entries = await fs.readdir(importsDir);
    const todayPattern = new RegExp(`^${today}-\\d{3}\\.ndjson$`);
    const sequences = entries
      .filter((entry) => todayPattern.test(entry))
      .map((entry) => Number.parseInt(entry.slice(today.length + 1, today.length + 4), 10))
      .filter((seq) => !Number.isNaN(seq));
    const nextSequence = (sequences.length > 0 ? Math.max(...sequences) : 0) + 1;
    return ok(`${today}-${String(nextSequence).padStart(3, '0')}.ndjson`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok(`${today}-001.ndjson`);
    }
    return err(error instanceof Error ? error.message : String(error));
  }
}