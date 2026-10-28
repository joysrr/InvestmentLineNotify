import { describe, expect, it } from "vitest";
import { loadStressScenarioFixture } from "../../tools/stressScenarioFixture.mjs";
import { getStressScenarios } from "../../tools/stressScenarios.mjs";

describe("stressScenarioFixture", () => {
  it("loads the synthetic fixture with four complete scenarios", async () => {
    const fixture = await loadStressScenarioFixture();

    expect(fixture).toMatchObject({
      schemaVersion: "1.0",
      fixtureSource: "synthetic",
    });
    expect(fixture.scenarios.map(({ scenarioId }) => scenarioId)).toEqual([
      "COVID_CIRCUIT_BREAKER",
      "BEAR_CHOPPY",
      "FLASH_CRASH",
      "VALUATION_REVERSION",
    ]);

    for (const scenario of fixture.scenarios) {
      expect(scenario.days.length).toBeGreaterThan(0);
      for (const day of scenario.days) {
        expect(Number.isInteger(day.day)).toBe(true);
        expect(Number.isFinite(day.dailyReturn)).toBe(true);
        expect(day.snapshot).toEqual({
          totalAssets: expect.any(Number),
          totalLiabilities: expect.any(Number),
        });
        expect(day.expectedState).toEqual({
          freeze00675L: expect.any(Boolean),
          p0Exempt: true,
        });
      }
    }
  });

  it("keeps file-backed daily returns aligned with canonical scenarios", async () => {
    const fixture = await loadStressScenarioFixture();
    const canonicalScenarios = getStressScenarios();

    expect(fixture.scenarios).toHaveLength(canonicalScenarios.length);
    for (const scenario of canonicalScenarios) {
      const fileScenario = fixture.scenarios.find(
        ({ scenarioId }) => scenarioId === scenario.id,
      );
      expect(fileScenario.days).toHaveLength(scenario.dailyReturns.length);
      expect(fileScenario.days.map(({ dailyReturn }) => dailyReturn)).toEqual(
        scenario.dailyReturns,
      );
    }
  });
});
