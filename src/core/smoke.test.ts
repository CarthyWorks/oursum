// src/core/smoke.test.ts
// Sprint-1 validation: Result<T> helpers work correctly without Electrobun.
// Run with: bun test src/core/
import { expect, test, describe } from "bun:test";
import { ok, err, type Result } from "../shared/contracts/result";

describe("Result<T>", () => {
  test("ok() produces a success result", () => {
    const result: Result<number> = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(42);
    }
  });

  test("err() produces a failure result", () => {
    const result = err("something went wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("something went wrong");
    }
  });

  test("ok() and err() are discriminated by the ok flag", () => {
    const results: Result<string>[] = [
      ok("hello"),
      err("oops"),
    ];
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
