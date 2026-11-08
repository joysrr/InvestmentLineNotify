import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import statusRoute from "./status.mjs";

vi.mock("../../domain/ilnState.mjs", () => ({
  loadStateFromLatestFiles: vi.fn(),
}));

describe("GET /api/status (TDD Phase 3)", () => {
  let app;
  let loadStateFromLatestFiles;

  beforeEach(async () => {
    const ilnState = await import("../../domain/ilnState.mjs");
    loadStateFromLatestFiles = ilnState.loadStateFromLatestFiles;

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
});
