import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import statusRoute from "./status.mjs";

vi.mock("../../domain/ilnState.mjs", () => ({
  loadStateFromLatestFiles: vi.fn(),
}));

vi.mock("../../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getMarketHistory: vi.fn(),
  },
}));

describe("GET /api/status (TDD Phase 3)", () => {
  let app;
  let loadStateFromLatestFiles;
  let archiveManager;

  beforeEach(async () => {
    const ilnState = await import("../../domain/ilnState.mjs");
    loadStateFromLatestFiles = ilnState.loadStateFromLatestFiles;

    const archive = await import("../../modules/data/archiveManager.mjs");
    archiveManager = archive.archiveManager;

    app = Fastify();
    await app.register(statusRoute);
  });

  afterEach(async () => {
    await app.close();
    loadStateFromLatestFiles.mockReset();
  });

  it("當 state 為 null 時回傳 404", async () => {
    loadStateFromLatestFiles.mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Market status data not available yet");
  });

  it("當 state 有效時回傳 200 並呼叫 toStatusPayload", async () => {
    const payload = { market: { price: 100 }, report: { date: "2026-11-05" } };
    const mockState = { toStatusPayload: vi.fn().mockReturnValue(payload) };
    loadStateFromLatestFiles.mockResolvedValue(mockState);

    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(200);
    expect(mockState.toStatusPayload).toHaveBeenCalledTimes(1);
    const body = JSON.parse(res.payload);
    expect(body).toEqual(payload);
  });

  it("當 loadStateFromLatestFiles 拋出錯誤時回傳 500", async () => {
    loadStateFromLatestFiles.mockRejectedValue(new Error("Storage error"));

    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Internal server error");
  });

  it("rawMargin 應包含 marginBalanceChangePercent5d，從歷史數據計算 5 日增減百分比", async () => {
    const mockState = {
      toStatusPayload: vi.fn().mockReturnValue({
        _meta: {},
        data: {
          rawMargin: {
            marginBalance100M: 5340.53,
            date: "2026/11/06",
          },
        },
      }),
    };
    loadStateFromLatestFiles.mockResolvedValue(mockState);

    // 5 個交易日前的融資餘額為 5000
    archiveManager.getMarketHistory.mockResolvedValue([
      { date: "2026-10-30", data: { rawMargin: { marginBalance100M: 5000 } } },
      {
        date: "2026-11-06",
        data: { rawMargin: { marginBalance100M: 5340.53 } },
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // (5340.53 - 5000) / 5000 * 100 = 6.8106%
    expect(body.data.rawMargin.marginBalanceChangePercent5d).toBeCloseTo(
      6.81,
      1,
    );
  });

  it("rawMargin marginBalanceChangePercent5d 為 null 當歷史數據不足 5 日", async () => {
    const mockState = {
      toStatusPayload: vi.fn().mockReturnValue({
        _meta: {},
        data: {
          rawMargin: {
            marginBalance100M: 5340.53,
            date: "2026/11/06",
          },
        },
      }),
    };
    loadStateFromLatestFiles.mockResolvedValue(mockState);

    // 僅有 1 筆歷史數據，不足 5 日
    archiveManager.getMarketHistory.mockResolvedValue([
      {
        date: "2026-11-06",
        data: { rawMargin: { marginBalance100M: 5340.53 } },
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.rawMargin.marginBalanceChangePercent5d).toBeNull();
  });
});
