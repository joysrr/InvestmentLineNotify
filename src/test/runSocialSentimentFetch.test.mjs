import { describe, it, expect, vi } from "vitest";

// TDD: Verify /sentiment bot command triggers social sentiment snapshot generation
describe("runSocialSentimentFetch - Manual sentiment update trigger (Phase 4)", () => {
  it("應執行 daily_snapshot.py 並寫入 social_sentiment_daily.json", async () => {
    const mockExecFile = vi.fn();
    // Make execFile call its callback with success
    mockExecFile.mockImplementation((cmd, args, opts, callback) => {
      // Handle both 3-arg (no opts) and 4-arg signatures
      if (typeof opts === "function") {
        opts(null, "snapshot complete", "");
      } else {
        callback(null, "snapshot complete", "");
      }
    });

    vi.doMock("child_process", () => ({ execFile: mockExecFile }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(
      "/workspace/projects/InvestmentLineNotify/data/sentiment/social_sentiment_daily.json",
    );
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("python3");
  });

  it("當執行失敗時，應回傳 success: false 並帶錯誤訊息", async () => {
    const mockExecFile = vi.fn();
    mockExecFile.mockImplementation((cmd, args, opts, callback) => {
      const err = new Error("python3 not found");
      if (typeof opts === "function") {
        opts(err, "", "");
      } else {
        callback(err, "", "");
      }
    });

    vi.doMock("child_process", () => ({ execFile: mockExecFile }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(false);
    expect(result.error).toContain("python3 not found");
  });
});
