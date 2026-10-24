import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../modules/replay/replayEvidenceLoader.mjs", () => ({
  loadReplayEvidenceList: vi.fn(),
}));

import { handleReplay } from "../../bot/commands/replayCommand.mjs";
import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";

describe("handleReplay command", () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      reply: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("returns friendly message when no replay evidence exists", async () => {
    loadReplayEvidenceList.mockResolvedValue([]);

    await handleReplay(ctx);

    expect(ctx.reply).toHaveBeenCalledOnce();
    const message = ctx.reply.mock.calls[0][0];
    expect(message).toContain("目前尚無 replay evidence");
  });

  it("displays replay evidence list with key fields", async () => {
    loadReplayEvidenceList.mockResolvedValue([
      {
        replayDate: "2026-08-18",
        fixtureSource: "synthetic",
        status: "available",
        dataAsOf: { market: { latestDate: "2026-08-18" } },
        strategyHash: "sha256:abc123def456",
        replayMatches: true,
      },
      {
        replayDate: "2026-08-17",
        fixtureSource: "production",
        status: "available",
        dataAsOf: { market: { latestDate: "2026-08-17" } },
        strategyHash: "sha256:xyz789",
        replayMatches: false,
      },
    ]);

    await handleReplay(ctx);

    expect(ctx.reply).toHaveBeenCalledOnce();
    const message = ctx.reply.mock.calls[0][0];
    expect(message).toContain("Replay Evidence");
    expect(message).toContain("2026-08-18");
    expect(message).toContain("2026-08-17");
    expect(message).toContain("synthetic");
    expect(message).toContain("production");
    expect(message).toContain("✅"); // replayMatches: true
    expect(message).toContain("⚠️"); // replayMatches: false
  });

  it("handles loader errors gracefully", async () => {
    loadReplayEvidenceList.mockRejectedValue(new Error("Directory read error"));

    await handleReplay(ctx);

    expect(ctx.reply).toHaveBeenCalledOnce();
    const message = ctx.reply.mock.calls[0][0];
    expect(message).toContain("載入 replay evidence 時發生錯誤");
  });

  it("truncates long strategy hashes", async () => {
    loadReplayEvidenceList.mockResolvedValue([
      {
        replayDate: "2026-08-18",
        fixtureSource: "synthetic",
        status: "available",
        strategyHash:
          "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        replayMatches: true,
      },
    ]);

    await handleReplay(ctx);

    expect(ctx.reply).toHaveBeenCalledOnce();
    const message = ctx.reply.mock.calls[0][0];
    // Hash should be truncated to first 12 chars
    expect(message).toContain("abcdef123456");
    expect(message).not.toContain(
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    );
  });
});
