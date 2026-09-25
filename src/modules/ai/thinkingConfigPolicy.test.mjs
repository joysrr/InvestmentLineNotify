import { describe, expect, it } from "vitest";
import { shouldRetryWithoutThinkingConfig } from "./thinkingConfigPolicy.mjs";

describe("thinkingConfigPolicy", () => {
  it("模型不支援 thinking level 時應降級重試", () => {
    expect(
      shouldRetryWithoutThinkingConfig(
        new Error("Thinking level is not supported for this model."),
      ),
    ).toBe(true);
  });

  it("其他 400 錯誤不得誤判為 thinking level 不相容", () => {
    expect(
      shouldRetryWithoutThinkingConfig(new Error("Invalid response schema")),
    ).toBe(false);
  });

  it("沒有錯誤訊息時不得降級", () => {
    expect(shouldRetryWithoutThinkingConfig(null)).toBe(false);
  });
});
