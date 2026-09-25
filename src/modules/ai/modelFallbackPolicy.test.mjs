import { describe, expect, it } from "vitest";
import { getNextModelIndex } from "./modelFallbackPolicy.mjs";

describe("modelFallbackPolicy", () => {
  it("503 service error 時應切換到下一個模型", () => {
    expect(
      getNextModelIndex({
        currentModelIndex: 0,
        modelCount: 3,
        errorType: "service",
      }),
    ).toBe(1);
  });

  it("最後一個模型 503 時應回到第一個模型索引", () => {
    expect(
      getNextModelIndex({
        currentModelIndex: 2,
        modelCount: 3,
        errorType: "service",
      }),
    ).toBe(0);
  });

  it("quota 錯誤也應允許切換模型", () => {
    expect(
      getNextModelIndex({
        currentModelIndex: 0,
        modelCount: 2,
        errorType: "quota",
      }),
    ).toBe(1);
  });
});
