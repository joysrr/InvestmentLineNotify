import { describe, expect, it } from "vitest";
import { generateScoringMatrix } from "../../modules/strategy/signalGenerator.mjs";

const baseIndicators = {
  rsiArr: [50],
  kdArr: [{ k: 50, d: 50 }],
  macdArr: [],
};

function strategyWith(categories) {
  return {
    scoringMatrix: {
      enabled: true,
      categories,
      thresholds: {
        buyTactical: 999,
        buyTacticalBullish: 999,
        sellTactical: -999,
        hysteresisExit: 0,
        scaling: {
          tier1: { score: 1, ratio: 0.4 },
          tier2: { score: 2, ratio: 0.7 },
          tier3: { score: 3, ratio: 1 },
        },
      },
      normalization: { lookbackDays: 20 },
    },
  };
}

describe("generateScoringMatrix golden cases", () => {
  it("normalizes a 40 percent drop to one before applying weight", () => {
    const result = generateScoringMatrix(
      baseIndicators,
      40,
      strategyWith({
        technicalTrend: { cap: 4, weights: {} },
        valuationValue: { cap: 8, weights: { priceDrop: 6 } },
        flowOfFunds: { cap: 4, weights: {} },
        extremeOscillation: { cap: 2, weights: {} },
      }),
    );

    expect(result.factorPool.priceDrop).toBe(1);
    expect(result.categoryResults.valuationValue.finalScore).toBe(6);
    expect(result.finalScore).toBe(6);
  });

  it("applies the configured category cap", () => {
    const result = generateScoringMatrix(
      baseIndicators,
      40,
      strategyWith({
        technicalTrend: { cap: 4, weights: {} },
        valuationValue: { cap: 8, weights: { priceDrop: 12 } },
        flowOfFunds: { cap: 4, weights: {} },
        extremeOscillation: { cap: 2, weights: {} },
      }),
    );

    expect(result.categoryResults.valuationValue.rawScore).toBe(12);
    expect(result.categoryResults.valuationValue.finalScore).toBe(8);
    expect(result.categoryResults.valuationValue.isCapped).toBe(true);
  });
});

// TODO: add independent golden fixtures for normalization, institutional fallback,
// sentiment clamp, bullish momentum, and tier thresholds.
