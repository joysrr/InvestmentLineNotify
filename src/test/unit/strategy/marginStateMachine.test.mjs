import { describe, it, expect } from "vitest";
import {
  SYSTEM_STATES,
  evaluatePersonalMarginBreaker,
  transitionLeadingIndicatorState,
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
      expect(result.constraints.p0Exempt).toBe(true); // P0 定期定額持續豁免
      expect(result.cardSummary).toContain("個人維持率斷路器");
      expect(result.cardSummary).toContain("153.3%");
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
});
