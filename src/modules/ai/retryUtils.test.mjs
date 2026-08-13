// src/utils/retryUtils.test.mjs
// TDD: Retry Utils 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ProviderError,
  AIServiceError,
  delay,
  calculateBackoffDelay,
  isRetryableError,
  isAIRetryableError,
  withRetry,
  retrySimple,
  fetchWithTimeout,
} from "../../utils/retryUtils.mjs";

describe("retryUtils - 重試工具", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProviderError / AIServiceError - 錯誤類別", () => {
    it("ProviderError 應正確建立並攜帶選項", () => {
      const err = new ProviderError("API failed", {
        providerId: "gemini",
        operation: "generateContent",
        statusCode: 500,
        isRetryable: true,
      });

      expect(err.name).toBe("ProviderError");
      expect(err.message).toBe("API failed");
      expect(err.providerId).toBe("gemini");
      expect(err.operation).toBe("generateContent");
      expect(err.statusCode).toBe(500);
      expect(err.isRetryable).toBe(true);
    });

    it("AIServiceError 應正確建立", () => {
      const err = new AIServiceError("Quota exceeded", {
        provider: "gemini",
        model: "gemini-3-flash",
        statusCode: 429,
        isQuotaExhausted: true,
      });

      expect(err.name).toBe("AIServiceError");
      expect(err.provider).toBe("gemini");
      expect(err.isQuotaExhausted).toBe(true);
    });
  });

  describe("delay - 延遲函數", () => {
    it("應等待指定毫秒數", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe("calculateBackoffDelay - 指數退避計算", () => {
    it("attempt 0 應回傳 baseDelay + jitter", () => {
      const d = calculateBackoffDelay(0, 1000, 10000, 0.5);
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThanOrEqual(1500); // 1000 + 1000*0.5
    });

    it("attempt 1 應為 2*baseDelay + jitter", () => {
      const d = calculateBackoffDelay(1, 1000, 10000, 0.5);
      expect(d).toBeGreaterThanOrEqual(2000);
      expect(d).toBeLessThanOrEqual(3000);
    });

    it("超過 maxDelay 時應被限制在 maxDelay", () => {
      const d = calculateBackoffDelay(10, 1000, 5000, 0.5);
      expect(d).toBeLessThanOrEqual(7500); // maxDelay(5000) + jitter(2500)
    });

    it("jitterFactor 0 應無抖動", () => {
      const d = calculateBackoffDelay(0, 1000, 10000, 0);
      expect(d).toBe(1000);
    });

    it("jitterFactor 1 應有完整抖動", () => {
      const d = calculateBackoffDelay(0, 1000, 10000, 1);
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThanOrEqual(2000);
    });
  });

  describe("isRetryableError - 通用可重試判斷", () => {
    it("網路錯誤應可重試", () => {
      expect(isRetryableError(new Error("timeout"))).toBe(true);
      expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isRetryableError(new Error("socket hang up"))).toBe(true);
    });

    it("HTTP 5xx 應可重試", () => {
      const err500 = new Error("Internal Server Error");
      err500.statusCode = 500;
      expect(isRetryableError(err500)).toBe(true);

      const err503 = new Error("Service Unavailable");
      err503.status = 503;
      expect(isRetryableError(err503)).toBe(true);
    });

    it("429 Too Many Requests 應可重試", () => {
      const err429 = new Error("Rate limited");
      err429.statusCode = 429;
      expect(isRetryableError(err429)).toBe(true);
    });

    it("4xx (除 429) 應不可重試", () => {
      const err400 = new Error("Bad Request");
      err400.statusCode = 400;
      expect(isRetryableError(err400)).toBe(false);

      const err401 = new Error("Unauthorized");
      err401.statusCode = 401;
      expect(isRetryableError(err401)).toBe(false);

      const err404 = new Error("Not Found");
      err404.statusCode = 404;
      expect(isRetryableError(err404)).toBe(false);
    });

    it("明確 isRetryable=true 應可重試", () => {
      const err = new Error("Some error");
      err.isRetryable = true;
      expect(isRetryableError(err)).toBe(true);
    });

    it("null/undefined 應回傳 false", () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe("isAIRetryableError - AI 專用可重試判斷", () => {
    it("AIServiceError 預設可重試", () => {
      const err = new AIServiceError("API error", { isServiceError: true });
      expect(isAIRetryableError(err)).toBe(true);
    });

    it("AIServiceError isServiceError=false 應不可重試", () => {
      const err = new AIServiceError("Bad request", { isServiceError: false });
      expect(isAIRetryableError(err)).toBe(false);
    });

    it("Quota 相關錯誤應可重試", () => {
      expect(isAIRetryableError(new Error("quota exceeded"))).toBe(true);
      expect(isAIRetryableError(new Error("rate limit exceeded"))).toBe(true);
      expect(isAIRetryableError(new Error("too many requests"))).toBe(true);
    });

    it("繼承通用 isRetryableError 邏輯", () => {
      const err500 = new Error("Server error");
      err500.statusCode = 500;
      expect(isAIRetryableError(err500)).toBe(true);

      const err400 = new Error("Bad request");
      err400.statusCode = 400;
      expect(isAIRetryableError(err400)).toBe(false);
    });
  });

  describe("withRetry - 指數退避重試包裝器", () => {
    it("成功執行應直接回傳結果", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn, { maxRetries: 3 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("暫態錯誤應重試並在成功後回傳", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 50,
        jitterFactor: 0,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("非暫態錯誤應立即拋出不重試", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Bad Request"));
      const err400 = new Error("Bad Request");
      err400.statusCode = 400;

      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow(
        "Bad Request",
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("超過最大重試次數仍失敗應拋出錯誤", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("timeout"));

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 20,
          jitterFactor: 0,
        }),
      ).rejects.toThrow("timeout");

      expect(fn).toHaveBeenCalledTimes(3); // 初始 + 2 次重試
    });

    it("onRetry 回調應被呼叫", async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue("success");

      await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number),
      );
    });
  });

  describe("retrySimple - 簡易重試", () => {
    it("應使用預設配置呼叫 withRetry", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await retrySimple(fn, "test-op", 2);
      expect(result).toBe("ok");
    });
  });
});
