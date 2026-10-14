import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStockDayMonthWithCache = vi.fn();

vi.mock("../modules/providers/twseProvider.mjs", () => ({
  fetchStockDayMonthWithCache,
}));

vi.mock("../utils/coreUtils.mjs", () => ({
  TwDate: () => ({ formatMonthKey: () => "202610" }),
  toTwseStockNo: (symbol) => symbol.replace(".TW", ""),
  enumerateMonths: vi.fn(),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/logger.mjs", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const { fetchStockHistoryWithAutoFillDetailed } =
  await import("../modules/providers/historyProvider.mjs");

describe("history provider resilience", () => {
  beforeEach(() => {
    fetchStockDayMonthWithCache.mockReset();
  });

  it("retries a transient month failure and reports a successful source", async () => {
    const rows = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 1 + index));
      return {
        date: date.toISOString().slice(0, 10),
        close: 100 + index,
      };
    });
    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(new Error("TWSE timeout"))
      .mockResolvedValueOnce(rows);

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-09-30",
      { retryAttempts: 1, retryDelayMs: 0 },
    );

    expect(fetchStockDayMonthWithCache).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("available");
    expect(result.data).toHaveLength(60);
    expect(result.failedMonths).toEqual([]);
  });

  it("treats an empty current month as expected when prior data meets the requirement", async () => {
    const rows = Array.from({ length: 64 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, 1 + index));
      return {
        date: date.toISOString().slice(0, 10),
        close: 100 + index,
      };
    });
    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(
        new Error("TWSE STOCK_DAY 00675L 202610: 很抱歉，沒有符合條件的資料!"),
      )
      .mockResolvedValueOnce(rows);

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-10-01",
      { retryAttempts: 0, retryDelayMs: 0 },
    );

    expect(result.status).toBe("available");
    expect(result.data).toHaveLength(64);
    expect(result.failedMonths).toEqual([]);
    expect(result.lastError).toBeNull();
  });

  it("distinguishes a source failure from genuinely insufficient history", async () => {
    fetchStockDayMonthWithCache.mockRejectedValue(new Error("TWSE blocked"));

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-09-30",
      { maxMonths: 1, retryAttempts: 0, retryDelayMs: 0 },
    );

    expect(result.status).toBe("source_unavailable");
    expect(result.data).toEqual([]);
    expect(result.failedMonths).toEqual(["202609"]);
    expect(result.lastError).toContain("TWSE blocked");
  });

  it("does not throw TypeError when error.code is a number (e.g. HTTP status)", async () => {
    // 重現 TWSE 回傳 HTTP 404 時，error.code 是數字導致 isRetryableError 拋出
    // TypeError: error.code?.toLowerCase is not a function
    const numericCodeError = new Error(
      "TWSE STOCK_DAY 202610: 很抱歉，沒有符合條件的資料!",
    );
    numericCodeError.code = 404; // 數字，不是字串

    const rows = Array.from({ length: 64 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, 1 + index));
      return { date: date.toISOString().slice(0, 10), close: 100 + index };
    });

    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(numericCodeError)
      .mockResolvedValueOnce(rows);

    // 不應拋出 TypeError，應正常視為當月空資料並回傳 available
    await expect(
      fetchStockHistoryWithAutoFillDetailed("00675L.TW", 60, "2026-10-01", {
        retryAttempts: 0,
        retryDelayMs: 0,
      }),
    ).resolves.toMatchObject({ status: "available", failedMonths: [] });
  });

  it("treats 'all endpoints failed (non-JSON or blocked)' as empty current month, not source failure", async () => {
    // 重現今天的真實場景：202610 當月 TWSE 回傳 HTML（WAF 攔截），
    // fetchStockDayMonth 兩個 URL 都 fallthrough，最終拋出固定訊息
    // isEmptyCurrentMonth 目前只比對 "沒有符合條件的資料"，不會匹配這個錯誤
    const blockedError = new Error(
      "TWSE STOCK_DAY: all endpoints failed (non-JSON or blocked)",
    );

    const rows = Array.from({ length: 64 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, 1 + index));
      return { date: date.toISOString().slice(0, 10), close: 100 + index };
    });

    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(blockedError) // 202610 當月：被 WAF 擋
      .mockResolvedValueOnce(rows); // 202609：正常取得

    // 預期：當月 blocked 不應列為 failedMonths，應繼續回補並回傳 available
    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-10-14",
      { retryAttempts: 0, retryDelayMs: 0 },
    );

    expect(result.status).toBe("available");
    expect(result.failedMonths).toEqual([]);
    expect(result.lastError).toBeNull();
  });

  it("returns available when only current month failed but prior data meets minCount", async () => {
    // 核心場景：當月 TWSE API 完全 blocked（任何 error），但前幾個月已有 ≥60 筆
    // 不管 error message 是什麼，只要當月是唯一失敗、且資料足夠，就應繼續
    const anyCurrentMonthError = new Error(
      "some completely new TWSE error format XYZ",
    );

    const rows = Array.from({ length: 64 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, 1 + index));
      return { date: date.toISOString().slice(0, 10), close: 100 + index };
    });

    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(anyCurrentMonthError) // 202610 當月：任意錯誤
      .mockResolvedValueOnce(rows); // 202609：正常

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-10-14",
      { retryAttempts: 0, retryDelayMs: 0 },
    );

    // 資料足夠 (64 >= 60)，唯一失敗是當月 → 應為 available
    expect(result.status).toBe("available");
    expect(result.count).toBeGreaterThanOrEqual(60);
    // failedMonths 可選：包含或不包含 202610 都可接受，但不應造成 source_unavailable
  });

  it("returns source_unavailable when only current month failed AND prior data is insufficient", async () => {
    // 邊界守護：當月失敗 + 資料不足 → 仍應失敗，不能假裝 available
    const anyCurrentMonthError = new Error(
      "some completely new TWSE error format XYZ",
    );

    const rows = Array.from({ length: 30 }, (_, index) => {
      // 只有 30 筆，不足 minCount=60
      const date = new Date(Date.UTC(2026, 6, 1 + index));
      return { date: date.toISOString().slice(0, 10), close: 100 + index };
    });

    fetchStockDayMonthWithCache
      .mockRejectedValueOnce(anyCurrentMonthError) // 202610 當月失敗
      .mockResolvedValueOnce(rows) // 202609：只有 30 筆
      .mockRejectedValue(new Error("TWSE blocked")); // 再更早的月份也失敗

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-10-14",
      { maxMonths: 3, retryAttempts: 0, retryDelayMs: 0 },
    );

    // 資料不足 → 不應偽裝成 available
    expect(result.status).not.toBe("available");
    expect(result.count).toBeLessThan(60);
  });

  it("still reports source_unavailable when a non-current month is blocked", async () => {
    // 確保修改後不影響：非當月的 blocked 仍然是真正的失敗
    const blockedError = new Error(
      "TWSE STOCK_DAY: all endpoints failed (non-JSON or blocked)",
    );

    fetchStockDayMonthWithCache.mockRejectedValue(blockedError);

    const result = await fetchStockHistoryWithAutoFillDetailed(
      "00675L.TW",
      60,
      "2026-09-30", // 非當月（currentMonthKey = 202610）
      { maxMonths: 1, retryAttempts: 0, retryDelayMs: 0 },
    );

    expect(result.status).toBe("source_unavailable");
    expect(result.failedMonths).toEqual(["202609"]);
  });
});
