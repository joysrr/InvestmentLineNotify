import { describe, it, expect } from "vitest";
import {
  formatLeadingIndicatorTelegramCard,
  evaluateLeadingIndicators,
} from "../../../modules/strategy/leadingIndicatorEvaluator.mjs";
import { SYSTEM_STATES } from "../../../modules/strategy/marginStateMachine.mjs";

describe("Phase 4: Leading Indicator Evaluator & Telegram Card Formatter", () => {
  const mockCleanMarketData = {
    rSox: -0.01,
    rTsm: -0.008,
    rNight: -0.002,
    soxHistory: [],
    tsmHistory: [],
    maintenanceRatio: 165.0,
    marginBalanceChangePct: -0.002,
    marginHistory: [],
    vix: 18.0,
    taiexReturn: -0.005,
    bias60: -0.02,
    vixHistory: [],
    rsr: 5.0,
    rsrHistory: [],
  };

  const mockSafePortfolio = {
    totalAssets: 3500000,
    totalLiabilities: 1500000,
    netAssetValue: 2000000,
    grossExposure: 3000000,
  };

  describe("4.1 策略引擎整合四大雷達 (evaluateLeadingIndicators)", () => {
    it("TC-01: 常態市況且無雷達觸發時，保持 行動建議", () => {
      const result = evaluateLeadingIndicators({
        marketData: {
          ...mockCleanMarketData,
          kellyConservative: 1.6,
        },
        portfolio: {
          ...mockSafePortfolio,
          cash: 200000,
          accountNetAsset: 2000000,
          targetLeverage: 1.6,
        },
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.8 } },
      });

      expect(result.cashExposureAnalysis.status).toBe("RECOMMEND_DCA");
      expect(result.cashExposureAnalysis.exposureGap).toBe(200000);
      expect(result.cashExposureAnalysis.suggestedDcaAmt).toBe(100000);
      expect(result.cashExposureAnalysis.cashAdequacy).toBe(true);
    });
  });

  describe("4.2 Telegram 警報卡片格式化 (formatLeadingIndicatorTelegramCard)", () => {
    it("遵循「1 行摘要 + 行動紀律行 + 建議批次」結構輸出", () => {
      const card = formatLeadingIndicatorTelegramCard({
        state: SYSTEM_STATES.TRIGGERED,
        triggeredRadars: [
          {
            radarId: "EXTREME_PANIC",
          },
        ],
        personalBreaker: { breakerTriggered: false },
        constraints: { freeze00675L: false, allowLeft0050: true },
        cashExposureAnalysis: {
          status: "CRISIS_ACCUMULATE",
          suggestedDcaAmt: 50000,
          exposureGap: 500000,
          targetLeverage: 1.3,
          currentLeverage: 0.78,
        },
      });

      expect(card).toContain("🚨【極端雷達矩陣警報】");
      expect(card).toContain(
        "🛡 行動紀律：00675L 限速加碼 | 0050 啟動左側布局 | P0 定期定額正常執行",
      );
      expect(card).toContain("建議：本批加碼 00675L 上限 $50,000 TWD");
      expect(card).toContain("📱 細節：Mini App → 雷達監控 → 槓桿與批次計算");

      expect(card).not.toContain("詳情卡");
      expect(card).not.toContain("長期防禦模式");
      expect(card).not.toContain("複利耗損");
    });
  });
});
