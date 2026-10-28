import { describe, it, expect } from "vitest";
import {
  evaluateLeadingIndicators,
  formatLeadingIndicatorTelegramCard,
} from "../../../modules/strategy/leadingIndicatorEvaluator.mjs";
import { SYSTEM_STATES } from "../../../modules/strategy/marginStateMachine.mjs";

describe("Phase 4: Leading Indicator Evaluator & Telegram Card Formatter", () => {
  const mockCleanMarketData = {
    // 雷達 1
    rSox: -0.01,
    rTsm: -0.008,
    rNight: -0.002,
    soxHistory: [],
    tsmHistory: [],
    // 雷達 2
    maintenanceRatio: 165.0,
    marginBalanceChangePct: -0.002,
    marginHistory: [],
    // 雷達 3
    vix: 18.0,
    taiexReturn: -0.005,
    bias60: -0.02,
    vixHistory: [],
    // 雷達 4
    rsr: 5.0,
    rsrHistory: [],
  };

  const mockSafePortfolio = {
    totalAssets: 3500000,
    totalLiabilities: 1500000, // 維持率 233.3% >= 160%
    netAssetValue: 2000000,
    currentExposure: 3000000,
  };

  describe("4.1 策略引擎整合四大雷達 (evaluateLeadingIndicators)", () => {
    it("TC-01: 常態市況且無雷達觸發時，保持 IDLE 與常態靜默", () => {
      const result = evaluateLeadingIndicators({
        marketData: mockCleanMarketData,
        portfolio: mockSafePortfolio,
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
      });

      expect(result.hasAnyRadarTriggered).toBe(false);
      expect(result.stateMachine.state).toBe(SYSTEM_STATES.IDLE);
      expect(result.constraints.freeze00675L).toBe(false);
      expect(result.constraints.allowLeft0050).toBe(false);
      expect(result.constraints.p0Exempt).toBe(true);
      expect(result.triggeredRadars).toHaveLength(0);
      expect(result.telegramCard).toBeNull(); // 常態靜默
    });

    it("缺少夜盤資料時標記不可用，不將來源不可用誤判為正常", () => {
      const result = evaluateLeadingIndicators({
        marketData: {
          ...mockCleanMarketData,
          rNight: null,
          nightDataStatus: "UNAVAILABLE",
        },
        portfolio: mockSafePortfolio,
      });

      expect(result.radars.overnightShock.metrics.rNight).toBeNull();
      expect(result.radars.overnightShock.metrics.dataStatus).toBe(
        "UNAVAILABLE",
      );
    });

    it("缺少 RSR 時保留 null，不轉成 0", () => {
      const result = evaluateLeadingIndicators({
        marketData: {
          ...mockCleanMarketData,
          rsr: null,
          retailSentimentDataStatus: "SOURCE_UNAVAILABLE",
        },
        portfolio: mockSafePortfolio,
      });

      expect(result.radars.retailSentiment.metrics.rsr).toBeNull();
      expect(result.radars.retailSentiment.metrics.dataStatus).toBe(
        "SOURCE_UNAVAILABLE",
      );
    });

    it("TC-02: 雷達 1 隔夜衝擊觸發時，狀態轉入 TRIGGERED，凍結 00675L 並暫緩 P1", () => {
      const shockMarketData = {
        ...mockCleanMarketData,
        rSox: -0.045, // 極端重挫
        rTsm: -0.042,
        rNight: -0.015, // 夜盤強共振
      };

      const result = evaluateLeadingIndicators({
        marketData: shockMarketData,
        portfolio: mockSafePortfolio,
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
      });

      expect(result.hasAnyRadarTriggered).toBe(true);
      expect(result.stateMachine.state).toBe(SYSTEM_STATES.TRIGGERED);
      expect(result.constraints.freeze00675L).toBe(true);
      expect(result.constraints.p0Exempt).toBe(true);
      expect(result.triggeredRadars).toHaveLength(1);
      expect(result.telegramCard).not.toBeNull();
      expect(result.telegramCard).toContain("美股隔夜衝擊");
    });

    it("TC-03: 雷達 2 籌碼沉澱觸發時，啟動 0050 左側分批布局並計算加碼金額", () => {
      const marginCrashMarketData = {
        ...mockCleanMarketData,
        maintenanceRatio: 136.0, // < 140%
        marginBalanceChangePct: -0.02, // <= -1.5%
      };

      const result = evaluateLeadingIndicators({
        marketData: marginCrashMarketData,
        portfolio: mockSafePortfolio,
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
      });

      expect(result.hasAnyRadarTriggered).toBe(true);
      expect(result.constraints.allowLeft0050).toBe(true);
      expect(result.constraints.freeze00675L).toBe(true);
      expect(result.telegramCard).toContain("籌碼沉澱偵測器");
      expect(result.telegramCard).toContain("0050 啟動左側布局");
    });

    it("TC-04: 個人維持率斷路器觸發時 (維持率 < 160%)，強制凌駕外部雷達並封鎖加碼", () => {
      const marginCrashMarketData = {
        ...mockCleanMarketData,
        maintenanceRatio: 136.0,
        marginBalanceChangePct: -0.02,
      };

      const dangerousPortfolio = {
        totalAssets: 2300000,
        totalLiabilities: 1500000, // 230 / 150 = 153.3% < 160%
        netAssetValue: 800000,
        currentExposure: 2000000,
      };

      const result = evaluateLeadingIndicators({
        marketData: marginCrashMarketData,
        portfolio: dangerousPortfolio,
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
      });

      expect(result.personalBreaker.breakerTriggered).toBe(true);
      expect(result.constraints.allowLeft0050).toBe(false); // 被強制封鎖！
      expect(result.constraints.freeze00675L).toBe(true);
      expect(result.telegramCard).toContain("個人維持率斷路器觸發");
    });

    it("帳戶淨資產與 cash 存在時，回傳 cashExposureAnalysis 行動建議", () => {
      const result = evaluateLeadingIndicators({
        marketData: {
          ...mockCleanMarketData,
          kellyConservative: 1.6,
        },
        portfolio: {
          ...mockSafePortfolio,
          cash: 200000,
          accountNetAsset: 2000000,
        },
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
      });

      expect(result.cashExposureAnalysis.status).toBe("RECOMMEND_DCA");
      expect(result.cashExposureAnalysis.exposureGap).toBe(200000);
      expect(result.cashExposureAnalysis.suggestedDcaAmt).toBe(100000);
      expect(result.cashExposureAnalysis.cashAdequacy).toBe(true);
    });
  });

  describe("4.2 Telegram 警報卡片格式化 (formatLeadingIndicatorTelegramCard)", () => {
    it("遵循「1 行摘要 + 詳情卡 + 行動紀律行」結構輸出", () => {
      const card = formatLeadingIndicatorTelegramCard({
        state: SYSTEM_STATES.TRIGGERED,
        activeDays: 1,
        triggeredRadars: [
          {
            radarId: "OVERNIGHT_SHOCK",
            cardSummary: "🚨【隔夜衝擊：強共振】費半重挫 -4.5%，夜盤跌 -1.5%。",
          },
          {
            radarId: "RETAIL_SENTIMENT",
            cardSummary:
              "🚨【散戶多空對決：多殺多崩跌警報】小台散戶多空比衝高至 +34.2%。",
          },
        ],
        personalBreaker: { breakerTriggered: false },
        constraints: {
          freeze00675L: true,
          allowLeft0050: false,
          p0Exempt: true,
        },
      });

      // 檢查規範
      expect(card).toContain("🚨【極端雷達矩陣警報】");
      expect(card).toContain("├─ 詳情卡");
      expect(card).toContain(
        "├─ 🛡 行動紀律：00675L 禁止買入 | 0050 暫緩左側 | P0 定期定額正常執行",
      );
    });

    it("連續 20 日非 IDLE 時附帶 F-10 長期防禦模式提示", () => {
      const card = formatLeadingIndicatorTelegramCard({
        state: SYSTEM_STATES.COOLDOWN,
        activeDays: 21,
        isLongTermDefense: true,
        triggeredRadars: [],
        personalBreaker: { breakerTriggered: false },
        constraints: {
          freeze00675L: true,
          allowLeft0050: false,
          p0Exempt: true,
        },
      });

      expect(card).toContain("📊【系統長期防禦模式】已持續 21 日");
    });

    it("cashExposureAnalysis 存在時，卡片底部附帶現金/曝險摘要行", () => {
      const card = formatLeadingIndicatorTelegramCard({
        state: SYSTEM_STATES.IDLE,
        activeDays: 0,
        isLongTermDefense: false,
        triggeredRadars: [],
        personalBreaker: { breakerTriggered: false },
        constraints: {
          freeze00675L: false,
          allowLeft0050: true,
          p0Exempt: true,
        },
        cashExposureAnalysis: {
          status: "RECOMMEND_DCA",
          suggestedDcaAmt: 100000,
          exposureGap: 500000,
          targetExposure: 1500000,
          cashAdequacy: true,
          message:
            "現金充足且市場正常，建議本次 DCA $100,000（曝險缺口 $500,000）",
        },
      });

      expect(card).toContain("💰");
      expect(card).toContain("現金");
      expect(card).toContain("建議 DCA $100000");
      expect(card).toContain("曝險缺口 $500000");
    });
  });
});
