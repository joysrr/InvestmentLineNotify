import { describe, expect, it } from "vitest";
import { loadMissingStressScenarioFixture } from "../../tools/stressScenarioFixture.mjs";
import { evaluateStressDay } from "../../tools/stressTestEvaluator.mjs";

describe("stress scenario missing-data fixture", () => {
  it("fails closed without producing a trade signal", async () => {
    const fixture = await loadMissingStressScenarioFixture();
    const result = evaluateStressDay(fixture.day);

    expect(fixture.fixtureSource).toBe("synthetic");
    expect(result).toEqual({
      status: "UNAVAILABLE",
      mode: "SHADOW_ONLY",
      day: 1,
      reason: "MISSING_OR_INVALID_STRESS_INPUT",
      expectedState: {
        freeze00675L: true,
        p0Exempt: true,
      },
      actualState: null,
      differences: [],
      tradeSignal: null,
    });
  });
});
