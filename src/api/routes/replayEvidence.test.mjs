import { describe, expect, it, vi, beforeEach } from "vitest";
import Fastify from "fastify";

// Set development mode to bypass auth middleware
process.env.NODE_ENV = "development";

vi.mock("../../modules/replay/replayEvidenceLoader.mjs", () => ({
  loadReplayEvidenceList: vi.fn(),
}));

import replayEvidenceRoute from "../../api/routes/replayEvidence.mjs";
import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";

describe("GET /api/replay-evidence", () => {
  let app;

  beforeEach(async () => {
    app = Fastify();
    await app.register(replayEvidenceRoute);
    vi.clearAllMocks();
  });

  it("returns empty array when no evidence exists", async () => {
    loadReplayEvidenceList.mockResolvedValue([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/replay-evidence",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("evidence");
    expect(body.evidence).toEqual([]);
  });

  it("returns evidence list sorted by replayDate descending", async () => {
    loadReplayEvidenceList.mockResolvedValue([
      {
        replayDate: "2026-08-18",
        fixtureSource: "synthetic",
        status: "available",
        replayMatches: true,
      },
      {
        replayDate: "2026-08-17",
        fixtureSource: "synthetic",
        status: "available",
        replayMatches: false,
      },
      {
        replayDate: "2026-08-14",
        fixtureSource: "synthetic",
        status: "available",
        replayMatches: true,
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/replay-evidence",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.evidence).toHaveLength(3);
    expect(body.evidence[0].replayDate).toBe("2026-08-18");
    expect(body.evidence[1].replayDate).toBe("2026-08-17");
    expect(body.evidence[2].replayDate).toBe("2026-08-14");
  });

  it("validates response schema with required fields", async () => {
    loadReplayEvidenceList.mockResolvedValue([
      {
        replayDate: "2026-08-14",
        fixtureSource: "synthetic",
        status: "available",
        dataAsOf: { market: { latestDate: "2026-08-14" } },
        strategyHash: "sha256:abc123",
        replayMatches: true,
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/replay-evidence",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.evidence[0]).toMatchObject({
      replayDate: "2026-08-14",
      fixtureSource: "synthetic",
      status: "available",
      replayMatches: true,
    });
  });
});
