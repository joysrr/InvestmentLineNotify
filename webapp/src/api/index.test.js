import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("window", {
  Telegram: { WebApp: { initData: "test-init-data" } },
});

vi.mock("../../src/utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { apiFetch } = await import("./index.js");

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
