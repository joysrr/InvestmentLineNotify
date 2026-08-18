import { describe, expect, it } from "vitest";
import {
  calcATR,
  calcSMA,
  calcSlopeN,
  calculateIndicators,
} from "../../modules/strategy/indicators.mjs";

describe("calculateIndicators RSI golden cases", () => {
  it("calculates the initial RSI from 13 gains and 1 loss", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 13];
    const history = closes.map((close, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      high: close + 1,
      low: close - 1,
      close,
    }));

    const result = calculateIndicators(history);

    expect(result.rsiArr).toHaveLength(1);
    expect(result.rsiArr[0]).toBe(92.86);
  });
});

describe("indicator arithmetic golden cases", () => {
  it("calculates SMA with leading unavailable values", () => {
    const result = calcSMA([1, 2, 3, 4], 3);

    expect(Number.isNaN(result[0])).toBe(true);
    expect(Number.isNaN(result[1])).toBe(true);
    expect(result[2]).toBe(2);
    expect(result[3]).toBe(3);
  });

  it("calculates the first ATR from three constant true ranges", () => {
    const result = calcATR(
      [11, 12, 13, 14],
      [9, 10, 11, 12],
      [10, 11, 12, 13],
      3,
    );

    expect(Number.isNaN(result[0])).toBe(true);
    expect(Number.isNaN(result[1])).toBe(true);
    expect(Number.isNaN(result[2])).toBe(true);
    expect(result[3]).toBe(2);
  });
});

describe("calculateIndicators Slow KD golden cases", () => {
  it("applies SMA(3) to Fast K and then SMA(3) to Slow K", () => {
    const closes = [
      10, 11, 12, 13, 14, 10, 11, 12, 13, 14, 10, 11, 12, 13, 14, 10, 11, 12,
      13, 14,
    ];
    const history = closes.map((close, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      high: close + 2,
      low: close - 2,
      close,
    }));

    const result = calculateIndicators(history);

    expect(result.kdArr).toHaveLength(8);
    expect(result.kdArr.at(-1)).toEqual({
      k: 62.5,
      d: 50,
    });
  });
});

describe("calculateIndicators MACD golden cases", () => {
  it("uses EMA 12/26/9 and preserves MACD output fields", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i * 2 + (i % 3));
    const history = closes.map((close, index) => ({
      date: `2026-02-${String(index + 1).padStart(2, "0")}`,
      high: close + 1,
      low: close - 1,
      close,
    }));

    const latest = calculateIndicators(history).macdArr.at(-1);

    expect(latest.MACD).toBeCloseTo(13.97024150837018, 12);
    expect(latest.signal).toBeCloseTo(14.003345644533146, 12);
    expect(latest.histogram).toBeCloseTo(-0.033104136162966924, 12);
  });
});

describe("calcSlopeN golden cases", () => {
  it("calculates the average five-period slope", () => {
    expect(calcSlopeN([10, 12, 14, 16, 18, 20], 5)).toBe(2);
  });

  it("returns NaN when the lookback endpoint is unavailable", () => {
    expect(Number.isNaN(calcSlopeN([NaN, 12, 14, 16, 18, 20], 5))).toBe(true);
  });
});
