// src/core/persistence/config.ts
// Electrobun-free: uses node:async_hooks, node:os, node:path only.
import { AsyncLocalStorage } from 'node:async_hooks';
import os from 'node:os';
import path from 'node:path';

export function resolveDataFolderPath(
  platform: NodeJS.Platform,
  homeDirectory: string = os.homedir(),
  appDataDirectory: string | undefined = process.env.APPDATA,
): string {
  switch (platform) {
    case 'darwin':
      return path.join(homeDirectory, 'Library', 'Application Support', 'Oursum', 'data');
    case 'win32':
      return path.join(appDataDirectory ?? homeDirectory, 'Oursum', 'data');
    default:
      return path.join(homeDirectory, '.oursum', 'data');
  }
}

export class DataFolderConfig {
  private static instance: DataFolderConfig | null = null;
  private static readonly testInstanceStorage = new AsyncLocalStorage<DataFolderConfig>();
  private _path: string;

  private constructor(dataPath: string) {
    this._path = dataPath;
  }

  static getInstance(): DataFolderConfig {
    const testInstance = DataFolderConfig.testInstanceStorage.getStore();
    if (testInstance) {
      return testInstance;
    }

    if (!DataFolderConfig.instance) {
      DataFolderConfig.instance = new DataFolderConfig(DataFolderConfig.resolveDefault());
    }
    return DataFolderConfig.instance;
  }

  private static resolveDefault(): string {
    return resolveDataFolderPath(process.platform);
  }

  get dataFolderPath(): string { return this._path; }
  get importsPath(): string    { return path.join(this._path, 'imports'); }
  get manualPath(): string     { return path.join(this._path, 'manual'); }

  configFilePath(filename: string): string {
    return path.join(this._path, filename);
  }

  /** Called by Story 1.6 — data folder relocation */
  setPath(absolutePath: string): void {
    this._path = absolutePath;
  }

  /** @internal — used by withTestDataFolder() to isolate concurrent test contexts. */
  static runWithTestPath<T>(absolutePath: string, fn: () => Promise<T>): Promise<T> {
    return DataFolderConfig.testInstanceStorage.run(new DataFolderConfig(absolutePath), fn);
  }

  /**
   * @internal — resets the global singleton to null.
   * Only use in test lifecycle hooks (beforeEach/afterEach) when testing singleton reset
   * behavior that cannot be covered by withTestDataFolder alone.
   */
  static reset(): void {
    DataFolderConfig.instance = null;
  }
}
