/**
 * Test: dailyCheck should use TELEGRAM_WEBAPP_URL env var for non-trading day messages
 *
 * Bug: dailyCheck.mjs was using TELEGRAM_MINIAPP_URL (wrong env var name)
 * instead of TELEGRAM_WEBAPP_URL (the actual env var in .env)
 * This caused web_app button URL to fall back to t.me link, which
 * Telegram rejects with "Bad Request: BUTTON_URL_INVALID" -> HTTP 400
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock envGuard FIRST to prevent assertEnv() from running during module load
vi.mock("../../../../src/utils/envGuard.mjs", () => ({
  assertEnv: vi.fn(),
}));

// Mock externals
const mockSendTelegramBatch = vi.fn();
const mockBuildDailyRunContext = vi.fn();
const mockBuildReportPortfolioSnapshot = vi.fn();
const mockBuildTheoreticalShadowForReport = vi.fn();

vi.mock("../../../../src/modules/ai/aiClient.mjs", () => ({
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
}));
vi.mock("../../../../src/utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  setGlobalContext: vi.fn(),
  clearGlobalContext: vi.fn(),
}));
vi.mock("../../../../src/modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getPortfolioState: vi.fn(),
    updatePortfolioState: vi.fn(),
  },
}));
vi.mock(
  "../../../../src/modules/portfolio/verifiedPortfolioFields.mjs",
  () => ({
    buildVerifiedPortfolioState: vi.fn(),
  }),
);

const mockBuilder = vi.fn();
vi.mock(
  "../../../../src/modules/notifications/templates/telegramHtmlBuilder.mjs",
  () => ({
    buildNonTradingDayMessage: (...args) => mockBuilder(...args),
    buildTradingDayMessage: vi.fn(),
    buildLeadingIndicatorsMessage: vi.fn(),
  }),
);

vi.mock(
  "../../../../src/modules/notifications/transports/telegramClient.mjs",
  () => ({
    sendTelegramBatch: (...args) => mockSendTelegramBatch(...args),
  }),
);

vi.mock("../../../../src/domain/dailyRunContext.mjs", () => ({
  buildDailyRunContext: (...args) => mockBuildDailyRunContext(...args),
}));
vi.mock(
  "../../../../src/modules/portfolio/reportPortfolioSnapshot.mjs",
  () => ({
    buildReportPortfolioSnapshot: (...args) =>
      mockBuildReportPortfolioSnapshot(...args),
  }),
);
vi.mock("../../../../src/modules/strategy/theoreticalShadowReport.mjs", () => ({
  buildTheoreticalShadowForReport: (...args) =>
    mockBuildTheoreticalShadowForReport(...args),
}));

// Set env vars AFTER mocks are set up
process.env.TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN || "test_token";
process.env.TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID || "123";
process.env.TELEGRAM_WEBAPP_URL = "https://joysrr.duckdns.org";
delete process.env.TELEGRAM_MINIAPP_URL;

// Import after mocks
const { runDailyCheck } =
  await import("../../../../src/scheduler/dailyCheck.mjs");

describe("dailyCheck - TELEGRAM_WEBAPP_URL usage (Non-Trading Day)", () => {
  beforeAll(() => {
    mockBuildDailyRunContext.mockResolvedValue({
      lastState: { totalValue: 1500000, cash: 270995 },
      openToday: false,
      socialSentiment: {
        success: true,
        data: { score: 56, scoreLabel: "中性" },
      },
      usRisk: { riskLevel: "正常", vix: 19.03, spxChg: "0.58%" },
      macroData: { fx: { usdTwd: 32.5 } },
      newsStructured: { tw: [{ title: "test" }], us: [] },
      newsSummaryText: "",
      price0050: 106.9,
      price0050Snapshot: { asOf: new Date(), close: 106.9 },
      priceZ2Snapshot: { asOf: new Date(), close: 311 },
    });

    mockBuildReportPortfolioSnapshot.mockReturnValue({
      status: "UNAVAILABLE",
      reason: "non_trading_day",
    });

    mockBuildTheoreticalShadowForReport.mockReturnValue({
      status: "AVAILABLE",
      theory: { grossExposure: 0.5 },
    });

    const mockMessage = [{ text: "test", webAppUrl: null, pin: false }];
    mockBuilder.mockReturnValue(mockMessage);

    mockSendTelegramBatch.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
    });
  });

  it("should pass TELEGRAM_WEBAPP_URL value to buildNonTradingDayMessage for webAppUrl", async () => {
    await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: false, isCallAI: false },
    );

    expect(mockBuilder).toHaveBeenCalled();
    const callArg = mockBuilder.mock.calls[0][1];
    expect(callArg).toBe("https://joysrr.duckdns.org");
  });

  it("should NOT pass t.me URL when TELEGRAM_WEBAPP_URL is set", async () => {
    mockBuilder.mockClear();
    mockSendTelegramBatch.mockClear();
    mockBuildDailyRunContext.mockClear().mockResolvedValue({
      lastState: { totalValue: 1500000, cash: 270995 },
      openToday: false,
      socialSentiment: { success: true, data: { score: 56 } },
      usRisk: { riskLevel: "正常", vix: 19.03, spxChg: "0.58%" },
      macroData: { fx: { usdTwd: 32.5 } },
      newsStructured: { tw: [], us: [] },
      newsSummaryText: "",
      price0050: 106.9,
      price0050Snapshot: { asOf: new Date(), close: 106.9 },
      priceZ2Snapshot: { asOf: new Date(), close: 311 },
    });

    await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: false, isCallAI: false },
    );

    const callArg = mockBuilder.mock.calls[0][1];
    expect(callArg).not.toContain("t.me");
  });
});
