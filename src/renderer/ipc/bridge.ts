// src/renderer/ipc/bridge.ts
// Renderer-side Electrobun IPC bridge.
// RULE: No business logic here — only the typed transport to/from the Bun process.
// RULE: No FS access in renderer — use ipcRequest (READ_FILE) for any file reads.
import { Electroview } from "electrobun/view";
import type { AppRPCSchema } from "../../shared/contracts/ipc";

type BunRequests = AppRPCSchema["bun"]["requests"];
type BunMessages = AppRPCSchema["bun"]["messages"];

type RequestMockHandlers = {
  [K in keyof BunRequests]: (
    params: BunRequests[K]["params"]
  ) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;
};

type MessageMockHandlers = {
  [K in keyof BunMessages]: (params: BunMessages[K]) => void | Promise<void>;
};

type RendererE2EMock = {
  requests?: Partial<RequestMockHandlers>;
  messages?: Partial<MessageMockHandlers>;
};

declare global {
  var __OUR_EXPENSES_E2E_RPC__: RendererE2EMock | undefined;
}

// Define the webview-side RPC:
//   handlers.requests = requests THIS side handles (from Bun) — none for now
//   handlers.messages = fire-and-forget messages THIS side handles (from Bun) — none for now
//   webviewRPC.request.PING()           → Promise<"PONG">
//   webviewRPC.request.READ_FILE(...)   → Promise<{ ok: boolean; ... }>
//   webviewRPC.send.FILE_DROPPED(...)   → void (fire-and-forget to Bun)
const electroviewRPC = Electroview.defineRPC<AppRPCSchema>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {},
    messages: {},
  },
});

function getE2EMock(): RendererE2EMock | undefined {
  return globalThis.__OUR_EXPENSES_E2E_RPC__;
}

export const webviewRPC = {
  request: {
    PING: (params: void) => getE2EMock()?.requests?.PING?.(params) ?? electroviewRPC.request.PING(params),
    READ_FILE: (params: { path: string }) =>
      getE2EMock()?.requests?.READ_FILE?.(params) ?? electroviewRPC.request.READ_FILE(params),
    GET_INITIAL_STATE: (params: void) =>
      getE2EMock()?.requests?.GET_INITIAL_STATE?.(params) ?? electroviewRPC.request.GET_INITIAL_STATE(params),
    SAVE_PREFERENCES: (params: BunRequests["SAVE_PREFERENCES"]["params"]) =>
      getE2EMock()?.requests?.SAVE_PREFERENCES?.(params) ?? electroviewRPC.request.SAVE_PREFERENCES(params),
    UPDATE_PREFERENCES: (params: BunRequests["UPDATE_PREFERENCES"]["params"]) =>
      getE2EMock()?.requests?.UPDATE_PREFERENCES?.(params) ?? electroviewRPC.request.UPDATE_PREFERENCES(params),
    OPEN_FOLDER_PICKER: (params: void) =>
      getE2EMock()?.requests?.OPEN_FOLDER_PICKER?.(params) ?? electroviewRPC.request.OPEN_FOLDER_PICKER(params),
    OPEN_DATA_FOLDER: (params: BunRequests["OPEN_DATA_FOLDER"]["params"]) =>
      getE2EMock()?.requests?.OPEN_DATA_FOLDER?.(params) ?? electroviewRPC.request.OPEN_DATA_FOLDER(params),
    OPEN_FILE_PICKER: (params: void) =>
      getE2EMock()?.requests?.OPEN_FILE_PICKER?.(params) ?? electroviewRPC.request.OPEN_FILE_PICKER(params),
    INGEST_FILE: (params: BunRequests["INGEST_FILE"]["params"]) =>
      getE2EMock()?.requests?.INGEST_FILE?.(params) ?? electroviewRPC.request.INGEST_FILE(params),
    INGEST_FILE_BYTES: (params: BunRequests["INGEST_FILE_BYTES"]["params"]) =>
      getE2EMock()?.requests?.INGEST_FILE_BYTES?.(params) ?? electroviewRPC.request.INGEST_FILE_BYTES(params),
    MATCH_IMPORT_PROFILE: (params: BunRequests["MATCH_IMPORT_PROFILE"]["params"]) =>
      getE2EMock()?.requests?.MATCH_IMPORT_PROFILE?.(params) ?? electroviewRPC.request.MATCH_IMPORT_PROFILE(params),
    SAVE_PROFILE: (params: BunRequests["SAVE_PROFILE"]["params"]) =>
      getE2EMock()?.requests?.SAVE_PROFILE?.(params) ?? electroviewRPC.request.SAVE_PROFILE(params),
    EXECUTE_IMPORT: (params: BunRequests["EXECUTE_IMPORT"]["params"]) =>
      getE2EMock()?.requests?.EXECUTE_IMPORT?.(params) ?? electroviewRPC.request.EXECUTE_IMPORT(params),
    GET_IMPORT_HISTORY: (params: void) =>
      getE2EMock()?.requests?.GET_IMPORT_HISTORY?.(params) ?? electroviewRPC.request.GET_IMPORT_HISTORY(params),
    GET_TRANSACTIONS: (params: void) =>
      getE2EMock()?.requests?.GET_TRANSACTIONS?.(params) ?? electroviewRPC.request.GET_TRANSACTIONS(params),
    GET_CATEGORIES: (params: void) =>
      getE2EMock()?.requests?.GET_CATEGORIES?.(params) ?? electroviewRPC.request.GET_CATEGORIES(params),
    ADD_CATEGORY: (params: BunRequests["ADD_CATEGORY"]["params"]) =>
      getE2EMock()?.requests?.ADD_CATEGORY?.(params) ?? electroviewRPC.request.ADD_CATEGORY(params),
    RENAME_CATEGORY: (params: BunRequests["RENAME_CATEGORY"]["params"]) =>
      getE2EMock()?.requests?.RENAME_CATEGORY?.(params) ?? electroviewRPC.request.RENAME_CATEGORY(params),
    DELETE_CATEGORY: (params: BunRequests["DELETE_CATEGORY"]["params"]) =>
      getE2EMock()?.requests?.DELETE_CATEGORY?.(params) ?? electroviewRPC.request.DELETE_CATEGORY(params),
    GET_RULES: (params: void) =>
      getE2EMock()?.requests?.GET_RULES?.(params) ?? electroviewRPC.request.GET_RULES(params),
    SAVE_RULE: (params: BunRequests["SAVE_RULE"]["params"]) =>
      getE2EMock()?.requests?.SAVE_RULE?.(params) ?? electroviewRPC.request.SAVE_RULE(params),
    DELETE_RULE: (params: BunRequests["DELETE_RULE"]["params"]) =>
      getE2EMock()?.requests?.DELETE_RULE?.(params) ?? electroviewRPC.request.DELETE_RULE(params),
    UPDATE_TRANSACTION_CATEGORY: (params: BunRequests["UPDATE_TRANSACTION_CATEGORY"]["params"]) =>
      getE2EMock()?.requests?.UPDATE_TRANSACTION_CATEGORY?.(params) ?? electroviewRPC.request.UPDATE_TRANSACTION_CATEGORY(params),
    PREVIEW_RULE_MATCHES: (params: BunRequests["PREVIEW_RULE_MATCHES"]["params"]) =>
      getE2EMock()?.requests?.PREVIEW_RULE_MATCHES?.(params) ?? electroviewRPC.request.PREVIEW_RULE_MATCHES(params),
    APPLY_RULE_TO_EXISTING_TRANSACTIONS: (params: BunRequests["APPLY_RULE_TO_EXISTING_TRANSACTIONS"]["params"]) =>
      getE2EMock()?.requests?.APPLY_RULE_TO_EXISTING_TRANSACTIONS?.(params) ?? electroviewRPC.request.APPLY_RULE_TO_EXISTING_TRANSACTIONS(params),
    RELOCATE_DATA_FOLDER: (params: BunRequests["RELOCATE_DATA_FOLDER"]["params"]) =>
      getE2EMock()?.requests?.RELOCATE_DATA_FOLDER?.(params) ?? electroviewRPC.request.RELOCATE_DATA_FOLDER(params),
    CLOSE_WINDOW: (params: void) =>
      getE2EMock()?.requests?.CLOSE_WINDOW?.(params) ?? electroviewRPC.request.CLOSE_WINDOW(params),
    QUIT_APP: (params: void) =>
      getE2EMock()?.requests?.QUIT_APP?.(params) ?? electroviewRPC.request.QUIT_APP(params),
    MATCH_CATEGORY_FOR_DESCRIPTION: (params: BunRequests["MATCH_CATEGORY_FOR_DESCRIPTION"]["params"]) =>
      getE2EMock()?.requests?.MATCH_CATEGORY_FOR_DESCRIPTION?.(params) ?? electroviewRPC.request.MATCH_CATEGORY_FOR_DESCRIPTION(params),
    ADD_MANUAL_TRANSACTION: (params: BunRequests["ADD_MANUAL_TRANSACTION"]["params"]) =>
      getE2EMock()?.requests?.ADD_MANUAL_TRANSACTION?.(params) ?? electroviewRPC.request.ADD_MANUAL_TRANSACTION(params),
    DELETE_TRANSACTION: (params: BunRequests["DELETE_TRANSACTION"]["params"]) =>
      getE2EMock()?.requests?.DELETE_TRANSACTION?.(params) ?? electroviewRPC.request.DELETE_TRANSACTION(params),
    BATCH_DELETE_TRANSACTIONS: (params: BunRequests["BATCH_DELETE_TRANSACTIONS"]["params"]) =>
      getE2EMock()?.requests?.BATCH_DELETE_TRANSACTIONS?.(params) ?? electroviewRPC.request.BATCH_DELETE_TRANSACTIONS(params),
    BATCH_UPDATE_TRANSACTION_CATEGORIES: (params: BunRequests["BATCH_UPDATE_TRANSACTION_CATEGORIES"]["params"]) =>
      getE2EMock()?.requests?.BATCH_UPDATE_TRANSACTION_CATEGORIES?.(params) ?? electroviewRPC.request.BATCH_UPDATE_TRANSACTION_CATEGORIES(params),
    GET_SPLIT_CALCULATOR_CONFIG: (params: void) =>
      getE2EMock()?.requests?.GET_SPLIT_CALCULATOR_CONFIG?.(params) ?? electroviewRPC.request.GET_SPLIT_CALCULATOR_CONFIG(params),
    SAVE_SPLIT_CALCULATOR_CONFIG: (params: BunRequests["SAVE_SPLIT_CALCULATOR_CONFIG"]["params"]) =>
      getE2EMock()?.requests?.SAVE_SPLIT_CALCULATOR_CONFIG?.(params) ?? electroviewRPC.request.SAVE_SPLIT_CALCULATOR_CONFIG(params),
  },
  send: {
    FILE_DROPPED: (params: BunMessages["FILE_DROPPED"]) => {
      const mockHandler = getE2EMock()?.messages?.FILE_DROPPED;
      if (mockHandler) {
        void mockHandler(params);
        return;
      }
      electroviewRPC.send.FILE_DROPPED(params);
    },
    TOGGLE_MAXIMIZE: (params: BunMessages["TOGGLE_MAXIMIZE"]) => {
      const mockHandler = getE2EMock()?.messages?.TOGGLE_MAXIMIZE;
      if (mockHandler) {
        void mockHandler(params);
        return;
      }
      electroviewRPC.send.TOGGLE_MAXIMIZE(params);
    },
  },
};

// Initializing Electroview sets up the encrypted WebSocket transport to the Bun process.
// Must be called exactly once per page load — imported as a side effect in main.tsx.
// Wrapped in try/catch so that non-Electrobun environments (E2E, Vite HMR-only) don't
// crash the module and prevent React from mounting.
try {
  new Electroview({ rpc: electroviewRPC });
} catch (e) {
  console.warn('[IPC] Electroview init failed (non-Electrobun environment):', e);
}
