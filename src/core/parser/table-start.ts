// src/core/parser/table-start.ts
// Detect where the data table starts in a parsed file (handles bank frontmatter rows).
// RULE: No I/O — pure string[][] logic only.

export type TableStartResult =
  | { ok: true; headerRowOffset: number; confidence: 'high' | 'low' }
  | { ok: false; error: 'NO_TABLE_FOUND' };

/** Check whether a cell value looks like a number (European format aware). */
function isNumericLike(cell: string): boolean {
  const trimmed = cell.trim();
  if (trimmed === '') return false;
  // Handle European decimal format (comma as decimal separator)
  const normalized = trimmed.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isFinite(parsed) && !isNaN(parsed);
}

/**
 * Detect the header row in up to the first 30 rows.
 *
 * If `forcedOffset` is provided, trust the user's selection and return immediately
 * with high confidence.
 *
 * Detection algorithm:
 * - A candidate header row must have ≥3 non-empty cells AND ≥50% of non-empty cells are text-like
 * - High confidence: ≥3 consistent data rows follow the header (non-empty cell count within ±1)
 * - Low confidence: 1–2 consistent data rows follow
 * - No table found: neither a high nor low confidence result was located
 */
export function detectTableStart(rows: string[][], forcedOffset?: number): TableStartResult {
  // Forced path — trust the user
  if (forcedOffset !== undefined) {
    return { ok: true, headerRowOffset: forcedOffset, confidence: 'high' };
  }

  const scanLimit = Math.min(30, rows.length);
  let firstLowConfidence: TableStartResult | null = null;

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];

    // Count non-empty cells
    const nonEmptyCells = row.filter((c) => c.trim() !== '');
    if (nonEmptyCells.length < 3) continue;

    // Majority text check: ≥50% of non-empty cells are non-numeric
    const numericCount = nonEmptyCells.filter(isNumericLike).length;
    const textCount = nonEmptyCells.length - numericCount;
    if (textCount < nonEmptyCells.length * 0.5) continue;

    // Row i is a candidate header — count consistent data rows following it
    const headerNonEmptyCount = nonEmptyCells.length;
    let consistentCount = 0;

    for (let j = i + 1; j < scanLimit; j++) {
      const dataRow = rows[j];
      const dataRowNonEmpty = dataRow.filter((c) => c.trim() !== '').length;
      if (Math.abs(dataRowNonEmpty - headerNonEmptyCount) <= 1) {
        consistentCount++;
      }
    }

    if (consistentCount >= 3) {
      // High confidence
      return { ok: true, headerRowOffset: i, confidence: 'high' };
    }

    if (consistentCount >= 1 && firstLowConfidence === null) {
      // Save first low-confidence hit, continue scanning for better match
      firstLowConfidence = { ok: true, headerRowOffset: i, confidence: 'low' };
    }
  }

  if (firstLowConfidence !== null) {
    return firstLowConfidence;
  }

  return { ok: false, error: 'NO_TABLE_FOUND' };
}
