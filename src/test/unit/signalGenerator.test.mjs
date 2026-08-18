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

describe("generateScoringMatrix normalization freshness", () => {
  it("excludes the current institutional value from its history baseline", () => {
    const result = generateScoringMatrix(
      baseIndicators,
      0,
      strategyWith({
        technicalTrend: { cap: 4, weights: {} },
        valuationValue: { cap: 8, weights: {} },
        flowOfFunds: { cap: 4, weights: { institutional: 1 } },
        extremeOscillation: { cap: 2, weights: {} },
      }),
      { institutionalNet: 6, institutionalHistory: [1, 2, 3, 4, 5, 6] },
    );

    expect(result.factorPool.institutional).toBeCloseTo(0.9716679, 6);
  });
});

describe("generateScoringMatrix missing institutional data", () => {
  it("falls back to zero institutional factor and preserves technical fallback", () => {
    const result = generateScoringMatrix(
      { ...baseIndicators, macdArr: [{ histogram: 0 }] },
      0,
      strategyWith({
        technicalTrend: { cap: 4, weights: { ma60Slope: 1 } },
        valuationValue: { cap: 8, weights: {} },
        flowOfFunds: { cap: 4, weights: { institutional: 5 } },
        extremeOscillation: { cap: 2, weights: {} },
      }),
      { ma60SlopeArr: [0.1], institutionalHistory: [] },
    );

    expect(result.factorPool.institutional).toBe(0);
    expect(result.categoryResults.technicalTrend.finalScore).toBe(3);
    expect(result.categoryResults.flowOfFunds.finalScore).toBe(0);
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

describe("generateScoringMatrix scaling tiers", () => {
  function runAtScore(score) {
    return generateScoringMatrix(baseIndicators, (score / 8) ** 2 * 40, {
      scoringMatrix: {
        enabled: true,
        categories: {
          technicalTrend: { cap: 4, weights: {} },
          valuationValue: { cap: 8, weights: { priceDrop: 8 } },
          flowOfFunds: { cap: 4, weights: {} },
          extremeOscillation: { cap: 2, weights: {} },
        },
        thresholds: {
          buyTactical: 1,
          buyTacticalBullish: 1,
          sellTactical: -999,
          hysteresisExit: 0,
          scaling: {
            tier1: { score: 1.5, ratio: 0.4 },
            tier2: { score: 3.5, ratio: 0.7 },
            tier3: { score: 6, ratio: 1 },
          },
        },
        normalization: { lookbackDays: 20 },
      },
    });
  }

  it("uses tier 1 below the tier 2 boundary", () => {
    expect(runAtScore(2).scalingRatio).toBe(0.4);
  });

  it("uses tier 2 at its exact boundary", () => {
    expect(runAtScore(3.5).scalingRatio).toBe(0.7);
  });

  it("uses tier 3 at its exact boundary", () => {
    expect(runAtScore(6).scalingRatio).toBe(1);
  });
});

describe("generateScoringMatrix buy threshold matrix", () => {
  function run({ score, bullish, currentPR = 50 }) {
    return generateScoringMatrix(
      baseIndicators,
      40,
      {
        scoringMatrix: {
          enabled: true,
          categories: {
            technicalTrend: { cap: 4, weights: {} },
            valuationValue: { cap: 8, weights: { priceDrop: score } },
            flowOfFunds: { cap: 4, weights: {} },
            extremeOscillation: { cap: 2, weights: {} },
          },
          normalization: { lookbackDays: 20 },
          thresholds: {
            buyTactical: 4,
            buyTacticalBullish: 1.5,
            sellTactical: -999,
            hysteresisExit: 0,
            scaling: {
              tier1: { score: 1.5, ratio: 0.4 },
              tier2: { score: 3.5, ratio: 0.7 },
              tier3: { score: 6, ratio: 1 },
            },
          },
        },
      },
      {
        ma60SlopeArr: bullish ? [0.1] : [0],
        institutionalNet: 0,
        institutionalHistory: [0, 0, 0, 0, 0],
        currentPR,
      },
    );
  }

  it("uses the bullish threshold at its exact boundary", () => {
    expect(run({ score: 1.5, bullish: true }).signal).toBe("buy_tactical");
  });

  it("does not buy below the bullish threshold", () => {
    expect(run({ score: 1.49, bullish: true }).signal).not.toBe("buy_tactical");
  });

  it("uses the normal threshold when bullish valuation is overheated", () => {
    expect(run({ score: 1.5, bullish: true, currentPR: 90 }).signal).not.toBe(
      "buy_tactical",
    );
    expect(run({ score: 4, bullish: true, currentPR: 90 }).signal).toBe(
      "buy_tactical",
    );
  });

  it("uses the normal threshold in a non-bullish market", () => {
    expect(run({ score: 1.5, bullish: false }).signal).not.toBe("buy_tactical");
    expect(run({ score: 4, bullish: false }).signal).toBe("buy_tactical");
  });
});

describe("generateScoringMatrix synergy tier boost", () => {
  function run({ currentPR = 50, macd = [0.1, 0.2], score = 2 }) {
    return generateScoringMatrix(
      {
        ...baseIndicators,
        macdArr: macd.map((histogram) => ({ histogram })),
      },
      40,
      {
        scoringMatrix: {
          enabled: true,
          categories: {
            technicalTrend: { cap: 4, weights: {} },
            valuationValue: { cap: 8, weights: { priceDrop: score } },
            flowOfFunds: { cap: 4, weights: {} },
            extremeOscillation: { cap: 2, weights: {} },
          },
          thresholds: {
            buyTactical: 1,
            buyTacticalBullish: 1,
            sellTactical: -999,
            hysteresisExit: 0,
            scaling: {
              tier1: { score: 1.5, ratio: 0.4 },
              tier2: { score: 3.5, ratio: 0.7 },
              tier3: { score: 6, ratio: 1 },
            },
          },
          normalization: { lookbackDays: 20 },
        },
        valuationMomentum: {
          synergy: {
            safePRThreshold: 95,
            macdPositiveRequired: true,
            scalingTierBoost: 1,
          },
        },
      },
      {
        currentPR,
        institutionalHistory: [0, 0, 0, 0, 0],
        macdArr: [],
      },
    );
  }

  it("boosts tier 1 to tier 2 when valuation and MACD conditions hold", () => {
    const result = run({});
    expect(result.signal).toBe("buy_tactical");
    expect(result.scalingRatio).toBe(0.7);
    expect(result.synergyBoostApplied).toBe(true);
  });

  it("does not boost when PR equals the safe threshold", () => {
    const result = run({ currentPR: 95 });
    expect(result.scalingRatio).toBe(0.4);
    expect(result.synergyBoostApplied).toBe(false);
  });

  it("does not boost when MACD is not positive", () => {
    const result = run({ macd: [-0.2, -0.1] });
    expect(result.scalingRatio).toBe(0.4);
    expect(result.synergyBoostApplied).toBe(false);
  });

  it("does not exceed tier 3 after the boost", () => {
    const result = run({ score: 6 });
    expect(result.scalingRatio).toBe(1);
    expect(result.synergyBoostApplied).toBe(true);
  });
});

describe("generateScoringMatrix sell and exit boundaries", () => {
  function runAtScore(score, hasTacticalPosition) {
    return generateScoringMatrix(
      baseIndicators,
      score < 0 ? 40 : 0,
      {
        scoringMatrix: {
          enabled: true,
          categories: {
            technicalTrend: { cap: 4, weights: {} },
            valuationValue: { cap: 8, weights: {} },
            flowOfFunds: { cap: 4, weights: { sentiment: 4 } },
            extremeOscillation: { cap: 2, weights: {} },
          },
          thresholds: {
            buyTactical: 999,
            buyTacticalBullish: 999,
            sellTactical: -4,
            hysteresisExit: 0,
            scaling: {
              tier1: { score: 1.5, ratio: 0.4 },
              tier2: { score: 3.5, ratio: 0.7 },
              tier3: { score: 6, ratio: 1 },
            },
          },
          normalization: { lookbackDays: 20 },
        },
      },
      {
        ma60SlopeArr: [0],
        sentimentScore: score < 0 ? score / 4 : 0,
        institutionalHistory: [0, 0, 0, 0, 0],
        hasTacticalPosition,
      },
    );
  }

  it("uses sell tactical at the exact -4 boundary", () => {
    expect(runAtScore(-4, true).signal).toBe("sell_tactical");
  });

  it("uses exit buffer below zero but above sell threshold", () => {
    expect(runAtScore(-3.99, true).signal).toBe("exit_buffer");
  });

  it("does not exit at the exact zero boundary", () => {
    expect(runAtScore(0, true).signal).toBe("neutral");
  });

  it("does not use exit buffer without a tactical position", () => {
    expect(runAtScore(-3.99, false).signal).toBe("neutral");
  });
});

// TODO: add independent golden fixtures for institutional fallback.
