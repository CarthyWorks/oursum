// src/core/parser/csv-adapter.test.ts
import { describe, it, expect } from 'bun:test';
import { parseCSV } from './csv-adapter';

function toBuffer(text: string, encoding: BufferEncoding = 'utf8'): Uint8Array {
  return new Uint8Array(Buffer.from(text, encoding));
}

describe('parseCSV', () => {
  it('semicolon-delimited CSV (ING format) → correct string[][]', () => {
    const csv = 'DATA OPERAZIONE;DATA REGISTRAZIONE;DESCRIZIONE OPERAZIONE;IMPORTO IN EURO\n01/01/2026;03/01/2026;PAGAMENTO POS;-50,00\n';
    const buf = toBuffer(csv);
    const result = parseCSV(buf, 'utf-8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.delimiter).toBe(';');
    expect(result.data.rows[0]).toEqual(['DATA OPERAZIONE', 'DATA REGISTRAZIONE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO']);
    expect(result.data.rows[1]).toEqual(['01/01/2026', '03/01/2026', 'PAGAMENTO POS', '-50,00']);
  });

  it('comma-delimited CSV → correct string[][]', () => {
    const csv = 'date,amount,description\n01/12/2025,-2.80,Grocery\n';
    const buf = toBuffer(csv);
    const result = parseCSV(buf, 'utf-8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.delimiter).toBe(',');
    expect(result.data.rows[0]).toEqual(['date', 'amount', 'description']);
    expect(result.data.rows[1]).toEqual(['01/12/2025', '-2.80', 'Grocery']);
  });

  it('CSV with empty lines → empty lines are excluded (skipEmptyLines: true)', () => {
    const csv = 'a,b,c\n\n1,2,3\n\n4,5,6\n';
    const buf = toBuffer(csv);
    const result = parseCSV(buf, 'utf-8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows.length).toBe(3);
    expect(result.data.rows[0]).toEqual(['a', 'b', 'c']);
    expect(result.data.rows[1]).toEqual(['1', '2', '3']);
    expect(result.data.rows[2]).toEqual(['4', '5', '6']);
  });

  it('all cells remain strings even when values look numeric', () => {
    const csv = 'amount,description\n-2,80,grocery\n100,rent\n';
    const buf = toBuffer(csv);
    const result = parseCSV(buf, 'utf-8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All values are strings, not numbers
    for (const row of result.data.rows) {
      for (const cell of row) {
        expect(typeof cell).toBe('string');
      }
    }
  });

  it('numeric-looking cells like "-2,80" remain as strings', () => {
    const csv = 'amount\n"-2,80"\n';
    const buf = toBuffer(csv);
    const result = parseCSV(buf, 'utf-8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data.rows[1][0]).toBe('string');
    expect(result.data.rows[1][0]).toBe('-2,80');
  });
});
