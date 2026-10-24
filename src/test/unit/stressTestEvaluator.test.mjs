import { describe, expect, it } from "vitest";
import { evaluateStressDay } from "../../tools/stressTestEvaluator.mjs";
import { getStressScenarios } from "../../tools/stressScenarios.mjs";

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

  it("exposes the four fixed shadow scenarios without production inputs", () => {
    const scenarios = getStressScenarios();

    expect(scenarios.map(({ id }) => id)).toEqual([
      "COVID_CIRCUIT_BREAKER",
      "BEAR_CHOPPY",
      "FLASH_CRASH",
      "VALUATION_REVERSION",
    ]);
    expect(scenarios).toHaveLength(4);
    for (const scenario of scenarios) {
      expect(scenario.mode).toBe("SHADOW_ONLY");
      expect(scenario.dailyReturns.length).toBeGreaterThan(0);
      expect(scenario.validationTarget).toEqual(expect.any(String));
      expect(scenario).not.toHaveProperty("snapshot");
    }

    scenarios[0].dailyReturns[0] = 999;
    expect(getStressScenarios()[0].dailyReturns[0]).toBe(-3.5);
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
