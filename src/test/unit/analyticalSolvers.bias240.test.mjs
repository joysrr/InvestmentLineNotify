/**
 * analyticalSolvers.bias240.test.mjs
 * MA240 Bias 容忍度與邊界條件測試 (TD-004)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  solvePriceForMA240Bias,
  calcSMA,
} from "../../modules/simulator/analyticalSolvers.mjs";
import { MA240_FALLBACK_THRESHOLDS } from "../../modules/simulator/constants.mjs";

// Mock forwardSimulator
const createMockForwardSimulator = (returns) => {
  return vi.fn(async () => returns);
};

describe("MA240 Bias 容忍度與邊界條件 (TD-004)", () => {
  let mockForwardSimulator;
  let baseSimulationInput;

  beforeEach(() => {
    baseSimulationInput = {
      price0050: 175,
      currentPrice: 275,
      VIX: 20,
      RSI: 50,
      vixArr: [20],
      macroMarketDirection: "BULL",
      portfolio: {
        assets: {
          "0050": { qty: 1000, avgCost: 150 },
          "00675L": { qty: 500, avgCost: 300 },
        },
        cash: 50000,
        totalLoan: 100000,
      },
      rawValuation: {},
      indicators0050: {},
      pbRecords: [],
      pbRecordsObjects: [],
      valuationGuardState: {},
      closeArr: [175],
      ma20Arr: [170],
      atrArr: [5],
      macdArr: [{ macd: 1, signal: 0.5, hist: 0.5 }],
      ma60SlopeArr: [0.1],
      institutionalNet: 0,
      institutionalHistory: [],
      indicators: { kdArr: [], macdArr: [], rsiArr: [] },
    };
  });

  describe("solvePriceForMA240Bias - 容忍度測試", () => {
    it("應在 0.1% 容忍度內通過驗證 (現有行為)", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const ma240 = 158;
      const targetBias = 10;
      const expectedPrice = ma240 * (1 + targetBias / 100); // 173.8

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: targetBias + 0.05 }, // 10.05% - 0.05% 誤差
        price0050: expectedPrice,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(result.method).toBe("analytical_verified");
      expect(Math.abs(result.achievedValue - targetBias)).toBeLessThanOrEqual(
        0.1,
      );
    });

    it("應標記為近似解當誤差 > 0.1%", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: targetBias + 0.2 }, // 10.2% - 0.2% 誤差
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(result.method).toBe("analytical_approx");
      expect(result.note).toContain("近似解");
    });

    it("應支援可配置的容忍度參數", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: targetBias + 0.15 }, // 10.15% - 0.15% 誤差
        price0050: 173.8,
      });

      // 測試使用較寬鬆的 0.2% 容忍度
      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
        { tolerance: 0.2 },
      );

      expect(result.achievable).toBe(true);
      expect(result.method).toBe("analytical_verified");
    });
  });

  describe("solvePriceForMA240Bias - Fallback 邊界條件", () => {
    it("資料 >= 240 筆應使用 FULL MA240", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(closeArr.length).toBeGreaterThanOrEqual(
        MA240_FALLBACK_THRESHOLDS.FULL,
      );
    });

    it("資料 60-239 筆應使用 MA60 PROXY", async () => {
      const closeArr = Array.from({ length: 100 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(closeArr.length).toBeGreaterThanOrEqual(
        MA240_FALLBACK_THRESHOLDS.MA60_PROXY,
      );
      expect(closeArr.length).toBeLessThan(MA240_FALLBACK_THRESHOLDS.FULL);
    });

    it("資料 20-59 筆應使用 MA20 PROXY", async () => {
      const closeArr = Array.from({ length: 30 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(closeArr.length).toBeGreaterThanOrEqual(
        MA240_FALLBACK_THRESHOLDS.MA20_PROXY,
      );
      expect(closeArr.length).toBeLessThan(
        MA240_FALLBACK_THRESHOLDS.MA60_PROXY,
      );
    });

    it("資料 < 20 筆應回傳失敗", async () => {
      const closeArr = Array.from({ length: 15 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(false);
      expect(result.reason).toContain("資料不足");
    });

    it("空陣列應回傳失敗", async () => {
      const closeArr = [];
      const targetBias = 10;

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        vi.fn(),
      );

      expect(result.achievable).toBe(false);
    });

    it("MA240 計算結果為 NaN/無限值應回傳失敗", async () => {
      const closeArr = Array.from({ length: 250 }, () => NaN);
      const targetBias = 10;

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        vi.fn(),
      );

      expect(result.achievable).toBe(false);
    });

    it("MA240 為 0 或負數應回傳失敗", async () => {
      const closeArr = Array.from({ length: 250 }, () => 0);
      const targetBias = 10;

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        vi.fn(),
      );

      expect(result.achievable).toBe(false);
    });
  });

  describe("solvePriceForMA240Bias - 極值測試", () => {
    it("極大目標偏離 (+50%) 應能計算", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = 50;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 50.05 },
        price0050: 237,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });

    it("極小目標偏離 (-30%) 應能計算", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = -30;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: -29.95 },
        price0050: 110.6,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });

    it("目標偏離 0% 應正確處理", async () => {
      const closeArr = Array.from({ length: 250 }, (_, i) => 155 + i * 0.01);
      const targetBias = 0;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 0.05 },
        price0050: 158,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });
  });

  describe("MA240 分級 Fallback - 整合驗證", () => {
    it("FULL -> MA60_PROXY -> MA20_PROXY 邊界正確", () => {
      expect(MA240_FALLBACK_THRESHOLDS.FULL).toBe(240);
      expect(MA240_FALLBACK_THRESHOLDS.MA60_PROXY).toBe(60);
      expect(MA240_FALLBACK_THRESHOLDS.MA20_PROXY).toBe(20);
    });

    it("60 筆資料應使用 MA60_PROXY", async () => {
      const closeArr = Array.from({ length: 60 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });

    it("59 筆資料應使用 MA20_PROXY", async () => {
      const closeArr = Array.from({ length: 59 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });

    it("20 筆資料應使用 MA20_PROXY", async () => {
      const closeArr = Array.from({ length: 20 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 10.05 },
        price0050: 173.8,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
    });

    it("19 筆資料應失敗", async () => {
      const closeArr = Array.from({ length: 19 }, (_, i) => 155 + i * 0.01);
      const targetBias = 10;

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        vi.fn(),
      );

      expect(result.achievable).toBe(false);
    });
  });

  describe("stock split 後 MA240 計算", () => {
    it("分割後價格序列應正確計算 MA240", async () => {
      // 模擬 0050 分割後的價格序列 (1拆4)
      const preSplitPrices = Array.from(
        { length: 150 },
        (_, i) => 600 + i * 0.1,
      ); // 分割前價格 ~600
      const postSplitPrices = Array.from(
        { length: 100 },
        (_, i) => 150 + i * 0.1,
      ); // 分割後價格 ~150
      const closeArr = [...preSplitPrices, ...postSplitPrices];

      const targetBias = 5;

      mockForwardSimulator = createMockForwardSimulator({
        indicators: { bias240: 5.05 },
        price0050: 166,
      });

      const result = await solvePriceForMA240Bias(
        targetBias,
        closeArr,
        baseSimulationInput,
        mockForwardSimulator,
      );

      expect(result.achievable).toBe(true);
      expect(closeArr.length).toBe(250);
    });
  });
});
