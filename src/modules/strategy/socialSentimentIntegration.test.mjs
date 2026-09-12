import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyMacroRegime,
  MacroRegimeState,
} from "./macroRegimeClassifier.mjs";

describe("Phase 2: Social Sentiment Integration (RED-GREEN)", () => {
  describe("社群情緒頂背離雙重確認阻尼器 (dualConfirmation dampener)", () => {
    it("當融資過熱 且 社群情緒背離 (BEARISH_DIVergence) 時，dampingMultiplier 應進一步下調為 0.25，並納入 reason", () => {
      // 一般散戶融資過熱 alone → damping 0.5
      const baseOverheated = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
        marginChangePercent5d: 5.0,
        indexChangePercent5d: 2.0,
      });

      // 融資過熱 + 社群情緒頂背離 → damping 進一步下調 0.25
      const withSentimentDivergence = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
        marginChangePercent5d: 5.0,
        indexChangePercent5d: 2.0,
        socialSentiment: {
          score: 85.0,
          ma7: 65.0,
          divergenceStatus: "BEARISH_DIVERGENCE",
        },
      });

      expect(baseOverheated.dampingMultiplier).toBe(0.5);
      expect(withSentimentDivergence.dampingMultiplier).toBe(0.25);
      expect(withSentimentDivergence.reason).toContain("散戶情緒頂背離");
    });

    it("當融資過熵但社群情緒正常時，dampingMultiplier 應維持 0.5", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
        marginChangePercent5d: 5.0,
        indexChangePercent5d: 2.0,
        socialSentiment: {
          score: 52.0,
          ma7: 50.0,
          divergenceStatus: "NONE",
        },
      });

      expect(result.dampingMultiplier).toBe(0.5);
    });

    it("當 BEAR_PANIC 狀態且社群情緒頂背離時，dampingMultiplier 應始終為 0.0", () => {
      const result = classifyMacroRegime({
        price0050: 80,
        ma60: 170,
        ma60Slope: -0.015,
        vix: 42.0,
        socialSentiment: {
          score: 88.0,
          ma7: 40.0,
          divergenceStatus: "BEARISH_DIVERGENCE",
        },
      });

      expect(result.state).toBe(MacroRegimeState.BEAR_PANIC);
      expect(result.dampingMultiplier).toBe(0.0);
    });
  });

  describe("社群情緒分數注入 (signalGenerator factorPool)", () => {
    it("應將 socialSentiment.score 正規化到 factorPool.sentiment (-1 ~ 1)", async () => {
      const { generateScoringMatrix } = await import("./signalGenerator.mjs");

      const strategy = {
        scoringMatrix: {
          enabled: true,
          thresholds: {
            buyTactical: 0.5,
            sellTactical: -0.5,
          },
          categories: {},
          normalization: {
            lookbackDays: 20,
          },
        },
      };

      const result = generateScoringMatrix(
        {},
        0,
        strategy,
        {
          closeArr: [],
          socialSentiment: { score: 75 },
        },
        null,
      );

      // score=75 正規化到 (-1, 1) 區間
      const normalized = Math.max(-1, Math.min(1, (75 - 50) / 50));
      expect(result.factorPool.sentiment).toBeCloseTo(normalized, 4);
    });
  });

  describe("社群情緒缺失容錯 (missing / null)", () => {
    it("當 socialSentiment 未提供時，應不影響原有 dampingMultiplier 計算", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
        marginChangePercent5d: 5.0,
        indexChangePercent5d: 2.0,
      });

      expect(result.dampingMultiplier).toBe(0.5);
      expect(result.isMarginOverheated).toBe(true);
    });

    it("當 socialSentiment 為 null 時，應不擲出例外", () => {
      const result = classifyMacroRegime({
        price0050: 180,
        ma60: 170,
        ma60Slope: 0.002,
        vix: 16.5,
        socialSentiment: null,
      });

      expect(result).toBeDefined();
      expect(result.dampingMultiplier).toBe(1.0);
    });
  });
});
