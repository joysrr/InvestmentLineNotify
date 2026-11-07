import { describe, expect, it, vi } from "vitest";
import { computeEntryScore } from "../../../modules/strategy/policies/entryScoringPolicy.mjs";

vi.mock("../../../modules/strategy/indicators.mjs", () => ({
  roseAboveAfterBelow: vi.fn(() => true),
  macdCrossUp: vi.fn(() => true),
  kdCrossUp: vi.fn(() => true),
  wasBelowLevel: vi.fn(() => true),
}));

const baseStrategy = {
  buy: {
    dropScoreRules: [
      { minDrop: 10, score: 3, label: "跌幅 ≥ 10%" },
      { minDrop: 5, score: 2, label: "跌幅 ≥ 5%" },
      { minDrop: 2, score: 1, label: "跌幅 ≥ 2%" },
    ],
    rsi: { oversold: 30, score: 2 },
    kd: { oversoldK: 20, crossLevelThreshold: 50, lookbackDays: 18, score: 2 },
    macd: { score: 1 },
  },
};

describe("computeEntryScore", () => {
  it("總分 = dropScore + MAX(rsiScore, kdScore) + macdScore + sentimentScore", () => {
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      8,
      baseStrategy,
      { direction: "BULL", bonus: 1 },
    );

    expect(result.weightScore).toBe(2 + 2 + 1 + 1); // drop=2(minDrop=5), MAX(rsi=2,kd=2)=2, macd=1, sentiment=1
    expect(result.weightDetails.dropScore).toBe(2);
    expect(result.weightDetails.rsiScore).toBe(2);
    expect(result.weightDetails.kdScore).toBe(2);
    expect(result.weightDetails.macdScore).toBe(1);
    expect(result.weightDetails.sentimentScore).toBe(1);
  });

  it("RSI > KD 時，動能分數取 rsiScore", () => {
    const strategy = {
      ...baseStrategy,
      buy: {
        ...baseStrategy.buy,
        rsi: { oversold: 30, score: 3 },
        kd: {
          oversoldK: 20,
          crossLevelThreshold: 50,
          lookbackDays: 18,
          score: 1,
        },
        macd: { score: 1 },
      },
    };
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      5,
      strategy,
      null,
    );

    // drop=2, MAX(rsi=3, kd=1)=3, macd=1, sentiment=0
    expect(result.weightScore).toBe(2 + 3 + 1 + 0);
    expect(result.weightDetails.rsiScore).toBe(3);
    expect(result.weightDetails.kdScore).toBe(1);
  });

  it("KD > RSI 時，動能分數取 kdScore", () => {
    const strategy = {
      ...baseStrategy,
      buy: {
        ...baseStrategy.buy,
        rsi: { oversold: 30, score: 1 },
        kd: {
          oversoldK: 20,
          crossLevelThreshold: 50,
          lookbackDays: 18,
          score: 3,
        },
        macd: { score: 1 },
      },
    };
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      5,
      strategy,
      null,
    );

    // drop=2, MAX(rsi=1, kd=3)=3, macd=1, sentiment=0
    expect(result.weightScore).toBe(2 + 3 + 1 + 0);
    expect(result.weightDetails.rsiScore).toBe(1);
    expect(result.weightDetails.kdScore).toBe(3);
  });

  it("沒有符合的 dropRule 時，dropScore 為 0", () => {
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      1, // 小於所有 minDrop
      baseStrategy,
      null,
    );

    expect(result.weightDetails.dropScore).toBe(0);
    expect(result.weightScore).toBe(0 + 2 + 1 + 0); // drop=0, MAX(rsi=2,kd=2)=2, macd=1, sentiment=0
  });

  it("沒有 macroSentiment 時，sentimentScore 為 0", () => {
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      5,
      baseStrategy,
      null,
    );

    expect(result.weightDetails.sentimentScore).toBe(0);
  });

  it("BEAR 情緒時，sentimentScore 為負值", () => {
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      5,
      baseStrategy,
      { direction: "BEAR", penalty: 2 },
    );

    expect(result.weightDetails.sentimentScore).toBe(-2);
    expect(result.weightScore).toBe(2 + 2 + 1 + -2);
  });

  it("rsiScore 與 kdScore 細項皆正確返回，即使總分只取 MAX", () => {
    const strategy = {
      ...baseStrategy,
      buy: {
        ...baseStrategy.buy,
        rsi: { oversold: 30, score: 4 },
        kd: {
          oversoldK: 20,
          crossLevelThreshold: 50,
          lookbackDays: 18,
          score: 1,
        },
        macd: { score: 0 },
      },
    };
    const result = computeEntryScore(
      { rsiArr: [], kdArr: [{ k: 10 }], macdArr: [] },
      10,
      strategy,
      null,
    );

    expect(result.weightDetails.rsiScore).toBe(4);
    expect(result.weightDetails.kdScore).toBe(1);
    // 總分取 MAX(rsi=4, kd=1)=4，不等於 rsi+kd=5
    expect(result.weightScore).toBe(3 + 4 + 0 + 0);
  });
});
