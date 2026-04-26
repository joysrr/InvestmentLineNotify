import { describe, it, expect } from "vitest";
import { parseNumberOrNull } from "../src/utils/coreUtils.mjs";

describe("coreUtils", () => {
  it("should parse normal number", () => {
    expect(parseNumberOrNull("1,234.56")).toBe(1234.56);
  });

  it("should return null for invalid inputs", () => {
    expect(parseNumberOrNull("--")).toBe(null);
    expect(parseNumberOrNull("abc")).toBe(null);
  });
});
