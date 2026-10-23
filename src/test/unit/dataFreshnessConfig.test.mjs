import { describe, expect, it } from "vitest";
import strategyConfig from "../../../data/config/Strategy.default.json";
import { resolveFreshnessConfig } from "../../domain/dataFreshness.mjs";

describe("strategy lifecycle age configuration", () => {
  it("uses the user's confirmed current age and does not imply automatic ageing without birthYear", () => {
    expect(strategyConfig.lifecycle.currentAge).toBe(33);
    expect(strategyConfig.lifecycle.birthYear).toBeUndefined();
  });
});

describe("data freshness config", () => {
  it("provides shadow defaults and category dependencies", () => {
    expect(resolveFreshnessConfig(strategyConfig.dataFreshness)).toEqual({
      mode: "shadow",
      staleAfterTradingDays: 3,
      dependencies: {
        technical: ["z2History", "etf0050History"],
        institutional: ["institutionalHistory"],
        valuation: ["valuation"],
        risk: ["marketMargin", "vix"],
      },
    });
  });

  it("accepts an environment mode override", () => {
    const previous = process.env.DATA_FRESHNESS_MODE;
    process.env.DATA_FRESHNESS_MODE = "enforcement";
    try {
      expect(resolveFreshnessConfig({ mode: "shadow" }).mode).toBe(
        "enforcement",
      );
    } finally {
      if (previous === undefined) delete process.env.DATA_FRESHNESS_MODE;
      else process.env.DATA_FRESHNESS_MODE = previous;
    }
  });
});
