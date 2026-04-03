// src/core/parser/xlsx-adapter.ts
// Parse XLSX buffer to normalized string[][].
// RULE: No framework imports — pure Bun/TS + xlsx only.
import * as XLSX from 'xlsx';
import { ok, err, type Result } from '../../shared/contracts/result';

export type XlsxParseResult = { rows: string[][]; parseErrors: string[] };

/**
 * Parse an XLSX file buffer to a normalized string[][].
 * Uses the first sheet only. SheetJS handles encoding internally.
 */
export function parseXLSX(buffer: Uint8Array): Result<XlsxParseResult> {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return err('XLSX_NO_SHEETS');
    }

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

    // Coerce all cells to strings; use Array.from to normalize sparse arrays
    const rows: string[][] = rawRows.map((row) =>
      Array.from({ length: (row as unknown[]).length }, (_, i) => {
        const cell = (row as unknown[])[i];
        return cell == null ? '' : String(cell);
      })
    );

    return ok({ rows, parseErrors: [] });
  } catch {
    return err('XLSX_PARSE_FAILED');
  }
}
