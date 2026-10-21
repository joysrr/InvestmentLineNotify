import { describe, expect, it } from "vitest";
import { parseNumber } from "../../../utils/coreUtils.mjs";

describe("parseNumber", () => {
  it("缺少數值時預設回傳 null，避免把資料缺失當成 0", () => {
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("")).toBeNull();
  });

  it("仍可用 fallback 明確指定其他缺失值", () => {
    expect(parseNumber(null, { fallback: 0 })).toBe(0);
  });
});
