import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 先 mock logger，避免測試輸出干擾
vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
}));

// Mock retryUtils 中的 fetchWithTimeout
vi.mock("../../utils/retryUtils.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchWithTimeout: mockFetchWithTimeout,
  };
});

import { ProviderError } from "../../utils/retryUtils.mjs";
import {
  sendTelegramBatch,
  unpinAllChatMessages,
} from "../../modules/notifications/transports/telegramClient.mjs";

describe("telegramClient unit tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      TELEGRAM_API_TOKEN: "mock-token",
      TELEGRAM_USER_ID: "12345678",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("當 sendMessage 發送成功時應正常完成，且使用強化後的超時與重試參數", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      json: vi
        .fn()
        .mockResolvedValue({ ok: true, result: { message_id: 999 } }),
    });

    await expect(
      sendTelegramBatch([{ text: "測試成功訊息" }]),
    ).resolves.not.toThrow();

    expect(mockFetchWithTimeout).toHaveBeenCalledOnce();
    const callArgs = mockFetchWithTimeout.mock.calls[0];
    expect(callArgs[0]).toContain("sendMessage");
    // 確認可涵蓋長時間跨境網路中斷 (>=30s, >=5次, retryDelay>=5000)
    expect(callArgs[2]).toBeGreaterThanOrEqual(30000);
    expect(callArgs[3]).toBeGreaterThanOrEqual(5);
    expect(callArgs[4]).toBeGreaterThanOrEqual(5000);
  });

  it("當所有 sendMessage 發送皆失敗時，sendTelegramBatch 應拋出 ProviderError 拒絕虛假成功", async () => {
    mockFetchWithTimeout.mockRejectedValue(
      new ProviderError(
        "[fetchWithTimeout] All 3 retries failed: fetch failed",
        {
          providerId: "telegram",
          operation: "sendMessage[1]",
        },
      ),
    );

    await expect(sendTelegramBatch([{ text: "測試失敗訊息" }])).rejects.toThrow(
      ProviderError,
    );
  });

  it("當 unpinAllChatMessages 失敗時應優雅降級不拋出異常（防禦性設計）", async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(
      new ProviderError("Network error", { providerId: "telegram" }),
    );

    await expect(unpinAllChatMessages()).resolves.not.toThrow();
  });
});
