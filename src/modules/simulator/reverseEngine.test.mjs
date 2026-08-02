// src/modules/simulator/reverseEngine.test.mjs
// TDD: 反向推導主流程測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import { runReverseEngine } from "./reverseEngine.mjs";

describe("reverseEngine - 反向推導主流程", () => {
  const currentPrice0050 = 175;
  const currentPriceZ2 = 116.5;
  const priceRatio = currentPriceZ2 / currentPrice0050;

  const mockSimulationInput = {
    portfolio: { qty0050: 10000, qtyZ2: 5000, cash: 50000, totalLoan: 800000 },
    price0050: 175,
    currentPrice: 116.5,
    closeArr: Array.from({ length: 250 }, (_, i) => 170 + i * 0.1),
  };

  // Mock forwardSimulator
  const createMockForwardSimulator = () => {
    return vi.fn(async (simInput) => {
      const price = simInput.price0050;
      const priceDiff = price - currentPrice0050;
      const maintenanceMargin = 142.5 + priceDiff * 3;

      return {
        indicators: {
          rsi: 50 + priceDiff * 0.5,
          kd: { k: 50 + priceDiff * 2, d: 50 + priceDiff * 1.5 },
          macd: { MACD: 0.5 + priceDiff * 0.1, signal: 0.3, histogram: 0.2 },
          ma20: 172 + priceDiff * 0.8,
          ma60: 168 + priceDiff * 0.5,
          bias240: 15 + priceDiff * 0.3,
          atr: 2.1,
        },
        maintenanceMargin,
        strategyScore: Math.max(0, Math.min(100, 65 + priceDiff * 2)),
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

  const mockForwardSimulator = createMockForwardSimulator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("解析型目標", () => {
    it("maintenanceRatio: 同比例聯動求解", async () => {
      const result = await runReverseEngine({
        target: { type: "maintenanceRatio", value: 150 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("maintenanceRatio");
      expect(result.reachable).toBe(true);
      expect(result.method).toBe("analytical");
      expect(result.results.price0050).toBeGreaterThan(0);
      expect(result.results.priceZ2).toBeCloseTo(
        result.results.price0050 * priceRatio,
        1,
      );
      expect(result.assumptions).toContainEqual(
        expect.stringContaining("同比例聯動"),
      );
    });

    it("rsi: 二分搜尋求解", async () => {
      const result = await runReverseEngine({
        target: { type: "rsi", value: 60 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("rsi");
      expect(result.reachable).toBe(true);
      expect(result.method).toMatch(/binary_search/);
      expect(result.results.price0050).toBeGreaterThan(currentPrice0050);
    });

    it("ma20: 線性解析求解", async () => {
      // mock closeArr 最後 20 筆約 193-194，MA20 約 193.5
      // 使用合理的目標均線值
      const result = await runReverseEngine({
        target: { type: "ma20", value: 193.5 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("ma20");
      expect(result.reachable).toBe(true);
      expect(result.method).toBe("analytical");
      expect(result.results.priceZ2).toBe(currentPriceZ2); // Z2 固定
    });

    it("ma60: 線性解析求解", async () => {
      // mock closeArr 最後 60 筆約 189-195，MA60 約 192
      const result = await runReverseEngine({
        target: { type: "ma60", value: 192 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("ma60");
      expect(result.reachable).toBe(true);
      expect(result.method).toBe("analytical");
    });

    it("ma240Bias: 分級 Fallback 估算 + 驗證", async () => {
      const result = await runReverseEngine({
        target: { type: "ma240Bias", value: 10 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("ma240Bias");
      expect(result.reachable).toBe(true);
      expect(result.method).toMatch(/analytical/);
    });
  });

  describe("掃描型目標", () => {
    it("kdCross: golden 掃描", async () => {
      const result = await runReverseEngine({
        target: { type: "kdCross", direction: "golden" },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("kdCross");
      expect(result.target.direction).toBe("golden");
      expect(result.method).toBe("scan");
      expect(result.results).toBeDefined();
    });

    it("kdCross: dead 掃描", async () => {
      const result = await runReverseEngine({
        target: { type: "kdCross", direction: "dead" },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.direction).toBe("dead");
      expect(result.method).toBe("scan");
    });

    it("macdCross: golden 掃描", async () => {
      const result = await runReverseEngine({
        target: { type: "macdCross", direction: "golden" },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("macdCross");
      expect(result.method).toBe("scan");
    });

    it("strategyScore: 掃描", async () => {
      const result = await runReverseEngine({
        target: { type: "strategyScore", value: 70 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("strategyScore");
      expect(result.method).toBe("scan");
    });

    it("portfolioHealth: AND 邏輯掃描", async () => {
      const result = await runReverseEngine({
        target: { type: "portfolioHealth", status: "green" },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.target.type).toBe("portfolioHealth");
      expect(result.target.status).toBe("green");
      expect(result.method).toBe("scan");
    });
  });

  describe("不可達處理", () => {
    it("目標超出掃描範圍回傳 reachable: false", async () => {
      // 策略分數 200 不可能達成
      const result = await runReverseEngine({
        target: { type: "strategyScore", value: 200 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.reachable).toBe(false);
      expect(result.method).toBe("scan");
      expect(result.reason).toBeDefined();
      expect(result.closestResult).toBeDefined();
    });

    it("RSI 目標超出範圍回傳不可達", async () => {
      // 使用極端目標，在 ±30% 範圍內無法達成
      // mock: RSI = 50 + priceDiff * 0.5
      // ±30% 價格範圍: 175 * 0.7 = 122.5 到 175 * 1.3 = 227.5
      // 最低價格 122.5 -> priceDiff = -52.5 -> RSI = 50 - 26.25 = 23.75
      // 所以 RSI 5 在 ±30% 內不可達
      const result = await runReverseEngine({
        target: { type: "rsi", value: 5 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.reachable).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("計算模式標記", () => {
    it("解析解標記為 REVERSE_ANALYTICAL", async () => {
      const result = await runReverseEngine({
        target: { type: "maintenanceRatio", value: 150 },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.calculationMode).toBe("reverse_analytical");
    });

    it("掃描解標記為 REVERSE_SCAN", async () => {
      const result = await runReverseEngine({
        target: { type: "kdCross", direction: "golden" },
        simulationInput: mockSimulationInput,
        forwardSimulator: mockForwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      });

      expect(result.calculationMode).toBe("reverse_scan");
    });
  });

  describe("錯誤處理", () => {
    it("不支援的目標類型拋出錯誤", async () => {
      await expect(
        runReverseEngine({
          target: { type: "unknownType" },
          simulationInput: mockSimulationInput,
          forwardSimulator: mockForwardSimulator,
          currentPrice0050,
          currentPriceZ2,
        }),
      ).rejects.toThrow("不支援的目標類型");
    });
  });
});
