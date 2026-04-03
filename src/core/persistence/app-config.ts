// src/core/persistence/app-config.ts
// Electrobun-free: uses node:fs, node:path, node:os only.
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';
import { atomicWrite } from './utils';
import { parseAppSettings } from './schemas';

export function resolveAppSupportPath(
  platform: NodeJS.Platform,
  homeDir: string = os.homedir(),
  appData: string | undefined = process.env.APPDATA,
): string {
  switch (platform) {
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Oursum');
    case 'win32':
      return path.join(appData ?? homeDir, 'Oursum');
    default:
      return path.join(homeDir, '.oursum');
  }
}

export async function readAppSettings(
  appSupportDir?: string,
): Promise<Result<{ dataFolderPath?: string }>> {
  const dir = appSupportDir ?? resolveAppSupportPath(process.platform);
  const settingsPath = path.join(dir, 'app-settings.json');
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const raw = JSON.parse(content) as unknown;
    return parseAppSettings(raw);
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({});
    }
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function writeAppSettings(
  settings: { dataFolderPath?: string },
  appSupportDir?: string,
): Promise<Result<void>> {
  const dir = appSupportDir ?? resolveAppSupportPath(process.platform);
  const settingsPath = path.join(dir, 'app-settings.json');
  const content = JSON.stringify(settings, null, 2);
  return atomicWrite(settingsPath, content);
}
