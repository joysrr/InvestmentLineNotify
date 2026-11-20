import { describe, expect, it } from "vitest";
import { formatMoney, fmtDecimal } from "./formatters.js";

describe("formatMoney", () => {
  it("formats finite values as rounded zh-TW amounts", () => {
    expect(formatMoney(1234.56)).toBe("1,235");
    expect(formatMoney(0)).toBe("0");
  });

  it("uses the fallback for missing and non-finite values", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney(Number.NaN)).toBe("—");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("fmtDecimal", () => {
  it("rounds to fixed digits for finite numbers", () => {
    expect(fmtDecimal(180.555)).toBe("180.56");
    expect(fmtDecimal(10.2)).toBe("10.20");
  });

  it("returns fallback for missing and non-finite values", () => {
    expect(fmtDecimal(null)).toBe("—");
    expect(fmtDecimal(undefined)).toBe("—");
    expect(fmtDecimal(Number.NaN)).toBe("—");
  });
});
