// src/core/persistence/utils.ts
// Electrobun-free: uses node:fs, node:path, and Bun globals only.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';

type AtomicWriteFs = {
  mkdir: (path: string, options: { recursive: true }) => Promise<string | undefined>;
  writeFile: (file: string, data: string, encoding: 'utf-8') => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
};

type AtomicWriteOptions = {
  fsImpl?: AtomicWriteFs;
  platform?: NodeJS.Platform;
  randomUUID?: () => string;
};

export async function atomicWrite(
  destPath: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<Result<void>> {
  const dir = path.dirname(destPath);
  const fileSystem = options.fsImpl ?? fs;
  const platform = options.platform ?? process.platform;
  const tempFileName = options.randomUUID ? options.randomUUID() : crypto.randomUUID();
  const tmpPath = path.join(dir, `${tempFileName}.tmp`);

  try {
    await fileSystem.mkdir(dir, { recursive: true });
    await fileSystem.writeFile(tmpPath, content, 'utf-8');
    if (platform === 'win32') {
      try { await fileSystem.unlink(destPath); } catch { /* ignore ENOENT */ }
    }
    await fileSystem.rename(tmpPath, destPath);
    return ok(undefined);
  } catch (e) {
    try { await fileSystem.unlink(tmpPath); } catch { /* cleanup best-effort */ }
    return err(e instanceof Error ? e.message : String(e));
  }
}
