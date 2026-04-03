import { describe, expect, test } from 'bun:test';
import { handleDeleteTransactionRequest } from './delete-transaction-request';

describe('handleDeleteTransactionRequest()', () => {
  test('resolves imports/manual paths from config and forwards only the transaction id', async () => {
    const calls: Array<{ id: string; importsDir: string; manualDir: string }> = [];

    const result = await handleDeleteTransactionRequest(
      { id: 'tx-1' },
      {
        getConfig: () => ({ importsPath: '/tmp/imports', manualPath: '/tmp/manual' }),
        deleteTransactionFn: async (id, importsDir, manualDir) => {
          calls.push({ id, importsDir, manualDir });
          return { ok: true as const, data: undefined };
        },
      },
    );

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      { id: 'tx-1', importsDir: '/tmp/imports', manualDir: '/tmp/manual' },
    ]);
  });

  test('maps core delete failures to the IPC error envelope', async () => {
    const result = await handleDeleteTransactionRequest(
      { id: 'missing-id' },
      {
        getConfig: () => ({ importsPath: '/tmp/imports', manualPath: '/tmp/manual' }),
        deleteTransactionFn: async () => ({ ok: false as const, error: 'NOT_FOUND:missing-id' }),
      },
    );

    expect(result).toEqual({ ok: false, error: 'NOT_FOUND:missing-id' });
  });
});