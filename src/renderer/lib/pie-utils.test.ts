import { describe, expect, test } from 'bun:test';
import type { Transaction } from '../../shared/types';
import { computePieSlices, sliceToPath } from './pie-utils';

const transactions: Transaction[] = [
  {
    id: '2026-03-01|-100|Groceries|0',
    date: '2026-03-01',
    amount: -100,
    description: 'Groceries',
    category: 'Groceries',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-02|-50|Dining|0',
    date: '2026-03-02',
    amount: -50,
    description: 'Dining',
    category: 'Dining',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
  {
    id: '2026-03-03|2000|Salary|0',
    date: '2026-03-03',
    amount: 2000,
    description: 'Salary',
    category: 'Income',
    accountId: '',
    importFile: '2026-03.ndjson',
    notes: '',
  },
];

describe('pie-utils', () => {
  test('returns no slices when there are no expenses', () => {
    expect(
      computePieSlices([
        {
          ...transactions[2],
        },
      ]),
    ).toEqual([]);
  });

  test('groups expenses by category and excludes income', () => {
    const slices = computePieSlices(transactions);

    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({
      category: 'Groceries',
      amount: 100,
      percentage: expect.closeTo(66.6666666667, 8),
      colorIndex: 0,
    });
    expect(slices[1]).toMatchObject({
      category: 'Dining',
      amount: 50,
      percentage: expect.closeTo(33.3333333333, 8),
      colorIndex: 1,
    });
    expect(slices[0].startAngle).toBeCloseTo(-Math.PI / 2, 8);
    expect(slices[1].endAngle).toBeCloseTo((Math.PI * 3) / 2, 8);
  });

  test('draws a near-full circle for a single slice', () => {
    const [slice] = computePieSlices([transactions[0]]);
    expect(sliceToPath(slice, 90, 90, 78)).toBe(
      'M 90 12 A 78 78 0 1 1 89.999 12 Z',
    );
  });

  test('draws a wedge path for partial slices', () => {
    const [slice] = computePieSlices(transactions);
    const path = sliceToPath(slice, 90, 90, 78);

    expect(path.startsWith('M 90 90 L')).toBe(true);
    expect(path.includes('A 78 78 0 1 1')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });

  test('draws a wedge with largeArc=0 for slices under 50%', () => {
    const [, smallSlice] = computePieSlices(transactions);
    // Dining slice is 33.3% — should use largeArc flag = 0
    expect(smallSlice.category).toBe('Dining');
    const path = sliceToPath(smallSlice, 90, 90, 78);
    // largeArc=0 means the arc descriptor contains '0 1' not '1 1'
    expect(path.includes('A 78 78 0 0 1')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });
});