/**
 * Weekly Report 排程單元測試
 * 測試 src/scheduler/weeklyReport.mjs 的核心邏輯
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

// Mock the internal modules that runWeeklyReport uses
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

import { runWeeklyReport } from "../../../../src/scheduler/weeklyReport.mjs";

describe("WeeklyReport Scheduler - 單元測試", () => {
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
    ]);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    // Act
    const result = await runWeeklyReport({});

    // Assert
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("insufficient_reports");
    expect(result.count).toBe(2);
  });

  it("正常情況下應產生週報並發送", async () => {
    // Arrange
    const mockReports = [
      { date: "2026-08-06" },
      { date: "2026-08-05" },
      { date: "2026-08-04" },
      { date: "2026-08-03" },
      { date: "2026-08-02" },
      { date: "2026-08-01" },
      { date: "2026-07-31" },
    ];

    const { loadRecentReports } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(loadRecentReports).mockResolvedValue(mockReports);

    const { buildPeriodStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildPeriodStats).mockReturnValue({
      period: "weekly",
      totalReports: 7,
      avgScore: 62,
      signalDistribution: { hold: 5, long: 2, short: 0 },
    });

    const { buildSignalAccuracyStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildSignalAccuracyStats).mockReturnValue({
      totalSignals: 7,
      correctPredictions: 5,
      accuracy: 0.71,
    });

    const { generatePeriodAiSummary } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(generatePeriodAiSummary).mockResolvedValue({
      aiSummary: "測試週期 AI 摘要內容",
    });

    const { buildCompactPeriodMessage } =
      await import("../../../../src/modules/notifications/templates/periodReportBuilder.mjs");
    vi.mocked(buildCompactPeriodMessage).mockReturnValue([
      { text: "測試週報訊息", parse_mode: "HTML" },
    ]);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runWeeklyReport({});

    // Assert
    expect(result.skipped).toBe(false);
    expect(result.reportCount).toBe(7);
    expect(sendTelegramBatch).toHaveBeenCalledTimes(1);
  });

  it("AI 摘要失敗時應降級發送純統計報告", async () => {
    // Arrange
    const mockReports = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-08-${6 - i}`,
    }));

    const { loadRecentReports } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(loadRecentReports).mockResolvedValue(mockReports);

    const { buildPeriodStats } =
      await import("../../../../src/modules/ai/periodReportAgent.mjs");
    vi.mocked(buildPeriodStats).mockReturnValue({
      period: "weekly",
      totalReports: 7,
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
      { text: "測試週報訊息", parse_mode: "HTML" },
    ]);

    const { sendTelegramBatch } =
      await import("../../../../src/modules/notifications/transports/telegramClient.mjs");
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runWeeklyReport({});

    // Assert
    expect(result.skipped).toBe(false);
    expect(result.reportCount).toBe(7);
  });
});
