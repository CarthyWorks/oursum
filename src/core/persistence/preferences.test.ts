// src/core/persistence/preferences.test.ts
import { describe, expect, test } from 'bun:test';
import { readPreferences, writePreferences } from './preferences';
import { withTestDataFolder } from './test-utils';
import type { Preferences } from '../../shared/types';

const defaultPrefs: Preferences = {
  language: 'en',
  numberFormat: '1,234.56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
  theme: 'mountain',
};

describe('readPreferences()', () => {
  test('returns ok(null) when no preferences.json exists (first launch)', async () => {
    await withTestDataFolder(async () => {
      const result = await readPreferences();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBeNull();
    });
  });

  test('roundtrip: writePreferences then readPreferences returns ok(defaultPrefs)', async () => {
    await withTestDataFolder(async () => {
      const writeResult = await writePreferences(defaultPrefs);
      expect(writeResult.ok).toBe(true);

      const readResult = await readPreferences();
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.data).toEqual(defaultPrefs);
    });
  });

  test('returns ok:false when preferences.json has a missing required field (schema violation)', async () => {
    await withTestDataFolder(async (dir) => {
      // Write a file with missing "theme" field
      const { promises: fs } = await import('node:fs');
      const path = await import('node:path');
      const filePath = path.join(dir, 'preferences.json');
      const malformed = { language: 'en', numberFormat: '1,234.56', dateFormat: 'dd/mm/yyyy', currencySymbol: '€' };
      await fs.writeFile(filePath, JSON.stringify(malformed), 'utf-8');

      const result = await readPreferences();
      expect(result.ok).toBe(false);
    });
  });
});
