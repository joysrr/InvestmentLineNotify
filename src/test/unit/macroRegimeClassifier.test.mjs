import { describe, it, expect } from "vitest";
import {
  classifyMacroRegime,
  MacroRegimeState,
} from "../../modules/strategy/macroRegimeClassifier.mjs";

describe("MacroRegimeClassifier (Phase 2: 四象限狀態機 TDD)", () => {
  describe("基本象限判定 (無歷史狀態)", () => {
    it("應判定為 BULL_TREND 當指數在 MA60 之上且 VIX < 20", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
      });

      expect(result.state).toBe(MacroRegimeState.BULL_TREND);
      expect(result.mode).toBe("trend_offensive");
      expect(result.leverageMultiplier).toBe(1.0);
      expect(result.weights).toEqual({
        momentum: 0.7,
        contrarianDca: 0.0,
        institutional: 0.3,
      });
      expect(result.dampingMultiplier).toBe(1.0);
    });

    it("應判定為 BULL_VOLATILE 當指數在 MA60 之上但 VIX 介於 20 與 35 之間", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.001,
        vix: 24.5,
      });

      expect(result.state).toBe(MacroRegimeState.BULL_VOLATILE);
      expect(result.mode).toBe("dip_buying");
      expect(result.leverageMultiplier).toBe(0.8);
      expect(result.weights.contrarianDca).toBeGreaterThan(0.5);
      expect(result.weights.momentum).toBeLessThanOrEqual(0.2);
    });

    it("應判定為 BEAR_PANIC 當 VIX >= 35 (優先級最高，無視均線與遲滯)", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.005,
        vix: 38.0,
      });

      expect(result.state).toBe(MacroRegimeState.BEAR_PANIC);
      expect(result.mode).toBe("sell_only");
      expect(result.leverageMultiplier).toBe(0);
      expect(result.dampingMultiplier).toBe(0);
    });

    it("應判定為 BEAR_CHOPPY 當指數跌破 MA60 且 VIX < 20", () => {
      const result = classifyMacroRegime({
        price0050: 160,
        ma60: 175,
        ma60Slope: -0.002,
        vix: 17.5,
      });

      expect(result.state).toBe(MacroRegimeState.BEAR_CHOPPY);
      expect(result.mode).toBe("dca_only");
      expect(result.costOfCarryFilterActive).toBe(true);
      expect(result.weights.momentum).toBe(0);
      expect(result.weights.tacticalDca).toBe(0);
    });
  });

  describe("散戶籌碼過熱阻尼器 (Retail Margin Damper)", () => {
    it("當 5 日融資增幅顯著大於大盤漲幅且 > 2% 時，dampingMultiplier 應為 0.5", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 22.0, // BULL_VOLATILE
        marginChangePercent5d: 2.8, // 融資 5 日暴增 2.8%
        indexChangePercent5d: 0.5, // 指數僅漲 0.5%
      });

      expect(result.state).toBe(MacroRegimeState.BULL_VOLATILE);
      expect(result.isMarginOverheated).toBe(true);
      expect(result.dampingMultiplier).toBe(0.5);
    });

    it("當融資未過熱時，dampingMultiplier 應為 1.0", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 18.0,
        marginChangePercent5d: 0.5,
        indexChangePercent5d: 1.2,
      });

      expect(result.isMarginOverheated).toBe(false);
      expect(result.dampingMultiplier).toBe(1.0);
    });
  });

  describe("遲滯機制 (Hysteresis Filter)", () => {
    it("進入防守狀態需連續 2 天確認；若僅 1 天滿足，應維持原 BULL_TREND", () => {
      const previousState = {
        state: MacroRegimeState.BULL_TREND,
        consecutiveDays: 10,
        candidateState: null,
        candidateDays: 0,
      };

      // 第 1 天觸發 VIX 升至 22
      const day1 = classifyMacroRegime(
        {
          price0050: 180,
          ma60: 170,
          ma60Slope: 0.002,
          vix: 22.0,
        },
        previousState,
      );

      expect(day1.state).toBe(MacroRegimeState.BULL_TREND);
      expect(day1.candidateState).toBe(MacroRegimeState.BULL_VOLATILE);
      expect(day1.candidateDays).toBe(1);

      // 第 2 天持續 VIX 23 -> 正式確認轉換為 BULL_VOLATILE
      const day2 = classifyMacroRegime(
        {
          price0050: 180,
          ma60: 170,
          ma60Slope: 0.002,
          vix: 23.0,
        },
        day1,
      );

      expect(day2.state).toBe(MacroRegimeState.BULL_VOLATILE);
      expect(day2.candidateState).toBe(null);
      expect(day2.candidateDays).toBe(0);
    });

    it("極端崩盤 BEAR_PANIC (VIX >= 35) 應 0 延遲即刻轉換，無視 2 天遲滯期", () => {
      const previousState = {
        state: MacroRegimeState.BULL_TREND,
        consecutiveDays: 15,
        candidateState: null,
        candidateDays: 0,
      };

      const result = classifyMacroRegime(
        {
          price0050: 180,
          ma60: 170,
          ma60Slope: 0.002,
          vix: 36.5,
        },
        previousState,
      );

      expect(result.state).toBe(MacroRegimeState.BEAR_PANIC);
      expect(result.candidateDays).toBe(0);
    });

    it("從 BEAR_CHOPPY 恢復回 BULL_TREND 需 5 天緩衝期", () => {
      let state = {
        state: MacroRegimeState.BEAR_CHOPPY,
        consecutiveDays: 8,
        candidateState: null,
        candidateDays: 0,
      };

      // 連續 4 天回升到 BULL_TREND 條件
      for (let day = 1; day <= 4; day++) {
        state = classifyMacroRegime(
          {
            price0050: 180,
            ma60: 170,
            ma60Slope: 0.002,
            vix: 17.0,
          },
          state,
        );
        expect(state.state).toBe(MacroRegimeState.BEAR_CHOPPY);
        expect(state.candidateState).toBe(MacroRegimeState.BULL_TREND);
        expect(state.candidateDays).toBe(day);
      }

      // 第 5 天正式確認恢復
      state = classifyMacroRegime(
        {
          price0050: 180,
          ma60: 170,
          ma60Slope: 0.002,
          vix: 17.0,
        },
        state,
      );
      expect(state.state).toBe(MacroRegimeState.BULL_TREND);
      expect(state.candidateDays).toBe(0);
    });
  });

  describe("向後相容現有 P0 RegimePolicyRule", () => {
    it("產出的結果應包含相容欄位 (state, leverageMultiplier, mode, reason)", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
      });

      expect(result).toHaveProperty("state");
      expect(result).toHaveProperty("leverageMultiplier");
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("weights");
      expect(result).toHaveProperty("dampingMultiplier");
    });
  });
});
