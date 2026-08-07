/**
 * Monthly Report 排程單元測試
 * 測試 src/scheduler/monthlyReport.mjs 的核心邏輯
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies at the top level
vi.mock("../../../../src/modules/ai/aiClient.mjs", () => ({
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
}));

vi.mock("../../../../src/utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the internal modules that runMonthlyReport uses
vi.mock("../../../../src/modules/ai/periodReportAgent.mjs", () => ({
  loadRecentReports: vi.fn(),
  buildPeriodStats: vi.fn(),
  generatePeriodAiSummary: vi.fn(),
  buildSignalAccuracyStats: vi.fn(),
}));

vi.mock(
  "../../../../src/modules/notifications/templates/periodReportBuilder.mjs",
  () => ({
    buildPeriodReportMessages: vi.fn(),
    buildCompactPeriodMessage: vi.fn(),
  }),
);

vi.mock(
  "../../../../src/modules/notifications/transports/telegramClient.mjs",
  () => ({
    sendTelegramBatch: vi.fn(),
  }),
);

import { runMonthlyReport } from "../../../../src/scheduler/monthlyReport.mjs";

describe("MonthlyReport Scheduler - 單元測試", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("報告數量不足時應回傳 skipped: true", async () => {
    // Arrange
    const { loadRecentReports } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(loadRecentReports).mockResolvedValue([
      { date: "2026-08-06" },
      { date: "2026-08-05" },
      { date: "2026-08-04" },
      { date: "2026-08-03" },
      { date: "2026-08-02" },
      { date: "2026-08-01" },
      { date: "2026-07-31" },
      { date: "2026-07-30" },
      { date: "2026-07-29" },
    ]); // 9 份，少於 10 份

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    // Act
    const result = await runMonthlyReport({});

    // Assert
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("insufficient_reports");
    expect(result.count).toBe(9);
  });

  it("正常情況下應產生月報並發送", async () => {
    // Arrange - 50 份報告，取後 30 份
    const allReports = Array.from({ length: 50 }, (_, i) => ({
      date: `2026-${String(8 - Math.floor(i / 5)).padStart(2, "0")}-${String((i % 5) + 1).padStart(2, "0")}`,
    }));

    const { loadRecentReports } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(loadRecentReports).mockResolvedValue(allReports);

    const { buildPeriodStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildPeriodStats).mockReturnValue({
      period: "monthly",
      totalReports: 30,
      avgScore: 62,
      signalDistribution: { hold: 20, long: 8, short: 2 },
    });

    const { buildSignalAccuracyStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildSignalAccuracyStats).mockReturnValue({
      totalSignals: 30,
      correctPredictions: 22,
      accuracy: 0.73,
    });

    const { generatePeriodAiSummary } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(generatePeriodAiSummary).mockResolvedValue({
      aiSummary: "測試月報 AI 摘要內容",
    });

    const { buildCompactPeriodMessage } =
      await import("../../../../src/modules/notifications/templates/periodReportBuilder.mjs");
    vi.mocked(buildCompactPeriodMessage).mockReturnValue([
      { text: "測試月報訊息", parse_mode: "HTML" },
    ]);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runMonthlyReport({});

    // Assert
    expect(result.skipped).toBe(false);
    expect(result.reportCount).toBe(30);
    expect(sendTelegramBatch).toHaveBeenCalledTimes(1);
  });

  it("AI 摘要失敗時應降級發送純統計報告", async () => {
    // Arrange
    const allReports = Array.from({ length: 50 }, (_, i) => ({
      date: `2026-${String(8 - Math.floor(i / 5)).padStart(2, "0")}-${String((i % 5) + 1).padStart(2, "0")}`,
    }));

    const { loadRecentReports } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(loadRecentReports).mockResolvedValue(allReports);

    const { buildPeriodStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildPeriodStats).mockReturnValue({
      period: "monthly",
      totalReports: 30,
    });

    const { buildSignalAccuracyStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildSignalAccuracyStats).mockReturnValue({});

    const { generatePeriodAiSummary } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(generatePeriodAiSummary).mockRejectedValue(
      new Error("AI failed"),
    );

    const { buildCompactPeriodMessage } =
      await import("../../../../src/modules/notifications/templates/periodReportBuilder.mjs");
    vi.mocked(buildCompactPeriodMessage).mockReturnValue([
      { text: "測試月報訊息", parse_mode: "HTML" },
    ]);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runMonthlyReport({});

    // Assert
    expect(result.skipped).toBe(false);
    expect(result.reportCount).toBe(30);
  });
});
