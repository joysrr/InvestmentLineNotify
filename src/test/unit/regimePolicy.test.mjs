import { describe, it, expect } from "vitest";
import {
  determineRegime,
  applyRegimeLeverage,
  formatRegimeStatus,
} from "../../modules/strategy/regimePolicy.mjs";

describe("RegimePolicy Module", () => {
  describe("determineRegime", () => {
    const config = {
      vixOverrideTrigger: 28,
      vixAbsoluteOverride: 35,
      cautiousLeverageReductionPct: 25,
    };

    it("should return NORMAL when VIX < 28 and sentiment is not BEAR", () => {
      const result = determineRegime(20, "BULL", config);
      expect(result.state).to.equal("NORMAL");
      expect(result.leverageMultiplier).to.equal(1.0);
      expect(result.mode).to.equal("normal");
      expect(result.reason).to.contain("正常模式");
    });

    it("should return CAUTIOUS when VIX >= 28 and VIX < 35", () => {
      const result = determineRegime(30, "BULL", config);
      expect(result.state).to.equal("CAUTIOUS");
      expect(result.leverageMultiplier).to.equal(0.75);
      expect(result.mode).to.equal("reduced");
      expect(result.reason).to.contain("警戒門檻 28");
    });

    it("should return CAUTIOUS when sentiment is BEAR even if VIX is low", () => {
      const result = determineRegime(20, "BEAR", config);
      expect(result.state).to.equal("CAUTIOUS");
      expect(result.leverageMultiplier).to.equal(0.75);
      expect(result.mode).to.equal("reduced");
      expect(result.reason).to.contain("MacroSentiment = BEAR");
    });

    it("should return CRISIS when VIX >= 35", () => {
      const result = determineRegime(40, "BULL", config);
      expect(result.state).to.equal("CRISIS");
      expect(result.leverageMultiplier).to.equal(0);
      expect(result.mode).to.equal("sell_only");
      expect(result.reason).to.contain("絕對門檻 35");
    });

    it("should return CRISIS with crisis_accumulate mode when VIX >= 35 and debtMode is OPPORTUNITY", () => {
      const result = determineRegime(40, "BULL", config, "OPPORTUNITY");
      expect(result.state).to.equal("CRISIS");
      expect(result.leverageMultiplier).to.equal(0);
      expect(result.mode).to.equal("crisis_accumulate");
      expect(result.reason).to.contain("恐慌加碼視窗");
    });

    it("should maintain sell_only in CRISIS when debtMode is DEFENSE", () => {
      const result = determineRegime(40, "BULL", config, "DEFENSE");
      expect(result.state).to.equal("CRISIS");
      expect(result.mode).to.equal("sell_only");
      expect(result.reason).to.contain("絕對門檻 35");
    });

    it("should handle edge cases (VIX exactly at threshold)", () => {
      const result28 = determineRegime(28, "BULL", config);
      expect(result28.state).to.equal("CAUTIOUS");

      const result35 = determineRegime(35, "BULL", config);
      expect(result35.state).to.equal("CRISIS");
    });
  });

  describe("applyRegimeLeverage", () => {
    it("should correctly apply leverage multiplier", () => {
      const mockRegimeResult = { leverageMultiplier: 0.75 };
      const baseLeverage = 2.0;
      const result = applyRegimeLeverage(baseLeverage, mockRegimeResult);
      expect(result).to.equal(1.5);
    });

    it("should return 0 when multiplier is 0 (CRISIS)", () => {
      const mockRegimeResult = { leverageMultiplier: 0 };
      const baseLeverage = 2.0;
      const result = applyRegimeLeverage(baseLeverage, mockRegimeResult);
      expect(result).to.equal(0);
    });
  });

  describe("formatRegimeStatus", () => {
    it("should include emoji and state name", () => {
      const normalResult = {
        state: "NORMAL",
        mode: "normal",
        reason: "VIX 20.0 < 28 且 sentiment = BULL（正常模式）",
      };
      const status = formatRegimeStatus(normalResult);
      expect(status).to.contain("✅ NORMAL");
      expect(status).to.contain("[正常模式]");
      expect(status).to.contain("VIX 20.0");
    });

    it("should include warning emoji for CAUTIOUS", () => {
      const cautiousResult = {
        state: "CAUTIOUS",
        mode: "reduced",
        reason: "VIX 30.0 ≥ 警戒門檻 28",
      };
      const status = formatRegimeStatus(cautiousResult);
      expect(status).to.contain("⚠️ CAUTIOUS");
      expect(status).to.contain("[降槓桿模式]");
    });

    it("should include alarm emoji for CRISIS", () => {
      const crisisResult = {
        state: "CRISIS",
        mode: "sell_only",
        reason: "VIX 40.0 ≥ 絕對門檻 35",
      };
      const status = formatRegimeStatus(crisisResult);
      expect(status).to.contain("🚨 CRISIS");
      expect(status).to.contain("[強制賣出模式]");
    });
  });
});
