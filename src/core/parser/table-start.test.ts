// src/core/parser/table-start.test.ts
import { describe, it, expect } from 'bun:test';
import { detectTableStart } from './table-start';

/** Build synthetic rows: n rows each with the given cells. */
function makeDataRows(count: number, cells: string[]): string[][] {
  return Array.from({ length: count }, () => [...cells]);
}

describe('detectTableStart', () => {
  it('no frontmatter (ING credit card pattern): header at row 0, high confidence', () => {
    const headerRow = ['DATA OPERAZIONE', 'DATA REGISTRAZIONE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO'];
    const dataRows = makeDataRows(5, ['01/01/2026', '03/01/2026', 'PAGAMENTO POS', '-50,00']);
    const rows = [headerRow, ...dataRows];

    const result = detectTableStart(rows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headerRowOffset).toBe(0);
    expect(result.confidence).toBe('high');
  });

  it('6-row frontmatter (cc_elena_dicembre pattern): header at row 6, high confidence', () => {
    const frontmatter: string[][] = [
      ['Intestazione: Elena Rossi', '', '', ''],
      ['', '', '', ''],
      ['Carta di credito: **** **** **** 0000', '', '', ''],
      ['', '', '', ''],
      ['LISTA MOVIMENTI dal 01/12/2025 al 31/12/2025', '', '', ''],
      ['', '', '', ''],
    ];
    const headerRow = ['DATA OPERAZIONE', 'DATA REGISTRAZIONE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO'];
    const dataRows = makeDataRows(5, ['01/12/2025', '03/12/2025', 'SUPERMERCATO', '-30,00']);
    const rows = [...frontmatter, headerRow, ...dataRows];

    const result = detectTableStart(rows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headerRowOffset).toBe(6);
    expect(result.confidence).toBe('high');
  });

  it('low confidence: header at row 0 with only 2 data rows → low confidence', () => {
    const headerRow = ['DATA OPERAZIONE', 'DATA REGISTRAZIONE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO'];
    const dataRows = makeDataRows(2, ['01/01/2026', '03/01/2026', 'PAGAMENTO POS', '-50,00']);
    const rows = [headerRow, ...dataRows];

    const result = detectTableStart(rows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headerRowOffset).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('no table found: 30 rows all single-value or empty → err(NO_TABLE_FOUND)', () => {
    // All rows have fewer than 3 non-empty cells
    const rows = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? ['single value'] : ['', '']
    );

    const result = detectTableStart(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NO_TABLE_FOUND');
  });

  it('forced offset: detectTableStart(anyRows, 3) → always headerRowOffset 3, high confidence', () => {
    const rows = makeDataRows(10, ['a', 'b', 'c', 'd']);
    const result = detectTableStart(rows, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headerRowOffset).toBe(3);
    expect(result.confidence).toBe('high');
  });

  it('forced offset 0 → headerRowOffset 0, high confidence', () => {
    const rows = makeDataRows(5, ['x', 'y', 'z']);
    const result = detectTableStart(rows, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headerRowOffset).toBe(0);
    expect(result.confidence).toBe('high');
  });

  it('empty rows array with no forced offset → no table found', () => {
    const result = detectTableStart([]);
    expect(result.ok).toBe(false);
  });
});
