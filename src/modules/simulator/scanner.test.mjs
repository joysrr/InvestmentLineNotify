// src/modules/simulator/scanner.test.mjs
// TDD: 掃描器測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  scanPriceRange,
  createKDCrossChecker,
  createMACDCrossChecker,
  createStrategyScoreChecker,
  createPortfolioHealthChecker,
} from "./scanner.mjs";

describe("scanner - 掃描器", () => {
  const currentPrice0050 = 175;
  const currentPriceZ2 = 116.5;
  const priceRatio = currentPriceZ2 / currentPrice0050;

  const mockSimulationInput = {
    portfolio: { qty0050: 10000, qtyZ2: 5000, cash: 50000, totalLoan: 800000 },
    price0050: 175,
    currentPrice: 116.5,
  };

  // Mock forwardSimulator that varies results based on price
  const createMockForwardSimulator = (variations = {}) => {
    return vi.fn(async (simInput) => {
      const price = simInput.price0050;
      const priceDiff = price - currentPrice0050;

      // 根據價格模擬不同指標
      const k = 50 + priceDiff * 2; // 價格漲 1 元，K 漲 2
      const d = 50 + priceDiff * 1.5;
      const macd = 0.5 + priceDiff * 0.1;
      const signal = 0.3 + priceDiff * 0.05;
      const score = 65 + priceDiff * 2;
      const maintenanceMargin = 142.5 + priceDiff * 3;

      return {
        indicators: {
          kd: { k, d },
          macd: { MACD: macd, signal, histogram: macd - signal },
          rsi: 50 + priceDiff * 0.5,
          ma20: 172 + priceDiff * 0.8,
          ma60: 168 + priceDiff * 0.5,
          bias240: 15 + priceDiff * 0.3,
          atr: 2.1,
        },
        maintenanceMargin,
        strategyScore: Math.max(0, Math.min(100, score)),
        portfolioHealth: {
          maintenanceRisk: {
            level:
              maintenanceMargin > 150
                ? "Normal"
                : maintenanceMargin > 130
                  ? "Protect"
                  : "Critical",
          },
        },
      };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scanPriceRange - 通用掃描", () => {
    it("找到完全匹配時提前結束 (earlyStop)", async () => {
      const forwardSimulator = createMockForwardSimulator();

      // 目標：strategyScore >= 70
      const checker = (result) => ({
        matched: result.strategyScore >= 70,
        exactMatch: result.strategyScore >= 70,
        value: result.strategyScore,
        error: Math.abs(result.strategyScore - 70),
      });

      const result = await scanPriceRange({
        simulationInput: mockSimulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        checkTarget: checker,
        options: { earlyStop: true },
      });

      expect(result.reachable).toBe(true);
      expect(result.method).toBe("scan");
      expect(result.results.minPrice0050).toBe(result.results.maxPrice0050);
      expect(result.results.achievedValue).toBeGreaterThanOrEqual(70);
      expect(result.scanDetails.iterations).toBeLessThan(60); // 提前結束
    });

    it("掃描完整區間並回傳所有匹配範圍", async () => {
      const forwardSimulator = createMockForwardSimulator();

      // 目標：KD 金叉 (k > d)
      const checker = createKDCrossChecker("golden");

      const result = await scanPriceRange({
        simulationInput: mockSimulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        checkTarget: checker,
        options: { earlyStop: false },
      });

      expect(result.reachable).toBe(true);
      expect(result.results.minPrice0050).toBeLessThan(
        result.results.maxPrice0050,
      );
      expect(result.scanDetails.matchedCount).toBeGreaterThan(0);
    });

    it("無匹配時回傳最近結果", async () => {
      const forwardSimulator = createMockForwardSimulator();

      // 目標：strategyScore >= 200 (不可能)
      const checker = (result) => ({
        matched: false,
        exactMatch: false,
        value: result.strategyScore,
        error: Math.abs(result.strategyScore - 200),
      });

      const result = await scanPriceRange({
        simulationInput: mockSimulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        checkTarget: checker,
      });

      expect(result.reachable).toBe(false);
      expect(result.closestResult).toBeDefined();
      expect(result.closestResult.price0050).toBeGreaterThan(0);
      expect(result.scanDetails.matchedCount).toBe(0);
    });

    it("掃描參數正確套用", async () => {
      const forwardSimulator = createMockForwardSimulator();
      const checker = createStrategyScoreChecker(70);

      const result = await scanPriceRange({
        simulationInput: mockSimulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        checkTarget: checker,
        options: { rangePct: 0.1, stepPct: 0.01, maxIterations: 100 },
      });

      // ±10% = 17.5 元範圍，1% 步距 = 1.75 元，約 20 個點
      expect(result.scanDetails.iterations).toBeLessThanOrEqual(100);
      expect(result.scanDetails.range[0]).toBeCloseTo(
        currentPrice0050 * 0.9,
        0,
      );
      expect(result.scanDetails.range[1]).toBeCloseTo(
        currentPrice0050 * 1.1,
        0,
      );
    });
  });

  describe("createKDCrossChecker - KD 交叉檢查", () => {
    it("golden: k > d 為真", () => {
      const checker = createKDCrossChecker("golden");

      expect(checker({ indicators: { kd: { k: 60, d: 50 } } }).matched).toBe(
        true,
      );
      expect(checker({ indicators: { kd: { k: 50, d: 60 } } }).matched).toBe(
        false,
      );
    });

    it("dead: k < d 為真", () => {
      const checker = createKDCrossChecker("dead");

      expect(checker({ indicators: { kd: { k: 40, d: 50 } } }).matched).toBe(
        true,
      );
      expect(checker({ indicators: { kd: { k: 60, d: 50 } } }).matched).toBe(
        false,
      );
    });

    it("缺少 KD 資料回傳 false", () => {
      const checker = createKDCrossChecker("golden");

      expect(checker({ indicators: {} }).matched).toBe(false);
      expect(checker({}).matched).toBe(false);
    });
  });

  describe("createMACDCrossChecker - MACD 交叉檢查", () => {
    it("golden: MACD > signal 為真", () => {
      const checker = createMACDCrossChecker("golden");

      expect(
        checker({ indicators: { macd: { MACD: 1.0, signal: 0.5 } } }).matched,
      ).toBe(true);
      expect(
        checker({ indicators: { macd: { MACD: 0.3, signal: 0.5 } } }).matched,
      ).toBe(false);
    });

    it("dead: MACD < signal 為真", () => {
      const checker = createMACDCrossChecker("dead");

      expect(
        checker({ indicators: { macd: { MACD: 0.2, signal: 0.5 } } }).matched,
      ).toBe(true);
    });
  });

  describe("createStrategyScoreChecker - 策略分數檢查", () => {
    it("目標分數 ±1 容忍", () => {
      const checker = createStrategyScoreChecker(70);

      expect(checker({ strategyScore: 70 }).matched).toBe(true);
      expect(checker({ strategyScore: 69.5 }).matched).toBe(true);
      expect(checker({ strategyScore: 71 }).matched).toBe(true);
      expect(checker({ strategyScore: 68 }).matched).toBe(false);
      expect(checker({ strategyScore: 72 }).matched).toBe(false);
    });

    it("缺少分數回傳 false", () => {
      const checker = createStrategyScoreChecker(70);
      expect(checker({}).matched).toBe(false);
    });
  });

  describe("createPortfolioHealthChecker - Portfolio Health 檢查 (AND 邏輯)", () => {
    it("green: maintenanceRisk Normal", () => {
      const checker = createPortfolioHealthChecker("green");

      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Normal" } } })
          .matched,
      ).toBe(true);
      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Protect" } } })
          .matched,
      ).toBe(false);
      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Critical" } } })
          .matched,
      ).toBe(false);
    });

    it("yellow: maintenanceRisk Protect", () => {
      const checker = createPortfolioHealthChecker("yellow");

      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Protect" } } })
          .matched,
      ).toBe(true);
    });

    it("red: maintenanceRisk Critical 或 Frozen", () => {
      const checker = createPortfolioHealthChecker("red");

      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Critical" } } })
          .matched,
      ).toBe(true);
      expect(
        checker({ portfolioHealth: { maintenanceRisk: { level: "Frozen" } } })
          .matched,
      ).toBe(true);
    });
  });
});
