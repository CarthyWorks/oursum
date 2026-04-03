import { beforeEach, describe, expect, test } from 'bun:test';
import { useReportStore } from './report-store';

describe('useReportStore selection state', () => {
  beforeEach(() => {
    useReportStore.setState({
      selectedTransactionIds: new Set(),
      lastSelectedIndex: null,
      lastSelectedId: null,
    });
  });

  test('shift-click selects a contiguous range using the anchor row id after visible order changes', () => {
    const store = useReportStore.getState();

    store.toggleTransactionSelection('a', 2, false, ['c', 'b', 'a']);
    useReportStore.getState().toggleTransactionSelection('c', 2, true, ['a', 'b', 'c']);

    expect(Array.from(useReportStore.getState().selectedTransactionIds)).toEqual(['a', 'b', 'c']);
  });

  test('shift-click with no prior anchor falls back to a normal single selection', () => {
    useReportStore.getState().toggleTransactionSelection('b', 1, true, ['a', 'b', 'c']);

    expect(Array.from(useReportStore.getState().selectedTransactionIds)).toEqual(['b']);
    expect(useReportStore.getState().lastSelectedId).toBe('b');
    expect(useReportStore.getState().lastSelectedIndex).toBe(1);
  });

  test('clearSelection resets both the selected ids and the shift-click anchor', () => {
    useReportStore.getState().toggleTransactionSelection('b', 1, false, ['a', 'b', 'c']);
    useReportStore.getState().clearSelection();

    expect(Array.from(useReportStore.getState().selectedTransactionIds)).toEqual([]);
    expect(useReportStore.getState().lastSelectedId).toBeNull();
    expect(useReportStore.getState().lastSelectedIndex).toBeNull();
  });
});