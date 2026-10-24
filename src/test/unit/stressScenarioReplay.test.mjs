import { describe, expect, it } from "vitest";
import { loadStressScenarioFixture } from "../../tools/stressScenarioFixture.mjs";
import { evaluateStressDay } from "../../tools/stressTestEvaluator.mjs";

describe("stress scenario replay", () => {
  it("replays every file-backed day as shadow-only state verification", async () => {
    const fixture = await loadStressScenarioFixture();
    const results = fixture.scenarios.flatMap((scenario) =>
      scenario.days.map((day) => evaluateStressDay(day)),
    );

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.status === "OK")).toBe(true);
    expect(results.every((result) => result.mode === "SHADOW_ONLY")).toBe(true);
    expect(results.every((result) => result.differences.length === 0)).toBe(
      true,
    );
    expect(results.every((result) => result.tradeSignal === null)).toBe(true);
  });
});
