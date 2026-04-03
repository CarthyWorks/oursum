// src/core/persistence/app-config.test.ts
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAppSupportPath, readAppSettings, writeAppSettings } from './app-config';

/** Local helper — creates an isolated temp dir for app support dir tests. */
async function withTestAppSupportDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-appsupport-test-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('resolveAppSupportPath()', () => {
  test('darwin returns ~/Library/Application Support/Oursum', () => {
    const result = resolveAppSupportPath('darwin', '/Users/test', undefined);
    expect(result).toBe('/Users/test/Library/Application Support/Oursum');
  });

  test('win32 with APPDATA returns <APPDATA>/Oursum', () => {
    const result = resolveAppSupportPath('win32', 'C:\\Users\\test', 'C:\\AppData\\Roaming');
    expect(result).toBe('C:\\AppData\\Roaming/Oursum');
  });

  test('win32 without APPDATA falls back to homeDir', () => {
    const result = resolveAppSupportPath('win32', 'C:\\Users\\test', undefined);
    expect(result).toBe('C:\\Users\\test/Oursum');
  });

  test('linux returns ~/.oursum', () => {
    const result = resolveAppSupportPath('linux' as NodeJS.Platform, '/home/test', undefined);
    expect(result).toBe('/home/test/.oursum');
  });
});

describe('readAppSettings()', () => {
  test('returns ok({}) when app-settings.json does not exist', async () => {
    await withTestAppSupportDir(async (dir) => {
      const result = await readAppSettings(dir);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual({});
    });
  });

  test('returns ok with dataFolderPath from valid JSON', async () => {
    await withTestAppSupportDir(async (dir) => {
      await fs.writeFile(
        path.join(dir, 'app-settings.json'),
        JSON.stringify({ dataFolderPath: '/custom/data/path' }),
        'utf-8',
      );
      const result = await readAppSettings(dir);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.dataFolderPath).toBe('/custom/data/path');
    });
  });

  test('returns ok({}) when dataFolderPath is absent (optional field)', async () => {
    await withTestAppSupportDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'app-settings.json'), JSON.stringify({}), 'utf-8');
      const result = await readAppSettings(dir);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.dataFolderPath).toBeUndefined();
    });
  });

  test('returns err when app-settings.json contains malformed JSON', async () => {
    await withTestAppSupportDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'app-settings.json'), 'not-valid-json{', 'utf-8');
      const result = await readAppSettings(dir);
      expect(result.ok).toBe(false);
    });
  });

  test('returns err when app-settings.json has schema violation (dataFolderPath not a string)', async () => {
    await withTestAppSupportDir(async (dir) => {
      await fs.writeFile(
        path.join(dir, 'app-settings.json'),
        JSON.stringify({ dataFolderPath: 12345 }),
        'utf-8',
      );
      const result = await readAppSettings(dir);
      expect(result.ok).toBe(false);
    });
  });
});

describe('writeAppSettings()', () => {
  test('round-trip: writes then reads back the same dataFolderPath', async () => {
    await withTestAppSupportDir(async (dir) => {
      const writeResult = await writeAppSettings({ dataFolderPath: '/my/custom/folder' }, dir);
      expect(writeResult.ok).toBe(true);

      const readResult = await readAppSettings(dir);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.data.dataFolderPath).toBe('/my/custom/folder');
    });
  });

  test('round-trip with empty settings object (no dataFolderPath)', async () => {
    await withTestAppSupportDir(async (dir) => {
      const writeResult = await writeAppSettings({}, dir);
      expect(writeResult.ok).toBe(true);

      const readResult = await readAppSettings(dir);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.data).toEqual({});
    });
  });
});
