// src/modules/simulator/analyticalSolvers.test.mjs
// TDD: 解析型反向推導測試

import { describe, it, expect, beforeEach } from "vitest";
import {
  solvePriceForMaintenanceRatio,
  solvePriceForMA,
  solvePriceForMA240Bias,
} from "./analyticalSolvers.mjs";

describe("analyticalSolvers - 解析型反向推導", () => {
  const mockPortfolio = {
    qty0050: 10000,
    qtyZ2: 5000,
    cash: 50000,
    totalLoan: 800000,
  };
  const currentPrice0050 = 175;
  const currentPriceZ2 = 116.5;
  const priceRatio = currentPriceZ2 / currentPrice0050;

  describe("solvePriceForMaintenanceRatio - 維持率反推", () => {
    it("同比例聯動模式：正常求解", () => {
      // 目標維持率 150%
      // netAsset = 150/100 * 800000 = 1,200,000
      // p = (1200000 - 50000 + 800000) / (10000 + 5000 * 0.6657)
      //   = 1950000 / 13328.5 ≈ 146.3
      const result = solvePriceForMaintenanceRatio(
        150,
        mockPortfolio,
        currentPriceZ2,
        currentPrice0050,
        true,
      );

      expect(result.achievable).toBe(true);
      expect(result.price0050).toBeGreaterThan(0);
      expect(result.priceZ2).toBeCloseTo(result.price0050 * priceRatio, 1);
    });

    it("Z2 固定模式：正常求解", () => {
      const result = solvePriceForMaintenanceRatio(
        150,
        mockPortfolio,
        currentPriceZ2,
        currentPrice0050,
        false,
      );

      expect(result.achievable).toBe(true);
      expect(result.priceZ2).toBe(currentPriceZ2);
    });

    it("總融資為 0 時不可達", () => {
      const result = solvePriceForMaintenanceRatio(
        150,
        { ...mockPortfolio, totalLoan: 0 },
        currentPriceZ2,
        currentPrice0050,
        true,
      );

      expect(result.achievable).toBe(false);
      expect(result.reason).toContain("融資");
    });

    it("0050 持股為 0 時不可達", () => {
      const result = solvePriceForMaintenanceRatio(
        150,
        { ...mockPortfolio, qty0050: 0 },
        currentPriceZ2,
        currentPrice0050,
        true,
      );

      expect(result.achievable).toBe(false);
      expect(result.reason).toContain("持股");
    });

    it("目標維持率極高導致價格異常", () => {
      // 目標 1000% 維持率
      const result = solvePriceForMaintenanceRatio(
        1000,
        mockPortfolio,
        currentPriceZ2,
        currentPrice0050,
        true,
      );

      // 應該能解出但價格極高
      expect(result.achievable).toBe(true);
      expect(result.price0050).toBeGreaterThan(500); // 調整為合理期望
    });
  });

  describe("solvePriceForMA - 均線反推", () => {
    const closeArr = Array.from({ length: 100 }, (_, i) => 170 + i * 0.1);

    it("MA20 正常求解", () => {
      // 前 19 筆總和
      const prev19 = closeArr.slice(-20, -1);
      const sumPrev = prev19.reduce((a, b) => a + b, 0);
      const targetMA20 = 180;
      // 期望價格 = 180 * 20 - sumPrev

      const result = solvePriceForMA(targetMA20, closeArr, 20);

      expect(result.achievable).toBe(true);
      expect(result.price0050).toBe(targetMA20 * 20 - sumPrev);
    });

    it("MA60 正常求解", () => {
      // closeArr 最後 60 筆約 174-179.9，MA60 約 177
      // 使用合理的目標均線值
      const result = solvePriceForMA(177, closeArr, 60);

      expect(result.achievable).toBe(true);
      expect(result.price0050).toBeGreaterThan(0);
    });

    it("資料不足 20 筆時不可達", () => {
      const shortArr = [170, 171, 172]; // 只有 3 筆
      const result = solvePriceForMA(180, shortArr, 20);

      expect(result.achievable).toBe(false);
      expect(result.reason).toContain("不足 20 筆");
    });

    it("資料不足 60 筆時 MA60 不可達", () => {
      const shortArr = Array.from({ length: 50 }, (_, i) => 170 + i);
      const result = solvePriceForMA(180, shortArr, 60);

      expect(result.achievable).toBe(false);
    });

    it("空陣列不可達", () => {
      const result = solvePriceForMA(180, [], 20);
      expect(result.achievable).toBe(false);
    });
  });

  describe("solvePriceForMA240Bias - MA240 偏離反推", () => {
    // 這個函式需要 forwardSimulator，在整合測試中驗證
    it("需要 forwardSimulator 參數", () => {
      // 確認函式簽名包含 forwardSimulator
      expect(typeof solvePriceForMA240Bias).toBe("function");
      expect(solvePriceForMA240Bias.length).toBeGreaterThanOrEqual(4);
    });
  });
});
