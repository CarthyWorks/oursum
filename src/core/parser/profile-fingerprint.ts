// src/core/parser/profile-fingerprint.ts
// Pure SHA-256 fingerprint + profile auto-match logic.
// RULE: No Electrobun imports. Testable with `bun test` without launching the app window.
import { createHash } from 'node:crypto';
import type { ImportProfile, ProfileMatchResult } from '../../shared/types';

function countNonEmptyColumns(headerRow: string[]): number {
  return headerRow.filter(name => name.trim() !== '').length;
}

function resolveCandidateHeaderRow(
  headerRow: string[],
  scannedRows: string[][] | undefined,
  profile: ImportProfile,
): string[] {
  return scannedRows?.[profile.headerRowOffset] ?? headerRow;
}

/**
 * Normalizes a header row and computes a deterministic SHA-256 fingerprint.
 * - Each column name is lowercased and whitespace-stripped
 * - Names are sorted alphabetically then joined with '|'
 * - The joined string is hashed with SHA-256 (hex) → always 64 chars
 * - Empty headerRow → computes fingerprint of '' (does NOT throw)
 */
export function computeFingerprint(headerRow: string[]): string {
  const normalized = headerRow
    .map(name => name.toLowerCase().trim())
    .sort()
    .join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Matches a header row against a list of saved ImportProfiles, honoring each
 * profile's headerRowOffset when scannedRows are provided.
 * Returns the best match result:
 * - 'exact'   → fingerprint matches exactly → skip wizard
 * - 'partial' → same column count, different fingerprint → wizard pre-filled
 * - 'none'    → no match → wizard with blank mappings
 *
 * Both passes iterate profiles in insertion order; first match wins.
 */
export function matchProfileFromRows(
  headerRow: string[],
  profiles: ImportProfile[],
  scannedRows?: string[][],
): ProfileMatchResult {
  const exactMatch = profiles.find((profile) => {
    const candidateHeaderRow = resolveCandidateHeaderRow(headerRow, scannedRows, profile);
    return computeFingerprint(candidateHeaderRow) === profile.fingerprint;
  });

  if (exactMatch) return { match: 'exact', profile: exactMatch };

  const partialMatch = profiles.find((profile) => {
    const candidateHeaderRow = resolveCandidateHeaderRow(headerRow, scannedRows, profile);
    return countNonEmptyColumns(candidateHeaderRow) === Object.keys(profile.columnMap).length;
  });

  if (partialMatch) return { match: 'partial', profile: partialMatch };

  return { match: 'none' };
}

/**
 * Convenience wrapper for callers that already have the exact header row
 * (no frontmatter / scanned-row offset needed). Delegates to matchProfileFromRows.
 */
export function matchProfile(headerRow: string[], profiles: ImportProfile[]): ProfileMatchResult {
  return matchProfileFromRows(headerRow, profiles);
}
