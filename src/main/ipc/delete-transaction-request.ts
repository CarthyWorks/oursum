import { DataFolderConfig } from '../../core/persistence/config';
import { deleteTransaction } from '../../core/persistence/transaction-category-mutations';
import type { AppRPCSchema } from '../../shared/contracts/ipc';

type DeleteTransactionParams = AppRPCSchema['bun']['requests']['DELETE_TRANSACTION']['params'];
type DeleteTransactionResponse = AppRPCSchema['bun']['requests']['DELETE_TRANSACTION']['response'];
type TransactionPaths = {
  importsPath: string;
  manualPath: string;
};

type DeleteTransactionRequestDeps = {
  getConfig: () => TransactionPaths;
  deleteTransactionFn: typeof deleteTransaction;
};

const defaultDeps: DeleteTransactionRequestDeps = {
  getConfig: () => DataFolderConfig.getInstance(),
  deleteTransactionFn: deleteTransaction,
};

export async function handleDeleteTransactionRequest(
  { id }: DeleteTransactionParams,
  deps: DeleteTransactionRequestDeps = defaultDeps,
): Promise<DeleteTransactionResponse> {
  const config = deps.getConfig();
  const result = await deps.deleteTransactionFn(id, config.importsPath, config.manualPath);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const };
}