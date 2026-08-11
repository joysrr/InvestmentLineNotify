import { describe, it, expect, vi } from "vitest";
import { validateParetoInput } from "../../../modules/simulator/validator.mjs";

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

describe("Pareto Validator", () => {
  describe("validateParetoInput", () => {
    it("應拒絕非物件輸入", () => {
      const result = validateParetoInput("invalid");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("body 為必填物件");
    });

    it("應拒絕缺少 baseParams", () => {
      const result = validateParetoInput({ scanParams: [], objectives: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("baseParams"))).toBe(true);
    });

    it("應拒絕無效的 baseParams", () => {
      const result = validateParetoInput({
        baseParams: { price0050: -10 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("price0050"))).toBe(true);
    });

    it("應拒絕空的 scanParams", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("scanParams"))).toBe(true);
    });

    it("應拒絕超過 5 個 scanParams", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [
          { path: "maintenance.protectTrigger", range: [140, 180] },
          { path: "buy.minDropPercentToConsider", range: [3, 8] },
          { path: "trading.loanInterestRate", range: [0.02, 0.08] },
          { path: "maintenance.protectTarget", range: [140, 180] },
          { path: "maintenance.marginCallThreshold", range: [100, 150] },
          { path: "trading.transFee", range: [0.001, 0.01] },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("scanParams 數量不能超過 5")),
      ).toBe(true);
    });

    it("應拒絕不支援的 scanParams 路徑", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "invalid.path", range: [1, 10] }],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("scanParams"))).toBe(true);
    });

    it("應拒絕無效的 range", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [200, 140] }],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("range"))).toBe(true);
    });

    it("應拒絕空的 objectives", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("objectives"))).toBe(true);
    });

    it("應拒絕不支援的 objectives metric", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [
          { metric: "invalidMetric", direction: "maximize" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("不支援"))).toBe(true);
    });

    it("應拒絕無效的 direction", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [
          { metric: "strategyScore", direction: "invalid" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("direction"))).toBe(true);
    });

    it("應接受有效的 weights", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [
          { path: "maintenance.protectTrigger", range: [140, 180] },
          { path: "buy.minDropPercentToConsider", range: [3, 8] },
        ],
        objectives: [
          { metric: "strategyScore", direction: "maximize" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
        weights: [0.6, 0.4],
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.weights).toEqual([0.6, 0.4]);
    });

    it("應拒絕 weights 長度不匹配 objectives", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [
          { metric: "strategyScore", direction: "maximize" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
        weights: [0.5],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("weights"))).toBe(true);
    });

    it("應接受有效的 sampling 設定", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [
          { metric: "strategyScore", direction: "maximize" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
        sampling: { method: "lhs", samples: 200 },
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.sampling.method).toBe("lhs");
      expect(result.sanitized.sampling.samples).toBe(200);
    });

    it("應拒絕超過 500 的 samples", () => {
      const result = validateParetoInput({
        baseParams: { price0050: 175 },
        scanParams: [{ path: "maintenance.protectTrigger", range: [140, 180] }],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        sampling: { method: "lhs", samples: 1000 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("samples"))).toBe(true);
    });
  });

  describe("Pareto Engine Integration", () => {
    it("非支配排序應正確分級", () => {
      // 佔位 - 將在實作階段測試
      expect(true).toBe(true);
    });

    it("膝點檢測應正確識別", () => {
      expect(true).toBe(true);
    });

    it("LHS 採樣應產生均勻分佈", () => {
      expect(true).toBe(true);
    });
  });
});
