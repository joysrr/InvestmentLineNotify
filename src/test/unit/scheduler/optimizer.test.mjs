/**
 * Optimizer 排程單元測試
 * 測試 src/scheduler/optimizer.mjs 的核心邏輯
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies at the top level
vi.mock("../../../../src/modules/ai/aiClient.mjs", () => ({
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
}));

vi.mock("../../../../src/utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the internal modules that runOptimizer uses
vi.mock("../../../../src/modules/ai/ruleOptimizerAgent.mjs", () => ({
  runRuleOptimizer: vi.fn(),
}));

vi.mock("../../../../src/modules/notifications/notifier.mjs", () => ({
  broadcastOptimizerResult: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("path", () => ({
  join: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("url", () => ({
  fileURLToPath: vi.fn(),
}));

import { runOptimizer } from "../../../../src/scheduler/optimizer.mjs";

describe("Optimizer Scheduler - 單元測試", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("應成功執行優化器並回傳結果", async () => {
    // Arrange
    const mockResult = {
      tw: {
        accepted: [{ pattern: "test1" }, { pattern: "test2" }],
        rejected: [{ pattern: "bad1" }],
      },
      us: { accepted: [{ pattern: "test3" }], rejected: [] },
    };

    const { runRuleOptimizer } =
      await import("../../../../src/modules/ai/ruleOptimizerAgent.mjs");
    vi.mocked(runRuleOptimizer).mockResolvedValue(mockResult);

    const { broadcastOptimizerResult } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastOptimizerResult).mockResolvedValue(undefined);

    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    const { readFileSync } = await import("fs");
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ titleBlackListPatterns: ["test1", "test2", "test3"] }),
    );

    const { join } = await import("path");
    vi.mocked(join).mockReturnValue("/fake/path/blacklist.json");

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runOptimizer({});

    // Assert
    expect(result).toEqual(mockResult);
    expect(runRuleOptimizer).toHaveBeenCalledTimes(1);
    expect(broadcastOptimizerResult).toHaveBeenCalledTimes(1);
  });

  it("blacklist 不存在時 totalRuleCount 應為 null", async () => {
    // Arrange
    const mockResult = {
      tw: { accepted: [], rejected: [] },
      us: { accepted: [], rejected: [] },
    };

    const { runRuleOptimizer } =
      await import("../../../../src/modules/ai/ruleOptimizerAgent.mjs");
    vi.mocked(runRuleOptimizer).mockResolvedValue(mockResult);

    const { broadcastOptimizerResult } =
      await import("../../../../src/modules/notifications/notifier.mjs");
    vi.mocked(broadcastOptimizerResult).mockResolvedValue(undefined);

    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act
    const result = await runOptimizer({});

    // Assert
    expect(result).toEqual(mockResult);
    expect(broadcastOptimizerResult).toHaveBeenCalledWith(mockResult, null);
  });

  it("runRuleOptimizer 拋出錯誤時應重新拋出", async () => {
    // Arrange
    const { runRuleOptimizer } =
      await import("../../../../src/modules/ai/ruleOptimizerAgent.mjs");
    vi.mocked(runRuleOptimizer).mockRejectedValue(
      new Error("Optimization failed"),
    );

    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    vi.mocked(langfuse.shutdownAsync).mockResolvedValue(undefined);

    // Act & Assert
    await expect(runOptimizer({})).rejects.toThrow("Optimization failed");
  });
});
