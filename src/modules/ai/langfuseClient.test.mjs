// src/modules/ai/langfuseClient.test.mjs
// TDD: Langfuse v5 Client 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

// Set env vars before import so langfuseEnabled is true
vi.stubEnv("LANGFUSE_PUBLIC_KEY", "test-public-key");
vi.stubEnv("LANGFUSE_SECRET_KEY", "test-secret-key");

// Mock @langfuse/tracing before import
vi.mock("@langfuse/tracing", () => ({
  observe: vi.fn((fn) => fn),
  getCurrentTraceId: vi.fn().mockReturnValue("test-trace-id"),
  flush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@langfuse/client", () => {
  class MockLangfuseAPIClient {
    constructor() {
      this.prompts = {
        get: vi.fn().mockResolvedValue({
          version: 1,
          name: "test-prompt",
          prompt: [{ role: "system", content: "You are AI assistant." }],
          config: {},
        }),
      };
      this.score = {
        create: vi.fn().mockResolvedValue(undefined),
      };
      this.shutdown = vi.fn().mockResolvedValue(undefined);
    }
  }

  return {
    Langfuse: MockLangfuseAPIClient,
    LangfuseAPIClient: MockLangfuseAPIClient,
  };
});

vi.mock("@langfuse/otel", () => {
  class MockLangfuseExporter {
    constructor() {
      this.export = vi.fn();
      this.shutdown = vi.fn();
    }
  }
  return {
    LangfuseExporter: MockLangfuseExporter,
  };
});

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("langfuseClient (v5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("flushLangfuse", () => {
    it("應該成功 flush", async () => {
      const { flushLangfuse } = await import("./langfuseClient.mjs");
      await expect(
        flushLangfuse("trace-123", "success"),
      ).resolves.toBeUndefined();
    });

    it("CI 環境下應跳過 flush", async () => {
      const originalCI = process.env.GITHUB_RUN_ID;
      process.env.GITHUB_RUN_ID = "test-run";

      const { flushLangfuse } = await import("./langfuseClient.mjs");
      await expect(
        flushLangfuse("trace-123", "success"),
      ).resolves.toBeUndefined();

      if (originalCI) {
        process.env.GITHUB_RUN_ID = originalCI;
      } else {
        delete process.env.GITHUB_RUN_ID;
      }
    });
  });

  describe("getPromptFromLangfuse", () => {
    it("應該透過 Langfuse Client 取得 prompt", async () => {
      const { getPromptFromLangfuse } = await import("./langfuseClient.mjs");
      const result = await getPromptFromLangfuse("TestPrompt", {
        label: "production",
      });

      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("prompt");
    });
  });

  describe("getCurrentTraceIdSafe", () => {
    it("應該回傳當前 trace ID", async () => {
      const { getCurrentTraceIdSafe } = await import("./langfuseClient.mjs");
      const traceId = getCurrentTraceIdSafe();

      expect(traceId).toBe("test-trace-id");
    });
  });

  describe("observeWithLangfuse", () => {
    it("應該包裝函數並執行", async () => {
      const { observeWithLangfuse } = await import("./langfuseClient.mjs");
      const mockFn = vi.fn().mockResolvedValue("result");

      const wrapped = observeWithLangfuse(mockFn, {
        as_type: "generation",
        name: "test-generation",
      });

      const result = await wrapped();
      expect(result).toBe("result");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
