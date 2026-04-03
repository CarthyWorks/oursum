// src/core/persistence/relocate.test.ts
import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relocateDataFolder } from './relocate';
import { DataFolderConfig } from './config';
import { withTestDataFolder } from './test-utils';

describe('relocateDataFolder()', () => {
  test('no-op when newAbsolutePath equals currentPath — returns ok, no files touched', async () => {
    await withTestDataFolder(async (dir) => {
      await fs.writeFile(path.join(dir, 'preferences.json'), '{"theme":"mountain"}', 'utf-8');
      const result = await relocateDataFolder(dir);
      expect(result.ok).toBe(true);
      // DataFolderConfig still returns original path
      expect(DataFolderConfig.getInstance().dataFolderPath).toBe(dir);
      // Original file untouched
      const content = await fs.readFile(path.join(dir, 'preferences.json'), 'utf-8');
      expect(content).toBe('{"theme":"mountain"}');
    });
  });

  test('successful relocation: files appear at new path, DataFolderConfig returns new path', async () => {
    await withTestDataFolder(async (sourceDir) => {
      // Populate source dir with files in root and imports/ subdir
      await fs.writeFile(path.join(sourceDir, 'preferences.json'), '{"theme":"mountain"}', 'utf-8');
      await fs.mkdir(path.join(sourceDir, 'imports'), { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'imports', 'bank.csv'), 'date,amount', 'utf-8');

      const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-reloc-dest-'));
      const appSupportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-appsupport-'));
      try {
        const result = await relocateDataFolder(destDir, appSupportDir);
        expect(result.ok).toBe(true);

        // Files exist at new location
        const prefsContent = await fs.readFile(path.join(destDir, 'preferences.json'), 'utf-8');
        expect(prefsContent).toBe('{"theme":"mountain"}');
        const csvContent = await fs.readFile(path.join(destDir, 'imports', 'bank.csv'), 'utf-8');
        expect(csvContent).toBe('date,amount');

        // DataFolderConfig now returns new path
        expect(DataFolderConfig.getInstance().dataFolderPath).toBe(destDir);
      } finally {
        await fs.rm(destDir, { recursive: true, force: true });
        await fs.rm(appSupportDir, { recursive: true, force: true });
      }
    });
  });

  test('error mid-copy: originals untouched, DataFolderConfig still returns old path', async () => {
    await withTestDataFolder(async (sourceDir) => {
      await fs.writeFile(path.join(sourceDir, 'preferences.json'), '{"theme":"mountain"}', 'utf-8');

      // Use a file path where mkdir will fail (ENOTDIR — a file blocks directory creation)
      const blockingFile = path.join(os.tmpdir(), `oursum-blocking-${Date.now()}`);
      await fs.writeFile(blockingFile, 'block', 'utf-8');
      try {
        // newAbsolutePath is a file, so fs.mkdir(..., 'imports') inside it will fail
        const result = await relocateDataFolder(blockingFile);
        expect(result.ok).toBe(false);

        // Original file untouched
        const prefsContent = await fs.readFile(path.join(sourceDir, 'preferences.json'), 'utf-8');
        expect(prefsContent).toBe('{"theme":"mountain"}');

        // DataFolderConfig still points to original path
        expect(DataFolderConfig.getInstance().dataFolderPath).toBe(sourceDir);
      } finally {
        await fs.rm(blockingFile, { force: true });
      }
    });
  });

  test('rolls back copied destination files when app-settings persistence fails', async () => {
    await withTestDataFolder(async (sourceDir) => {
      await fs.writeFile(path.join(sourceDir, 'data.json'), '{"key":"value"}', 'utf-8');

      const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-rollback-dest-'));
      const blockingAppSupportPath = path.join(os.tmpdir(), `oursum-appsupport-block-${Date.now()}`);
      await fs.writeFile(blockingAppSupportPath, 'block', 'utf-8');
      try {
        const result = await relocateDataFolder(destDir, blockingAppSupportPath);
        expect(result.ok).toBe(false);

        expect(DataFolderConfig.getInstance().dataFolderPath).toBe(sourceDir);
        expect(await fs.readFile(path.join(sourceDir, 'data.json'), 'utf-8')).toBe('{"key":"value"}');
        await expect(fs.access(path.join(destDir, 'data.json'))).rejects.toThrow();
      } finally {
        await fs.rm(destDir, { recursive: true, force: true });
        await fs.rm(blockingAppSupportPath, { force: true });
      }
    });
  });

  test('uses atomicWrite for relocation copies instead of fs.rename across folders', async () => {
    const source = await fs.readFile(path.join(import.meta.dir, 'relocate.ts'), 'utf-8');
    expect(source).toContain('const writeResult = await atomicWrite(destPath, content);');
    expect(source).not.toContain('await fs.rename(');
  });

  test('preserves file contents when relocating between distinct source and destination directories', async () => {
    await withTestDataFolder(async (sourceDir) => {
      await fs.writeFile(path.join(sourceDir, 'data.json'), '{"key":"value"}', 'utf-8');

      const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-cross-dest-'));
      const appSupportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oursum-appsupport-'));
      try {
        const result = await relocateDataFolder(destDir, appSupportDir);
        expect(result.ok).toBe(true);

        const content = await fs.readFile(path.join(destDir, 'data.json'), 'utf-8');
        expect(content).toBe('{"key":"value"}');
      } finally {
        await fs.rm(destDir, { recursive: true, force: true });
        await fs.rm(appSupportDir, { recursive: true, force: true });
      }
    });
  });
});
