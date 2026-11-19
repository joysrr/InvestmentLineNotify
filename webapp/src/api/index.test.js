import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.stubGlobal("window", {
  Telegram: { WebApp: { initData: "test-init-data" } },
});

vi.stubGlobal("navigator", { onLine: true });

const { mockIsOnline, mockIsWeakNetwork } = vi.hoisted(() => ({
  mockIsOnline: { value: true },
  mockIsWeakNetwork: { value: false },
}));

const OfflineErrorMock = vi.hoisted(
  () =>
    class OfflineError extends Error {
      constructor(message = "網路離線，無法發出請求") {
        super(message);
        this.name = "OfflineError";
        this.isOffline = true;
      }
    },
);

vi.mock("../composables/useNetworkStatus.js", () => ({
  isOnline: mockIsOnline,
  isWeakNetwork: mockIsWeakNetwork,
  OfflineError: OfflineErrorMock,
}));

vi.mock("../../src/utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { apiFetch, fetchReplayEvidence } = await import("./index.js");

describe("apiFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockIsOnline.value = true;
    mockIsWeakNetwork.value = false;
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

describe("apiFetch 網路感知", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockIsOnline.value = true;
    mockIsWeakNetwork.value = false;
  });

  afterEach(() => {
    mockIsOnline.value = true;
    mockIsWeakNetwork.value = false;
  });

  it("離線時直接拋出 OfflineError，不發出請求", async () => {
    fetchMock.mockReset();
    mockIsOnline.value = false;

    await expect(apiFetch("/api/status")).rejects.toThrow("網路離線");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchReplayEvidence", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockIsOnline.value = true;
    mockIsWeakNetwork.value = false;
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
