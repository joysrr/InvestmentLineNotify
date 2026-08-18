import { describe, expect, it } from "vitest";
import {
  calcATR,
  calcSMA,
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

// TODO: add independent golden fixtures for MACD, Slow KD, and slope.
