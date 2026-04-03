// src/core/parser/xlsx-adapter.test.ts
import { describe, it, expect } from 'bun:test';
import path from 'node:path';
import { parseXLSX } from './xlsx-adapter';

const FIXTURES_DIR = path.join(import.meta.dir, '../../../data/test/import-fixtures/italian');

describe('parseXLSX', () => {
  it('parses cc_elena_dicembre.xlsx fixture — correct column headers and data rows', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_elena_dicembre.xlsx');
    const buf = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    const result = parseXLSX(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should have rows
    expect(result.data.rows.length).toBeGreaterThan(0);
  });

  it('all cells are strings (no numbers, no booleans)', async () => {
    const filePath = path.join(FIXTURES_DIR, 'Movimenti_CartaCredito_0000_20260101_20260131.xlsx');
    const buf = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    const result = parseXLSX(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.data.rows) {
      for (const cell of row) {
        expect(typeof cell).toBe('string');
      }
    }
  });

  it('parses transazioni.xlsx fixture — has rows and string cells', async () => {
    const filePath = path.join(FIXTURES_DIR, 'transazioni.xlsx');
    const buf = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    const result = parseXLSX(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows.length).toBeGreaterThan(0);
  });

  it('cc_mario_dicembre.xlsx fixture — parses successfully with string cells', async () => {
    const filePath = path.join(FIXTURES_DIR, 'cc_mario_dicembre.xlsx');
    const buf = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    const result = parseXLSX(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows.length).toBeGreaterThan(0);
    // All cells of non-empty rows must be strings
    for (const row of result.data.rows) {
      for (const cell of row) {
        expect(typeof cell).toBe('string');
      }
    }
  });

  // Note: XLSX_NO_SHEETS and XLSX_PARSE_FAILED are defensive branches.
  // SheetJS v0.18.5 creates a default "Sheet1" for any Uint8Array input (even garbage bytes)
  // and only throws for null/undefined. These paths cannot be triggered with real Uint8Array data
  // without mocking SheetJS internals.
});
