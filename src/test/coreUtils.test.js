import { describe, it, expect } from "vitest";
import { parseNumber } from "../src/utils/coreUtils.mjs";

describe("coreUtils", () => {
  it("should parse normal number", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
  });

  it("should return null for invalid inputs", () => {
    expect(parseNumber("--")).toBe(null);
    expect(parseNumber("abc")).toBe(null);
  });
});
