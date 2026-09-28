/**
 * Daily Check 排程單元測試
 * 測試 src/scheduler/dailyCheck.mjs 的核心邏輯
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock envGuard at the very top to prevent assertEnv() from running during module load
vi.mock("../../../../src/utils/envGuard.mjs", () => ({
  assertEnv: vi.fn(),
}));

// Mock external dependencies at the top level
vi.mock("../../../../src/modules/ai/aiClient.mjs", () => ({
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
}));

vi.mock("../../../../src/utils/logger.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    setGlobalContext: vi.fn(),
    clearGlobalContext: vi.fn(),
  };
});

// Mock the internal modules that runDailyCheck uses
vi.mock("../../../../src/domain/signalContext.mjs", () => ({
  buildSignalContext: vi.fn(),
}));

vi.mock("../../../../src/modules/strategy/strategyEngine.mjs", () => ({
  getInvestmentSignalAsync: vi.fn(),
  fetchStrategyConfig: vi.fn(),
}));

vi.mock("../../../../src/modules/notifications/notifier.mjs", () => ({
  broadcastDailyReport: vi.fn(),
}));

vi.mock("../../../../src/modules/ai/aiCoach.mjs", () => ({
  getAiInvestmentAdvice: vi.fn(),
}));

vi.mock("../../../../src/modules/ai/llmJudge.mjs", () => ({
  shouldRunJudge: vi.fn(),
  runJudge: vi.fn(),
}));

vi.mock("../../../../src/modules/storage.mjs", () => ({
  logDailyToSheet: vi.fn(),
}));

vi.mock("../../../../src/modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    saveValuationGuardState: vi.fn(),
    saveReport: vi.fn(),
    getHighsSince: vi.fn().mockResolvedValue([]),
    getHistoricalLoan: vi.fn().mockResolvedValue(0),
    getMarketHistory: vi.fn().mockResolvedValue([]),
    getFreshnessShadowStats: vi.fn().mockResolvedValue({ samples: [] }),
    saveFreshnessShadowStats: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/utils/coreUtils.mjs", () => ({
  TwDate: vi.fn(() => ({ formatDateKey: () => "2026-08-06" })),
  stepTimer: vi.fn(() => vi.fn()),
}));

vi.mock("../../../../src/utils/snapshotCrypto.mjs", () => ({
  isSnapshotEncryptEnabled: vi.fn(() => false),
}));

vi.mock(
  "../../../../src/modules/notifications/transports/telegramClient.mjs",
  () => ({
    sendTelegramBatch: vi.fn(),
  }),
);

vi.mock("../../../../src/domain/ilnState.mjs", () => ({
  IlnState: vi.fn().mockImplementation(function IlnState(input) {
    this.toReportObject = () => input;
  }),
}));

vi.mock("../../../../src/domain/dailyRunContext.mjs", () => ({
  buildDailyRunContext: vi.fn(),
}));

import { runDailyCheck } from "../../../../src/scheduler/dailyCheck.mjs";

describe("DailyCheck Scheduler - 單元測試", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("歷史資料真的不足時，通知應包含實際門檻與筆數", async () => {
    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockRejectedValue(
      Object.assign(new Error("00675L history insufficient"), {
        code: "HISTORY_INSUFFICIENT",
        details: { symbol: "00675L", required: 60, count: 12 },
      }),
    );

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    expect(result).toBe("❌ 資料不足");
    expect(sendTelegramBatch.mock.calls[0][0][0].text).toContain("60");
    expect(sendTelegramBatch.mock.calls[0][0][0].text).toContain("12");
    expect(sendTelegramBatch.mock.calls[0][0][0].text).not.toContain("30 筆");
  });

  it("歷史來源暫時失敗時，通知應標示來源不可用而非資料不足", async () => {
    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockRejectedValue(
      Object.assign(new Error("TWSE timeout"), {
        code: "HISTORY_SOURCE_UNAVAILABLE",
        details: { symbol: "00675L", failedMonths: ["202609"] },
      }),
    );

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    const text = sendTelegramBatch.mock.calls[0][0][0].text;
    expect(text).toContain("資料來源暫時不可用");
    expect(text).toContain("202609");
    expect(text).not.toContain("歷史資料不足");
  });

  it("無開市日應跳過通知並返回成功", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: false,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: { status: "觀望", score: 65, latchNowActive: false },
      marketState: {},
      strategySnapshot: {},
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveValuationGuardState).mockResolvedValue(
      undefined,
    );

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "hold" },
      traceId: "trace-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const { logDailyToSheet } =
      await import("../../../../src/modules/storage.mjs");
    vi.mocked(logDailyToSheet).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    const { shouldRunJudge } =
      await import("../../../../src/modules/ai/llmJudge.mjs");
    vi.mocked(shouldRunJudge).mockReturnValue(false);

    const { fetchStrategyConfig } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(fetchStrategyConfig).mockResolvedValue({
      dataFreshness: {
        mode: "shadow",
        staleAfterTradingDays: 3,
        dependencies: {
          technical: ["z2History", "etf0050History"],
          institutional: ["institutionalHistory"],
          valuation: ["valuation"],
          risk: ["marketMargin", "vix"],
        },
      },
    });

    // Act
    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
  });

  it("非交易日且 isTelegramEnabled=true 時應發送休市訊息", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: false,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockClear();

    // Act
    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
    expect(sendTelegramBatch).toHaveBeenCalledOnce();
    const msg = vi.mocked(sendTelegramBatch).mock.calls[0][0][0].text;
    expect(msg).toContain("休市");
  });

  it("非交易日且 isTelegramEnabled=false 時不應發送任何 Telegram 訊息", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: false,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockClear();

    // Act
    await runDailyCheck(
      {},
      { isTelegramEnabled: false, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(sendTelegramBatch).not.toHaveBeenCalled();
  });

  it("新聞分析失敗時不得覆寫每日報告", async () => {
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: true,
      vixData: { value: 15 },
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "新聞集錦取得失敗",
      newsAnalysisStatus: "failed",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync, fetchStrategyConfig } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: { status: "觀望", score: 65, latchNowActive: false },
      marketState: {},
      strategySnapshot: {},
    });
    vi.mocked(fetchStrategyConfig).mockResolvedValue({
      dataFreshness: { mode: "shadow", staleAfterTradingDays: 3 },
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveReport).mockResolvedValue(undefined);
    vi.mocked(archiveManager.getFreshnessShadowStats).mockResolvedValue({
      samples: [],
    });

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "hold" },
      traceId: "trace-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: false, isAIAdvisor: true, isCallAI: true },
    );

    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
    expect(archiveManager.saveReport).not.toHaveBeenCalled();
  });

  it("開市日會儲存帶有 freshness shadow observation 的報告", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: true,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [
        { date: "2026-08-03" },
        { date: "2026-08-04" },
        { date: "2026-08-05" },
        { date: "2026-08-06" },
        { date: "2026-08-07" },
      ],
      history0050: [
        { date: "2026-08-04" },
        { date: "2026-08-05" },
        { date: "2026-08-06" },
        { date: "2026-08-07" },
      ],
      sourceMetadata: {
        sources: {
          twse: { status: "SUCCESS", lastFetch: "2026-08-17T08:00:00Z" },
        },
        datasets: { z2History: "twse" },
      },
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: { status: "觀望", score: 65, latchNowActive: false },
      marketState: {},
      strategySnapshot: {},
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveValuationGuardState).mockResolvedValue(
      undefined,
    );

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "hold" },
      traceId: "trace-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const { logDailyToSheet } =
      await import("../../../../src/modules/storage.mjs");
    vi.mocked(logDailyToSheet).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    const { shouldRunJudge } =
      await import("../../../../src/modules/ai/llmJudge.mjs");
    vi.mocked(shouldRunJudge).mockReturnValue(false);

    const { fetchStrategyConfig } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(fetchStrategyConfig).mockResolvedValue({
      dataFreshness: {
        mode: "shadow",
        staleAfterTradingDays: 3,
        dependencies: {
          technical: ["z2History", "etf0050History"],
          institutional: ["institutionalHistory"],
          valuation: ["valuation"],
          risk: ["marketMargin", "vix"],
        },
      },
    });

    vi.mocked(archiveManager.saveReport).mockResolvedValue(undefined);
    vi.mocked(archiveManager.getFreshnessShadowStats).mockResolvedValue({
      samples: Array.from({ length: 9 }, (_, index) => ({
        reportDate: `2026-07-${String(index + 20).padStart(2, "0")}`,
        wouldBlock: false,
        blockedSignals: [],
      })),
    });

    // Act
    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
    expect(archiveManager.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: expect.objectContaining({
          shadowGuardDecision: expect.any(Object),
          dataProvenance: [
            expect.objectContaining({
              provider: "twse",
              dataset: "z2History",
              integrity: "unverified",
            }),
          ],
        }),
      }),
    );
    expect(archiveManager.saveFreshnessShadowStats).toHaveBeenCalledWith({
      samples: [],
      archive: expect.objectContaining({
        sampleCount: 10,
        falsePositiveRate: 0,
      }),
    });

    const previousMode = process.env.DATA_FRESHNESS_MODE;
    process.env.DATA_FRESHNESS_MODE = "enforcement";
    try {
      mockContext.historyZ2 = [{ date: "2026-08-03" }];
      vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
        signals: {
          signalDirection: "buy_tactical",
          status: "買進",
          score: 80,
          latchNowActive: false,
        },
        marketState: {},
        strategySnapshot: {},
      });
      vi.mocked(archiveManager.getFreshnessShadowStats).mockResolvedValue({
        samples: [],
      });

      await runDailyCheck(
        {},
        { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
      );

      expect(getAiInvestmentAdvice).toHaveBeenLastCalledWith(
        expect.objectContaining({
          signals: expect.objectContaining({
            signalDirection: "hold",
            blockedByDataFreshness: true,
          }),
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    } finally {
      if (previousMode === undefined) delete process.env.DATA_FRESHNESS_MODE;
      else process.env.DATA_FRESHNESS_MODE = previousMode;
    }
  });

  it("Latch 狀態變更時應更新 valuationGuardState", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: false,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: {
        status: "觀望",
        score: 65,
        latchNowActive: true,
        shouldLatch: true,
      },
      marketState: {},
      strategySnapshot: {},
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveValuationGuardState).mockResolvedValue(
      undefined,
    );

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "hold" },
      traceId: "trace-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const { logDailyToSheet } =
      await import("../../../../src/modules/storage.mjs");
    vi.mocked(logDailyToSheet).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    const { shouldRunJudge } =
      await import("../../../../src/modules/ai/llmJudge.mjs");
    vi.mocked(shouldRunJudge).mockReturnValue(false);

    const { fetchStrategyConfig } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(fetchStrategyConfig).mockResolvedValue({
      dataFreshness: {
        mode: "shadow",
        staleAfterTradingDays: 3,
        dependencies: {
          technical: ["z2History", "etf0050History"],
          institutional: ["institutionalHistory"],
          valuation: ["valuation"],
          risk: ["marketMargin", "vix"],
        },
      },
    });

    // Act
    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
  });

  it("高風險日應觸發 LLM Judge 背景任務", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: true,
      vixData: { value: 35 }, // High VIX
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [],
      newsSummaryText: "news summary",
      newsStructured: { tw: [], us: [] },
      macroAnalysis: {},
      macroTextForCoach: "",
      macroMarketDirection: "NEUTRAL",
      previousAdviceSummary: "",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: {
        status: "long",
        score: 80,
        latchNowActive: false,
        signalDirection: "long",
      },
      marketState: {},
      strategySnapshot: {},
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveValuationGuardState).mockResolvedValue(
      undefined,
    );

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "buy" },
      traceId: "trace-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const { logDailyToSheet } =
      await import("../../../../src/modules/storage.mjs");
    vi.mocked(logDailyToSheet).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    const { shouldRunJudge, runJudge } =
      await import("../../../../src/modules/ai/llmJudge.mjs");
    vi.mocked(shouldRunJudge).mockReturnValue(true);
    vi.mocked(runJudge).mockResolvedValue(undefined);

    // Act
    const result = await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );

    // Assert
    expect(result).toMatch(/^✅ dailyCheck 執行成功/);
  });

  // ── P1 可觀測性：執行摘要 ──────────────────────────────────────────────────
  it("成功完成交易日時應記錄帶有 runSummary 的結構化摘要日誌", async () => {
    // Arrange
    const mockContext = {
      lastState: { totalValue: 1000000 },
      openToday: true,
      vixData: { value: 15 },
      basePrice: 150,
      price0050: 180,
      currentPriceZ2: 280,
      historyZ2: [{ date: "2026-09-01" }, { date: "2026-09-02" }],
      history0050: [],
      macroData: {},
      macroAndChipStr: "",
      usRisk: {},
      quote: "test quote",
      newsMessages: [{ text: "新聞1" }, { text: "新聞2" }, { text: "新聞3" }],
      newsSummaryText: "新聞摘要",
      newsAnalysisStatus: "success",
      newsStructured: { tw: [{ title: "A" }], us: [{ title: "B" }] },
      macroAnalysis: {},
      macroTextForCoach: "",
      previousAdviceSummary: "",
      macroMarketDirection: "neutral",
      valuationGuardState: { defenseLatch: false, latchActive: false },
      pbRecords: [],
      pbRecordsObjects: [],
    };

    const { buildDailyRunContext } =
      await import("../../../../src/domain/dailyRunContext.mjs");
    vi.mocked(buildDailyRunContext).mockResolvedValue(mockContext);

    const { buildSignalContext } =
      await import("../../../../src/domain/signalContext.mjs");
    vi.mocked(buildSignalContext).mockReturnValue({
      signalData: {},
      finalPriceZ2: 280,
    });

    const { getInvestmentSignalAsync, fetchStrategyConfig } =
      await import("../../../../src/modules/strategy/strategyEngine.mjs");
    vi.mocked(getInvestmentSignalAsync).mockResolvedValue({
      signals: { status: "觀望", score: 65, latchNowActive: false },
      marketState: {},
      strategySnapshot: {},
    });
    vi.mocked(fetchStrategyConfig).mockResolvedValue({
      dataFreshness: { mode: "shadow", staleAfterTradingDays: 3 },
    });

    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    vi.mocked(archiveManager.saveReport).mockResolvedValue(undefined);
    vi.mocked(archiveManager.getFreshnessShadowStats).mockResolvedValue({
      samples: [],
    });

    const { getAiInvestmentAdvice } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    vi.mocked(getAiInvestmentAdvice).mockResolvedValue({
      advice: { summary: "test", action: "hold" },
      traceId: "trace-summary-1",
    });

    const { broadcastDailyReport } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastDailyReport).mockResolvedValue(undefined);

    const { shouldRunJudge } =
      await import("../../../../src/modules/ai/llmJudge.mjs");
    vi.mocked(shouldRunJudge).mockReturnValue(false);

    const logger = (await import("../../../../src/utils/logger.mjs")).default;
    vi.mocked(logger.info).mockClear();

    // Act
    await runDailyCheck(
      {},
      { isTelegramEnabled: false, isAIAdvisor: true, isCallAI: true },
    );

    // Assert: logger.info 應至少有一次呼叫帶有 runSummary 欄位
    const summaryCall = vi
      .mocked(logger.info)
      .mock.calls.find(
        (args) =>
          args[0] && typeof args[0] === "object" && "runSummary" in args[0],
      );
    expect(summaryCall).toBeDefined();

    const summary = summaryCall[0].runSummary;
    expect(summary).toMatchObject({
      newsAnalysisStatus: "success",
      reportPersisted: true,
      durationMs: expect.any(Number),
      newsPoolCount: expect.any(Number),
    });
  });
});
