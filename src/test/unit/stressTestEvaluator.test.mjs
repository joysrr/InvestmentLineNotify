import { describe, expect, it } from "vitest";
import { evaluateStressDay } from "../../tools/stressTestEvaluator.mjs";

describe("stressTestEvaluator", () => {
  it("reports the maintenance defense state without producing a trade signal", () => {
    const result = evaluateStressDay({
      day: 1,
      snapshot: {
        totalAssets: 150000,
        totalLiabilities: 100000,
      },
      expectedState: {
        freeze00675L: true,
        pauseP1: true,
        p0Exempt: true,
      },
    });

    expect(result).toEqual({
      status: "OK",
      mode: "SHADOW_ONLY",
      day: 1,
      expectedState: {
        freeze00675L: true,
        pauseP1: true,
        p0Exempt: true,
      },
      actualState: {
        freeze00675L: true,
        pauseP1: true,
        p0Exempt: true,
      },
      differences: [],
      tradeSignal: null,
    });
  });

  it("reports state differences while keeping the evaluator read-only", () => {
    const result = evaluateStressDay({
      day: 2,
      snapshot: {
        totalAssets: 200000,
        totalLiabilities: 100000,
      },
      expectedState: {
        freeze00675L: true,
        pauseP1: true,
        p0Exempt: true,
      },
    });

    expect(result.status).toBe("OK");
    expect(result.actualState).toEqual({
      freeze00675L: false,
      pauseP1: false,
      p0Exempt: true,
    });
    expect(result.differences).toEqual([
      { field: "freeze00675L", expected: true, actual: false },
      { field: "pauseP1", expected: true, actual: false },
    ]);
    expect(result.tradeSignal).toBeNull();
  });
});
