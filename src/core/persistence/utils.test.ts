// src/core/persistence/utils.test.ts
import { describe, test, expect } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicWrite } from './utils';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-write-test-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('atomicWrite', () => {
  test('writes a new file and content matches', async () => {
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'new-file.json');
      const content = '{"hello":"world"}';
      const result = await atomicWrite(dest, content);
      expect(result.ok).toBe(true);
      const read = await fs.readFile(dest, 'utf-8');
      expect(read).toBe(content);
    });
  });

  test('overwrites an existing file with new content', async () => {
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'existing.json');
      await fs.writeFile(dest, '{"old":"value"}', 'utf-8');
      const newContent = '{"new":"value"}';
      const result = await atomicWrite(dest, newContent);
      expect(result.ok).toBe(true);
      const read = await fs.readFile(dest, 'utf-8');
      expect(read).toBe(newContent);
    });
  });

  test('creates parent directory if it does not exist and writes file', async () => {
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'nested', 'deep', 'file.json');
      const content = '{"nested":true}';
      const result = await atomicWrite(dest, content);
      expect(result.ok).toBe(true);
      const read = await fs.readFile(dest, 'utf-8');
      expect(read).toBe(content);
    });
  });

  test('original file is unchanged when rename throws (interrupted write simulation)', async () => {
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'original.json');
      const originalContent = '{"original":true}';
      await fs.writeFile(dest, originalContent, 'utf-8');

      // Mock fsImpl where rename throws — simulates an interrupted write mid-operation
      const fsImpl = {
        mkdir: async (): Promise<string | undefined> => undefined,
        writeFile: async () => {},
        unlink: async () => {},
        rename: async () => { throw new Error('Simulated rename failure'); },
      };

      const result = await atomicWrite(dest, '{"partial":"interrupted"}', { fsImpl });

      // Operation must fail
      expect(result.ok).toBe(false);
      // Destination must remain unchanged — no partial write visible at the final path
      const afterContent = await fs.readFile(dest, 'utf-8');
      expect(afterContent).toBe(originalContent);
    });
  });

  test('uses unlink plus rename on Windows overwrites', async () => {
    const calls: string[] = [];
    const fsImpl = {
      mkdir: async (): Promise<string | undefined> => {
        calls.push('mkdir');
        return undefined;
      },
      writeFile: async () => {
        calls.push('writeFile');
      },
      unlink: async (targetPath: string) => {
        calls.push(`unlink:${targetPath}`);
      },
      rename: async (fromPath: string, toPath: string) => {
        calls.push(`rename:${fromPath}->${toPath}`);
      },
    };

    const result = await atomicWrite('C:/data/preferences.json', '{"ok":true}', {
      fsImpl,
      platform: 'win32',
      randomUUID: () => 'temp-id',
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'mkdir',
      'writeFile',
      'unlink:C:/data/preferences.json',
      'rename:C:/data/temp-id.tmp->C:/data/preferences.json',
    ]);
  });
});
