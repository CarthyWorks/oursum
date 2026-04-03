import { describe, expect, test } from 'bun:test';
import {
  calculateSplitResult,
  makeDefaultContributors,
  syncContributorsFromSource,
  type Contributor,
} from './useSplitCalculator';

function createContributor(overrides: Partial<Contributor>): Contributor {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? '',
    splitType: overrides.splitType ?? 'equal',
    value: overrides.value ?? 0,
  };
}

describe('useSplitCalculator helpers', () => {
  test('creates two equal contributors by default', () => {
    const contributors = makeDefaultContributors();

    expect(contributors).toHaveLength(2);
    expect(contributors[0].splitType).toBe('equal');
    expect(contributors[1].splitType).toBe('equal');
    expect(contributors[0].id).not.toBe(contributors[1].id);
  });

  test('splits total equally when all contributors are equal', () => {
    const result = calculateSplitResult(100, [
      createContributor({ id: 'a' }),
      createContributor({ id: 'b' }),
      createContributor({ id: 'c' }),
    ]);

    expect(result.settlements).toEqual([
      { id: 'a', amount: 100 / 3 },
      { id: 'b', amount: 100 / 3 },
      { id: 'c', amount: 100 / 3 },
    ]);
    expect(result.unallocated).toBe(0);
  });

  test('distributes fixed and percentage values before equal contributors absorb the remainder', () => {
    const result = calculateSplitResult(200, [
      createContributor({ id: 'a', splitType: 'fixed', value: 30 }),
      createContributor({ id: 'b', splitType: 'percentage', value: 20 }),
      createContributor({ id: 'c', splitType: 'equal' }),
      createContributor({ id: 'd', splitType: 'equal' }),
    ]);

    expect(result.settlements).toEqual([
      { id: 'a', amount: 30 },
      { id: 'b', amount: 40 },
      { id: 'c', amount: 65 },
      { id: 'd', amount: 65 },
    ]);
    expect(result.unallocated).toBe(0);
  });

  test('reports positive unallocated remainder when no equal contributors absorb it', () => {
    const result = calculateSplitResult(200, [
      createContributor({ id: 'a', splitType: 'percentage', value: 30 }),
      createContributor({ id: 'b', splitType: 'percentage', value: 30 }),
    ]);

    expect(result.settlements).toEqual([
      { id: 'a', amount: 60 },
      { id: 'b', amount: 60 },
    ]);
    expect(result.unallocated).toBe(80);
  });

  test('reports negative unallocated amount when fixed contributions over-allocate the total', () => {
    const result = calculateSplitResult(100, [
      createContributor({ id: 'a', splitType: 'fixed', value: 60 }),
      createContributor({ id: 'b', splitType: 'fixed', value: 60 }),
    ]);

    expect(result.settlements).toEqual([
      { id: 'a', amount: 60 },
      { id: 'b', amount: 60 },
    ]);
    expect(result.unallocated).toBe(-20);
  });

  test('returns zero settlements when total is zero', () => {
    const result = calculateSplitResult(0, [
      createContributor({ id: 'a' }),
      createContributor({ id: 'b', splitType: 'fixed', value: 10 }),
    ]);

    expect(result.settlements).toEqual([
      { id: 'a', amount: 0 },
      { id: 'b', amount: 0 },
    ]);
    expect(result.unallocated).toBe(0);
  });

  test('replaces local contributors when a newly hydrated source arrives', () => {
    const defaults = makeDefaultContributors();
    const saved = [
      createContributor({ id: 'saved-a', name: 'Alice' }),
      createContributor({ id: 'saved-b', name: 'Bob', splitType: 'fixed', value: 25 }),
    ];

    expect(syncContributorsFromSource(defaults, defaults, saved)).toBe(saved);
  });

  test('preserves local contributors when the source reference is unchanged', () => {
    const source = makeDefaultContributors();
    const edited = source.map((contributor, index) => ({
      ...contributor,
      name: index === 0 ? 'Edited' : contributor.name,
    }));

    expect(syncContributorsFromSource(edited, source, source)).toBe(edited);
  });
});