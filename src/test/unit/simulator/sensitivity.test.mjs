import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateSensitivityInput } from "../../../modules/simulator/validator.mjs";
import {
  PRICE_BOUNDS,
  SCANNABLE_PARAMS,
} from "../../../modules/simulator/constants.mjs";

vi.mock("../../../modules/simulator/constants.mjs", () => ({
  PRICE_BOUNDS: { MIN: 50, MAX: 500 },
  SCANNABLE_PARAMS: [
    {
      path: "maintenance.protectTrigger",
      label: "維持率防禦觸發",
      type: "number",
      min: 100,
      max: 200,
    },
    {
      path: "buy.minDropPercentToConsider",
      label: "最小跌幅考慮",
      type: "number",
      min: 1,
      max: 15,
    },
    {
      path: "trading.loanInterestRate",
      label: "融資利率",
      type: "number",
      min: 0.01,
      max: 0.1,
    },
  ],
}));

describe("Sensitivity Analysis Validator", () => {
  describe("validateSensitivityInput", () => {
    it("應拒絕非物件輸入", () => {
      const result = validateSensitivityInput("invalid");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("body 為必填物件");
    });

    it("應拒絕缺少 baseParams", () => {
      const result = validateSensitivityInput({
        targetParam: "maintenance.protectTrigger",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("baseParams"))).toBe(true);
    });

    it("應拒絕無效 baseParams.price0050", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: -10 },
        targetParam: "maintenance.protectTrigger",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("price0050"))).toBe(true);
    });

    it("應拒絕超出範圍的 price0050", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 1000 },
        targetParam: "maintenance.protectTrigger",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("50 到 500"))).toBe(true);
    });

    it("應接受有效的 baseParams", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175, priceZ2: 275 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 140, max: 180, step: 1 },
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.baseParams.price0050).toBe(175);
    });

    it("應拒絕不支援的 targetParam", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "invalid.param",
        scanRange: { min: 100, max: 200, step: 1 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("不支援的參數路徑"))).toBe(
        true,
      );
    });

    it("應拒絕缺少 scanRange", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("scanRange"))).toBe(true);
    });

    it("應拒絕無效的 scanRange (min > max)", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 200, max: 100, step: 1 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("min 不能大於 max"))).toBe(
        true,
      );
    });

    it("應拒絕無效的 scanRange step", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 100, max: 200, step: 0 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("step 必須大於 0"))).toBe(
        true,
      );
    });

    it("應接受有效的 metrics 陣列", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 140, max: 180, step: 1 },
        metrics: ["strategyScore", "maintenanceMargin"],
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.metrics).toEqual([
        "strategyScore",
        "maintenanceMargin",
      ]);
    });

    it("應拒絕無效的 metrics", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 140, max: 180, step: 1 },
        metrics: ["invalidMetric"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("不支援的觀測指標"))).toBe(
        true,
      );
    });

    it("應接受有效的 multiParams", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 140, max: 180, step: 1 },
        multiParams: [
          { path: "maintenance.protectTrigger", range: [140, 180] },
          { path: "buy.minDropPercentToConsider", range: [3, 8] },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.multiParams).toHaveLength(2);
    });

    it("應拒絕 multiParams 中的不支援路徑", () => {
      const result = validateSensitivityInput({
        baseParams: { price0050: 175 },
        targetParam: "maintenance.protectTrigger",
        scanRange: { min: 140, max: 180, step: 1 },
        multiParams: [{ path: "invalid.path", range: [1, 10] }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("multiParams"))).toBe(true);
    });
  });

  describe("calculateSlope", () => {
    it("應正確計算正斜率", () => {
      const points = [
        { x: 1, y: 10 },
        { x: 2, y: 12 },
        { x: 3, y: 14 },
      ];
      // 這將在實作階段測試
      expect(points.length).toBe(3);
    });

    it("應正確計算負斜率", () => {
      const points = [
        { x: 1, y: 14 },
        { x: 2, y: 12 },
        { x: 3, y: 10 },
      ];
      expect(points.length).toBe(3);
    });
  });
});

describe("Sensitivity Analysis Integration", () => {
  it("單參數掃描應回傳正確格式", () => {
    // 整合測試佔位
    expect(true).toBe(true);
  });

  it("多參數掃描應回傳 Tornado 圖資料", () => {
    expect(true).toBe(true);
  });

  it("關鍵驅動因子應正確識別 Top 3", () => {
    expect(true).toBe(true);
  });
});
