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
    p1Balance: 450000,
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
      expect(result.constraints.pauseP1).toBe(false);
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
      expect(result.constraints.pauseP1).toBe(true);
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
      expect(result.constraints.pauseP1).toBe(false);
      expect(result.p1Allocation0050.allowed).toBe(true);
      expect(result.p1Allocation0050.allocatedAmount).toBe(150000); // 45 萬 * 1/3
      expect(result.telegramCard).toContain("籌碼沉澱偵測器");
      expect(result.telegramCard).toContain("0050 建議加碼");
    });

    it("TC-04: 個人維持率斷路器觸發時 (維持率 < 160%)，強制凌駕外部雷達並凍結 P1", () => {
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
        p1Balance: 450000,
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
      expect(result.constraints.pauseP1).toBe(true); // 被強制凍結！
      expect(result.constraints.freeze00675L).toBe(true);
      expect(result.p1Allocation0050.allowed).toBe(false);
      expect(result.telegramCard).toContain("個人維持率斷路器觸發");
    });
  });

  describe("4.2 Telegram 警報卡片格式化 (formatLeadingIndicatorTelegramCard)", () => {
    it("遵循 F-7「1 行摘要 + 詳情卡 + P1 餘額行」結構輸出", () => {
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
          pauseP1: true,
          p0Exempt: true,
        },
        p1Balance: 450000,
        usedBatches: 0,
      });

      // 檢查 F-7 規範
      expect(card).toContain("🚨【極端雷達矩陣警報】");
      expect(card).toContain("├─ 詳情卡");
      expect(card).toContain(
        "├─ 🛡 行動紀律：00675L 禁止買入 | 0050 暫緩左側 | P0 定期定額正常執行",
      );
      expect(card).toContain(
        "└─ 💰 P1 預備金餘額：450,000 元（本波已動用：0 / 3 批）",
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
          pauseP1: false,
          p0Exempt: true,
        },
        p1Balance: 300000,
        usedBatches: 1,
      });

      expect(card).toContain("📊【系統長期防禦模式】已持續 21 日");
    });
  });
});
