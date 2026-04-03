export interface MappedRow {
  sourceRowIndex: number;
  rawDate: string;
  rawAmount: string;
  rawDebit: string | null;
  rawCredit: string | null;
  rawDescription: string;
}

export interface ColumnMapResult {
  rows: MappedRow[];
  failedIndices: number[];
}

export function buildRoleIndex(
  headerRow: string[],
  columnMap: Record<string, string>,
): Record<string, number> {
  const roleIndex: Record<string, number> = {};

  for (const [columnName, role] of Object.entries(columnMap)) {
    const columnIndex = headerRow.indexOf(columnName);
    if (columnIndex !== -1) {
      roleIndex[role] = columnIndex;
    }
  }

  return roleIndex;
}

export function mapColumns(
  rows: string[][],
  headerRow: string[],
  columnMap: Record<string, string>,
): ColumnMapResult {
  const roleIndex = buildRoleIndex(headerRow, columnMap);
  const isSplitMode = roleIndex.debit !== undefined && roleIndex.credit !== undefined;
  const mappedRows: MappedRow[] = [];
  const failedIndices: number[] = [];

  rows.forEach((row, index) => {
    const rawDateIndex = roleIndex.date;
    const rawAmountIndex = roleIndex.amount;
    const rawDebitIndex = roleIndex.debit;
    const rawCreditIndex = roleIndex.credit;

    const isFailed =
      rawDateIndex === undefined ||
      (!isSplitMode && rawAmountIndex === undefined) ||
      (isSplitMode && rawDebitIndex === undefined && rawCreditIndex === undefined);

    if (isFailed) {
      failedIndices.push(index);
      return;
    }

    mappedRows.push({
      sourceRowIndex: index,
      rawDate: row[rawDateIndex] ?? '',
      rawAmount: isSplitMode ? '' : (row[rawAmountIndex] ?? ''),
      rawDebit: isSplitMode && rawDebitIndex !== undefined ? (row[rawDebitIndex] ?? '') : null,
      rawCredit: isSplitMode && rawCreditIndex !== undefined ? (row[rawCreditIndex] ?? '') : null,
      rawDescription: roleIndex.description !== undefined ? (row[roleIndex.description] ?? '') : '',
    });
  });

  return { rows: mappedRows, failedIndices };
}