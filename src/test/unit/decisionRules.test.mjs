/**
 * Decision Rules Unit Tests
 * 測試各個 DecisionRule 的 evaluate() 行為
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DecisionRule,
  createDecisionResult,
} from "../../../src/modules/strategy/decision/DecisionRule.mjs";
import { RegimePolicyRule } from "../../../src/modules/strategy/decision/rules/RegimePolicyRule.mjs";
import { MarginLayerRule } from "../../../src/modules/strategy/decision/rules/MarginLayerRule.mjs";
import { LifecycleLeverageRule } from "../../../src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs";
import { GrossLeverageRule } from "../../../src/modules/strategy/decision/rules/GrossLeverageRule.mjs";
import { ValuationGuardRule } from "../../../src/modules/strategy/decision/rules/ValuationGuardRule.mjs";
import { EntryGateRule } from "../../../src/modules/strategy/decision/rules/EntryGateRule.mjs";
import { StopLossTrailingRule } from "../../../src/modules/strategy/decision/rules/StopLossTrailingRule.mjs";
import { ValuationBubbleRule } from "../../../src/modules/strategy/decision/rules/ValuationBubbleRule.mjs";
import { RebalanceRule } from "../../../src/modules/strategy/decision/rules/RebalanceRule.mjs";
import { ConversionGuardRule } from "../../../src/modules/strategy/decision/rules/ConversionGuardRule.mjs";
import { ScoringDecisionRule } from "../../../src/modules/strategy/decision/rules/ScoringDecisionRule.mjs";
import {
  createMockStrategy,
  createMockCtx,
} from "../../../src/test/utils/mockFactory.mjs";

// Mock 外部依賴 - 使用 hoisted vi.mock
vi.mock("../../../src/modules/strategy/regimePolicy.mjs", () => ({
  determineRegime: vi.fn((vix, sentiment, cfg, debtMode = "DEFENSE") => {
    if (vix > 40) {
      if (debtMode === "OPPORTUNITY") {
        return {
          state: "CRISIS",
          leverageMultiplier: 0,
          mode: "crisis_accumulate",
          reason: "恐慌加碼視窗",
        };
      }
      return {
        state: "CRISIS",
        leverageMultiplier: 0.5,
        mode: "sell_only",
        reason: "強制賣出",
      };
    }
    if (vix > 30)
      return {
        state: "CAUTIOUS",
        leverageMultiplier: 0.8,
        mode: "reduced",
      };
    return { state: "NORMAL", leverageMultiplier: 1.0, mode: "normal" };
  }),
  applyRegimeLeverage: vi.fn(
    (base, regime) => base * regime.leverageMultiplier,
  ),
  formatRegimeStatus: vi.fn((r) => `Regime: ${r.state}`),
}));

vi.mock("../../../src/modules/strategy/lifecycleEngine.mjs", () => ({
  computeLifecycleContext: vi.fn((age, retirementAge, profiles) => ({
    stage: age < 40 ? "Accumulation" : age < 55 ? "Growth" : "Preservation",
    profile: {
      maxLeverage: age < 40 ? 2.0 : age < 55 ? 1.5 : 1.0,
      mode: "test",
    },
    description: "Test Lifecycle",
    yearsToRetirement: retirementAge - age,
  })),
}));

vi.mock("../../../src/modules/strategy/core/index.mjs", () => ({
  getMarginLayer: vi.fn((mm, maint, th) => {
    if (mm < 135) return "critical";
    if (mm < 145) return "frozen";
    if (mm < 160) return "caution";
    return "normal";
  }),
  evaluateMarginLayer: vi.fn((layer, ctx, strategy, reserve) => {
    if (layer === "critical")
      return {
        maintenanceLayer: "critical",
        marketStatus: "🔴【斷頭危機】",
        target: "🛑 強制降槓桿",
      };
    if (layer === "frozen")
      return {
        maintenanceLayer: "frozen",
        marketStatus: "🟠【高危凍結】",
        target: "🚫 禁止進場",
      };
    return null;
  }),
  getReserveStatus: vi.fn(() => ({ level: "normal" })),
  resolveTrendConfirmation: vi.fn(() => ({ ma20BreakDays: 0 })),
  resolveValuationGuard: vi.fn(() => ({
    currentPR: 50,
    defenseLatchActive: false,
  })),
  evaluateValuationGuard: vi.fn(() => null),
  resolveValuationMomentum: vi.fn(() => ({ trend: "neutral" })),
  evaluateGrossLeverage: vi.fn(() => null),
}));

vi.mock("../../../src/modules/strategy/riskManagement.mjs", () => ({
  getReserveStatus: vi.fn(() => ({ level: "normal" })),
}));

vi.mock("../../../src/modules/strategy/policies/entryGatePolicy.mjs", () => ({
  resolveEntryGate: vi.fn((drop, rsi, cfg, ma60Slope) => {
    if (drop < 5 && rsi > 60)
      return {
        blocked: true,
        tierIndex: 0,
        tier: { minDrop: 0, maxDrop: 5, rsiThreshold: 60, note: "Tier 0" },
        blockReason: "RSI 過高",
      };
    return { blocked: false };
  }),
}));

vi.mock("../../../src/modules/strategy/policies/conversionPolicy.mjs", () => ({
  resolveConversionGuard: vi.fn(() => null),
}));

vi.mock("../../../src/modules/strategy/signalGenerator.mjs", () => ({
  generateScoringMatrix: vi.fn(() => ({
    finalScore: 0,
    signal: "neutral",
    signalDirection: "hold",
    scalingRatio: 0.3,
    categoryResults: {
      valuation: { label: "估值", finalScore: 0, isCapped: false },
      technical: { label: "技術", finalScore: 0, isCapped: false },
    },
  })),
}));

vi.mock("../../../src/modules/strategy/indicators.mjs", () => ({
  calcHHV: vi.fn(() => [100]),
}));

vi.mock("../../../src/modules/strategy/strategyDefaults.mjs", () => ({
  MAX_DAILY_LOAN_INCREASE_PCT: 0.02,
  MAX_ROLLING_LOAN_INCREASE_PCT: 0.1,
  BUDGET_ROLLING_DAYS: 10,
  PANIC_BYPASS_DROP_PCT: 10,
  PANIC_BYPASS_VIX_THRESHOLD: 30,
}));

// 取得 mock 函式參考
import {
  determineRegime,
  applyRegimeLeverage,
  formatRegimeStatus,
} from "../../../src/modules/strategy/regimePolicy.mjs";
import { computeLifecycleContext } from "../../../src/modules/strategy/lifecycleEngine.mjs";
import {
  getMarginLayer,
  evaluateMarginLayer,
  getReserveStatus,
  resolveTrendConfirmation,
  resolveValuationGuard,
  evaluateValuationGuard,
  resolveValuationMomentum,
  evaluateGrossLeverage,
} from "../../../src/modules/strategy/core/index.mjs";
import { resolveEntryGate } from "../../../src/modules/strategy/policies/entryGatePolicy.mjs";
import { resolveConversionGuard } from "../../../src/modules/strategy/policies/conversionPolicy.mjs";
import { generateScoringMatrix } from "../../../src/modules/strategy/signalGenerator.mjs";

describe("DecisionRule 基底類別", () => {
  it("應拒絕無效的 priority", () => {
    expect(() => new DecisionRule({ priority: "high", name: "Test" })).toThrow(
      "priority 必須為數字",
    );
  });

  it("應拒絕空的 name", () => {
    expect(() => new DecisionRule({ priority: 10, name: "" })).toThrow(
      "name 必須為非空字串",
    );
  });

  it("應強制要求實作 evaluate()", () => {
    const rule = new DecisionRule({ priority: 10, name: "Test" });
    expect(() => rule.evaluate({}, {}, {})).toThrow("必須實作 evaluate() 方法");
  });
});

describe("RegimePolicyRule (P0)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new RegimePolicyRule();
    strategy = createMockStrategy({
      regime: {},
      lifecycle: {
        profiles: { test: { maxLeverage: 2.0 } },
        retirementAge: 65,
      },
    });
    ctx = createMockCtx({
      vix: 20,
      macroSentiment: { direction: "NEUTRAL" },
      currentAge: 35,
    });
    engineState = {};
  });

  it("NORMAL regime 應回傳 null（繼續下一條）", () => {
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("CRISIS regime 應回傳強制賣出決策", () => {
    ctx.vix = 50;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.regimeState).toBe("CRISIS");
    expect(result.target).toContain("強制賣出");
  });

  it("CRISIS regime 在 totalDebt === 0 時應進入 OPPORTUNITY 模式不中斷決策流（回傳 null）", () => {
    ctx.vix = 50;
    ctx.totalDebt = 0;
    ctx.totalLoan = 0;
    ctx.portfolio = { totalDebt: 0, totalLoan: 0 };
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
    expect(engineState.crisisAccumulateMode).toBe(true);
    expect(engineState.debtMode).toBe("OPPORTUNITY");
    expect(ctx.regimeState).toBe("CRISIS");
  });

  it("CAUTIOUS regime 應計算調整後槓桿並存入 engineState", () => {
    ctx.vix = 35;
    ctx.currentAge = 35;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
    expect(engineState.adjustedMaxLeverage).toBeDefined();
    expect(engineState.regimeResult.state).toBe("CAUTIOUS");
  });
});

describe("MarginLayerRule (P10)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new MarginLayerRule();
    strategy = createMockStrategy();
    ctx = createMockCtx({ maintenanceMargin: 200 });
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("normal 維持率應回傳 null", () => {
    ctx.maintenanceMargin = 200;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("critical 維持率應回傳強制降槓桿決策", () => {
    ctx.maintenanceMargin = 130;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.maintenanceLayer).toBe("critical");
  });

  it("frozen 維持率應回傳禁止進場決策", () => {
    ctx.maintenanceMargin = 140;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.maintenanceLayer).toBe("frozen");
  });
});

describe("LifecycleLeverageRule (P20)", () => {
  let rule, strategy, ctx, engineState, grossLeverageResult;

  beforeEach(() => {
    rule = new LifecycleLeverageRule();
    strategy = createMockStrategy({
      lifecycle: {
        profiles: { Accumulation: { maxLeverage: 2.0 } },
        retirementAge: 65,
      },
    });
    ctx = createMockCtx({ currentAge: 35 });
    engineState = {
      regimeResult: { state: "NORMAL" },
      adjustedMaxLeverage: null,
    };
    grossLeverageResult = { grossLeverage: 1.5 };
  });

  it("槓桿未超過上限應回傳 null", () => {
    grossLeverageResult.grossLeverage = 1.5;
    const result = rule.evaluate(
      ctx,
      strategy,
      engineState,
      grossLeverageResult,
    );
    expect(result).toBeNull();
  });

  it("槓桿超過上限應回傳封鎖決策", () => {
    grossLeverageResult.grossLeverage = 2.5;
    const result = rule.evaluate(
      ctx,
      strategy,
      engineState,
      grossLeverageResult,
    );
    expect(result).not.toBeNull();
    expect(result.lifecycleBlocked).toBe(true);
    expect(result.target).toContain("封鎖");
  });
});

describe("GrossLeverageRule (P30)", () => {
  let rule, strategy, ctx, engineState, grossLeverageResult;

  beforeEach(() => {
    rule = new GrossLeverageRule();
    strategy = createMockStrategy();
    ctx = createMockCtx();
    engineState = { panicBypassActive: false };
    grossLeverageResult = { grossLeverage: 2.0 };
  });

  it("正常情況應回傳 null", () => {
    evaluateGrossLeverage.mockReturnValue(null);
    const result = rule.evaluate(
      ctx,
      strategy,
      engineState,
      grossLeverageResult,
    );
    expect(result).toBeNull();
  });
});

describe("ValuationGuardRule (P40)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new ValuationGuardRule();
    strategy = createMockStrategy({
      valuationGuard: { enabled: true, latch: { triggerPrThreshold: 90 } },
    });
    ctx = createMockCtx({
      valuation: { pb: 1.5 },
      pbRecords: [1.0, 1.2, 1.4, 1.5],
      pbRecordsObjects: [],
    });
    engineState = {};
  });

  it("未啟用時應回傳 null", () => {
    strategy.valuationGuard.enabled = false;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("PB 正常時應回傳 null", () => {
    evaluateValuationGuard.mockReturnValue(null);
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });
});

describe("EntryGateRule (P50)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new EntryGateRule();
    strategy = createMockStrategy({ buy: { entryGate: { enabled: true } } });
    ctx = createMockCtx({ priceDropPercent: 2, rsi: 50 });
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("EntryGate 未啟用應回傳 null", () => {
    strategy.buy.entryGate.enabled = false;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("RSI 過高應回傳封鎖決策", () => {
    ctx.rsi = 80;
    ctx.priceDropPercent = 2;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.entryGateBlocked).toBe(true);
  });
});

describe("StopLossTrailingRule (P60)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new StopLossTrailingRule();
    strategy = createMockStrategy({
      sell: { trailingStop: { enabled: false }, ma20StopDays: 3 },
    });
    ctx = createMockCtx({
      z2Ratio: 20,
      currentPrice: 100,
      portfolio: { lastBuyDate: "2024-01-01", avgCostZ2: 90 },
      closeArr: [105, 104],
      ma20Arr: [100, 99],
      atrArr: [5],
    });
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("無部位時應回傳 null", () => {
    ctx.z2Ratio = 0;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });
});

describe("ValuationBubbleRule (P70)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new ValuationBubbleRule();
    strategy = createMockStrategy({ valuationGuard: { enabled: true } });
    ctx = createMockCtx({ valuation: { pb: 1.5 } });
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("PB < 2.2 應回傳 null", () => {
    ctx.valuation.pb = 1.5;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("PB >= 2.2 應回傳泡沫決策", () => {
    ctx.valuation.pb = 2.5;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.marketStatus).toContain("估值泡沫");
  });
});

describe("RebalanceRule (P80)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new RebalanceRule();
    strategy = createMockStrategy({
      threshold: {
        z2RatioHigh: 30,
        z2TargetRatio: 0.2,
        minActionableAmount: 10000,
      },
    });
    ctx = createMockCtx({
      z2Ratio: 20,
      netAsset: 1000000,
      currentZ2Value: 200000,
    });
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("z2Ratio 未超過門檻應回傳 null", () => {
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });

  it("z2Ratio 超過門檻應回傳再平衡決策", () => {
    ctx.z2Ratio = 35;
    ctx.currentZ2Value = 350000;
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.marketStatus).toContain("再平衡");
  });
});

describe("ConversionGuardRule (P90)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new ConversionGuardRule();
    strategy = createMockStrategy();
    ctx = createMockCtx();
    engineState = { regimeResult: { state: "NORMAL" } };
  });

  it("無轉換訊號應回傳 null", () => {
    resolveConversionGuard.mockReturnValue(null);
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).toBeNull();
  });
});

describe("ScoringDecisionRule (P100)", () => {
  let rule, strategy, ctx, engineState;

  beforeEach(() => {
    rule = new ScoringDecisionRule();
    strategy = createMockStrategy({
      trading: {
        budget: {
          maxDailyLoanIncreasePct: 0.02,
          maxRollingLoanIncreasePct: 0.1,
        },
      },
      sell: { sellRatioLimit: 1.0 },
    });
    ctx = createMockCtx({
      z2Ratio: 20,
      netAsset: 1000000,
      portfolio: { totalLoan: 500000 },
      historyLoan10d: 400000,
      indicators: {
        ma20Arr: [],
        closes: [],
        rsiArr: [],
        kdArr: [],
        macdArr: [],
        atrArr: [],
      },
      priceDropPercent: 2,
      macroSentiment: { direction: "NEUTRAL" },
      cooldownStatus: { inCooldown: false },
      institutionalNet: 0,
      institutionalHistory: [],
      ma60SlopeArr: [],
      closeArr: [],
    });
    engineState = {
      regimeResult: { state: "NORMAL" },
      valuationGuardResult: { currentPR: 50 },
      valuationMomentumResult: null,
      trailingActive: false,
      dynamicAnchor: null,
    };
  });

  it("應將 bullish threshold 所需資料傳入 scoring matrix", () => {
    ctx.ma60SlopeArr = [0.1, 0.2];
    ctx.closeArr = [100, 105, 110];
    ctx.macroSentiment = { direction: "BULL", bonus: 2 };
    engineState.valuationGuardResult.currentPR = 89;
    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0,
      categoryResults: {},
    });

    rule.evaluate(ctx, strategy, engineState);

    expect(generateScoringMatrix).toHaveBeenCalledWith(
      ctx.indicators,
      ctx.priceDropPercent,
      strategy,
      expect.objectContaining({
        ma60SlopeHistory: [0.1, 0.2],
        closeArr: [100, 105, 110],
        currentPR: 89,
        sentimentScore: 2,
      }),
      ctx.macroSentiment,
    );
  });

  it("中性訊號應回傳 DCA 決策", () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0.3,
      categoryResults: {
        valuation: { label: "估值", finalScore: 0, isCapped: false },
      },
    });
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.target).toContain("0050 DCA");
    expect(result.signalDirection).toBe("hold");
  });

  it("ctx 有 cashExposureAnalysis 時，suggestion 附帶現金/曝險參考行", () => {
    ctx.cashExposureAnalysis = {
      status: "RECOMMEND_DCA",
      suggestedDcaAmt: 100000,
      exposureGap: 500000,
      targetExposure: 1500000,
      cashAdequacy: true,
      message: "現金充足且市場正常，建議本次 DCA $100000（曝險缺口 $500000）",
    };
    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0.3,
      categoryResults: {},
    });
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result.suggestion).toContain("現金");
    expect(result.suggestion).toContain("建議 DCA $100000");
    expect(result.suggestion).toContain("曝險缺口 $500000");
  });

  it("ctx 無 cashExposureAnalysis 時，suggestion 不受影響（不崩潰）", () => {
    delete ctx.cashExposureAnalysis;
    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0.3,
      categoryResults: {},
    });
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.target).toContain("0050 DCA");
  });

  it("buy_tactical 訊號應回傳加碼決策", () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: 8,
      signal: "buy_tactical",
      signalDirection: "buy_tactical",
      scalingRatio: 0.6,
      categoryResults: {
        valuation: { label: "估值", finalScore: 5, isCapped: false },
      },
    });
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.target).toContain("撥款加碼");
  });

  it("sell_tactical 訊號應回傳減倉決策", () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: -6,
      signal: "sell_tactical",
      signalDirection: "sell_tactical",
      scalingRatio: 1.0,
      categoryResults: {
        valuation: { label: "估值", finalScore: -5, isCapped: false },
      },
    });
    const result = rule.evaluate(ctx, strategy, engineState);
    expect(result).not.toBeNull();
    expect(result.target).toContain("降槓桿");
  });
});
