import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock(
  "../../modules/notifications/templates/telegramHtmlBuilder.mjs",
  () => ({
    buildTelegramMessages: vi.fn(),
    buildCompactMessage: vi.fn(),
  }),
);

vi.mock("../../modules/notifications/transports/telegramClient.mjs", () => ({
  unpinAllChatMessages: vi.fn(),
  sendTelegramBatch: vi.fn(),
  sendSystemMessage: vi.fn(),
}));

import { broadcastDailyReport } from "../../modules/notifications/notifier.mjs";
import {
  buildTelegramMessages,
  buildCompactMessage,
} from "../../modules/notifications/templates/telegramHtmlBuilder.mjs";
import {
  unpinAllChatMessages,
  sendTelegramBatch,
} from "../../modules/notifications/transports/telegramClient.mjs";

describe("notifications unit tests (broadcastDailyReport)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      TELEGRAM_API_TOKEN: "mock-token",
    };
    vi.mocked(unpinAllChatMessages).mockResolvedValue(undefined);
    vi.mocked(sendTelegramBatch).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("應能根據數據正確格式化 Telegram 訊息（MiniApp 模式）", async () => {
    process.env.TELEGRAM_WEBAPP_URL = "https://example.com/miniapp";
    const mockData = { dateText: "2026-09-28", result: {} };
    const mockCompactMsg = [{ text: "精簡卡片", parse_mode: "HTML" }];
    vi.mocked(buildCompactMessage).mockReturnValue(mockCompactMsg);

    await broadcastDailyReport(mockData, [], true);

    expect(buildCompactMessage).toHaveBeenCalledWith(
      mockData,
      "https://example.com/miniapp",
    );
    expect(unpinAllChatMessages).toHaveBeenCalledOnce();
    expect(sendTelegramBatch).toHaveBeenCalledWith(mockCompactMsg);
  });

  it("當 Telegram API 失敗時應正確處理例外且不中斷流程", async () => {
    process.env.TELEGRAM_WEBAPP_URL = "https://example.com/miniapp";
    const mockData = { dateText: "2026-09-28" };
    vi.mocked(buildCompactMessage).mockReturnValue([{ text: "測試卡片" }]);
    vi.mocked(sendTelegramBatch).mockRejectedValue(
      new Error("Telegram Network Error"),
    );

    await expect(
      broadcastDailyReport(mockData, [], true),
    ).resolves.not.toThrow();
    expect(sendTelegramBatch).toHaveBeenCalledOnce();
  });

  it("當 MiniApp URL 為空時應回退到完整訊息模式", async () => {
    delete process.env.TELEGRAM_WEBAPP_URL;
    const mockData = { dateText: "2026-09-28", result: {} };
    const mockFullMsgs = [
      { text: "完整報告第 1 則" },
      { text: "完整報告第 2 則" },
      { text: "完整報告第 3 則" },
    ];
    const mockNewsMsgs = [{ text: "新聞訊息第 1 則" }];
    vi.mocked(buildTelegramMessages).mockReturnValue(mockFullMsgs);

    await broadcastDailyReport(mockData, mockNewsMsgs, true);

    expect(buildTelegramMessages).toHaveBeenCalledWith(mockData);
    expect(sendTelegramBatch).toHaveBeenCalledWith([
      ...mockFullMsgs,
      ...mockNewsMsgs,
    ]);
  });
});
