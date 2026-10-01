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
});
