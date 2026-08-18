/**
 * Decision Chain Integration Tests
 * 測試完整的決策鏈運行流程
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runDecisionChain,
  createDefaultDecisionChain,
  DecisionChainBuilder,
} from "../../../src/modules/strategy/decision/chain.mjs";
import { DecisionRule } from "../../../src/modules/strategy/decision/DecisionRule.mjs";
import {
  createMockStrategy,
  createMockCtx,
} from "../../../src/test/utils/mockFactory.mjs";

// Mock 外部依賴
vi.mock("../../../src/modules/strategy/regimePolicy.mjs", () => ({
  determineRegime: vi.fn(),
  applyRegimeLeverage: vi.fn(),
  formatRegimeStatus: vi.fn(),
}));

vi.mock("../../../src/modules/strategy/lifecycleEngine.mjs", () => ({
  computeLifecycleContext: vi.fn(),
}));

vi.mock("../../../src/modules/strategy/core/index.mjs", () => ({
  getMarginLayer: vi.fn((mm, maint, th) => {
    if (mm < 135) return "critical";
    if (mm < 145) return "frozen";
    if (mm < 160) return "caution";
    return "normal";
  }),
  evaluateMarginLayer: vi.fn(),
  getReserveStatus: vi.fn(() => ({ level: "normal" })),
  resolveTrendConfirmation: vi.fn(() => ({ ma20BreakDays: 0 })),
  resolveValuationGuard: vi.fn(() => ({
    currentPR: 50,
    defenseLatchActive: false,
  })),
  evaluateValuationGuard: vi.fn(),
  resolveValuationMomentum: vi.fn(() => ({ trend: "neutral" })),
  evaluateGrossLeverage: vi.fn(),
}));

vi.mock("../../../src/modules/strategy/riskManagement.mjs", () => ({
  getReserveStatus: vi.fn(() => ({ level: "normal" })),
}));

vi.mock("../../../src/modules/strategy/policies/entryGatePolicy.mjs", () => ({
  resolveEntryGate: vi.fn(),
}));

vi.mock("../../../src/modules/strategy/policies/conversionPolicy.mjs", () => ({
  resolveConversionGuard: vi.fn(() => null),
}));

vi.mock(
  "../../../src/modules/strategy/policies/budgetSynergyPolicy.mjs",
  () => ({
    resolveBudgetSynergy: vi.fn(() => null),
  }),
);

vi.mock("../../../src/modules/strategy/strategyEngine.mjs", () => ({
  applyBudgetSynergy: vi.fn((decision, synergy) => decision),
}));

vi.mock("../../../src/modules/strategy/signalGenerator.mjs", () => ({
  generateScoringMatrix: vi.fn(),
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
  evaluateMarginLayer,
  evaluateGrossLeverage,
  evaluateValuationGuard,
} from "../../../src/modules/strategy/core/index.mjs";
import { resolveEntryGate } from "../../../src/modules/strategy/policies/entryGatePolicy.mjs";
import { generateScoringMatrix } from "../../../src/modules/strategy/signalGenerator.mjs";

describe("Decision Chain Runner", () => {
  let strategy, ctx, grossLeverageResult, ma60Slope;

  beforeEach(() => {
    vi.clearAllMocks();

    strategy = createMockStrategy({
      regime: {},
      lifecycle: {
        profiles: { Accumulation: { maxLeverage: 2.0 } },
        retirementAge: 65,
      },
      valuationGuard: { enabled: true, latch: { triggerPrThreshold: 90 } },
      buy: { entryGate: { enabled: true } },
      sell: {
        trailingStop: { enabled: false },
        ma20StopDays: 3,
        sellRatioLimit: 1.0,
      },
      trading: {
        budget: {
          maxDailyLoanIncreasePct: 0.02,
          maxRollingLoanIncreasePct: 0.1,
        },
      },
      threshold: {
        z2RatioHigh: 30,
        z2TargetRatio: 0.2,
        minActionableAmount: 10000,
      },
    });

    ctx = createMockCtx({
      vix: 20,
      macroSentiment: { direction: "NEUTRAL" },
      currentAge: 35,
      maintenanceMargin: 200,
      z2Ratio: 20,
      netAsset: 1000000,
      currentZ2Value: 200000,
      priceDropPercent: 2,
      rsi: 50,
      valuation: { pb: 1.5 },
      pbRecords: [1.0, 1.2, 1.4, 1.5],
      pbRecordsObjects: [],
      portfolio: {
        totalLoan: 500000,
        lastBuyDate: "2024-01-01",
        avgCostZ2: 90,
        qty0050: 1000,
        qtyZ2: 500,
        cash: 100000,
      },
      closeArr: [105, 104],
      ma20Arr: [100, 99],
      atrArr: [5],
      indicators: {
        ma20Arr: [],
        closes: [],
        rsiArr: [],
        kdArr: [],
        macdArr: [],
        atrArr: [],
      },
      historyLoan10d: 400000,
      cooldownStatus: { inCooldown: false },
      institutionalNet: 0,
      institutionalHistory: [],
      ma60SlopeArr: [],
      highsSince: [],
    });

    grossLeverageResult = { grossLeverage: 1.5 };
    ma60Slope = 0.01;
  });

  it("應能執行自訂規則鏈並回傳決策", async () => {
    // 建立簡單的測試規則
    const testRule = class extends DecisionRule {
      constructor() {
        super({ priority: 10, name: "TestRule" });
      }
      evaluate(ctx, strategy, engineState) {
        return {
          marketStatus: "🧪【測試規則】",
          target: "測試決策",
          targetSuggestion: "測試通過",
        };
      }
    };

    const chain = new DecisionChainBuilder().addRule(new testRule()).build();

    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result).not.toBeNull();
    expect(result.marketStatus).toBe("🧪【測試規則】");
    expect(result.target).toBe("測試決策");
  });

  it("規則回傳 null 時應繼續執行下一條規則", async () => {
    const passRule = class extends DecisionRule {
      constructor() {
        super({ priority: 10, name: "PassRule" });
      }
      evaluate() {
        return null;
      }
    };

    const stopRule = class extends DecisionRule {
      constructor() {
        super({ priority: 20, name: "StopRule" });
      }
      evaluate() {
        return { marketStatus: "🛑【停止規則】", target: "停止決策" };
      }
    };

    const chain = new DecisionChainBuilder()
      .addRule(new passRule())
      .addRule(new stopRule())
      .build();

    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.marketStatus).toBe("🛑【停止規則】");
  });

  it("規則依 priority 排序執行（數值越小越優先）", async () => {
    const executionOrder = [];

    const ruleA = class extends DecisionRule {
      constructor() {
        super({ priority: 30, name: "RuleA" });
      }
      evaluate() {
        executionOrder.push("A");
        return null;
      }
    };

    const ruleB = class extends DecisionRule {
      constructor() {
        super({ priority: 10, name: "RuleB" });
      }
      evaluate() {
        executionOrder.push("B");
        return { marketStatus: "B 決策", target: "B" };
      }
    };

    const ruleC = class extends DecisionRule {
      constructor() {
        super({ priority: 20, name: "RuleC" });
      }
      evaluate() {
        executionOrder.push("C");
        return null;
      }
    };

    const chain = new DecisionChainBuilder()
      .addRule(new ruleA())
      .addRule(new ruleB())
      .addRule(new ruleC())
      .build();

    await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    // 執行順序應為 B (10) -> C (20) -> A (30)，但 B 會早期終止
    expect(executionOrder).toEqual(["B"]);
  });

  it("應拒絕非 DecisionRule 實例", () => {
    expect(() => {
      new DecisionChainBuilder()
        .addRule({ priority: 10, name: "Fake" })
        .build();
    }).toThrow("只能加入 DecisionRule 實例");
  });

  it("空規則鏈應拋出錯誤", () => {
    expect(() => {
      new DecisionChainBuilder().build();
    }).toThrow("至少需要一條規則");
  });
});

describe("Default Decision Chain (完整決策鏈)", () => {
  let strategy, ctx, grossLeverageResult, ma60Slope;

  beforeEach(() => {
    vi.clearAllMocks();

    // 設定預設 mock 實作
    determineRegime.mockImplementation((vix, sentiment, cfg) => {
      if (vix > 40) return { state: "CRISIS", leverageMultiplier: 0.5 };
      if (vix > 30) return { state: "CAUTIOUS", leverageMultiplier: 0.8 };
      return { state: "NORMAL", leverageMultiplier: 1.0 };
    });
    applyRegimeLeverage.mockImplementation(
      (base, regime) => base * regime.leverageMultiplier,
    );
    formatRegimeStatus.mockImplementation((r) => `Regime: ${r.state}`);

    computeLifecycleContext.mockImplementation(
      (age, retirementAge, profiles) => ({
        stage: age < 40 ? "Accumulation" : age < 55 ? "Growth" : "Preservation",
        profile: {
          maxLeverage: age < 40 ? 2.0 : age < 55 ? 1.5 : 1.0,
          mode: "test",
        },
        description: "Test Lifecycle",
        yearsToRetirement: retirementAge - age,
      }),
    );

    evaluateMarginLayer.mockImplementation((layer, ctx, strategy, reserve) => {
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
    });

    evaluateGrossLeverage.mockReturnValue(null);
    evaluateValuationGuard.mockReturnValue(null);

    resolveEntryGate.mockImplementation((drop, rsi, cfg, ma60Slope) => {
      if (drop < 5 && rsi > 60)
        return {
          blocked: true,
          tierIndex: 0,
          tier: { minDrop: 0, maxDrop: 5, rsiThreshold: 60, note: "Tier 0" },
          blockReason: "RSI 過高",
        };
      return { blocked: false };
    });

    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0.3,
      categoryResults: {
        valuation: { label: "估值", finalScore: 0, isCapped: false },
      },
    });

    strategy = createMockStrategy({
      regime: {},
      lifecycle: {
        profiles: { Accumulation: { maxLeverage: 2.0 } },
        retirementAge: 65,
      },
      valuationGuard: { enabled: true, latch: { triggerPrThreshold: 90 } },
      buy: { entryGate: { enabled: true } },
      sell: {
        trailingStop: { enabled: false },
        ma20StopDays: 3,
        sellRatioLimit: 1.0,
      },
      trading: {
        budget: {
          maxDailyLoanIncreasePct: 0.02,
          maxRollingLoanIncreasePct: 0.1,
        },
      },
      threshold: {
        z2RatioHigh: 30,
        z2TargetRatio: 0.2,
        minActionableAmount: 10000,
      },
      dynamicDeleverage: { sellRatio: 1.0 },
    });

    ctx = createMockCtx({
      vix: 20,
      macroSentiment: { direction: "NEUTRAL" },
      currentAge: 35,
      maintenanceMargin: 200,
      z2Ratio: 20,
      netAsset: 1000000,
      currentZ2Value: 200000,
      priceDropPercent: 2,
      rsi: 50,
      valuation: { pb: 1.5 },
      pbRecords: [1.0, 1.2, 1.4, 1.5],
      pbRecordsObjects: [],
      portfolio: {
        totalLoan: 500000,
        lastBuyDate: "2024-01-01",
        avgCostZ2: 90,
        qty0050: 1000,
        qtyZ2: 500,
        cash: 100000,
      },
      closeArr: [105, 104],
      ma20Arr: [100, 99],
      atrArr: [5],
      indicators: {
        ma20Arr: [],
        closes: [],
        rsiArr: [],
        kdArr: [],
        macdArr: [],
        atrArr: [],
      },
      historyLoan10d: 400000,
      cooldownStatus: { inCooldown: false },
      institutionalNet: 0,
      institutionalHistory: [],
      ma60SlopeArr: [],
      highsSince: [],
    });

    grossLeverageResult = { grossLeverage: 1.5 };
    ma60Slope = 0.01;
  });

  it("CRISIS regime 應在第一優先級攔截並回傳強制賣出", async () => {
    ctx.vix = 50; // 觸發 CRISIS

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.regimeState).toBe("CRISIS");
    expect(result.target).toContain("強制賣出");
    expect(result.marketStatus).toContain("危機模式");
    // 驗證 determineRegime 被呼叫
    expect(determineRegime).toHaveBeenCalled();
  });

  it("P0 CRISIS 應優先於同時命中的 critical 維持率", async () => {
    ctx.vix = 50;
    ctx.maintenanceMargin = 130;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.regimeState).toBe("CRISIS");
    expect(result.target).toContain("強制賣出");
    expect(result.target).not.toContain("強制降槓桿");
  });

  it("P70 估值泡沫應優先於同時命中的再平衡", async () => {
    ctx.valuation.pb = 2.5;
    ctx.z2Ratio = 35;
    ctx.currentZ2Value = 350000;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.marketStatus).toContain("估值泡沫");
    expect(result.marketStatus).not.toContain("再平衡");
  });

  it("CAUTIOUS regime 應計算調整後槓桿並繼續後續規則", async () => {
    ctx.vix = 35; // 觸發 CAUTIOUS

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.regimeState).toBe("CAUTIOUS");
    // 應繼續執行到 ScoringDecisionRule
    expect(result.target).toContain("0050 DCA");
  });

  it("critical 維持率應被 MarginLayerRule 攔截", async () => {
    ctx.maintenanceMargin = 130;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.maintenanceLayer).toBe("critical");
    expect(result.target).toContain("強制降槓桿");
  });

  it("frozen 維持率應被攔截", async () => {
    ctx.maintenanceMargin = 140;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.maintenanceLayer).toBe("frozen");
    expect(result.target).toContain("禁止進場");
  });

  it("生命週期槓桿超過上限應被攔截", async () => {
    grossLeverageResult.grossLeverage = 2.5; // 超過 Accumulation 階段的 2.0

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.lifecycleBlocked).toBe(true);
    expect(result.target).toContain("封鎖");
  });

  it("Gross Leverage 警戒觸發應被攔截", async () => {
    evaluateGrossLeverage.mockReturnValue({
      maintenanceLayer: "normal",
      marketStatus: "⚠️【Gross Leverage 警戒】",
      target: "🚧 降槓桿",
    });

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.marketStatus).toContain("Gross Leverage");
  });

  it("EntryGate RSI 過高應被攔截", async () => {
    ctx.rsi = 80;
    ctx.priceDropPercent = 2;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.entryGateBlocked).toBe(true);
    expect(result.marketStatus).toContain("前置過濾");
  });

  it("PB >= 2.2 應觸發估值泡沫保護", async () => {
    ctx.valuation.pb = 2.5;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.marketStatus).toContain("估值泡沫");
    expect(result.target).toContain("鎖定風險");
  });

  it("z2Ratio 超過門檻應觸發再平衡", async () => {
    ctx.z2Ratio = 35;
    ctx.currentZ2Value = 350000;

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.marketStatus).toContain("再平衡");
    expect(result.target).toContain("降槓桿");
  });

  it("正常市況應走到 ScoringDecisionRule 回傳中性 DCA", async () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: 0,
      signal: "neutral",
      signalDirection: "hold",
      scalingRatio: 0.3,
      categoryResults: {
        valuation: { label: "估值", finalScore: 0, isCapped: false },
      },
    });

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.target).toContain("0050 DCA");
    expect(result.signalDirection).toBe("hold");
  });

  it("buy_tactical 訊號應回傳戰術加碼決策", async () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: 8,
      signal: "buy_tactical",
      signalDirection: "buy_tactical",
      scalingRatio: 0.6,
      categoryResults: {
        valuation: { label: "估值", finalScore: 5, isCapped: false },
      },
    });

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.target).toContain("撥款加碼");
    expect(result.signalDirection).toBe("buy_tactical");
  });

  it("sell_tactical 訊號應回傳戰術減倉決策", async () => {
    generateScoringMatrix.mockReturnValue({
      finalScore: -6,
      signal: "sell_tactical",
      signalDirection: "sell_tactical",
      scalingRatio: 1.0,
      categoryResults: {
        valuation: { label: "估值", finalScore: -5, isCapped: false },
      },
    });

    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.target).toContain("降槓桿");
    expect(result.signalDirection).toBe("sell_tactical");
  });

  it("決策結果應包含共享狀態（regimeResult, valuationGuardResult 等）", async () => {
    const chain = await createDefaultDecisionChain();
    const result = await runDecisionChain(
      ctx,
      strategy,
      grossLeverageResult,
      ma60Slope,
      chain,
    );

    expect(result.regimeResult).toBeDefined();
    expect(result.valuationGuardResult).toBeDefined();
    expect(result.regimeState).toBeDefined();
  });
});
