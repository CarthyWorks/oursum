// src/core/persistence/profiles.test.ts
import { describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import { readProfiles, saveProfile } from './profiles';
import { withTestDataFolder } from './test-utils';
import { DataFolderConfig } from './config';
import { computeFingerprint } from '../parser/profile-fingerprint';
import type { ImportProfile } from '../../shared/types';

function makeProfile(overrides?: Partial<ImportProfile>): ImportProfile {
  return {
    id: 'test-profile-1',
    name: 'Test Bank',
    bankName: 'Test Bank',
    csvDelimiter: ',',
    columnMap: { Date: 'date', Amount: 'amount', Description: 'description' },
    dateFormat: 'dd/mm/yyyy',
    amountMultiplier: 1,
    headerRowOffset: 0,
    fingerprint: computeFingerprint(['Date', 'Amount', 'Description']),
    ...overrides,
  };
}

// ── readProfiles ─────────────────────────────────────────────────────────────

describe('readProfiles()', () => {
  it('returns ok([]) when no profiles.json exists (first launch)', async () => {
    await withTestDataFolder(async () => {
      const result = await readProfiles();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual([]);
    });
  });

  it('round-trip: saveProfile then readProfiles returns the saved profile', async () => {
    await withTestDataFolder(async () => {
      const profile = makeProfile();
      await saveProfile(profile);
      const result = await readProfiles();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual(profile);
      }
    });
  });

  it('returns err when profiles.json contains a schema violation', async () => {
    await withTestDataFolder(async () => {
      const filePath = DataFolderConfig.getInstance().configFilePath('profiles.json');
      await fs.writeFile(filePath, JSON.stringify([{ invalid: true }]), 'utf-8');
      const result = await readProfiles();
      expect(result.ok).toBe(false);
    });
  });

  it('returns err when profiles.json contains malformed JSON', async () => {
    await withTestDataFolder(async () => {
      const filePath = DataFolderConfig.getInstance().configFilePath('profiles.json');
      await fs.writeFile(filePath, 'not valid json', 'utf-8');
      const result = await readProfiles();
      expect(result.ok).toBe(false);
    });
  });
});

// ── saveProfile ───────────────────────────────────────────────────────────────

describe('saveProfile()', () => {
  it('creates profiles.json and persists a new profile', async () => {
    await withTestDataFolder(async () => {
      const profile = makeProfile();
      const result = await saveProfile(profile);
      expect(result.ok).toBe(true);
      const readResult = await readProfiles();
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.data).toHaveLength(1);
    });
  });

  it('upserts: replaces existing profile with same id (does not duplicate)', async () => {
    await withTestDataFolder(async () => {
      const original = makeProfile({ name: 'Original Name' });
      await saveProfile(original);
      const updated = makeProfile({ name: 'Updated Name' });
      await saveProfile(updated);
      const result = await readProfiles();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('Updated Name');
      }
    });
  });

  it('appends a new profile when id does not already exist', async () => {
    await withTestDataFolder(async () => {
      const profile1 = makeProfile({ id: 'p1', name: 'Bank A' });
      const profile2 = makeProfile({ id: 'p2', name: 'Bank B' });
      await saveProfile(profile1);
      await saveProfile(profile2);
      const result = await readProfiles();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data.map(p => p.id)).toEqual(['p1', 'p2']);
      }
    });
  });

  it('preserves all profile fields across a round-trip', async () => {
    await withTestDataFolder(async () => {
      const profile = makeProfile({
        id: 'roundtrip',
        csvDelimiter: ';',
        amountMultiplier: -1,
        headerRowOffset: 3,
        dateFormat: 'mm/dd/yyyy',
      });
      await saveProfile(profile);
      const result = await readProfiles();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data[0]).toEqual(profile);
    });
  });
});
