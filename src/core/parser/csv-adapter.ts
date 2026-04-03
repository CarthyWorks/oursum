// src/core/parser/csv-adapter.ts
// Parse CSV buffer to normalized string[][].
// RULE: No framework imports — pure Bun/TS + papaparse only.
import Papa from 'papaparse';
import type { Encoding } from './encoding-detector';
import { ok, err, type Result } from '../../shared/contracts/result';

export type CsvParseResult = { rows: string[][]; parseErrors: string[]; delimiter: string | null };

/**
 * Decode a byte buffer with the given encoding and parse it as CSV.
 * Returns a normalized string[][] (all cells as strings).
 */
export function parseCSV(buffer: Uint8Array, encoding: Encoding): Result<CsvParseResult> {
  try {
    // TextDecoder('utf-8') strips BOM automatically per WHATWG spec
    const text = new TextDecoder(encoding).decode(buffer);

    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      dynamicTyping: false,
      header: false,
      // delimiter omitted → papaparse auto-detects comma/semicolon/tab
    });

    // Coerce all cells to strings to guarantee string[][]
    const rows = (result.data as unknown[][]).map((row) =>
      row.map((cell) => String(cell ?? ''))
    );

    const parseErrors = (result.errors ?? []).map(
      (e) => `Row ${e.row}: ${e.message}`
    );

    return ok({ rows, parseErrors, delimiter: result.meta.delimiter ?? null });
  } catch {
    return err('CSV_PARSE_FAILED');
  }
}
