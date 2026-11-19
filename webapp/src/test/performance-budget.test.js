import { describe, expect, it } from "vitest";
import { BUDGETS_KB } from "../../scripts/performance-budget.mjs";

describe("performance budgets", () => {
  it("defines guardrails for initial, total JS, CSS, and chunk sizes", () => {
    expect(BUDGETS_KB).toEqual({
      initialJsGzip: 156,
      totalJsGzip: 380,
      totalCssGzip: 80,
      maxChunkGzip: 180,
    });
  });
});
