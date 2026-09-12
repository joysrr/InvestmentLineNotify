import { describe, it, expect, vi } from "vitest";

// TDD: Verify /sentiment bot command triggers social sentiment snapshot generation
// RED phase
describe("runSocialSentimentFetch - Manual sentiment update trigger (Phase 4)", () => {
  it("應執行 daily_snapshot.py 並寫入社群情緒 JSON", async () => {
    // Mock execFile to simulate successful execution
    const mockChild = {
      on: vi.fn(),
    };
    const mockExecFile = vi.fn((cmd, args, opts, callback) => {
      // Call callback with success result
      callback(null, "snapshot complete", "");
      return mockChild;
    });

    vi.doMock("child_process", () => ({ execFile: mockExecFile }));
    vi.doMock("../utils/logger.mjs", () => ({
      default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(true);
    expect(result.outputPath).toContain("social_sentiment_daily.json");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("python3");
    // Verify env includes PYTHONPATH pointing to social-sentiment-optimizer/src
    const opts = mockExecFile.mock.calls[0][2];
    expect(opts.timeout).toBe(60000);
    expect(opts.env.PYTHONPATH).toContain("social-sentiment-optimizer/src");
  });

  it("當 execFile callback 回傳 error 時，應回傳 success: false 並帶錯誤訊息", async () => {
    const mockChild = {
      on: vi.fn(),
    };
    const mockExecFile = vi.fn((cmd, args, opts, callback) => {
      const err = new Error("Command failed: ENOENT");
      callback(err, "", "No module named social_optimizer");
      return mockChild;
    });

    vi.doMock("child_process", () => ({ execFile: mockExecFile }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Command failed: ENOENT");
  });

  it("當 child process 'error' 事件觸發時 (python3 not found)，應回傳 success: false", async () => {
    let errorHandler = null;
    const mockChild = {
      on: vi.fn((event, handler) => {
        errorHandler = handler;
      }),
    };
    const mockExecFile = vi.fn(() => mockChild);

    vi.doMock("child_process", () => ({ execFile: mockExecFile }));
    vi.doMock("../utils/logger.mjs", () => ({
      default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.resetModules();
    // Import but don't await — we need to trigger the error handler manually
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const promise = runSocialSentimentFetch();
    // Simulate the 'error' event firing (e.g., python3 not found)
    errorHandler(new Error("spawn python3 ENOENT"));

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("spawn python3 ENOENT");
    expect(result.error).toContain("Child process error");
  });
});
