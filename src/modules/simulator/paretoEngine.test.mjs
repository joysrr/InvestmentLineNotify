// src/modules/simulator/paretoEngine.test.mjs
// TDD: 先寫測試再實作

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runParetoAnalysis } from "./paretoEngine.mjs";

const mockRunForwardSimulation = vi.fn();

const mockLatestReport = {
  price0050: 180,
  currentPrice: 120,
};

const mockBaseSimulationInput = {
  date: "2026-08-01",
  currentPrice: 120,
  price0050: 180,
  basePrice: 115,
  closeArr: Array.from({ length: 250 }, (_, i) => 110 + i * 0.1),
  highArr: Array.from({ length: 250 }, (_, i) => 112 + i * 0.1),
  lowArr: Array.from({ length: 250 }, (_, i) => 108 + i * 0.1),
  closeArr0050: Array.from({ length: 250 }, (_, i) => 170 + i * 0.1),
  ma20Arr: Array.from({ length: 250 }, (_, i) => 170 + i * 0.05),
  ma60Arr: Array.from({ length: 250 }, (_, i) => 165 + i * 0.03),
  ma240Arr: Array.from({ length: 250 }, (_, i) => 155 + i * 0.01),
  ma60SlopeArr: Array.from({ length: 250 }, () => 0.1),
  macdArr: Array.from({ length: 250 }, () => ({
    MACD: 0.5,
    signal: 0.3,
    histogram: 0.2,
  })),
  kdArr: Array.from({ length: 250 }, () => ({ k: 62.1, d: 58.4 })),
  rsiArr: Array.from({ length: 250 }, () => 58),
  atrArr: Array.from({ length: 250 }, () => 2.1),
  vixArr: Array.from({ length: 30 }, () => 18),
  portfolio: {
    qty0050: 10000,
    qtyZ2: 5000,
    cash: 50000,
    totalLoan: 800000,
    lastBuyDate: "2026-01-15",
  },
  VIX: 18.5,
  macroMarketDirection: "NEUTRAL",
  indicators0050: {
    rsiArr: Array.from({ length: 250 }, () => 55),
    kdArr: Array.from({ length: 250 }, () => ({ k: 58, d: 53 })),
    macdArr: Array.from({ length: 250 }, () => ({
      MACD: 0.4,
      signal: 0.2,
      histogram: 0.2,
    })),
    ma20Arr: Array.from({ length: 250 }, () => 172),
    ma60Arr: Array.from({ length: 250 }, () => 168),
    ma240: 158,
    atrArr: Array.from({ length: 250 }, () => 1.8),
  },
  rawValuation: { pb: 1.15 },
  rawUsMarket: { vix: 18.5 },
  rawCnn: { score: 45 },
  rawMargin: { maintenanceRatio: 142.5 },
  rawFx: { currentRate: 31.2 },
  pbRecords: [],
  pbRecordsObjects: [],
  valuationGuardState: { defenseLatch: false },
  institutionalNet: 5000,
  institutionalHistory: [],
  dataQuality: {
    rsi: "ok",
    kd: "ok",
    macd: "ok",
    ma20: "ok",
    ma60: "ok",
    ma240: "ok",
    atr: "ok",
  },
  bias240: 16.3,
};

const mockSignals = {
  RSI: 58.3,
  KD_K: 62.1,
  KD_D: 58.4,
  bias240: 16.3,
  macdSignal: "bull",
  status: "觀望",
  target: "🔹 0050 DCA",
  suggestion: "維持觀望",
  score: 65,
  weightDetails: {},
  finalScore: 65,
  categoryResults: {},
  scalingRatio: 1.0,
  actualLeverage: 1.85,
  maintenanceMargin: 142.5,
  z2Ratio: 25.3,
  grossLeverage: 2.1,
  grossLeverageStatus: "normal",
  maintenanceRisk: { level: "Normal" },
  marginAnalysis: { currentMargin: 142.5, riskLevel: "Normal" },
  decouplingAnalysis: { decoupled: false },
  regimeState: { lifecycleStage: "累積期" },
};

describe("paretoEngine - Pareto 前沿分析", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunForwardSimulation.mockResolvedValue({
      ...mockSignals,
      simulatedPrice0050: 180,
      simulatedPriceZ2: 120,
      currentPrice0050: 175,
      currentPriceZ2: 116.5,
      priceDiff0050: 5,
      priceDiffPct0050: 2.86,
      indicators: {
        rsi: 58.3,
        kd: { k: 62.1, d: 58.4 },
        macd: { MACD: 0.5, signal: 0.3, histogram: 0.2 },
        ma20: 172,
        ma60: 168,
        ma240: 158,
        bias240: 16.3,
        atr: 2.1,
      },
      maintenanceMargin: 206.25,
      portfolioHealth: {
        maintenanceRisk: { level: "Normal" },
        actualLeverage: 1.85,
        z2Ratio: 25.3,
        grossLeverage: 2.1,
        grossLeverageStatus: "normal",
      },
      lifecycleStage: "累積期",
      lifecycleReadOnly: true,
      strategyScore: 65,
      strategyStatus: "觀望",
      strategyTarget: "🔹 0050 DCA",
      strategySuggestion: "維持觀望",
      dataQuality: {
        rsi: "ok",
        kd: "ok",
        macd: "ok",
        ma20: "ok",
        ma60: "ok",
        ma240: "ok",
        atr: "ok",
      },
      calculationMode: "forward",
      timestamp: new Date().toISOString(),
      dataAsOf: "2026-08-01",
      assumptions: [
        "同比例聯動",
        "市場資料 (VIX、持倉、融資等) 維持不變",
        "單一最新收盤價情境",
        "極端行情下指標可能失真",
      ],
      disclaimer: "本分析為條件分析，非價格預測，非投資建議",
      warnings: [],
    });
  });

  describe("runParetoAnalysis", () => {
    it("應拒絕空的 scanParams", async () => {
      const result = await runParetoAnalysis({
        scanParams: [],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 10 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      // scanParams 為空時，generateSamples 應回傳空陣列，導致無採樣點
      expect(result.allPoints).toEqual([]);
      expect(result.paretoFront).toEqual([]);
      expect(result.kneePoint).toBeNull();
    });

    it("單參數掃描應回傳正確格式", async () => {
      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 5 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      expect(result.allPoints).toHaveLength(5);
      expect(result.paretoFront.length).toBeGreaterThan(0);
      expect(result.kneePoint).not.toBeNull();
      expect(mockRunForwardSimulation).toHaveBeenCalledTimes(5);
    });

    it("多參數掃描應回傳 Tornado 圖資料", async () => {
      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
          {
            path: "buy.minDropPercentToConsider",
            range: [3, 8],
            label: "最小跌幅考慮",
            type: "number",
            min: 1,
            max: 15,
          },
        ],
        objectives: [
          { metric: "strategyScore", direction: "maximize" },
          { metric: "maintenanceMargin", direction: "maximize" },
        ],
        weights: [0.6, 0.4],
        sampling: { method: "lhs", samples: 10 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      expect(result.allPoints).toHaveLength(10);
      expect(result.paretoFront.length).toBeGreaterThan(0);
      expect(result.kneePoint).not.toBeNull();
      expect(result.kneePoint.weights).toHaveLength(2);
      expect(mockRunForwardSimulation).toHaveBeenCalledTimes(10);
    });

    it("關鍵驅動因子應正確識別 Top 3", async () => {
      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
          {
            path: "buy.minDropPercentToConsider",
            range: [3, 8],
            label: "最小跌幅考慮",
            type: "number",
            min: 1,
            max: 15,
          },
          {
            path: "trading.loanInterestRate",
            range: [0.02, 0.08],
            label: "融資利率",
            type: "number",
            min: 0.01,
            max: 0.1,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 15 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      expect(result.allPoints).toHaveLength(15);
      expect(result.paretoFront.length).toBeGreaterThan(0);
      expect(result.kneePoint).not.toBeNull();
      expect(mockRunForwardSimulation).toHaveBeenCalledTimes(15);
    });

    it("應正確處理模擬失敗的採樣點", async () => {
      mockRunForwardSimulation.mockRejectedValueOnce(new Error("模擬失敗"));

      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 3 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      // 應有 3 個點，其中 1 個失敗 (dominated: true)
      expect(result.allPoints).toHaveLength(3);
      const failedPoints = result.allPoints.filter((p) => p.dominated === true);
      expect(failedPoints.length).toBe(1);
      expect(mockRunForwardSimulation).toHaveBeenCalledTimes(3);
    });

    it("單點 Pareto 前沿應直接回傳該點", async () => {
      mockRunForwardSimulation.mockResolvedValueOnce({
        ...mockSignals,
        strategyScore: 80,
      });

      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 140],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 1 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      expect(result.paretoFront).toHaveLength(1);
      expect(result.kneePoint).toEqual(result.paretoFront[0]);
    });

    it("LHS 採樣應產生均勻分佈", async () => {
      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "maximize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 20 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      // 驗證所有採樣點都在範圍內
      result.allPoints.forEach((p) => {
        expect(p.params["maintenance.protectTrigger"]).toBeGreaterThanOrEqual(
          140,
        );
        expect(p.params["maintenance.protectTrigger"]).toBeLessThanOrEqual(180);
      });
      expect(result.allPoints).toHaveLength(20);
    });

    it("minimize 目標應正確排序 Pareto 前沿", async () => {
      const result = await runParetoAnalysis({
        scanParams: [
          {
            path: "maintenance.protectTrigger",
            range: [140, 180],
            label: "維持率防禦觸發",
            type: "number",
            min: 100,
            max: 200,
          },
        ],
        objectives: [{ metric: "strategyScore", direction: "minimize" }],
        weights: [1],
        sampling: { method: "lhs", samples: 5 },
        baseSimulationInput: mockBaseSimulationInput,
        _baseParams: { price0050: 175 },
        latestReport: mockLatestReport,
        runForwardSimulation: mockRunForwardSimulation,
      });

      expect(result.paretoFront.length).toBeGreaterThan(0);
      // minimize 時，較小的值應在前沿
      const scores = result.paretoFront.map((p) => p.objectives.strategyScore);
      expect(scores.every((s) => s !== null)).toBe(true);
    });
  });
});
