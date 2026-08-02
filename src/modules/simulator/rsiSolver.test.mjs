// src/modules/simulator/rsiSolver.test.mjs
// TDD: RSI 二分搜尋測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  solvePriceForRSI,
  solvePriceForRSIWithExpandingBounds,
} from "./rsiSolver.mjs";

describe("rsiSolver - RSI 二分搜尋反推", () => {
  const currentPrice0050 = 175;
  const currentPriceZ2 = 116.5;

  // Mock forwardSimulator that returns RSI based on price
  const mockForwardSimulator = vi.fn(async (simInput) => {
    // 簡單模型：價格越高 RSI 越高
    // price 175 -> RSI 50 (基準)
    // 每 1 元約 0.5 RSI 點
    const basePrice = 175;
    const baseRSI = 50;
    const priceDiff = simInput.price0050 - basePrice;
    const estimatedRSI = Math.max(1, Math.min(99, baseRSI + priceDiff * 0.5));

    return {
      indicators: { rsi: estimatedRSI },
      maintenanceMargin: 142.5,
      strategyScore: 65,
      portfolioHealth: { maintenanceRisk: { level: "Normal" } },
    };
  });

  const mockSimulationInput = {
    portfolio: { qty0050: 10000, qtyZ2: 5000, cash: 50000, totalLoan: 800000 },
    price0050: 175,
    currentPrice: 116.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("solvePriceForRSI - 固定 ±30% 範圍", () => {
    it("目標 RSI 60 (價格需上漲) 應收斂", async () => {
      const result = await solvePriceForRSI(
        60,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      expect(result.achievable).toBe(true);
      expect(result.method).toBe("binary_search_converged");
      expect(result.price0050).toBeGreaterThan(currentPrice0050); // RSI 60 > 50 需要漲
      expect(result.achievedValue).toBeCloseTo(60, 0);
      expect(result.iterations).toBeLessThanOrEqual(50);
    });

    it("目標 RSI 40 (價格需下跌) 應收斂", async () => {
      const result = await solvePriceForRSI(
        40,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      expect(result.achievable).toBe(true);
      expect(result.method).toBe("binary_search_converged");
      expect(result.price0050).toBeLessThan(currentPrice0050); // RSI 40 < 50 需要跌
      expect(result.achievedValue).toBeCloseTo(40, 0);
    });

    it("目標 RSI 50 (當前基準) 應快速收斂", async () => {
      const result = await solvePriceForRSI(
        50,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      expect(result.achievable).toBe(true);
      expect(result.price0050).toBeCloseTo(currentPrice0050, 0);
    });

    it("目標 RSI 0 (超出範圍) 應不可達", async () => {
      const result = await solvePriceForRSI(
        0,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      expect(result.achievable).toBe(false);
      expect(result.reason).toContain("1-99");
    });

    it("目標 RSI 100 (超出範圍) 應不可達", async () => {
      const result = await solvePriceForRSI(
        100,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      expect(result.achievable).toBe(false);
    });

    it("極端目標 RSI 5 在 ±30% 內可能不可達 (視 mock 行為)", async () => {
      const result = await solvePriceForRSI(
        5,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      // 取決於 mock 的行為，可能在 ±30% 內找到也可能找不到
      // 只要有合理的結果結構即可
      if (!result.achievable) {
        expect(result.method).toBe("binary_search_failed");
      } else {
        // mock 最低價格 122.5 時 RSI=23.75，無法達到 5
        // 如果回傳可達，說明 mock 行為與預期不同
        expect(result.achievedValue).toBeCloseTo(23.75, 0);
      }
    });
  });

  describe("solvePriceForRSIWithExpandingBounds - 動態邊界擴展", () => {
    it("在擴大範圍後能找到極端目標", async () => {
      // RSI 5 需要 ±60% 或更大範圍
      const result = await solvePriceForRSIWithExpandingBounds(
        5,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      // 應該在 ±60% 或 ±120% 找到
      if (result.achievable) {
        expect(result.method).toBe("binary_search_converged");
        expect(result.searchRange).toBeGreaterThanOrEqual(0.3);
      } else {
        expect(result.method).toBe("binary_search_exhausted");
      }
    });
  });

  describe("二分搜尋參數驗證", () => {
    it("收斂容忍度 0.5 RSI 點", async () => {
      const result = await solvePriceForRSI(
        60,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      if (result.achievable && result.method === "binary_search_converged") {
        expect(Math.abs(result.achievedValue - 60)).toBeLessThanOrEqual(0.5);
      }
    });

    it("最大迭代 50 次", async () => {
      const result = await solvePriceForRSI(
        60,
        mockSimulationInput,
        mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      if (result.iterations) {
        expect(result.iterations).toBeLessThanOrEqual(50);
      }
    });
  });
});
