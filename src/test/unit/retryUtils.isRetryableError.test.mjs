import { describe, expect, it } from "vitest";
import { isRetryableError } from "../../utils/retryUtils.mjs";

describe("isRetryableError — type safety", () => {
  it("does not throw when error.code is a number", () => {
    const err = new Error("HTTP 404");
    err.code = 404; // 數字，非字串
    expect(() => isRetryableError(err)).not.toThrow();
  });

  it("does not throw when error.code is undefined", () => {
    const err = new Error("generic error");
    expect(() => isRetryableError(err)).not.toThrow();
  });

  it("does not throw when error.code is null", () => {
    const err = new Error("null code");
    err.code = null;
    expect(() => isRetryableError(err)).not.toThrow();
  });

  it("does not throw when error.code is an object", () => {
    const err = new Error("object code");
    err.code = { value: "ECONNRESET" };
    expect(() => isRetryableError(err)).not.toThrow();
  });

  it("correctly detects ETIMEDOUT when error.code is a string", () => {
    const err = new Error("connection failed");
    err.code = "ETIMEDOUT";
    expect(isRetryableError(err)).toBe(true);
  });

  it("correctly detects network error via message when error.code is numeric", () => {
    const err = new Error("fetch failed timeout");
    err.code = 522; // Cloudflare timeout 數字
    expect(isRetryableError(err)).toBe(true); // 靠 message 判斷
  });

  it("returns false for a plain non-retryable error", () => {
    const err = new Error("some logic error");
    expect(isRetryableError(err)).toBe(false);
  });
});
