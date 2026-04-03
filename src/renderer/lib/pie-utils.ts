import type { Transaction } from '../../shared/types';

export interface PieSlice {
  category: string;
  amount: number;
  percentage: number;
  colorIndex: number;
  startAngle: number;
  endAngle: number;
}

export function buildColorMap(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount >= 0 || !t.category) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + Math.abs(t.amount));
  }

  const sorted = [...totals.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'en');
  });

  return new Map(sorted.map(([cat], i) => [cat, i % 10]));
}

export function computePieSlices(
  transactions: Transaction[],
  colorMap?: Map<string, number>,
): PieSlice[] {
  const totalsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) {
      continue;
    }

    if (!transaction.category) {
      continue;
    }

    totalsByCategory.set(
      transaction.category,
      (totalsByCategory.get(transaction.category) ?? 0) + Math.abs(transaction.amount),
    );
  }

  if (totalsByCategory.size === 0) {
    return [];
  }

  const sortedEntries = [...totalsByCategory.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0], 'en');
  });

  const totalExpenses = sortedEntries.reduce((sum, [, amount]) => sum + amount, 0);
  let currentAngle = -Math.PI / 2;

  return sortedEntries.map(([category, amount], index) => {
    const percentage = (amount / totalExpenses) * 100;
    const startAngle = currentAngle;
    const endAngle = startAngle + (amount / totalExpenses) * 2 * Math.PI;
    currentAngle = endAngle;

    return {
      category,
      amount,
      percentage,
      colorIndex: colorMap?.get(category) ?? index % 10,
      startAngle,
      endAngle,
    };
  });
}

export function sliceToPath(
  slice: PieSlice,
  cx: number,
  cy: number,
  R: number,
): string {
  const { startAngle, endAngle, percentage } = slice;

  if (percentage >= 99.9) {
    return (
      `M ${cx} ${cy - R} ` +
      `A ${R} ${R} 0 1 1 ${cx - 0.001} ${cy - R} Z`
    );
  }

  const x1 = cx + R * Math.cos(startAngle);
  const y1 = cy + R * Math.sin(startAngle);
  const x2 = cx + R * Math.cos(endAngle);
  const y2 = cy + R * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return (
    `M ${cx} ${cy} ` +
    `L ${x1} ${y1} ` +
    `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`
  );
}