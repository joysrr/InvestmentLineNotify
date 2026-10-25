import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("window", {
  Telegram: { WebApp: { initData: "test-init-data" } },
});

vi.mock("../../src/utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { apiFetch, fetchReplayEvidence } = await import("./index.js");

describe("apiFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("retries once after 401 and returns the successful response", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "expired" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await expect(apiFetch("/api/status")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchReplayEvidence", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("should fetch replay evidence list", async () => {
    const mockData = [
      {
        fixtureSource: "backtest",
        replayDate: "2026-10-24",
        dataAsOf: "2026-10-23",
        strategyHash: "abc123",
        replayMatches: true,
      },
    ];

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchReplayEvidence();
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/replay-evidence"),
      expect.any(Object),
    );
  });

  it("should handle empty replay evidence", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const result = await fetchReplayEvidence();
    expect(result).toEqual([]);
  });
});
