// src/core/persistence/relocate.ts
// Electrobun-free: uses node:fs, node:path only. Returns Result<T>, never throws.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';
import { DataFolderConfig } from './config';
import { atomicWrite } from './utils';
import { writeAppSettings } from './app-config';

type FileEntry = { srcPath: string; relPath: string };

async function cleanupCopiedFiles(destPaths: string[]): Promise<void> {
  for (const destPath of destPaths.reverse()) {
    try {
      await fs.unlink(destPath);
    } catch {
      // best-effort rollback cleanup only
    }
  }
}

async function collectFiles(dir: string, relPrefix: string): Promise<Result<FileEntry[]>> {
  try {
    const entries = await fs.readdir(dir);
    const files: FileEntry[] = [];
    for (const entry of entries) {
      const srcPath = path.join(dir, entry);
      const stat = await fs.stat(srcPath);
      if (stat.isFile()) {
        files.push({ srcPath, relPath: relPrefix ? `${relPrefix}/${entry}` : entry });
      }
    }
    return ok(files);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([]); // subdir missing — ok, nothing to copy
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Moves all data files from the current DataFolderConfig path to newAbsolutePath.
 * Uses atomicWrite for each file (cross-device safe — no fs.rename across volumes).
 * Updates DataFolderConfig and persists the new path to app-settings.json on success.
 * Originals are untouched if any copy step fails.
 *
 * @param newAbsolutePath  Target directory (may be on a different volume, e.g. iCloud Drive).
 * @param _appSupportDirOverride  @internal — test-only override for app-settings.json location.
 */
export async function relocateDataFolder(
  newAbsolutePath: string,
  _appSupportDirOverride?: string,
): Promise<Result<void>> {
  const config = DataFolderConfig.getInstance();
  const currentPath = config.dataFolderPath;

  // AC #5: no-op when destination equals current path
  if (newAbsolutePath === currentPath) {
    return ok(undefined);
  }

  // Step 3: Create destination dirs (root + imports/ + manual/)
  try {
    await fs.mkdir(path.join(newAbsolutePath, 'imports'), { recursive: true });
    await fs.mkdir(path.join(newAbsolutePath, 'manual'), { recursive: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }

  // Step 4: Enumerate files at root level and in imports/ + manual/ subdirs
  const rootResult = await collectFiles(currentPath, '');
  if (!rootResult.ok) return rootResult;

  const importsResult = await collectFiles(path.join(currentPath, 'imports'), 'imports');
  if (!importsResult.ok) return importsResult;

  const manualResult = await collectFiles(path.join(currentPath, 'manual'), 'manual');
  if (!manualResult.ok) return manualResult;

  const filesToCopy = [...rootResult.data, ...importsResult.data, ...manualResult.data];

  // Step 5: Copy each file via atomicWrite (cross-device safe: write+rename within dest volume)
  const copiedDestPaths: string[] = [];
  for (const { srcPath, relPath } of filesToCopy) {
    let content: string;
    try {
      content = await fs.readFile(srcPath, 'utf-8');
    } catch (e) {
      await cleanupCopiedFiles(copiedDestPaths);
      return err(`Failed to read ${relPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const destPath = path.join(newAbsolutePath, relPath);
    const writeResult = await atomicWrite(destPath, content);
    if (!writeResult.ok) {
      await cleanupCopiedFiles(copiedDestPaths);
      return err(`Failed to copy ${relPath}: ${writeResult.error}`);
    }
    copiedDestPaths.push(destPath);
  }

  // Persist restart state before deleting originals or switching the active singleton.
  const settingsResult = await writeAppSettings(
    { dataFolderPath: newAbsolutePath },
    _appSupportDirOverride,
  );
  if (!settingsResult.ok) {
    await cleanupCopiedFiles(copiedDestPaths);
    return err(`Relocation succeeded but failed to persist path: ${settingsResult.error}`);
  }

  // Step 6: Delete originals (best-effort; non-fatal if cleanup fails)
  for (const { srcPath } of filesToCopy) {
    try { await fs.unlink(srcPath); } catch { /* best-effort */ }
  }

  // Step 7: Update DataFolderConfig singleton
  config.setPath(newAbsolutePath);

  return ok(undefined);
}
