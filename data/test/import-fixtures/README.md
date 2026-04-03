# Import Fixture Corpus

Use this folder for sanitized fixture files that are safe to commit and use in parser tests.

Do not place raw personal bank exports here unless they have been anonymized.

## Structure

- `italian/` — real Italian bank exports
- `synthetic/` — hand-crafted files used to cover parser edge cases not yet represented by real data

---

## Italian Fixtures — Format Analysis

### `Movimenti_CartaCredito_0000_20260101_20260131.csv` + `.xlsx`

**Bank:** ING — credit card export
**Delimiter:** semicolon `;`
**Decimal separator:** comma (e.g. `-2,80`)
**Thousands separator:** dot (e.g. `-1.650,00`)
**Date format:** `dd/mm/yyyy`
**Encoding:** UTF-8
**Frontmatter:** none — header row is the first row
**headerRowOffset:** 0
**Amount column layout:** single signed column (`IMPORTO IN EURO`)
**Columns:** `DATA OPERAZIONE;DATA REGISTRAZIONE;DESCRIZIONE OPERAZIONE;IMPORTO IN EURO`
**Footer trap:** last row is a totals row (`;;Totale;-966,43`) — must be filtered out, not parsed as a transaction

**Parser behaviors exercised:**
- semicolon delimiter detection
- European number format parsing (comma decimal, dot thousands)
- single signed amount column
- footer-row filtering (last row is a summary, not a transaction)

---

### `IT47X9999501605CC0010000001_ListaTransazioni_20251231_20260201.csv` + `.xlsx`

**Bank:** Banca Mediolanum (or similar) — current account export
**Delimiter:** semicolon `;`
**Decimal separator:** comma (e.g. `-193,98`)
**Thousands separator:** dot (e.g. `+1.650,00`)
**Date format:** `dd/mm/yyyy`
**Encoding:** UTF-8
**Frontmatter:** none — header row is the first row
**headerRowOffset:** 0
**Amount column layout:** **split debit/credit** (`USCITE` for expenses, `ENTRATE` for income)
**Columns:** `DATA CONTABILE;DATA VALUTA;USCITE;ENTRATE;CAUSALE;DESCRIZIONE OPERAZIONE`
**Extra rows:** first and last rows are balance markers (`Saldo iniziale`, `Saldo finale`) with only the amount column filled — must be treated as non-transaction rows

**Parser behaviors exercised:**
- split debit/credit column mapping (FR5 — USCITE + ENTRATE → single signed amount)
- balance/saldo sentinel row detection and skipping
- semicolon delimiter
- European number format
- two-date-column layout (accounting date + value date)

---

### `cc_elena_dicembre.csv` + `.xlsx`

**Bank:** ING — credit card export (different export path from `Movimenti_CartaCredito`)
**Delimiter:** comma `,`
**Decimal separator:** **dot** (e.g. `-22.98`) — different from the other two files above
**Date format:** `dd/mm/yyyy`
**Encoding:** UTF-8
**Frontmatter:** YES — 6 rows before the actual header:
  - `Intestazione: <name>,,,`
  - (blank)
  - `Carta di credito: **** **** **** XXXX,,,`
  - (blank)
  - `LISTA MOVIMENTI dal dd/mm/yyyy al dd/mm/yyyy,,,`
  - (blank)
  - ← actual header row starts here
**headerRowOffset:** 6
**Amount column layout:** single signed column (`IMPORTO IN EURO`)
**Columns:** `DATA OPERAZIONE,DATA REGISTRAZIONE,DESCRIZIONE OPERAZIONE,IMPORTO IN EURO`
**Footer trap:** last row is a totals row (`,,Totale,-930.69`) — same filter needed

**Parser behaviors exercised:**
- frontmatter / header-row offset detection (table-start scanning algorithm)
- comma delimiter (vs semicolon in the other two)
- dot decimal separator (vs comma in the other two — same bank ecosystem, different export path)
- profile fingerprinting: same bank (ING), same column names as `Movimenti_CartaCredito`, different headerRowOffset and decimal separator
- footer-row filtering

---

### `cc_mario_dicembre.xlsx` and `transazioni.xlsx`

XLSX equivalents — same shape verification as the CSV counterparts. Used to confirm the SheetJS parsing path produces the same normalized `string[][]` as the CSV path for the same source data.

---

### `Elenco movimenti dal 08-03-2025 al 08-03-2026.xlsx`

**Bank:** ING — current account export
**Format:** XLSX only (no CSV counterpart)
**Sheet name:** `Elenco movimenti conto corrente`
**Decimal separator:** comma (raw Excel numeric cells — no string parsing needed)
**Date format:** `dd/mm/yyyy`
**Frontmatter:** YES — rows 1–8 before the header:
  - Row 1: report title (`Elenco movimenti conto corrente`)
  - Row 2: export timestamp
  - Row 3: (blank)
  - Row 4: account label + IBAN
  - Row 5: current balance
  - Row 6: (blank)
  - Row 7: account holder name(s)
  - Row 8: (blank)
  - ← actual header row is row 9
**headerRowOffset:** 8 (0-based)
**Columns:** `Operazione | Valuta | Tipologia Operazione | Descrizione | Uscite | Entrate`
**Amount column layout:** **split debit/credit** — `Uscite` holds expense amounts (positive raw numbers), `Entrate` holds income amounts (positive raw numbers); one of the two is always empty per row
**Extra column:** `Tipologia Operazione` — Italian transaction category string (e.g. `Addebiti diretti`, `Bonifici`, `Stipendi - Pensioni`, `Prelievi - Pagamenti`, `Mutui - Prestiti`, `Pagamenti`)
**Data rows:** 201 transactions (rows 10–210)
**Footer trap:** row 211 is a `Totale` summary row with column sums for `Uscite` and `Entrate` — must be filtered out, not parsed as a transaction

**Parser behaviors exercised:**
- multi-row frontmatter skip (8-row offset)
- holder-info and blank rows within frontmatter
- XLSX-only format (no CSV path to validate against)
- split signed amount columns (`Uscite` + `Entrate`) using raw Excel numeric values
- footer-row filtering (last row is a `Totale` summary)
- extra category column (`Tipologia Operazione`) that parsers must tolerate or map

---

## Parser Coverage Map

| Behavior | Covered by |
|---|---|
| Semicolon delimiter | `Movimenti_CartaCredito_0000*.csv`, `IT47X*.csv` |
| Comma delimiter | `cc_elena_dicembre.csv` |
| Comma decimal (European) | `Movimenti_CartaCredito_0000*.csv`, `IT47X*.csv` |
| Dot decimal (English-style in Italian export) | `cc_elena_dicembre.csv` |
| Raw Excel numeric cells (no string parsing) | `Elenco movimenti*.xlsx` |
| Single signed amount column | `Movimenti_CartaCredito_0000*.csv`, `cc_elena_dicembre.csv` |
| Split debit/credit columns | `IT47X*.csv`, `Elenco movimenti*.xlsx` |
| No frontmatter | `Movimenti_CartaCredito_0000*.csv`, `IT47X*.csv` |
| Frontmatter with 6-row offset | `cc_elena_dicembre.csv` |
| Frontmatter with 8-row offset (multi-row metadata block) | `Elenco movimenti*.xlsx` |
| Footer totals row filtering | `Movimenti_CartaCredito_0000*.csv`, `cc_elena_dicembre.csv`, `Elenco movimenti*.xlsx` |
| Balance sentinel rows | `IT47X*.csv` |
| XLSX parsing | `*.xlsx` variants of all shapes |
| Two date columns (accounting + value date) | `IT47X*.csv` |
| Extra category column (`Tipologia Operazione`) | `Elenco movimenti*.xlsx` |

**Still missing from the corpus — candidates for `synthetic/`:**
- Windows-1252 or ISO-8859-1 encoded CSV (for Italian bank exports with accented characters in non-UTF-8 encodings)
- A file where frontmatter has more than 8 rows (stress-tests the scan-up-to-30-rows algorithm)
- A file with mixed empty rows mid-table (robustness check)

---

## Naming Convention for New Files

`<country>-<bank-or-source>-<shape>-<delimiter>-<decimal>.<ext>`

Examples:
- `it-unicredit-basic-semicolon-comma.csv`
- `it-mediolanum-split-debit-credit-semicolon-comma.csv`
- `it-unicredit-frontmatter-comma-dot.csv`
- `it-genericsavings-win1252-semicolon-comma.csv`

## Sanitization Rules for Future Fixtures

Keep: column names, delimiter style, date format, number format, blank lines and frontmatter shape, row count roughly representative of the original.

Change: names, IBANs, account numbers, free-text descriptions, reference codes, exact amounts.