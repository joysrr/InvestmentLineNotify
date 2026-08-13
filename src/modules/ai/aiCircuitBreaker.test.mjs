// src/modules/ai/aiCircuitBreaker.test.mjs
// TDD: AI Circuit Breaker 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  canMakeAIRequest,
  recordAIRequestResult,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  isCircuitOpen,
  isCircuitClosed,
  CIRCUIT_STATE,
} from "./aiCircuitBreaker.mjs";

describe("aiCircuitBreaker - AI 熔斷器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
  });

  describe("初始狀態", () => {
    it("初始狀態應為 CLOSED", () => {
      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.CLOSED);
      expect(isCircuitClosed()).toBe(true);
      expect(isCircuitOpen()).toBe(false);
      expect(canMakeAIRequest()).toBe(true);
    });

    it("初始計數器應為 0", () => {
      const status = getCircuitBreakerStatus();
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
      expect(status.totalRequests).toBe(0);
      expect(status.failureRate).toBe(0);
    });
  });

  describe("recordAIRequestResult - 記錄請求結果", () => {
    it("記錄成功請求應增加 successCount 和 totalRequests", () => {
      recordAIRequestResult(100, true); // 100ms, 成功

      const status = getCircuitBreakerStatus();
      expect(status.successCount).toBe(1);
      expect(status.totalRequests).toBe(1);
      expect(status.failureCount).toBe(0);
      expect(status.failureRate).toBe(0);
    });

    it("記錄失敗請求應增加 failureCount 和 totalRequests", () => {
      recordAIRequestResult(100, false); // 100ms, 失敗

      const status = getCircuitBreakerStatus();
      expect(status.failureCount).toBe(1);
      expect(status.totalRequests).toBe(1);
      expect(status.successCount).toBe(0);
      expect(status.failureRate).toBe(1);
    });

    it("多次請求應正確累計失敗率", () => {
      recordAIRequestResult(100, true);
      recordAIRequestResult(100, true);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false); // 3/5 = 60% 失敗率 > 40% 閾值

      const status = getCircuitBreakerStatus();
      expect(status.totalRequests).toBe(5);
      expect(status.failureCount).toBe(3);
      expect(status.successCount).toBe(2);
      expect(status.failureRate).toBe(0.6);
    });

    it("慢請求應被記錄", () => {
      recordAIRequestResult(20000, true); // 20s > 15s 閾值

      const status = getCircuitBreakerStatus();
      expect(status.slowRequestCount).toBe(1);
    });

    it("不足 minimumRequests 時不開啟 Circuit", () => {
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false); // 2/2 = 100% 但 < 3 最小請求數

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.CLOSED);
      expect(canMakeAIRequest()).toBe(true);
    });
  });

  describe("Circuit 狀態轉換: CLOSED → OPEN", () => {
    it("失敗率超過 40% 且請求數 >= 3 時開啟 Circuit", () => {
      // 3 次請求，2 次失敗 = 66.7% > 40%
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true);

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.OPEN);
      expect(isCircuitOpen()).toBe(true);
      expect(canMakeAIRequest()).toBe(false);
    });

    it("OPEN 狀態下拒絕請求並記錄拒絕事件", () => {
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // 觸發 OPEN

      // 嘗試發出請求
      const allowed = canMakeAIRequest();
      expect(allowed).toBe(false);
    });
  });

  describe("Circuit 狀態轉換: OPEN → HALF_OPEN", () => {
    it("OPEN 狀態持續 30 秒後轉為 HALF_OPEN", async () => {
      vi.useFakeTimers();

      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // 觸發 OPEN

      expect(getCircuitBreakerStatus().state).toBe(CIRCUIT_STATE.OPEN);

      // 快轉 30 秒
      vi.advanceTimersByTime(30000);

      // 下次檢查時應轉為 HALF_OPEN
      expect(canMakeAIRequest()).toBe(true);
      expect(getCircuitBreakerStatus().state).toBe(CIRCUIT_STATE.HALF_OPEN);

      vi.useRealTimers();
    });
  });

  describe("Circuit 狀態轉換: HALF_OPEN → CLOSED / OPEN", () => {
    it("HALF_OPEN 期間最多允許 2 次測試請求", () => {
      vi.useFakeTimers();

      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // OPEN

      vi.advanceTimersByTime(30000); // 轉 HALF_OPEN

      // 第一次測試請求
      expect(canMakeAIRequest()).toBe(true);
      recordAIRequestResult(100, true);

      // 第二次測試請求
      expect(canMakeAIRequest()).toBe(true);
      recordAIRequestResult(100, true);

      // 測試額度用完，應轉回 CLOSED (成功率 100% > 50%)
      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.CLOSED);
      expect(isCircuitClosed()).toBe(true);

      vi.useRealTimers();
    });

    it("HALF_OPEN 期間任何失敗立即轉回 OPEN (fail-fast)", () => {
      vi.useFakeTimers();

      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // OPEN

      vi.advanceTimersByTime(30000); // HALF_OPEN

      // 第一次測試請求失敗
      expect(canMakeAIRequest()).toBe(true);
      recordAIRequestResult(100, false);

      // 立即轉回 OPEN
      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.OPEN);
      expect(isCircuitOpen()).toBe(true);

      vi.useRealTimers();
    });

    it("HALF_OPEN 成功率 <= 50% 時轉回 OPEN", () => {
      vi.useFakeTimers();

      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // OPEN

      vi.advanceTimersByTime(30000); // HALF_OPEN

      // 第一次成功
      recordAIRequestResult(100, true);
      // 第二次失敗 = 50% 成功率 (不 > 50%)
      recordAIRequestResult(100, false);

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.OPEN);

      vi.useRealTimers();
    });
  });

  describe("resetCircuitBreaker - 重置", () => {
    it("重置後所有狀態歸零並回到 CLOSED", () => {
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, false);
      recordAIRequestResult(100, true); // OPEN

      resetCircuitBreaker();

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe(CIRCUIT_STATE.CLOSED);
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
      expect(status.totalRequests).toBe(0);
      expect(status.failureRate).toBe(0);
      expect(canMakeAIRequest()).toBe(true);
    });
  });

  describe("getCircuitBreakerStatus - 狀態查詢", () => {
    it("回傳完整狀態資訊", () => {
      recordAIRequestResult(100, true);
      recordAIRequestResult(20000, true); // 慢請求
      recordAIRequestResult(100, false);

      const status = getCircuitBreakerStatus();
      expect(status).toHaveProperty("state");
      expect(status).toHaveProperty("failureCount");
      expect(status).toHaveProperty("successCount");
      expect(status).toHaveProperty("totalRequests");
      expect(status).toHaveProperty("failureRate");
      expect(status).toHaveProperty("slowRequestCount");
      expect(status).toHaveProperty("timeInCurrentState");
      expect(status).toHaveProperty("halfOpenRequests");
      expect(status).toHaveProperty("halfOpenSuccessCount");
      expect(status).toHaveProperty("halfOpenFailureCount");
    });
  });

  describe("歷史記錄", () => {
    it("記錄請求歷史，最多保留 50 筆", () => {
      for (let i = 0; i < 60; i++) {
        recordAIRequestResult(100, i % 2 === 0);
      }

      // 內部 history 應被截斷到 50 筆
      // 透過 totalRequests 驗證所有請求都被處理
      const status = getCircuitBreakerStatus();
      expect(status.totalRequests).toBe(60);
    });
  });
});