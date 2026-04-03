// src/renderer/hooks/useLoadTransactions.ts
// Shared hook: fetch all transactions from IPC and push them into the report store.
// Used by App.tsx (initial load / post-import) and ReportView (post-bulk-action refresh).
import { useCallback } from 'react';
import { webviewRPC } from '../ipc/bridge';
import { useReportStore } from '../store/report-store';

export function useLoadTransactions(): () => Promise<void> {
  return useCallback(async () => {
    try {
      const result = await webviewRPC.request.GET_TRANSACTIONS();
      if (result.ok) {
        useReportStore.getState().setTransactions(result.transactions);
      } else {
        console.warn('[useLoadTransactions] GET_TRANSACTIONS failed:', result.error);
      }
    } catch (e) {
      console.warn('[useLoadTransactions] GET_TRANSACTIONS threw:', e);
    }
  }, []);
}
