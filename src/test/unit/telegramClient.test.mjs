import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 先 mock logger，避免測試輸出干擾
vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockFetchWithTimeout, mockHttpsRequest } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
  mockHttpsRequest: vi.fn(),
}));

vi.mock("node:https", () => ({
  default: {
    request: mockHttpsRequest,
  },
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
    mockHttpsRequest.mockImplementation((_url, _options, callback) => {
      const response = new EventEmitter();
      response.statusCode = 200;
      const request = new EventEmitter();
      request.end = vi.fn(() => {
        callback(response);
        response.emit(
          "data",
          Buffer.from(
            JSON.stringify({ ok: true, result: { message_id: 999 } }),
          ),
        );
        response.emit("end");
      });
      request.destroy = vi.fn();
      return request;
    });
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

    expect(mockHttpsRequest).toHaveBeenCalledOnce();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    const callArgs = mockHttpsRequest.mock.calls[0];
    expect(callArgs[0].pathname).toContain("sendMessage");
    expect(callArgs[1].family).toBe(4);
    expect(callArgs[1].timeout).toBeGreaterThanOrEqual(30000);
  });

  it("當所有 sendMessage 發送皆失敗時，sendTelegramBatch 應拋出 ProviderError 拒絕虛假成功", async () => {
    mockHttpsRequest.mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter();
      request.end = vi.fn(() => {
        const error = new Error("HTTP 400");
        error.statusCode = 400;
        request.emit("error", error);
      });
      request.destroy = vi.fn();
      return request;
    });

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
