import { describe, it, expect } from "vitest";
import { parseNumber } from "../utils/coreUtils.mjs";

describe("coreUtils", () => {
  it("should parse normal number", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
  });

  it("should return null for invalid inputs", () => {
    expect(parseNumber("--", { fallback: null })).toBe(null);
    expect(parseNumber("abc", { fallback: null })).toBe(null);
  });
});
