// src/test/unit/ai/modelFallback.test.mjs
// TDD：多模型 Fallback 機制

import { describe, it, expect } from "vitest";
import { resolveGeminiModelList } from "../../../modules/ai/modelFallback.mjs";

describe("resolveGeminiModelList", () => {
  it("未設定 GEMINI_MODEL_FALLBACKS 時，回傳單一 defaultModel", () => {
    const result = resolveGeminiModelList({
      defaultModel: "gemini-3-flash-preview",
      fallbacksEnv: undefined,
    });
    expect(result).toEqual(["gemini-3-flash-preview"]);
  });

  it("設定 GEMINI_MODEL_FALLBACKS 時，回傳 defaultModel + fallback 清單（去重）", () => {
    const result = resolveGeminiModelList({
      defaultModel: "gemini-3-flash-preview",
      fallbacksEnv: "gemini-3.5-flash,gemini-3.8-flash,gemini-2.5-flash",
    });
    expect(result).toEqual([
      "gemini-3-flash-preview",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-2.5-flash",
    ]);
  });

  it("GEMINI_MODEL_FALLBACKS 包含與 defaultModel 重複時，自動去重", () => {
    const result = resolveGeminiModelList({
      defaultModel: "gemini-3-flash-preview",
      fallbacksEnv: "gemini-3-flash-preview,gemini-3.8-flash",
    });
    expect(result).toEqual(["gemini-3-flash-preview", "gemini-3.8-flash"]);
  });

  it("GEMINI_MODEL_FALLBACKS 含空白與空字串時，自動過濾", () => {
    const result = resolveGeminiModelList({
      defaultModel: "gemini-3-flash-preview",
      fallbacksEnv: "gemini-3.5-flash, ,gemini-3.8-flash,",
    });
    expect(result).toEqual([
      "gemini-3-flash-preview",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
    ]);
  });
});
