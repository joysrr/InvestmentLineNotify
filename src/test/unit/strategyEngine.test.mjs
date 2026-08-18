/**
 * strategyEngine.test.mjs
 * 策略引擎 N-asset 查詢測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildEngineContext,
  evaluateInvestmentSignal,
  formatSignalOutput,
  determineSignalCategory,
  determineSignalType,
  applyBudgetSynergy,
  attachReplaySignalData,
} from "../../modules/strategy/strategyEngine.mjs";
import {
  AssetRegistry,
  ASSET_TYPES,
  createDefaultAssetRegistry,
} from "../../modules/assets/assetRegistry.mjs";

// Mock dependencies
vi.mock("../../modules/strategy/signalRules.mjs", () => ({
  computeEntryScore: vi.fn(() => ({ weightScore: 50, weightDetails: {} })),
  computeReversalTriggers: vi.fn(() => null),
  computeOverheatState: vi.fn(() => null),
  computeSellSignals: vi.fn(() => null),
}));

vi.mock("../../modules/strategy/indicators.mjs", () => ({
  calcHHV: vi.fn(() => 100),
  getMACDSignal: vi.fn(() => "buy"),
}));

vi.mock("../../modules/strategy/leverageMonitor.mjs", () => ({
  computeGrossLeverage: vi.fn(() => null),
}));

vi.mock("../../modules/strategy/signalGenerator.mjs", () => ({
  generateScoringMatrix: vi.fn(() => ({})),
}));

vi.mock("../../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getHighsSince: vi.fn(() => Promise.resolve([])),
    getHistoricalLoan: vi.fn(() => Promise.resolve(0)),
  },
}));

vi.mock("../../modules/strategy/lifecycleEngine.mjs", () => ({
  computeLifecycleContext: vi.fn(() => ({})),
}));

vi.mock("../../modules/strategy/core/index.mjs", () => ({
  checkCooldown: vi.fn(() =>
    Promise.resolve({ inCooldown: false, daysLeft: 0 }),
  ),
}));

vi.mock("../../modules/strategy/policies/index.mjs", () => ({
  resolveEntryGate: vi.fn(() => null),
  resolveVixOverride: vi.fn(() => ({ overrideActive: false })),
  resolveMacroSentiment: vi.fn(() => ({})),
  analyzeMarginRisk: vi.fn(() => ({ currentMargin: 200, riskLevel: "Normal" })),
  analyzeCapitalDecoupling: vi.fn(() => ({})),
  analyzeSurvival: vi.fn(() => ({})),
  resolveBudgetSynergy: vi.fn(() => null),
  resolveConversionGuard: vi.fn(() => null),
  resolveBudgetLimit: vi.fn(() => ({
    allowedAmount: 100000,
    isLimited: false,
  })),
  applyRiskOverride: vi.fn((r) => r),
  calculateRequestedLoanAmount: vi.fn(() => 50000),
  applyInterestCostFilter: vi.fn(() => ({})),
  applyInterestCostFilterToDecision: vi.fn((d) => d),
  getMarginFinancingData: vi.fn(() => ({})),
}));

vi.mock("../../utils/coreUtils.mjs", () => ({
  parseNumber: vi.fn((v) => v),
}));

vi.mock("../../utils/normalizer.mjs", () => ({
  normalizeMarketData: vi.fn((d) => d),
}));

vi.mock("../../modules/strategy/decision/chain.mjs", () => ({
  runDecisionChain: vi.fn(() =>
    Promise.resolve({
      signalDirection: "long",
      target: "🔹 0050 DCA",
      targetSuggestion: "維持觀望",
      marketStatus: "🌱",
      weightScore: 50,
      finalScore: 50,
      scalingRatio: 1,
      categoryResults: {},
      panicBypassActive: false,
      regimeState: "NORMAL",
      regimeResult: {},
      entryGateLevel: "OK",
      trailingActive: false,
      dynamicAnchor: null,
      budgetInfo: {},
      valuationGuardResult: null,
      valuationMomentumResult: null,
      cooldownStatus: { inCooldown: false },
    }),
  ),
  createDefaultDecisionChain: vi.fn(() => []),
}));

vi.mock("../../modules/strategy/policies/budgetLimitPolicy.mjs", () => ({
  resolveBudgetLimit: vi.fn(() => ({
    allowedAmount: 100000,
    isLimited: false,
  })),
}));

vi.mock("../../modules/strategy/policies/budgetSynergyPolicy.mjs", () => ({
  resolveBudgetSynergy: vi.fn(() => null),
}));

vi.mock("../../modules/strategy/policies/interestCostFilterPolicy.mjs", () => ({
  applyInterestCostFilter: vi.fn(() => ({})),
  applyInterestCostFilterToDecision: vi.fn((d) => d),
}));

vi.mock("../../modules/strategy/strategyLoader.mjs", () => ({
  fetchStrategyConfigUnified: vi.fn(() =>
    Promise.resolve({
      trading: { cooldownDays: 20, budget: { rollingDays: 10 } },
      macroSentiment: { enabled: true, bearishCooldownMultiplier: 1.5 },
      sell: { trailingStop: { enabled: false } },
      grossLeverage: { enabled: true, maxRatio: 3 },
      dynamicDeleverage: { triggerRatio: 0.85, targetRatio: 0.7 },
      valuationGuard: { enabled: true },
      buy: { entryGate: { enabled: true }, minDropPercentToConsider: 1 },
    }),
  ),
}));

describe("StrategyEngine - N-asset Registry 查詢", () => {
  let registry;
  let strategy;

  beforeEach(() => {
    registry = createDefaultAssetRegistry();

    strategy = {
      trading: { cooldownDays: 20, budget: { rollingDays: 10 } },
      macroSentiment: { enabled: true, bearishCooldownMultiplier: 1.5 },
      sell: { trailingStop: { enabled: false } },
      grossLeverage: { enabled: true, maxRatio: 3 },
      dynamicDeleverage: { triggerRatio: 0.85, targetRatio: 0.7 },
      valuationGuard: { enabled: true },
      buy: { entryGate: { enabled: true }, minDropPercentToConsider: 1 },
      scoringMatrix: { thresholds: { buyTactical: 5, buyTacticalBullish: 3 } },
      overrideHierarchy: {
        panicBypassEnabled: true,
        panicBypassDropPct: 20,
        panicVixThreshold: 30,
      },
    };
  });

  describe("buildEngineContext - Registry 查詢", () => {
    it("ctx.portfolio 應包含完整的 assets 物件而非單一 qty0050/qtyZ2", () => {
      const data = {
        portfolio: {
          assets: {
            "0050": { qty: 1000, avgCost: 150 },
            "00675L": { qty: 500, avgCost: 300 },
          },
          cash: 50000,
          totalLoan: 100000,
        },
        price0050: 175,
        currentPrice: 275,
        VIX: 20,
        RSI: 50,
        vixArr: [20],
        macroMarketDirection: "BULL",
        rawValuation: {},
        indicators0050: {},
        pbRecords: [],
        pbRecordsObjects: [],
        valuationGuardState: {},
        closeArr: [175],
        ma20Arr: [170],
        atrArr: [5],
        macdArr: [{ macd: 1, signal: 0.5, hist: 0.5 }],
        ma60SlopeArr: [0.1],
        institutionalNet: 0,
        institutionalHistory: [],
      };

      const derived = {
        priceChangePercent: 0,
        priceUpPercent: 0,
        priceDropPercent: 0,
        maintenanceMargin: 200,
        z2Ratio: 50,
        netAsset: 200000,
        currentZ2Value: 137500,
        vixArr: [20],
        cooldownStatus: { inCooldown: false, daysLeft: 0 },
        macroSentiment: {},
        marginAnalysis: { currentMargin: 200, riskLevel: "Normal" },
        decouplingAnalysis: {},
        survivalAnalysis: {},
        entry: { weightScore: 50, weightDetails: {} },
        overheat: null,
        reversal: null,
        sellSignals: null,
        highsSince: [],
        historyLoan10d: 0,
      };

      const ctx = buildEngineContext(data, derived);

      // 驗證新格式 portfolio.assets 存在
      expect(ctx.portfolio).toBeDefined();
      expect(ctx.portfolio.assets).toBeDefined();
      expect(ctx.portfolio.assets["0050"]).toBeDefined();
      expect(ctx.portfolio.assets["00675L"]).toBeDefined();
      expect(ctx.portfolio.assets["0050"].qty).toBe(1000);
      expect(ctx.portfolio.assets["00675L"].qty).toBe(500);
    });

    it("ctx 應包含 Registry 查詢結果", () => {
      const data = {
        portfolio: {
          assets: {
            "0050": { qty: 1000 },
            "00675L": { qty: 500 },
          },
          cash: 50000,
          totalLoan: 100000,
        },
        price0050: 175,
        currentPrice: 275,
        VIX: 20,
        RSI: 50,
        vixArr: [20],
        macroMarketDirection: "BULL",
        rawValuation: {},
        indicators0050: {},
        pbRecords: [],
        pbRecordsObjects: [],
        valuationGuardState: {},
        closeArr: [175],
        ma20Arr: [170],
        atrArr: [5],
        macdArr: [{ macd: 1, signal: 0.5, hist: 0.5 }],
        ma60SlopeArr: [0.1],
        institutionalNet: 0,
        institutionalHistory: [],
      };

      const derived = {
        priceChangePercent: 0,
        priceUpPercent: 0,
        priceDropPercent: 0,
        maintenanceMargin: 200,
        z2Ratio: 50,
        netAsset: 200000,
        currentZ2Value: 137500,
        vixArr: [20],
        cooldownStatus: { inCooldown: false, daysLeft: 0 },
        macroSentiment: {},
        marginAnalysis: { currentMargin: 200, riskLevel: "Normal" },
        decouplingAnalysis: {},
        survivalAnalysis: {},
        entry: { weightScore: 50, weightDetails: {} },
        overheat: null,
        reversal: null,
        sellSignals: null,
        highsSince: [],
        historyLoan10d: 0,
      };

      const ctx = buildEngineContext(data, derived);

      // 驗證 ctx 包含策略需要的所有欄位
      expect(ctx.currentPrice).toBe(275);
      expect(ctx.replaySignalData).toEqual(expect.any(Object));
      expect(ctx.basePrice).toBe(175);
      expect(ctx.maintenanceMargin).toBe(200);
      expect(ctx.z2Ratio).toBe(50);
      expect(ctx.netAsset).toBe(200000);
      expect(ctx.currentZ2Value).toBe(137500);
      expect(ctx.vix).toBe(20);
      expect(ctx.rsi).toBe(50);
    });
  });

  describe("Registry 動態查詢方法", () => {
    it("getDcaAssets 應回傳可 DCA 的資產", () => {
      const dcaAssets = registry.getDcaAssets();
      expect(dcaAssets.length).toBeGreaterThan(0);
      expect(dcaAssets.every((a) => a.isDca === true)).toBe(true);
      expect(dcaAssets.map((a) => a.id)).toContain("0050");
    });

    it("getSellableAssets 應回傳可賣出的資產", () => {
      const sellableAssets = registry.getSellableAssets();
      expect(sellableAssets.length).toBeGreaterThan(0);
      expect(sellableAssets.every((a) => a.sellable === true)).toBe(true);
      expect(sellableAssets.map((a) => a.id)).toContain("00675L");
    });

    it("getPledgeableAssets 應回傳可質押的資產 (BASE 類型)", () => {
      const pledgeableAssets = registry.getPledgeableAssets();
      expect(pledgeableAssets.length).toBeGreaterThan(0);
      expect(pledgeableAssets.every((a) => a.type === ASSET_TYPES.BASE)).toBe(
        true,
      );
      expect(pledgeableAssets.map((a) => a.id)).toContain("0050");
    });

    it("getLeveragedAssets 應回傳槓桿資產 (LEVERAGED 類型)", () => {
      const leveragedAssets = registry.getLeveragedAssets();
      expect(leveragedAssets.length).toBeGreaterThan(0);
      expect(
        leveragedAssets.every((a) => a.type === ASSET_TYPES.LEVERAGED),
      ).toBe(true);
      expect(leveragedAssets.map((a) => a.id)).toContain("00675L");
    });

    it("getAssetsByType 應按類型過濾", () => {
      const baseAssets = registry.getAssetsByType(ASSET_TYPES.BASE);
      const leveragedAssets = registry.getAssetsByType(ASSET_TYPES.LEVERAGED);
      expect(baseAssets.every((a) => a.type === ASSET_TYPES.BASE)).toBe(true);
      expect(
        leveragedAssets.every((a) => a.type === ASSET_TYPES.LEVERAGED),
      ).toBe(true);
    });

    it("hasAsset 應正確檢查存在性", () => {
      expect(registry.hasAsset("0050")).toBe(true);
      expect(registry.hasAsset("00675L")).toBe(true);
      expect(registry.hasAsset("NONEXISTENT")).toBe(false);
    });

    it("getAsset 應回傳完整資產定義", () => {
      const asset = registry.getAsset("0050");
      expect(asset).toBeDefined();
      expect(asset.id).toBe("0050");
      expect(asset.symbol).toBe("0050.TW");
      expect(asset.type).toBe(ASSET_TYPES.BASE);
      expect(asset.leverage).toBe(1);
      expect(asset.isDca).toBe(true);
      expect(asset.sellable).toBe(false);
    });
  });

  describe("formatSignalOutput - 輸出格式向後相容", () => {
    it("應同時輸出新格式 portfolio.assets 與舊欄位 qty0050/qtyZ2", () => {
      const ctx = {
        portfolio: {
          assets: {
            "0050": { qty: 1000, avgCost: 150 },
            "00675L": { qty: 500, avgCost: 300 },
          },
          cash: 50000,
          totalLoan: 100000,
        },
        rsi: 50,
        indicators: { kdArr: [{ k: 60, d: 50 }] },
        reversal: null,
        sellSignals: null,
        entry: { weightScore: 50, weightDetails: {} },
        cooldownStatus: { inCooldown: false },
        vix: 20,
        vixArr: [20],
      };

      const finalDecision = {
        marketStatus: "🌱",
        target: "🔹 0050 DCA",
        targetSuggestion: "維持觀望",
        signalDirection: "long",
        weightScore: 50,
        finalScore: 50,
        categoryResults: {},
        scalingRatio: 1,
        panicBypassActive: false,
        regimeState: "NORMAL",
        regimeResult: {},
        entryGateLevel: "OK",
        trailingActive: false,
        dynamicAnchor: null,
        budgetInfo: {},
        valuationGuardResult: null,
        valuationMomentumResult: null,
        cooldownStatus: { inCooldown: false },
      };

      const derived = {
        priceChangePercent: 1.5,
        bias240: 2.5,
        actualLeverage: 1.2,
        maintenanceMargin: 200,
        z2Ratio: 50,
        grossLeverageResult: { grossLeverage: 1.5, status: "normal" },
        marginAnalysis: { riskLevel: "Normal" },
        decouplingAnalysis: {},
        macdSignal: "buy",
      };

      const output = formatSignalOutput(ctx, finalDecision, derived);

      // 新格式
      expect(output.portfolio).toBeDefined();
      // 舊欄位向後相容
      expect(output.priceChangePercent).toBeDefined();
      expect(output.maintenanceMargin).toBe(200);
      expect(output.z2Ratio).toBe(50);
    });

    it("前置攔截時 finalScore 為 null 且明確標示 P100 未執行", () => {
      const output = formatSignalOutput(
        {
          portfolio: {},
          rsi: 50,
          indicators: { kdArr: [] },
          entry: { weightScore: 0, weightDetails: {} },
        },
        { finalScore: null },
        {
          priceChangePercent: 0,
          bias240: null,
          actualLeverage: 1,
          maintenanceMargin: 999,
          z2Ratio: 0,
          grossLeverageResult: null,
          marginAnalysis: null,
          decouplingAnalysis: null,
          macdSignal: null,
        },
      );

      expect(output.finalScore).toBeNull();
      expect(output.scoringMatrixExecuted).toBe(false);
    });
  });

  describe("determineSignalCategory", () => {
    it("panicBypassActive 應回傳 panic", () => {
      const ctx = { priceDropPercent: 10 };
      const finalDecision = {
        panicBypassActive: true,
        target: "觀望",
        trailingActive: false,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("panic");
    });

    it("trailingActive 應回傳 take_profit", () => {
      const ctx = { priceDropPercent: 10 };
      const finalDecision = {
        panicBypassActive: false,
        target: "觀望",
        trailingActive: true,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("take_profit");
    });

    it("target 包含 再平衡 應回傳 rebalance", () => {
      const ctx = { priceDropPercent: 10 };
      const finalDecision = {
        panicBypassActive: false,
        target: "再平衡",
        trailingActive: false,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("rebalance");
    });

    it("跌幅 >= 30% 應回傳 panic", () => {
      const ctx = { priceDropPercent: 35 };
      const finalDecision = {
        panicBypassActive: false,
        target: "觀望",
        trailingActive: false,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("panic");
    });

    it("跌幅 >= 15% 且非 DCA/觀望 應回傳 deep_drop", () => {
      const ctx = { priceDropPercent: 20 };
      const finalDecision = {
        panicBypassActive: false,
        target: "🔹 加碼",
        trailingActive: false,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("deep_drop");
    });

    it("預設 baseline", () => {
      const ctx = { priceDropPercent: 5 };
      const finalDecision = {
        panicBypassActive: false,
        target: "🔹 0050 DCA",
        trailingActive: false,
      };
      expect(determineSignalCategory(ctx, finalDecision)).toBe("baseline");
    });
  });

  describe("determineSignalType", () => {
    it("panic -> tactical_panic", () => {
      expect(determineSignalType("panic")).toBe("tactical_panic");
    });
    it("deep_drop -> tactical_drop", () => {
      expect(determineSignalType("deep_drop")).toBe("tactical_drop");
    });
    it("baseline -> baseline", () => {
      expect(determineSignalType("baseline")).toBe("baseline");
    });
  });

  describe("applyBudgetSynergy", () => {
    it("synergy 為 null 時回傳原 decision", () => {
      const decision = { target: "觀望" };
      expect(applyBudgetSynergy(decision, null)).toBe(decision);
    });

    it("target 不為觀望時不修改", () => {
      const decision = { target: "🔹 0050 DCA" };
      const synergy = {
        label: "提前 DCA",
        suggestedAmount: 10000,
        suggestion: "建議提前",
      };
      const result = applyBudgetSynergy(decision, synergy);
      expect(result.target).toBe("🔹 0050 DCA");
    });

    it("target 為觀望時套用 synergy", () => {
      const decision = { target: "觀望", suggestion: "" };
      const synergy = {
        label: "提前 DCA",
        suggestedAmount: 10000,
        suggestion: "建議提前",
      };
      const result = applyBudgetSynergy(decision, synergy);
      expect(result.target).toBe("提前 DCA");
      expect(result.targetSuggestionShort).toContain("10,000");
    });
  });
});

describe("buildEngineContext raw provider bridge", () => {
  it("attaches replay scoring data without changing result", () => {
    const result = { signals: { signalDirection: "hold" } };
    const ctx = { replaySignalData: { currentPR: 42 } };

    expect(attachReplaySignalData(result, ctx)).toEqual({
      ...result,
      replaySignalData: { currentPR: 42 },
    });
  });

  it("converts raw institutional net buy into scoring input units", () => {
    const ctx = buildEngineContext(
      {
        currentPrice: 300,
        basePrice: 300,
        VIX: 20,
        RSI: 50,
        portfolio: { assets: {}, cash: 0 },
        rawValuation: {},
        rawInstitutional: { totalNetBuy: 28074345 },
        closeArr: [],
        ma20Arr: [],
        atrArr: [],
        macdArr: [],
        ma60SlopeArr: [],
        rsiArr: [],
        kdArr: [],
      },
      {
        priceChangePercent: 0,
        priceUpPercent: 0,
        priceDropPercent: 0,
        maintenanceMargin: 999,
        z2Ratio: 0,
        netAsset: 1,
        currentZ2Value: 0,
        vixArr: [],
        cooldownStatus: { inCooldown: false },
        macroSentiment: null,
        marginAnalysis: null,
        decouplingAnalysis: null,
        survivalAnalysis: null,
        entry: { weightScore: 0 },
        overheat: null,
        reversal: null,
        sellSignals: null,
        highsSince: [],
        historyLoan10d: 0,
      },
    );

    expect(ctx.institutionalNet).toBeCloseTo(28.074345, 6);
    expect(ctx.institutionalHistory).toEqual([]);
  });
});
