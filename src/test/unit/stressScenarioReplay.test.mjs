import { describe, expect, it } from "vitest";
import { loadStressScenarioFixture } from "../../tools/stressScenarioFixture.mjs";
import { evaluateStressDay } from "../../tools/stressTestEvaluator.mjs";
import { getStressScenarios } from "../../tools/stressScenarios.mjs";

describe("stress scenario replay", () => {
  it("replays every file-backed day as shadow-only state verification", async () => {
    const fixture = await loadStressScenarioFixture();
    const results = fixture.scenarios.flatMap((scenario) =>
      scenario.days.map((day) => evaluateStressDay(day)),
    );

    const expectedDayCount = getStressScenarios().reduce(
      (total, scenario) => total + scenario.dailyReturns.length,
      0,
    );
    expect(results).toHaveLength(expectedDayCount);
    expect(results.every((result) => result.status === "OK")).toBe(true);
    expect(results.every((result) => result.mode === "SHADOW_ONLY")).toBe(true);
    expect(results.every((result) => result.differences.length === 0)).toBe(
      true,
    );
    expect(results.every((result) => result.tradeSignal === null)).toBe(true);
  });
});
