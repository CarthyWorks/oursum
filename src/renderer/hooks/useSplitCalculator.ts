// src/renderer/hooks/useSplitCalculator.ts
// RULE: ADR-005 — pure renderer computation, zero imports from src/core/ or src/main/.
// RULE: No IPC calls — split calc is pure arithmetic, no Bun-side processing needed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SplitType = 'equal' | 'percentage' | 'fixed';

export interface Contributor {
  id: string;
  name: string;
  splitType: SplitType;
  value: number;
}

export interface SettlementEntry {
  id: string;
  amount: number;
}

export interface SplitResult {
  settlements: SettlementEntry[];
  unallocated: number;
}

function makeContributor(): Contributor {
  return {
    id: crypto.randomUUID(),
    name: '',
    splitType: 'equal',
    value: 0,
  };
}

export function makeDefaultContributors(): Contributor[] {
  return [makeContributor(), makeContributor()];
}

export function syncContributorsFromSource(
  current: Contributor[],
  previousSource: Contributor[] | null,
  nextSource: Contributor[]
): Contributor[] {
  return previousSource === nextSource ? current : nextSource;
}

function computeSplit(total: number, contributors: Contributor[]): SplitResult {
  if (total === 0) {
    return {
      settlements: contributors.map((contributor) => ({ id: contributor.id, amount: 0 })),
      unallocated: 0,
    };
  }

  const fixedSum = contributors
    .filter((contributor) => contributor.splitType === 'fixed')
    .reduce((sum, contributor) => sum + contributor.value, 0);

  const percentageAmountSum = contributors
    .filter((contributor) => contributor.splitType === 'percentage')
    .reduce((sum, contributor) => sum + (contributor.value / 100) * total, 0);

  const equalCount = contributors.filter((contributor) => contributor.splitType === 'equal').length;
  const remainingForEqual = total - fixedSum - percentageAmountSum;
  const equalShare = equalCount > 0 ? remainingForEqual / equalCount : 0;
  const unallocated = equalCount === 0 ? remainingForEqual : 0;

  return {
    settlements: contributors.map((contributor) => ({
      id: contributor.id,
      amount:
        contributor.splitType === 'equal'
          ? equalShare
          : contributor.splitType === 'percentage'
            ? (contributor.value / 100) * total
            : contributor.value,
    })),
    unallocated,
  };
}

// TEST-ONLY export — DO NOT import from src/core/ or src/main/ (ADR-005 violation).
// Exported so Bun tests can validate split arithmetic without a DOM test harness.
export function calculateSplitResult(total: number, contributors: Contributor[]): SplitResult {
  return computeSplit(total, contributors);
}

export function useSplitCalculator(options: {
  total: number;
  initialContributors: Contributor[];
  onContributorsChange: (contributors: Contributor[]) => void;
}) {
  const { total, initialContributors, onContributorsChange } = options;
  const [contributors, setContributors] = useState<Contributor[]>(() => initialContributors);
  const lastHydratedSourceRef = useRef<Contributor[] | null>(initialContributors);

  useEffect(() => {
    setContributors((current) => syncContributorsFromSource(current, lastHydratedSourceRef.current, initialContributors));
    lastHydratedSourceRef.current = initialContributors;
  }, [initialContributors]);

  // Notify parent on every contributors change (including initial mount).
  // onContributorsChange is setSplitCalculatorContributors from App.tsx — stable setter.
  useEffect(() => {
    onContributorsChange(contributors);
  }, [contributors, onContributorsChange]);

  const splitResult = useMemo(() => computeSplit(total, contributors), [total, contributors]);

  const addContributor = useCallback(() => {
    setContributors((prev) => [...prev, makeContributor()]);
  }, []);

  const removeContributor = useCallback((id: string) => {
    setContributors((prev) => (prev.length > 2 ? prev.filter((contributor) => contributor.id !== id) : prev));
  }, []);

  const updateContributor = useCallback((id: string, patch: Partial<Pick<Contributor, 'name' | 'splitType' | 'value'>>) => {
    setContributors((prev) => prev.map((contributor) => (contributor.id === id ? { ...contributor, ...patch } : contributor)));
  }, []);

  return {
    contributors,
    addContributor,
    removeContributor,
    updateContributor,
    splitResult,
  };
}