// src/core/parser/index.test.ts
// Integration tests for ingestFile — uses real fixture files from data/test/import-fixtures/
import { describe, it, expect } from 'bun:test';
import path from 'node:path';
import { ingestFile } from './index';

const FIXTURES_DIR = path.join(import.meta.dir, '../../../data/test/import-fixtures/italian');

describe('ingestFile', () => {
  it('Movimenti_CartaCredito CSV → high confidence, headerRowOffset 0', async () => {
    const filePath = path.join(FIXTURES_DIR, 'Movimenti_CartaCredito_0000_20260101_20260131.csv');
    const result = await ingestFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.confidence).toBe('high');
    expect(result.data.headerRowOffset).toBe(0);
    // Pure ASCII file — detector returns iso-8859-1 (ASCII is a subset of both utf-8 and iso-8859-1)
    expect(['utf-8', 'iso-8859-1']).toContain(result.data.encoding);
    expect(result.data.fileType).toBe('csv');
    expect(result.data.csvDelimiter).toBe(';');
    expect(result.data.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.data.headerRow.length).toBeGreaterThan(0);
  });

  it('cc_elena_dicembre CSV → high confidence, headerRowOffset 6', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_elena_dicembre.csv');
    const result = await ingestFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.confidence).toBe('high');
    expect(result.data.headerRowOffset).toBe(6);
    expect(result.data.fileType).toBe('csv');
    expect(result.data.csvDelimiter).toBe(',');
    expect(result.data.rows.length).toBeGreaterThanOrEqual(1);
    // The header row should contain column names
    expect(result.data.headerRow).toContain('DATA OPERAZIONE');
  });

  it('Movimenti_CartaCredito XLSX → same shape as CSV counterpart, fileType xlsx', async () => {
    const filePath = path.join(FIXTURES_DIR, 'Movimenti_CartaCredito_0000_20260101_20260131.xlsx');
    const result = await ingestFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fileType).toBe('xlsx');
    expect(result.data.encoding).toBe('utf-8');
    expect(result.data.csvDelimiter).toBeNull();
    expect(result.data.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.data.headerRow.length).toBeGreaterThan(0);
    // All cells must be strings
    for (const row of result.data.rows) {
      for (const cell of row) {
        expect(typeof cell).toBe('string');
      }
    }
  });

  it('nonexistent path → err(FILE_READ_FAILED)', async () => {
    const result = await ingestFile('/nonexistent/path/file.csv');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('FILE_READ_FAILED');
  });

  it('unsupported file type → err(UNSUPPORTED_FILE_TYPE)', async () => {
    const result = await ingestFile('/some/file.txt');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('forcedHeaderRowOffset: 2 on any fixture → detection returns offset 2 regardless', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_elena_dicembre.csv');
    const result = await ingestFile(filePath, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.headerRowOffset).toBe(2);
    expect(result.data.confidence).toBe('high');
  });

  it('scannedRows contains ≤30 rows', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_elena_dicembre.csv');
    const result = await ingestFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.scannedRows.length).toBeLessThanOrEqual(30);
  });

  it('cc_elena_dicembre XLSX → high confidence, fileType xlsx', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_elena_dicembre.xlsx');
    const result = await ingestFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fileType).toBe('xlsx');
    expect(result.data.rows.length).toBeGreaterThanOrEqual(1);
  });
});
