import { describe, it, expect, vi } from "vitest";

// Mock https module before importing
vi.mock("https", () => {
  const mockBody = JSON.stringify({
    ok: false,
    error_code: 400,
    description: "Bad Request: chat not found",
  });

  const mockRes = {
    statusCode: 400,
    setEncoding: vi.fn(),
    on: vi.fn((event, cb) => {
      if (event === "data") cb(Buffer.from(mockBody));
      if (event === "end") cb();
      return mockRes;
    }),
  };

  const mockRequest = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };

  return {
    default: {
      request: vi.fn((url, opts, cb) => {
        cb(mockRes);
        return mockRequest;
      }),
    },
  };
});

// Now import the module
const { sendTelegramBatch } = await import("../telegramClient.mjs");

// Mock the env
process.env.TELEGRAM_API_TOKEN = "test_token";

describe("requestTelegramJson error response body", () => {
  it("should include response body text in the thrown ProviderError when API returns 400", async () => {
    await expect(
      sendTelegramBatch([
        { text: "test message", webAppUrl: "https://example.com" },
      ]),
    ).rejects.toThrow(/Bad Request: chat not found/);
  });
});
