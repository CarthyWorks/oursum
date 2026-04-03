// src/core/persistence/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';
import { DataFolderConfig, resolveDataFolderPath } from './config';
import { withTestDataFolder } from './test-utils';

describe('DataFolderConfig', () => {
  beforeEach(() => DataFolderConfig.reset());
  afterEach(() => DataFolderConfig.reset());

  test('getInstance() returns the same reference on repeated calls', async () => {
    await withTestDataFolder(async () => {
      const a = DataFolderConfig.getInstance();
      const b = DataFolderConfig.getInstance();
      expect(a).toBe(b);
    });
  });

  test('importsPath equals dataFolderPath + /imports', async () => {
    await withTestDataFolder(async () => {
      const cfg = DataFolderConfig.getInstance();
      expect(cfg.importsPath).toBe(path.join(cfg.dataFolderPath, 'imports'));
    });
  });

  test('manualPath equals dataFolderPath + /manual', async () => {
    await withTestDataFolder(async () => {
      const cfg = DataFolderConfig.getInstance();
      expect(cfg.manualPath).toBe(path.join(cfg.dataFolderPath, 'manual'));
    });
  });

  test('configFilePath returns absolute path inside data folder', async () => {
    await withTestDataFolder(async () => {
      const cfg = DataFolderConfig.getInstance();
      const result = cfg.configFilePath('preferences.json');
      expect(result).toBe(path.join(cfg.dataFolderPath, 'preferences.json'));
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  test('withTestDataFolder: dataFolderPath resolves to temp dir during fn, then resets', async () => {
    let pathDuringFn = '';
    await withTestDataFolder(async (dir) => {
      pathDuringFn = DataFolderConfig.getInstance().dataFolderPath;
      expect(pathDuringFn).toBe(dir);
    });
    // After the fn, instance should be reset — next call creates a new one with the OS default path
    const afterReset = DataFolderConfig.getInstance().dataFolderPath;
    expect(afterReset).not.toBe(pathDuringFn);
  });

  test('withTestDataFolder isolates concurrent calls', async () => {
    const results = await Promise.all([
      withTestDataFolder(async (dir) => {
        await Bun.sleep(40);
        return { expected: dir, actual: DataFolderConfig.getInstance().dataFolderPath };
      }),
      withTestDataFolder(async (dir) => {
        await Bun.sleep(10);
        return { expected: dir, actual: DataFolderConfig.getInstance().dataFolderPath };
      }),
    ]);

    expect(results).toEqual([
      { expected: results[0].expected, actual: results[0].expected },
      { expected: results[1].expected, actual: results[1].expected },
    ]);
  });

  test('resolveDataFolderPath returns the macOS default path', () => {
    expect(resolveDataFolderPath('darwin', '/Users/tester')).toBe(
      '/Users/tester/Library/Application Support/Oursum/data',
    );
  });

  test('resolveDataFolderPath returns the Windows default path', () => {
    expect(resolveDataFolderPath('win32', 'C:/Users/tester', 'C:/Users/tester/AppData/Roaming')).toBe(
      'C:/Users/tester/AppData/Roaming/Oursum/data',
    );
  });

  test('resolveDataFolderPath falls back to a dot directory on other platforms', () => {
    expect(resolveDataFolderPath('linux', '/home/tester')).toBe('/home/tester/.oursum/data');
  });
});
