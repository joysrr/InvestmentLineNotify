import { describe, it, expect } from "vitest";
import { fmtDecimal, fmtRatio, fmtPercent } from "../utils/formatters.js";

describe("formatters utility", () => {
  describe("fmtDecimal", () => {
    it("應正確將長浮點數四捨五入至指定位數", () => {
      expect(fmtDecimal(0.93955613524562, 2)).toBe("0.94");
      expect(fmtDecimal(12.345, 2)).toBe("12.35");
      expect(fmtDecimal(100.1234, 1)).toBe("100.1");
    });

    it("應處理字串型態數字", () => {
      expect(fmtDecimal("0.939556", 2)).toBe("0.94");
    });

    it("無效數值、null 或 undefined 應傳回 fallback", () => {
      expect(fmtDecimal(null)).toBe("—");
      expect(fmtDecimal(undefined)).toBe("—");
      expect(fmtDecimal("abc")).toBe("—");
      expect(fmtDecimal(NaN)).toBe("—");
    });

    it("應正確處理 0", () => {
      expect(fmtDecimal(0, 2)).toBe("0.00");
    });
  });

  describe("fmtRatio", () => {
    it("應格式化倍數並附加 x 後綴", () => {
      expect(fmtRatio(0.939556)).toBe("0.94x");
      expect(fmtRatio(1.8)).toBe("1.80x");
    });

    it("無效數值應傳回 —", () => {
      expect(fmtRatio(null)).toBe("—");
    });
  });

  describe("fmtPercent", () => {
    it("應格式化百分比並附加 % 後綴", () => {
      expect(fmtPercent(40.1234)).toBe("40.12%");
    });

    it("無效數值應傳回 —", () => {
      expect(fmtPercent(undefined)).toBe("—");
    });
  });
});
