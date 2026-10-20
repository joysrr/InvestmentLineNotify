import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock envGuard at the very top to prevent assertEnv() from running during module load
vi.mock("../../../utils/envGuard.mjs", () => ({
  assertEnv: vi.fn(),
}));

import { runDailyCheck } from "../../../scheduler/dailyCheck.mjs";
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
      p1Balance: 450000,
    },
    vixData: { value: 20.0 },
    usRisk: { soxChg: -0.05, tsmChg: -0.04 },
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
  buildSignalContext: vi.fn().mockReturnValue({}),
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
  });
});
