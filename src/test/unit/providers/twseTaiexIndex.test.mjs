/**
 * twseTaiexIndex.test.mjs
 *
 * 驗證 fetchTaiexIndexByDate 的錯誤處理行為：
 *  - HTTP 307 (非 2xx) 必須拋出 Error，讓 historyProvider retry/failedDates 接手
 *  - 休市日 (stat !== "OK" 且 !data) 回傳 null（不拋出）
 *  - 正常交易日回傳 { date, close }
 *  - 無效日期格式回傳 null（不拋出）
 *
 * 設計原則：!res.ok → throw，讓 caller 決定是否重試或記錄 failedDate
 *            stat !== OK → return null（正常休市或查無資料）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ------- mock fetchWithTimeout -------
const mockFetchWithTimeout = vi.fn();

vi.mock("../../../utils/retryUtils.mjs", () => ({
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  isRetryableError: vi.fn(() => false),
  sleep: vi.fn(),
}));
vi.mock("../../../utils/coreUtils.mjs", async () => {
  const actual = await vi.importActual("../../../utils/coreUtils.mjs");
  return {
    ...actual,
    fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  };
});

// twseAgent 依賴 https-proxy-agent，先 mock 掉
vi.mock("https-proxy-agent", () => ({ HttpsProxyAgent: class {} }));
vi.mock("../../../utils/archiveManager.mjs", () => ({
  default: { getStockHistory: vi.fn(), saveStockHistory: vi.fn() },
}));
vi.mock("../../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const { fetchTaiexIndexByDate } =
  await import("../../../modules/providers/twseProvider.mjs");

// ------- helpers -------
function makeMockResponse({ ok, status, body }) {
  return {
    ok,
    status,
    text: async () => body,
  };
}

const VALID_MI_INDEX_BODY = JSON.stringify({
  stat: "OK",
  tables: [
    {
      title: "各類指數(臺灣證券交易所)價格指數(臺灣證券交易所)",
      fields: ["指數", "收盤指數"],
      data: [["發行量加權股價指數", "46,292.93"]],
    },
  ],
  date: "20261021",
});

const HOLIDAY_MI_INDEX_BODY = JSON.stringify({
  stat: "查詢日期小於93年2月11日，請重新查詢!",
  tables: [],
});

// ------- tests -------
describe("fetchTaiexIndexByDate — HTTP error handling", () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
  });

  it("RED: HTTP 307 should throw so historyProvider marks it as failedDate", async () => {
    // 目前行為：return null（錯誤，被誤認為休市日）
    // 預期行為：throw Error（讓 historyProvider 的 catch 接手 → failedDates）
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({
        ok: false,
        status: 307,
        body: "<html>redirect</html>",
      }),
    );

    await expect(fetchTaiexIndexByDate("2026-08-20")).rejects.toThrow(
      /HTTP 307/,
    );
  });

  it("HTTP 404 should throw so historyProvider marks it as failedDate", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({
        ok: false,
        status: 404,
        body: "<html>not found</html>",
      }),
    );

    await expect(fetchTaiexIndexByDate("2026-08-20")).rejects.toThrow(
      /HTTP 404/,
    );
  });

  it("HTTP 500 should throw (server error)", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({
        ok: false,
        status: 500,
        body: "Internal Server Error",
      }),
    );

    await expect(fetchTaiexIndexByDate("2026-08-20")).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("valid trading day returns { date, close }", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({ ok: true, status: 200, body: VALID_MI_INDEX_BODY }),
    );

    const result = await fetchTaiexIndexByDate("2026-10-21");
    expect(result).toMatchObject({ date: "2026-10-21", close: 46292.93 });
  });

  it("holiday/no-data response returns null (not throw)", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({ ok: true, status: 200, body: HOLIDAY_MI_INDEX_BODY }),
    );

    const result = await fetchTaiexIndexByDate("2026-01-01");
    expect(result).toBeNull();
  });

  it("empty response body returns null (not throw)", async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeMockResponse({ ok: true, status: 200, body: "   " }),
    );

    const result = await fetchTaiexIndexByDate("2026-10-21");
    expect(result).toBeNull();
  });

  it("invalid date format returns null (not throw)", async () => {
    const result = await fetchTaiexIndexByDate("not-a-date");
    expect(result).toBeNull();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it("network error (fetchWithTimeout throws) still propagates as throw", async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(fetchTaiexIndexByDate("2026-08-20")).rejects.toThrow(
      "ECONNRESET",
    );
  });
});
