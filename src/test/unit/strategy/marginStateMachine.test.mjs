import { describe, it, expect } from "vitest";
import {
  SYSTEM_STATES,
  evaluatePersonalMarginBreaker,
  transitionLeadingIndicatorState,
  evaluateP1Allocation,
} from "../../../modules/strategy/marginStateMachine.mjs";

describe("Phase 2: Leading Indicator State Machine & Personal Margin Breaker", () => {
  describe("2.1 個人真實維持率最高級斷路器 (evaluatePersonalMarginBreaker)", () => {
    it("無負債時個人維持率為無窮大，斷路器不觸發 (安全)", () => {
      const result = evaluatePersonalMarginBreaker({
        totalAssets: 3000000,
        totalLiabilities: 0,
      });

      expect(result.breakerTriggered).toBe(false);
      expect(result.marginRatio).toBe(Infinity);
      expect(result.cardSummary).toBeNull();
    });

    it("個人維持率 >= 160% 時安全通過 (正常運作)", () => {
      const result = evaluatePersonalMarginBreaker({
        totalAssets: 3200000,
        totalLiabilities: 1800000, // 320 / 180 = 177.7%
      });

      expect(result.breakerTriggered).toBe(false);
      expect(result.marginRatio).toBeCloseTo(177.78, 1);
      expect(result.cardSummary).toBeNull();
    });

    it("個人維持率 < 160% 時觸發 P-1 最高優先級斷路器 (強制凍結 P1)", () => {
      const result = evaluatePersonalMarginBreaker({
        totalAssets: 2300000,
        totalLiabilities: 1500000, // 230 / 150 = 153.3% < 160%
      });

      expect(result.breakerTriggered).toBe(true);
      expect(result.marginRatio).toBeCloseTo(153.33, 1);
      expect(result.constraints.freeze00675L).toBe(true);
      expect(result.constraints.allowLeft0050).toBe(false); // 封鎖加碼
      expect(result.constraints.pauseP1).toBe(true); // 強制凍結一切 P1
      expect(result.constraints.p0Exempt).toBe(true); // P0 定期定額持續豁免
      expect(result.cardSummary).toContain("個人維持率斷路器");
      expect(result.cardSummary).toContain("153.3%");
      expect(result.cardSummary).toContain("強制凍結一切 P1");
    });
  });

  describe("2.2 狀態機狀態流轉 (transitionLeadingIndicatorState)", () => {
    it("TC-01: 常態 IDLE 無雷達觸發時維持 IDLE", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
        hasAnyRadarTriggered: false,
      });

      expect(next.state).toBe(SYSTEM_STATES.IDLE);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(0);
    });

    it("TC-02: IDLE 下任一雷達觸發，進入 TRIGGERED (第一日)", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.IDLE,
        cooldownDays: 0,
        activeDays: 0,
        hasAnyRadarTriggered: true,
      });

      expect(next.state).toBe(SYSTEM_STATES.TRIGGERED);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(1);
    });

    it("TC-03: TRIGGERED 隔日無雷達觸發，進入 COOLDOWN (計數 1)", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.TRIGGERED,
        cooldownDays: 0,
        activeDays: 1,
        hasAnyRadarTriggered: false,
      });

      expect(next.state).toBe(SYSTEM_STATES.COOLDOWN);
      expect(next.cooldownDays).toBe(1);
      expect(next.activeDays).toBe(2);
    });

    it("TC-04: TRIGGERED 隔日仍有雷達觸發，轉入 CONTINUOUS_SHOCK", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.TRIGGERED,
        cooldownDays: 0,
        activeDays: 1,
        hasAnyRadarTriggered: true,
      });

      expect(next.state).toBe(SYSTEM_STATES.CONTINUOUS_SHOCK);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(2);
    });

    it("TC-05 (F-1): CONTINUOUS_SHOCK 下隔日無雷達觸發 (衝擊平息)，轉入 COOLDOWN", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.CONTINUOUS_SHOCK,
        cooldownDays: 0,
        activeDays: 3,
        hasAnyRadarTriggered: false,
      });

      expect(next.state).toBe(SYSTEM_STATES.COOLDOWN);
      expect(next.cooldownDays).toBe(1); // 重新起算 5 日
      expect(next.activeDays).toBe(4);
    });

    it("TC-06: CONTINUOUS_SHOCK 下隔日仍有雷達觸發，維持 CONTINUOUS_SHOCK", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.CONTINUOUS_SHOCK,
        cooldownDays: 0,
        activeDays: 3,
        hasAnyRadarTriggered: true,
      });

      expect(next.state).toBe(SYSTEM_STATES.CONTINUOUS_SHOCK);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(4);
    });

    it("TC-07 (F-8): COOLDOWN 期間再次有雷達觸發，重新轉入 CONTINUOUS_SHOCK", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.COOLDOWN,
        cooldownDays: 2,
        activeDays: 4,
        hasAnyRadarTriggered: true,
      });

      expect(next.state).toBe(SYSTEM_STATES.CONTINUOUS_SHOCK);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(5);
    });

    it("TC-08: COOLDOWN 期間連續 5 日無雷達觸發，安全回歸 IDLE", () => {
      // 第 4 天 COOLDOWN -> 第 5 天無觸發 -> 回歸 IDLE
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.COOLDOWN,
        cooldownDays: 4,
        activeDays: 6,
        hasAnyRadarTriggered: false,
      });

      expect(next.state).toBe(SYSTEM_STATES.IDLE);
      expect(next.cooldownDays).toBe(0);
      expect(next.activeDays).toBe(0);
    });

    it("TC-09 (F-10): 連續 20 個交易日處於非 IDLE 狀態，標記長期防禦模式", () => {
      const next = transitionLeadingIndicatorState({
        currentState: SYSTEM_STATES.COOLDOWN,
        cooldownDays: 3,
        activeDays: 19, // 進入第 20 天
        hasAnyRadarTriggered: false,
      });

      expect(next.state).toBe(SYSTEM_STATES.COOLDOWN);
      expect(next.activeDays).toBe(20);
      expect(next.isLongTermDefense).toBe(true);
    });
  });

  describe("2.3 0050/00675L P1 加碼預案與動態 GL 檢算 (evaluateP1Allocation)", () => {
    const defaultPortfolio = {
      netAssetValue: 2000000, // 淨資產 200 萬
      currentExposure: 3000000, // 當前總曝險 300 萬 (當前 GL = 1.5x)
      p1Balance: 450000, // P1 餘額 45 萬
    };

    it("TC-10: 0050 正常單批加碼 (1/3 餘額 = 15 萬，加碼後 GL = 1.575x <= 2.5x)", () => {
      const alloc = evaluateP1Allocation({
        targetAsset: "0050",
        portfolio: defaultPortfolio,
        isExtremePanic: false,
      });

      expect(alloc.allowed).toBe(true);
      expect(alloc.allocatedAmount).toBe(150000);
      expect(alloc.expectedGL).toBeCloseTo(1.575, 2);
    });

    it("TC-11 (F-9): 0050 加碼金額受 GL 2.5x 硬上限約束自動下修", () => {
      // 假設當前曝險已達 480 萬，淨資產 200 萬 (當前 GL = 2.4x)
      // 若加 15 萬 -> 總曝險 495 萬 / 200 萬 = 2.475x (OK)
      // 若當前曝險 490 萬 (GL = 2.45x)，加 15 萬 -> 505 萬 (GL = 2.525x 超標)
      // 允許的最大金額 = 200 萬 * 2.5 - 490 萬 = 10 萬
      const alloc = evaluateP1Allocation({
        targetAsset: "0050",
        portfolio: {
          netAssetValue: 2000000,
          currentExposure: 4900000,
          p1Balance: 450000,
        },
        isExtremePanic: false,
      });

      expect(alloc.allowed).toBe(true);
      expect(alloc.allocatedAmount).toBe(100000); // 自動下修至恰好 2.5x
      expect(alloc.expectedGL).toBeCloseTo(2.5, 2);
    });

    it("TC-12 (逆週期豁免): 極度恐慌 (雷達 3) 下 0050 GL 上限放寬至 2.7x", () => {
      // 當前曝險 490 萬，淨資產 200 萬
      // 在 2.7x 逆週期豁免下，上限可達 540 萬，因此 15 萬可全額打入！
      const alloc = evaluateP1Allocation({
        targetAsset: "0050",
        portfolio: {
          netAssetValue: 2000000,
          currentExposure: 4900000,
          p1Balance: 450000,
        },
        isExtremePanic: true, // 雷達 3 極度恐慌
      });

      expect(alloc.allowed).toBe(true);
      expect(alloc.allocatedAmount).toBe(150000);
      expect(alloc.expectedGL).toBeCloseTo(2.525, 2);
    });

    it("TC-13 (F-3): 00675L 右側加碼動態反推 (2x 槓桿受 GL 2.3x 緩衝約束)", () => {
      // 淨資產 200 萬，當前曝險 440 萬 (GL = 2.2x)
      // 2.3x 允許總曝險 = 460 萬，剩餘曝險空間 = 20 萬
      // 因 00675L 為 2x 槓桿，允許現貨金額 = 20 萬 / 2 = 10 萬 (< 15 萬)
      const alloc = evaluateP1Allocation({
        targetAsset: "00675L",
        portfolio: {
          netAssetValue: 2000000,
          currentExposure: 4400000,
          p1Balance: 450000,
        },
        isExtremePanic: false,
      });

      expect(alloc.allowed).toBe(true);
      expect(alloc.allocatedAmount).toBe(100000); // 動態下修至 10 萬
      expect(alloc.expectedGL).toBeCloseTo(2.3, 2);
    });

    it("TC-14 (F-3): 當前 GL 已達 2.3x 時，00675L 加碼金額為 0 (封鎖)", () => {
      const alloc = evaluateP1Allocation({
        targetAsset: "00675L",
        portfolio: {
          netAssetValue: 2000000,
          currentExposure: 4600000, // 460 / 200 = 2.3x
          p1Balance: 450000,
        },
        isExtremePanic: false,
      });

      expect(alloc.allowed).toBe(false);
      expect(alloc.allocatedAmount).toBe(0);
      expect(alloc.reason).toContain("GL 已達或超過 2.3x 緩衝上限");
    });

    it("TC-15: P1 餘額為 0 時標註無彈藥可用 (F-2)", () => {
      const alloc = evaluateP1Allocation({
        targetAsset: "0050",
        portfolio: {
          netAssetValue: 2000000,
          currentExposure: 2000000,
          p1Balance: 0,
        },
        isExtremePanic: false,
      });

      expect(alloc.allowed).toBe(false);
      expect(alloc.allocatedAmount).toBe(0);
      expect(alloc.reason).toContain("P1 餘額不足");
    });
  });
});
