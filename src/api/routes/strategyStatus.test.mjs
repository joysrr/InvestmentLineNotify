// src/api/routes/strategyStatus.test.mjs
// TDD: Strategy Status Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("../../domain/ilnState.mjs", () => ({
  loadStateFromLatestFiles: vi.fn(),
}));

vi.mock("../../modules/strategy/lifecycleEngine.mjs", () => ({
  determineLifecycleStage: vi.fn((years) => (years > 10 ? "EARLY" : "LATE")),
  LIFECYCLE_STAGE: { EARLY: "EARLY", MID: "MID", LATE: "LATE" },
}));

import strategyStatusRoute from "./strategyStatus.mjs";
import { loadStateFromLatestFiles } from "../../domain/ilnState.mjs";
import { determineLifecycleStage } from "../../modules/strategy/lifecycleEngine.mjs";

describe("strategyStatusRoute - 策略狀態 API", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    app = Fastify({ logger: false });
    await app.register(strategyStatusRoute);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /strategy-status", () => {
    it("無 state 回傳 404", async () => {
      loadStateFromLatestFiles.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("not available");
    });

    it("完整 state 回傳所有區塊", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: {
          weightDetails: {
            dropScore: 1.5,
            rsiScore: 2.0,
            macdScore: 1.0,
            kdScore: 0.5,
            sentimentScore: 0.8,
          },
          weightScore: 5.8,
          score: 5.8,
          cooldownStatus: {
            inCooldown: false,
            daysLeft: 0,
            lastBuyDate: null,
            message: "無冷卻期",
          },
          budgetInfo: { tier: "A", used: 100000 },
          budgetAllowedAmount: 500000,
          budgetIsLimited: false,
          budgetLimitedReason: null,
          signalCategory: "tactical",
          signalType: "buy",
          signalDirection: "long",
          target: "0050",
          suggestion: "建議買入",
          regimeState: { lifecycleStageEn: "EARLY" },
          regimeResult: { state: "NORMAL" },
          maintenanceRisk: {},
          grossLeverageResult: {},
          maintenanceMargin: 0.3,
          grossLeverage: 1.2,
          valuationGuardResult: { currentPR: 1.1 },
          valuationMomentumResult: {},
          panicBypassActive: false,
          trailingActive: false,
          netAsset: 1000000,
          actualLeverage: 1.1,
          z2Ratio: 0.5,
          date: "2024-01-15",
        },
        strategySnapshot: {
          allocation: [
            { minScore: 0, leverage: 0.15, cash: 0.85, comment: "底倉" },
            { minScore: 3, leverage: 0.5, cash: 0.5, comment: "戰術倉" },
            { minScore: 6, leverage: 1.0, cash: 0.0, comment: "全倉" },
          ],
          buy: { minWeightScoreToBuy: 3 },
          scoringMatrix: {
            thresholds: { buyTactical: 4, buyTacticalBullish: 1.5 },
          },
          lifecycle: {
            currentAge: 35,
            retirementAge: 65,
            profiles: {
              EARLY: {
                maxLeverage: 2.0,
                maxLeverageForNewZ2: 1.5,
                minSurvivalDropLimit: 140,
                mode: "aggressive",
              },
            },
          },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.timestamp).toBeDefined();
      expect(body.reportDate).toBe("2024-01-15");

      // weightScore breakdown
      expect(body.weightScore.dropScore).toBe(1.5);
      expect(body.weightScore.rsiScore).toBe(2.0);
      expect(body.weightScore.total).toBe(5.3);

      // cooldown
      expect(body.cooldown.inCooldown).toBe(false);
      expect(body.cooldown.daysLeft).toBe(0);

      // allocation
      expect(body.allocation.current.leverage).toBe(0.5); // currentScore 5.8 >= 3，當前檔位
      // targetAllocation 也是 0.5（同一檔位，因為 5.8 < 6），所以 next 為 null
      expect(body.allocation.next).toBeNull();

      // scoring
      expect(body.scoring.currentScore).toBe(5.8);
      expect(body.scoring.minScoreToBuy).toBe(3);

      // budget
      expect(body.budget.isLimited).toBe(false);
      expect(body.budget.allowedAmount).toBe(500000);

      // signal
      expect(body.signal.category).toBe("tactical");
      expect(body.signal.type).toBe("buy");
      expect(body.signal.direction).toBe("long");

      // lifecycle
      expect(body.lifecycle.stage).toBe("EARLY");
      expect(body.lifecycle.yearsToRetirement).toBe(30);

      // lifecycleProfile
      expect(body.lifecycleProfile.maxLeverage).toBe(2.0);
      expect(body.lifecycleProfile.mode).toBe("aggressive");

      // risk
      expect(body.risk.regime).toBe("NORMAL");
      expect(body.risk.maintenanceMargin).toBe(0.3);

      // keyMetrics
      expect(body.keyMetrics.maintenanceMargin).toBe(0.3);
      expect(body.keyMetrics.grossLeverage).toBe(1.2);
    });

    it("total 與細項一致（MAX 公式：dropScore + MAX(rsiScore, kdScore) + macdScore + sentimentScore）", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: {
          weightDetails: {
            dropScore: 1.5,
            rsiScore: 2.0,
            macdScore: 1.0,
            kdScore: 0.5,
            sentimentScore: 0.8,
          },
          weightScore: 5.8, // 狀態中直接給定的值，與 MAX 公式計算結果不一致
          score: 5.8,
          cooldownStatus: {
            inCooldown: false,
            daysLeft: 0,
            lastBuyDate: null,
            message: "無冷卻期",
          },
          budgetInfo: { tier: "A", used: 100000 },
          budgetAllowedAmount: 500000,
          budgetIsLimited: false,
          budgetLimitedReason: null,
          signalCategory: "tactical",
          signalType: "buy",
          signalDirection: "long",
          target: "0050",
          suggestion: "建議買入",
          regimeState: { lifecycleStageEn: "EARLY" },
          regimeResult: { state: "NORMAL" },
          maintenanceRisk: {},
          grossLeverageResult: {},
          maintenanceMargin: 0.3,
          grossLeverage: 1.2,
          valuationGuardResult: { currentPR: 1.1 },
          valuationMomentumResult: {},
          panicBypassActive: false,
          trailingActive: false,
          netAsset: 1000000,
          actualLeverage: 1.1,
          z2Ratio: 0.5,
          date: "2024-01-15",
        },
        strategySnapshot: {
          allocation: [
            { minScore: 0, leverage: 0.15, cash: 0.85, comment: "底倉" },
            { minScore: 3, leverage: 0.5, cash: 0.5, comment: "戰術倉" },
            { minScore: 6, leverage: 1.0, cash: 0.0, comment: "全倉" },
          ],
          buy: { minWeightScoreToBuy: 3 },
          scoringMatrix: {
            thresholds: { buyTactical: 4, buyTacticalBullish: 1.5 },
          },
          lifecycle: {
            currentAge: 35,
            retirementAge: 65,
            profiles: {
              EARLY: {
                maxLeverage: 2.0,
                maxLeverageForNewZ2: 1.5,
                minSurvivalDropLimit: 140,
                mode: "aggressive",
              },
            },
          },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // total 應按 MAX 公式重新計算：1.5 + MAX(2.0, 0.5) + 1.0 + 0.8 = 5.3
      expect(body.weightScore.total).toBe(5.3);
    });

    it("缺少 signals 使用預設值", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: {},
        strategySnapshot: {},
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.weightScore.total).toBe(0);
      expect(body.cooldown.inCooldown).toBe(false);
      expect(body.signal.category).toBe("baseline");
      expect(body.lifecycle.stage).toBe("EARLY");
    });

    it("無 lifecycle.currentAge 回傳 null yearsToRetirement", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: { regimeState: {} },
        strategySnapshot: { lifecycle: {} },
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.lifecycle.yearsToRetirement).toBeNull();
      expect(body.lifecycle.currentAge).toBeNull();
    });

    it("currentScore 決定 targetAllocation", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: { score: 8 },
        strategySnapshot: {
          allocation: [
            { minScore: 0, leverage: 0.15 },
            { minScore: 3, leverage: 0.5 },
            { minScore: 6, leverage: 1.0 },
          ],
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // currentScore 8 >= 6，currentAllocation 應為 leverage 1.0
      expect(body.allocation.current.leverage).toBe(1.0);
      // 沒有更高檔位，next 為 null
      expect(body.allocation.next).toBeNull();
    });

    it("determineLifecycleStage 被呼叫", async () => {
      loadStateFromLatestFiles.mockResolvedValue({
        signals: { regimeState: {} },
        strategySnapshot: { lifecycle: { currentAge: 40, retirementAge: 65 } },
      });

      await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(determineLifecycleStage).toHaveBeenCalledWith(25); // 65 - 40 = 25
    });

    it("異常回傳 500", async () => {
      loadStateFromLatestFiles.mockRejectedValue(new Error("Load failed"));

      const response = await app.inject({
        method: "GET",
        url: "/strategy-status",
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
