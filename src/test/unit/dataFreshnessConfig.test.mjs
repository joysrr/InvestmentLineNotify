import { describe, expect, it } from "vitest";
import strategy from "../../../data/config/Strategy.default.json";
import { resolveFreshnessConfig } from "../../domain/dataFreshness.mjs";

describe("data freshness config", () => {
  it("provides shadow defaults and category dependencies", () => {
    expect(resolveFreshnessConfig(strategy.dataFreshness)).toEqual({
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
