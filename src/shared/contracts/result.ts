// src/shared/contracts/result.ts
// Canonical error model for ALL src/core/ functions.
// RULE: src/core/ never throws — always returns Result<T>.

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const err = (error: string): Result<never> => ({ ok: false, error });
