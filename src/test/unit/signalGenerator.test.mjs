import { describe, expect, it } from "vitest";
import {
  generateScoringMatrix,
  normalizeUnbounded,
} from "../../modules/strategy/signalGenerator.mjs";

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

describe("normalizeUnbounded edge cases", () => {
  it("returns zero when history is insufficient or constant", () => {
    expect(normalizeUnbounded(10, [1, 2, 3, 4])).toBe(0);
    expect(normalizeUnbounded(10, [5, 5, 5, 5, 5])).toBe(0);
  });
});

describe("generateScoringMatrix factor bounds", () => {
  it("clamps sentiment and caps bullish momentum at one", () => {
    const closes = Array.from({ length: 21 }, (_, index) =>
      index === 0 ? 100 : 110,
    );
    const result = generateScoringMatrix(
      baseIndicators,
      0,
      strategyWith({
        technicalTrend: { cap: 4, weights: {} },
        valuationValue: { cap: 8, weights: { bullMomentum: 2 } },
        flowOfFunds: { cap: 4, weights: { sentiment: 3 } },
        extremeOscillation: { cap: 2, weights: {} },
      }),
      { closeArr: closes, sentimentScore: 2 },
    );

    expect(result.factorPool.bullMomentum).toBe(1);
    expect(result.factorPool.sentiment).toBe(1);
    expect(result.categoryResults.valuationValue.finalScore).toBe(2);
    expect(result.categoryResults.flowOfFunds.finalScore).toBe(3);
  });
});

// TODO: add independent golden fixtures for institutional fallback and tier thresholds.
