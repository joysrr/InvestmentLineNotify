import { describe, it, expect, vi } from "vitest";
import {
  calculateLogReturns,
  annualize,
  detectRegime,
  calculateMuSigma,
} from "./marketRegimeModel.mjs";

describe("marketRegimeModel.calculateLogReturns", () => {
  it("computes log returns from price array", () => {
    const prices = [100, 102, 101, 105];
    const returns = calculateLogReturns(prices);
    expect(returns).toHaveLength(3);
    // ln(102/100) ≈ 0.0198
    expect(returns[0]).toBeCloseTo(Math.log(102 / 100), 6);
    expect(returns[1]).toBeCloseTo(Math.log(101 / 102), 6);
    expect(returns[2]).toBeCloseTo(Math.log(105 / 101), 6);
  });

  it("returns empty array for single price", () => {
    expect(calculateLogReturns([100])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(calculateLogReturns([])).toEqual([]);
  });

  it("filters out null/undefined prices", () => {
    const prices = [100, null, 102, undefined, 105];
    const returns = calculateLogReturns(prices);
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(Math.log(102 / 100), 6);
    expect(returns[1]).toBeCloseTo(Math.log(105 / 102), 6);
  });

  it("filters out NaN prices", () => {
    const prices = [100, NaN, 102];
    const returns = calculateLogReturns(prices);
    expect(returns).toHaveLength(1);
  });
});

describe("marketRegimeModel.annualize", () => {
  it("annualizes mean and std with default 252 periods", () => {
    const mean = 0.0003; // daily ~0.03%
    const std = 0.01; // daily 1%
    const { mu, sigma } = annualize(mean, std);
    expect(mu).toBeCloseTo(mean * 252, 6);
    expect(sigma).toBeCloseTo(std * Math.sqrt(252), 6);
  });

  it("accepts custom periodsPerYear", () => {
    const { mu, sigma } = annualize(0.001, 0.02, 12); // monthly
    expect(mu).toBeCloseTo(0.001 * 12, 6);
    expect(sigma).toBeCloseTo(0.02 * Math.sqrt(12), 6);
  });
});

describe("marketRegimeModel.detectRegime", () => {
  it("returns BULL for positive mu above threshold", () => {
    expect(detectRegime(0.08, 0.18)).toBe("BULL");
    expect(detectRegime(0.06, 0.2)).toBe("BULL");
  });

  it("returns BEAR for negative mu below threshold", () => {
    expect(detectRegime(-0.06, 0.2)).toBe("BEAR");
    expect(detectRegime(-0.1, 0.25)).toBe("BEAR");
  });

  it("returns NEUTRAL for mu near zero", () => {
    expect(detectRegime(0.02, 0.15)).toBe("NEUTRAL");
    expect(detectRegime(-0.02, 0.15)).toBe("NEUTRAL");
    expect(detectRegime(0, 0.2)).toBe("NEUTRAL");
  });
});

describe("marketRegimeModel.calculateMuSigma", () => {
  it("returns OK with mu/sigma/regime for sufficient clean data", () => {
    // 生成 126 天略微上漲 + 波動的價格序列（有效日期）
    const prices = [];
    let p = 100;
    const startDate = new Date("2024-01-01");
    for (let i = 0; i < 126; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      p *= 1 + 0.0003 + (Math.random() - 0.5) * 0.02; // 日均 0.03%，日波 1%
      prices.push({ date: d.toISOString().split("T")[0], close: p });
    }

    const result = calculateMuSigma({ prices, minDays: 60 });
    expect(result.status).toBe("OK");
    expect(typeof result.mu).toBe("number");
    expect(typeof result.sigma).toBe("number");
    expect(["BULL", "BEAR", "NEUTRAL"]).toContain(result.regime);
    expect(result.asOf).toBeDefined();
    expect(result.sampleDays).toBeGreaterThanOrEqual(60);
  });

  it("returns INSUFFICIENT_DATA when valid prices < minDays", () => {
    const prices = [
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 101 },
    ];
    const result = calculateMuSigma({ prices, minDays: 60 });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.mu).toBeNull();
    expect(result.sigma).toBeNull();
    expect(result.regime).toBeNull();
  });

  it("handles prices with null/NaN close values", () => {
    const prices = [];
    const startDate = new Date("2024-01-01");
    for (let i = 0; i < 80; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      prices.push({
        date: d.toISOString().split("T")[0],
        close: i % 5 === 0 ? null : 100 + i * 0.1,
      });
    }
    const result = calculateMuSigma({ prices, minDays: 60 });
    expect(result.status).toBe("OK");
    expect(result.sampleDays).toBeGreaterThanOrEqual(60);
  });

  it("uses default minDays=60 when not specified", () => {
    const prices = [];
    const startDate = new Date("2024-01-01");
    for (let i = 0; i < 60; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      prices.push({
        date: d.toISOString().split("T")[0],
        close: 100 + i * 0.1,
      });
    }
    const result = calculateMuSigma({ prices });
    expect(result.status).toBe("OK");
  });

  it("returns INSUFFICIENT_DATA for empty prices array", () => {
    const result = calculateMuSigma({ prices: [] });
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });
});
