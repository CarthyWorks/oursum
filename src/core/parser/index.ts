// src/core/parser/index.ts
// Public API surface for the parser module.
// RULE: Only this file is imported by src/main/ — never internal submodules.
// RULE: No imports from electrobun/* or src/renderer/ — ADR-005.
import path from 'node:path';
import { detectEncoding } from './encoding-detector';
import { parseCSV } from './csv-adapter';
import { parseXLSX } from './xlsx-adapter';
import { detectTableStart } from './table-start';
import { ok, err, type Result } from '../../shared/contracts/result';
import type { IngestResult } from '../../shared/types';

export type { IngestResult };

/**
 * Read and parse a CSV or XLSX file, detect encoding and table start.
 *
 * @param filePath Absolute path to the file
 * @param forcedHeaderRowOffset If provided, skip detection and use this row as the header
 * @returns Result containing IngestResult on success, or an error string on failure
 */
/**
 * Parse an already-loaded buffer (CSV or XLSX) — used when the caller already has the file bytes
 * (e.g. WKWebView drag-and-drop, where `file.path` is not available).
 *
 * @param buf    Raw file bytes
 * @param filename  Original filename — used only to detect CSV vs XLSX via extension
 * @param forcedHeaderRowOffset  If provided, skip detection and use this row as the header
 */
export async function ingestBuffer(buf: Uint8Array, filename: string, forcedHeaderRowOffset?: number): Promise<Result<IngestResult>> {
  const ext = path.extname(filename).toLowerCase();

  if (ext !== '.csv' && ext !== '.xlsx') {
    return err('UNSUPPORTED_FILE_TYPE');
  }

  let allRows: string[][];
  let parseErrors: string[];
  let encoding: IngestResult['encoding'];
  let fileType: IngestResult['fileType'];
  let csvDelimiter: IngestResult['csvDelimiter'];

  if (ext === '.csv') {
    encoding = detectEncoding(buf);
    const parseResult = parseCSV(buf, encoding);
    if (!parseResult.ok) return err(parseResult.error);
    allRows = parseResult.data.rows;
    parseErrors = parseResult.data.parseErrors;
    csvDelimiter = parseResult.data.delimiter;
    fileType = 'csv';
  } else {
    const parseResult = parseXLSX(buf);
    if (!parseResult.ok) return err(parseResult.error);
    allRows = parseResult.data.rows;
    parseErrors = parseResult.data.parseErrors;
    encoding = 'utf-8'; // SheetJS handles encoding internally
    fileType = 'xlsx';
    csvDelimiter = null;
  }

  const scannedRows = allRows.slice(0, Math.min(30, allRows.length));
  const detection = detectTableStart(scannedRows, forcedHeaderRowOffset);

  if (!detection.ok) {
    return err('NO_TABLE_FOUND');
  }

  const { headerRowOffset, confidence } = detection;
  const headerRow = allRows[headerRowOffset] ?? [];
  const rows = allRows.slice(headerRowOffset + 1);

  return ok<IngestResult>({
    rows,
    headerRow,
    headerRowOffset,
    confidence,
    encoding,
    fileType,
    csvDelimiter,
    parseErrors,
    scannedRows,
  });
}

export async function ingestFile(filePath: string, forcedHeaderRowOffset?: number): Promise<Result<IngestResult>> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.csv' && ext !== '.xlsx') {
    return err('UNSUPPORTED_FILE_TYPE');
  }

  let buf: Uint8Array;
  try {
    buf = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  } catch {
    return err('FILE_READ_FAILED');
  }

  return ingestBuffer(buf, path.basename(filePath), forcedHeaderRowOffset);
}
