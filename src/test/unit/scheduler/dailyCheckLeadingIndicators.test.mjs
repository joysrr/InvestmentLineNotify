import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock envGuard at the very top to prevent assertEnv() from running during module load
vi.mock("../../../utils/envGuard.mjs", () => ({
  assertEnv: vi.fn(),
}));

import { runDailyCheck } from "../../../scheduler/dailyCheck.mjs";
import { buildDailyRunContext } from "../../../domain/dailyRunContext.mjs";
import * as leadingEvaluator from "../../../modules/strategy/leadingIndicatorEvaluator.mjs";
import * as notifier from "../../../modules/notifications/notifier.mjs";
import { archiveManager } from "../../../modules/data/archiveManager.mjs";

// Mock 相依
vi.mock("../../../domain/dailyRunContext.mjs", () => ({
  buildDailyRunContext: vi.fn().mockResolvedValue({
    openToday: true,
    lastState: {
      totalAssets: 3500000,
      totalLiabilities: 1500000,
      netAssetValue: 2000000,
    },
    vixData: { value: 20.0 },
    usRisk: { soxChg: -5, tsmChg: -4 },
    taifexNight: {
      changePct: -0.0015,
      dayToNightChangePct: 0.00694,
      dataStatus: "VERIFIED",
    },
    taifexRetailSentiment: {
      totalOi: 20051,
      institutionalNetOi: -9142,
      retailNetOi: 9142,
      rsr: 45.59,
      dataStatus: "VERIFIED",
    },
    macroData: {
      rawMargin: {
        maintenanceRatio: "138.0",
        dayChangeRate: "-2.5",
      },
    },
    socialSentiment: {},
    historyZ2: { closes: [100, 102], dates: ["2026-10-19", "2026-10-20"] },
    history0050: { closes: [150, 151], dates: ["2026-10-19", "2026-10-20"] },
    currentPriceZ2: 102,
    finalPriceZ2: 102,
    price0050: 151,
    newsStructured: { tw: [], us: [] },
    newsSummaryText: "新聞摘要",
    macroTextForCoach: "宏觀",
    macroAndChipStr: "籌碼",
    previousAdviceSummary: "前期建議",
    quote: { quote: "名言" },
    sourceMetadata: {},
    newsAnalysisStatus: "success",
    valuationGuardState: { latchActive: false },
  }),
}));

vi.mock("../../../domain/signalContext.mjs", () => ({
  buildSignalContext: vi.fn().mockReturnValue({
    signalData: {
      bias60: 0.0039,
      bias60DataStatus: "VERIFIED",
    },
    finalPriceZ2: 102,
  }),
}));

vi.mock("../../../modules/strategy/strategyEngine.mjs", () => ({
  getInvestmentSignalAsync: vi.fn().mockResolvedValue({
    marketState: { twMarket: { changePct: -0.02, bias60: -0.05 } },
    signals: {},
    strategySnapshot: {},
  }),
  fetchStrategyConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../modules/notifications/notifier.mjs", () => ({
  broadcastDailyReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../modules/ai/aiCoach.mjs", () => ({
  getAiInvestmentAdvice: vi
    .fn()
    .mockResolvedValue({ advice: {}, traceId: "t1" }),
}));

vi.mock("../../../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestReport: vi.fn().mockResolvedValue(null),
    saveReport: vi.fn().mockResolvedValue(undefined),
    saveValuationGuardState: vi.fn().mockResolvedValue(undefined),
    getHighsSince: vi.fn().mockResolvedValue([]),
    getHistoricalLoan: vi.fn().mockResolvedValue(0),
    getMarketHistory: vi.fn().mockResolvedValue([]),
    getFreshnessShadowStats: vi.fn().mockResolvedValue({ samples: [] }),
    saveFreshnessShadowStats: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../modules/notifications/transports/telegramClient.mjs", () => ({
  sendTelegramBatch: vi.fn().mockResolvedValue(undefined),
  unpinAllChatMessages: vi.fn().mockResolvedValue(undefined),
}));

describe("Phase A: dailyCheck Leading Indicators Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dailyCheck 執行時正確呼叫 evaluateLeadingIndicators 並將結果持久化至 saveReport", async () => {
    const evaluateSpy = vi.spyOn(leadingEvaluator, "evaluateLeadingIndicators");

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy.mock.calls[0][0].marketData.rSox).toBeCloseTo(-0.05, 5);
    expect(evaluateSpy.mock.calls[0][0].marketData.rTsm).toBeCloseTo(-0.04, 5);
    expect(evaluateSpy.mock.calls[0][0].marketData.rNight).toBeCloseTo(
      0.00694,
      5,
    );
    expect(evaluateSpy.mock.calls[0][0].marketData.nightDataStatus).toBe(
      "VERIFIED",
    );
    expect(evaluateSpy.mock.calls[0][0].marketData.rsr).toBeCloseTo(45.59, 2);
    expect(
      evaluateSpy.mock.calls[0][0].marketData.retailSentimentDataStatus,
    ).toBe("VERIFIED");
    const saveReportCalls = vi.mocked(archiveManager.saveReport).mock.calls;
    expect(saveReportCalls.length).toBeGreaterThan(0);
    const savedReport = saveReportCalls[0][0];

    // 驗證報告中儲存了 leadingIndicators 欄位
    expect(savedReport.leadingIndicators).toBeDefined();
    expect(savedReport.leadingIndicators.stateMachine).toBeDefined();
    expect(savedReport.portfolioSnapshot).toEqual({
      status: "UNAVAILABLE",
      reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
      source: "INTERNAL_DERIVATION_ONLY",
      asOf: null,
    });
  });

  it("行情 provenance 完整時，saveReport payload 使用 DERIVED snapshot", async () => {
    vi.mocked(buildDailyRunContext).mockResolvedValueOnce({
      openToday: true,
      lastState: {
        qty0050: 12000,
        qtyZ2: 6000,
        cash: 80000,
        totalLoan: 900000,
      },
      price0050: 151,
      currentPriceZ2: 102,
      price0050Snapshot: {
        price: 151,
        asOf: "2026-10-24T06:00:00+08:00",
      },
      priceZ2Snapshot: {
        price: 102,
        asOf: "2026-10-24T06:00:00+08:00",
      },
      finalPriceZ2: 102,
      vixData: { value: 20.0 },
      usRisk: { soxChg: -5, tsmChg: -4 },
      taifexNight: {},
      taifexRetailSentiment: {},
      macroData: { rawMargin: {} },
      socialSentiment: {},
      historyZ2: { closes: [100, 102], dates: ["2026-10-19", "2026-10-20"] },
      history0050: { closes: [150, 151], dates: ["2026-10-19", "2026-10-20"] },
      newsStructured: { tw: [], us: [] },
      newsSummaryText: "新聞摘要",
      macroTextForCoach: "宏觀",
      macroAndChipStr: "籌碼",
      previousAdviceSummary: "前期建議",
      quote: { quote: "名言" },
      sourceMetadata: {},
      newsAnalysisStatus: "success",
      valuationGuardState: { latchActive: false },
    });

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    const savedReport = vi.mocked(archiveManager.saveReport).mock.calls[0][0];
    expect(savedReport.portfolioSnapshot).toMatchObject({
      status: "DERIVED",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-24T06:00:00+08:00",
    });
    expect(savedReport.portfolioSnapshot.accountNetAsset).toBe(1604000);
    // 驗證 theoreticalShadow 正確解析非同步 Promise 且持久化為 AVAILABLE
    expect(savedReport.theoreticalShadow).toBeDefined();
    expect(savedReport.theoreticalShadow.status).toBe("AVAILABLE");
    expect(savedReport.theoreticalShadow.theory.kellyLimits).toBeDefined();
  });

  it("evaluator 收到正確的 bias60 與 bias60DataStatus，且 saveReport payload 保留這些值", async () => {
    const evaluateSpy = vi.spyOn(leadingEvaluator, "evaluateLeadingIndicators");

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    // 確認 evaluator 收到 signalContext 的 bias60
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    const marketData = evaluateSpy.mock.calls[0][0].marketData;
    expect(marketData.bias60).toBeCloseTo(0.0039, 4);
    expect(marketData.bias60DataStatus).toBe("VERIFIED");

    // 確認 saveReport payload 保留 bias60 相關指標
    const saveReportCalls = vi.mocked(archiveManager.saveReport).mock.calls;
    expect(saveReportCalls.length).toBeGreaterThan(0);
    const savedReport = saveReportCalls[0][0];

    expect(savedReport.leadingIndicators.radars.extremePanic).toBeDefined();
    const epMetrics = savedReport.leadingIndicators.radars.extremePanic.metrics;
    expect(epMetrics.bias60).toBeCloseTo(0.0039, 4);
    expect(epMetrics.bias60DataStatus).toBe("VERIFIED");
  });

  it("evaluator 收到正確的 rsr 與 retailSentimentDataStatus，且 saveReport payload 保留這些值", async () => {
    const evaluateSpy = vi.spyOn(leadingEvaluator, "evaluateLeadingIndicators");

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    const marketData = evaluateSpy.mock.calls[0][0].marketData;
    expect(marketData.rsr).toBeCloseTo(45.59, 2);
    expect(marketData.retailSentimentDataStatus).toBe("VERIFIED");

    const savedReport = vi.mocked(archiveManager.saveReport).mock.calls[0][0];
    const rsMetrics =
      savedReport.leadingIndicators.radars.retailSentiment.metrics;
    expect(rsMetrics.rsr).toBeCloseTo(45.59, 2);
    expect(rsMetrics.dataStatus).toBe("VERIFIED");
  });

  it("bias60 為 null（來源不可用）時不能轉換為 0，且 report 中保留 null", async () => {
    // 覆寫 signalContext mock 返回不可用的 bias60
    const { buildSignalContext } =
      await import("../../../domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValueOnce({
      signalData: {
        bias60: null,
        bias60DataStatus: "SOURCE_UNAVAILABLE",
      },
      finalPriceZ2: 102,
    });

    const evaluateSpy = vi.spyOn(leadingEvaluator, "evaluateLeadingIndicators");

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    const marketData = evaluateSpy.mock.calls[0][0].marketData;
    // null 不可被轉為 0
    expect(marketData.bias60).toBeNull();
    expect(marketData.bias60DataStatus).toBe("SOURCE_UNAVAILABLE");

    const savedReport = vi.mocked(archiveManager.saveReport).mock.calls[0][0];
    const epMetrics = savedReport.leadingIndicators.radars.extremePanic.metrics;
    // report 中的 bias60 必須是 null，不能是 0
    expect(epMetrics.bias60).toBeNull();
  });

  it("rsr 為 null（來源不可用）時 report 中保留 null 而非 0", async () => {
    // 覆寫 dailyRunContext mock 返回不可用的 taifexRetailSentiment
    const { buildDailyRunContext } =
      await import("../../../domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValueOnce({
      openToday: true,
      lastState: {
        totalAssets: 3500000,
        totalLiabilities: 1500000,
        netAssetValue: 2000000,
      },
      vixData: { value: 20.0 },
      usRisk: { soxChg: -5, tsmChg: -4 },
      taifexNight: {
        changePct: null,
        dayToNightChangePct: null,
        dataStatus: "SOURCE_UNAVAILABLE",
      },
      taifexRetailSentiment: {
        totalOi: null,
        institutionalNetOi: null,
        retailNetOi: null,
        rsr: null,
        dataStatus: "SOURCE_UNAVAILABLE",
      },
      macroData: {
        rawMargin: { maintenanceRatio: "138.0", dayChangeRate: "-2.5" },
      },
      socialSentiment: {},
      historyZ2: { closes: [100, 102], dates: ["2026-10-19", "2026-10-20"] },
      history0050: { closes: [150, 151], dates: ["2026-10-19", "2026-10-20"] },
      currentPriceZ2: 102,
      finalPriceZ2: 102,
      price0050: 151,
      newsStructured: { tw: [], us: [] },
      newsSummaryText: "新聞摘要",
      macroTextForCoach: "宏觀",
      macroAndChipStr: "籌碼",
      previousAdviceSummary: "前期建議",
      quote: { quote: "名言" },
      sourceMetadata: {},
      newsAnalysisStatus: "success",
      valuationGuardState: { latchActive: false },
    });

    const evaluateSpy = vi.spyOn(leadingEvaluator, "evaluateLeadingIndicators");

    await runDailyCheck({
      isTelegramEnabled: false,
      isAIAdvisor: false,
      isCallAI: false,
      isSheetEnabled: false,
    });

    const marketData = evaluateSpy.mock.calls[0][0].marketData;
    expect(marketData.rsr).toBeNull();
    expect(marketData.retailSentimentDataStatus).toBe("SOURCE_UNAVAILABLE");

    const savedReport = vi.mocked(archiveManager.saveReport).mock.calls[0][0];
    const rsMetrics =
      savedReport.leadingIndicators.radars.retailSentiment.metrics;
    expect(rsMetrics.rsr).toBeNull();
  });
});
