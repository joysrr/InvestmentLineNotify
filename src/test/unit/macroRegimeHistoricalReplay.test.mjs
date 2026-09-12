import { describe, it, expect } from "vitest";
import {
  classifyMacroRegime,
  MacroRegimeState,
} from "../../modules/strategy/macroRegimeClassifier.mjs";
import { generateScoringMatrix } from "../../modules/strategy/signalGenerator.mjs";

describe("Phase 4: 歷史極端行情回測與行為驗證", () => {
  const strategy = {
    scoringMatrix: {
      enabled: true,
      categories: {
        technicalTrend: { cap: 4, weights: { ma60Slope: 2 } },
        valuationValue: { cap: 8, weights: { priceDrop: 4, bullMomentum: 2 } },
        flowOfFunds: { cap: 4, weights: { institutional: 2 } },
        extremeOscillation: { cap: 2, weights: {} },
      },
      thresholds: {
        buyTactical: 2,
        buyTacticalBullish: 1.5,
        sellTactical: -4,
        hysteresisExit: 0,
        scaling: {
          tier1: { score: 1.5, ratio: 0.4 },
          tier2: { score: 3.5, ratio: 0.7 },
          tier3: { score: 6, ratio: 1.0 },
        },
      },
      normalization: { lookbackDays: 20 },
      regimeWeightsMapping: {
        BULL_TREND: {
          technicalTrend: { cap: 7, multiplier: 1.75 },
          valuationValue: { cap: 2, multiplier: 0.25 },
        },
        BULL_VOLATILE: {
          technicalTrend: { cap: 2, multiplier: 0.5 },
          valuationValue: { cap: 8, multiplier: 1.0 },
        },
        BEAR_CHOPPY: {
          technicalTrend: { cap: 0, multiplier: 0 },
          valuationValue: { cap: 0, multiplier: 0 },
        },
        BEAR_PANIC: {
          technicalTrend: { cap: 0, multiplier: 0 },
          valuationValue: { cap: 0, multiplier: 0 },
        },
      },
    },
  };

  it("情境一：2024/08/05 黑色星期一暴跌 (VIX 暴衝至 65) -> 觸發 BEAR_PANIC，全面防守", () => {
    // 模擬 8/5 當日數據：指數跳水、VIX 飆破 50
    const panicData = {
      price0050: 165,
      ma60: 185,
      ma60Slope: -0.01,
      vix: 65.0, // 極端恐慌
      marginChangePercent5d: -4.5,
      indexChangePercent5d: -8.5,
    };

    const regime = classifyMacroRegime(panicData);
    expect(regime.state).toBe(MacroRegimeState.BEAR_PANIC);
    expect(regime.mode).toBe("sell_only");
    expect(regime.leverageMultiplier).toBe(0);
    expect(regime.dampingMultiplier).toBe(0);

    const scoreResult = generateScoringMatrix(
      { macdArr: [], rsiArr: [], kdArr: [] },
      40, // 跌幅巨大
      strategy,
      {
        macroRegime: regime,
        institutionalHistory: [0, 0, 0, 0, 0],
      },
    );

    // 雖然跌幅達到抄底條件，但在 BEAR_PANIC 下加碼被完全阻斷
    expect(scoreResult.signal).not.toBe("buy_tactical");
    expect(scoreResult.scalingRatio).toBe(0);
  });

  it("情境二：2023 全年單邊大牛市 (低波單邊上漲) -> 觸發 BULL_TREND，動能主導順勢吃滿", () => {
    // 模擬 2023 台積電/AI 帶動之強趨勢行情
    const bullData = {
      price0050: 155,
      ma60: 140,
      ma60Slope: 0.008, // 斜率強勁向上
      vix: 14.2, // 低波動
      marginChangePercent5d: 0.8,
      indexChangePercent5d: 2.1,
    };

    const regime = classifyMacroRegime(bullData);
    expect(regime.state).toBe(MacroRegimeState.BULL_TREND);
    expect(regime.mode).toBe("trend_offensive");
    expect(regime.weights.momentum).toBe(0.7);

    const scoreResult = generateScoringMatrix(
      { macdArr: [{ histogram: 0.5 }], rsiArr: [60], kdArr: [{ k: 70 }] },
      0, // 幾乎無跌幅 (牛市不回頭)
      strategy,
      {
        ma60SlopeArr: [0.08],
        closeArr: Array(25)
          .fill(140)
          .map((v, i) => v + i * 1.5), // 20日強勢上漲 > 10%
        macroRegime: regime,
        institutionalNet: 3000,
        institutionalHistory: [1000, 2000, 3000, 4000, 5000],
      },
    );

    // 動能加權發威，即使跌幅為 0 仍能給予買進訊號
    expect(scoreResult.signal).toBe("buy_tactical");
    expect(scoreResult.scalingRatio).toBeGreaterThan(0);
    expect(scoreResult.macroRegimeApplied).toBe(true);
  });

  it("情境三：2022 升息循環陰跌盤整 -> 觸發 BEAR_CHOPPY，持有成本濾網生效，僅執行基礎 DCA", () => {
    const choppyData = {
      price0050: 110,
      ma60: 125,
      ma60Slope: -0.004,
      vix: 18.5, // 陰跌低波，常態性損耗
      marginChangePercent5d: -0.2,
      indexChangePercent5d: -0.5,
    };

    const regime = classifyMacroRegime(choppyData);
    expect(regime.state).toBe(MacroRegimeState.BEAR_CHOPPY);
    expect(regime.mode).toBe("dca_only");
    expect(regime.costOfCarryFilterActive).toBe(true);

    const scoreResult = generateScoringMatrix(
      { macdArr: [], rsiArr: [40], kdArr: [{ k: 30 }] },
      15, // 略有跌幅
      strategy,
      {
        ma60SlopeArr: [-0.004],
        macroRegime: regime,
        institutionalHistory: [0, 0, 0, 0, 0],
      },
    );

    // 實質持有成本濾網硬阻斷，戰術訊號強制為 neutral
    expect(scoreResult.signal).toBe("neutral");
    expect(scoreResult.scalingRatio).toBe(0);
  });
});
