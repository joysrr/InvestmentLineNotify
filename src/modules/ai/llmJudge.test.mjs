// src/modules/ai/llmJudge.test.mjs
// TDD: LLM Judge 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./aiClient.mjs", () => ({
  callAI: vi.fn(),
  PROVIDERS: { GEMINI: "gemini" },
  langfuse: { score: vi.fn() },
}));

vi.mock("../../utils/retryUtils.mjs", () => ({
  AIServiceError: class AIServiceError extends Error {
    constructor(message, provider, model) {
      super(message);
      this.name = "AIServiceError";
      this.provider = provider;
      this.model = model;
    }
  },
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { shouldRunJudge, runJudge } from "./llmJudge.mjs";
import { callAI, langfuse } from "./aiClient.mjs";

describe("llmJudge - LLM Judge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // 重置環境變數
    delete process.env.LLM_JUDGE_MODE;
    delete process.env.LLM_JUDGE_WEEKDAY;
    delete process.env.LLM_JUDGE_SAMPLE_RATE;
  });

  describe("shouldRunJudge - 是否執行 Judge", () => {
    it("forceRun=true 時強制執行", () => {
      expect(shouldRunJudge({ forceRun: true })).toBe(true);
    });

    it("mode=always 總是執行", () => {
      process.env.LLM_JUDGE_MODE = "always";
      expect(shouldRunJudge()).toBe(true);
    });

    it("mode=random 依機率抽樣", () => {
      process.env.LLM_JUDGE_MODE = "random";
      process.env.LLM_JUDGE_SAMPLE_RATE = "1.0"; // 100%
      expect(shouldRunJudge()).toBe(true);

      process.env.LLM_JUDGE_SAMPLE_RATE = "0"; // 0%
      expect(shouldRunJudge()).toBe(false);
    });

    it("mode=weekly 符合指定週幾執行", () => {
      process.env.LLM_JUDGE_MODE = "weekly";
      process.env.LLM_JUDGE_WEEKDAY = "1"; // 週一

      // Mock Date.getDay
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = vi.fn(() => 1); // 週一

      expect(shouldRunJudge()).toBe(true);

      Date.prototype.getDay = vi.fn(() => 2); // 週二
      expect(shouldRunJudge()).toBe(false);

      Date.prototype.getDay = originalGetDay;
    });

    it("預設 weekly 週一", () => {
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = vi.fn(() => 1); // 週一
      expect(shouldRunJudge()).toBe(true);

      Date.prototype.getDay = vi.fn(() => 0); // 週日
      expect(shouldRunJudge()).toBe(false);

      Date.prototype.getDay = originalGetDay;
    });
  });

  describe("runJudge - 執行 Judge 評分", () => {
    it("無效 adviceTraceId 跳過", async () => {
      await runJudge(null, {}, "session-1");
      expect(callAI).not.toHaveBeenCalled();
    });

    it("無效 adviceObj 跳過", async () => {
      await runJudge("trace-1", null, "session-1");
      expect(callAI).not.toHaveBeenCalled();
    });

    it("呼叫 callAI 兩次 (Actionability + Tone_and_Empathy)", async () => {
      callAI.mockResolvedValue({ text: JSON.stringify({ score: 0.8, reason: "good" }) });

      await runJudge("trace-1", {
        action_items: ["買入"],
        risk_warnings: ["風險"],
        mindset_advice: ["耐心"],
      }, "session-1");

      expect(callAI).toHaveBeenCalledTimes(2);
      expect(callAI).toHaveBeenCalledWith(
        "LLMJudge/JudgeActionability",
        expect.objectContaining({
          sessionId: "session-1",
          provider: "gemini",
          keyIndex: 2,
        }),
      );
      expect(callAI).toHaveBeenCalledWith(
        "LLMJudge/JudgeToneAndEmpathy",
        expect.objectContaining({
          sessionId: "session-1",
          provider: "gemini",
          keyIndex: 2,
        }),
      );
    });

    it("score 寫入 langfuse", async () => {
      callAI.mockResolvedValue({ text: JSON.stringify({ score: 0.75, reason: "ok" }) });

      await runJudge("trace-1", {
        action_items: [],
        risk_warnings: [],
        mindset_advice: [],
      }, "session-1");

      expect(langfuse.score).toHaveBeenCalledTimes(2);
      expect(langfuse.score).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-1",
          name: "Actionability",
          value: 0.75,
        }),
      );
    });

    it("score 超出範圍不寫入 langfuse", async () => {
      callAI.mockResolvedValue({ text: JSON.stringify({ score: 1.5, reason: "too high" }) });

      await runJudge("trace-1", { action_items: [] }, "session-1");

      // score 1.5 超出 0-1，應該被略過
      expect(langfuse.score).not.toHaveBeenCalled();
    });

    it("score 非數字不寫入 langfuse", async () => {
      callAI.mockResolvedValue({ text: JSON.stringify({ score: "invalid" }) });

      await runJudge("trace-1", { action_items: [] }, "session-1");

      expect(langfuse.score).not.toHaveBeenCalled();
    });

    it("callAI 異常時寫入錯誤分數 0", async () => {
      callAI.mockRejectedValue(new Error("AI unavailable"));

      await runJudge("trace-1", { action_items: [] }, "session-1");

      expect(langfuse.score).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-1",
          value: 0,
          comment: expect.stringContaining("Failed:"),
        }),
      );
    });

    it("AIServiceError 正確記錄錯誤", async () => {
      const { AIServiceError } = await import("../../utils/retryUtils.mjs");
      callAI.mockRejectedValue(new AIServiceError("Rate limited", "gemini", "gemini-1.5-pro"));

      await runJudge("trace-1", { action_items: [] }, "session-1");

      expect(langfuse.score).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0,
          comment: expect.stringContaining("AIServiceError"),
        }),
      );
    });

    it("傳遞正確的 promptVariables", async () => {
      callAI.mockResolvedValue({ text: JSON.stringify({ score: 0.5, reason: "test" }) });

      const advice = {
        action_items: ["動作1"],
        risk_warnings: ["風險1"],
        mindset_advice: ["心態1"],
      };
      await runJudge("trace-1", advice, "session-1");

      // 檢查第一次呼叫的 promptVariables
      const firstCall = callAI.mock.calls[0];
      expect(firstCall[1].promptVariables.coachOutputJson).toContain("動作1");
      expect(firstCall[1].promptVariables.coachOutputJson).toContain("風險1");
      expect(firstCall[1].promptVariables.coachOutputJson).toContain("心態1");
    });
  });
});