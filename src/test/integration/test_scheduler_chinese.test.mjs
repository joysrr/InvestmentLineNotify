import { describe, it, expect } from "vitest";

describe("Test with Chinese comments", () => {
  it("should pass with Chinese comments", () => {
    // 測試中文註釋
    expect(1 + 1).toBe(2);
  });
});
