// src/core/dedup/index.ts
// Deduplication engine — collision-indexed fingerprinting.
// ADR-005: zero Electrobun imports, zero React imports, zero node:crypto.
// Read-only module: makes no writes to disk.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ok, err, type Result } from '../../shared/contracts/result';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DeduplicateInput {
  date: string;
  amount: number;
  description: string;
}

export interface DeduplicatedRow {
  fingerprint: string;
  isOverwrite: boolean;
}

export interface DeduplicateResult {
  rows: DeduplicatedRow[];
  newCount: number;
  overwriteCount: number;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Computes a plain-string transaction fingerprint (NOT SHA-256).
 * Format: `${date}|${amount}|${description}|${occurrenceIndex}`
 */
export function computeTransactionFingerprint(
  date: string,
  amount: number,
  description: string,
  occurrenceIndex: number,
): string {
  return `${date}|${amount}|${description}|${occurrenceIndex}`;
}

/**
 * Assigns occurrence indices to rows based on how many times the exact
 * date+amount+description triplet appeared earlier in the batch (0-based).
 */
export function assignOccurrenceIndices(
  rows: DeduplicateInput[],
): Array<{ row: DeduplicateInput; occurrenceIndex: number }> {
  const seenCounts = new Map<string, number>();
  return rows.map((row) => {
    const tripletKey = `${row.date}|${row.amount}|${row.description}`;
    const idx = seenCounts.get(tripletKey) ?? 0;
    seenCounts.set(tripletKey, idx + 1);
    return { row, occurrenceIndex: idx };
  });
}

/**
 * Reads all *.ndjson files in importsDir and extracts a Set of fingerprint
 * strings from the `id` field of each line.
 * - Returns ok(empty Set) if the directory does not exist (ENOENT).
 * - Silently skips malformed lines or lines without a string `id`.
 * - Returns err() only on unexpected filesystem errors.
 */
export async function loadExistingFingerprints(
  importsDir: string,
): Promise<Result<Set<string>>> {
  const fingerprintSet = new Set<string>();
  try {
    let entries: string[];
    try {
      entries = await fs.readdir(importsDir);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ok(fingerprintSet);
      throw e;
    }
    const ndjsonFiles = entries.filter((f) => f.endsWith('.ndjson'));
    for (const filename of ndjsonFiles) {
      const content = await fs.readFile(path.join(importsDir, filename), 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as unknown;
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'id' in parsed &&
            typeof (parsed as Record<string, unknown>).id === 'string'
          ) {
            fingerprintSet.add((parsed as { id: string }).id);
          }
        } catch {
          // silently skip malformed JSON lines
        }
      }
    }
    return ok(fingerprintSet);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Orchestrates the deduplication check:
 * 1. Loads existing fingerprints from importsDir.
 * 2. Assigns occurrence indices to incoming rows.
 * 3. Computes fingerprints and checks against the existing set.
 * Returns counts of new vs. overwrite rows.
 */
export async function deduplicateRows(
  rows: DeduplicateInput[],
  importsDir: string,
): Promise<Result<DeduplicateResult>> {
  const existingResult = await loadExistingFingerprints(importsDir);
  if (!existingResult.ok) return err(existingResult.error);

  const existingFingerprints = existingResult.data;
  const indexed = assignOccurrenceIndices(rows);

  let newCount = 0;
  let overwriteCount = 0;
  const deduplicatedRows: DeduplicatedRow[] = indexed.map(({ row, occurrenceIndex }) => {
    const fingerprint = computeTransactionFingerprint(
      row.date,
      row.amount,
      row.description,
      occurrenceIndex,
    );
    const isOverwrite = existingFingerprints.has(fingerprint);
    if (isOverwrite) {
      overwriteCount++;
    } else {
      newCount++;
    }
    return { fingerprint, isOverwrite };
  });

  return ok({ rows: deduplicatedRows, newCount, overwriteCount });
}
