// src/modules/simulator/forwardSimulator.test.mjs
// TDD: 先寫測試再實作

import { describe, it, expect, beforeEach, vi } from "vitest";
import { runForwardSimulation } from "./forwardSimulator.mjs";
import { evaluateInvestmentSignal } from "../strategy/strategyEngine.mjs";

// Mock evaluateInvestmentSignal
vi.mock("../strategy/strategyEngine.mjs", () => ({
  evaluateInvestmentSignal: vi.fn(),
}));

const mockSimulationInput = {
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
  kdArr: Array.from({ length: 250 }, () => ({ k: 60, d: 55 })),
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

describe("forwardSimulator - 正向模擬主流程", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateInvestmentSignal.mockResolvedValue({ signals: mockSignals });
  });

  it("正常執行並回傳完整結構", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    // 基本結構
    expect(result).toHaveProperty("simulatedPrice0050", 180);
    expect(result).toHaveProperty("simulatedPriceZ2", 120);
    expect(result).toHaveProperty("currentPrice0050", 175);
    expect(result).toHaveProperty("currentPriceZ2", 116.5);
    expect(result).toHaveProperty("priceDiff0050", 5);
    expect(result).toHaveProperty("priceDiffPct0050");

    // 指標
    expect(result.indicators).toHaveProperty("rsi", 58.3);
    expect(result.indicators).toHaveProperty("kd");
    expect(result.indicators.kd).toHaveProperty("k", 62.1);
    expect(result.indicators.kd).toHaveProperty("d", 58.4);
    expect(result.indicators).toHaveProperty("macd");
    expect(result.indicators).toHaveProperty("ma20");
    expect(result.indicators).toHaveProperty("ma60");
    expect(result.indicators).toHaveProperty("ma240");
    expect(result.indicators).toHaveProperty("bias240", 16.3);
    expect(result.indicators).toHaveProperty("atr");

    // 維持率
    expect(typeof result.maintenanceMargin).toBe("number");
    expect(result.maintenanceMargin).toBeGreaterThan(0);

    // Portfolio Health
    expect(result.portfolioHealth).toHaveProperty("maintenanceRisk");
    expect(result.portfolioHealth).toHaveProperty("actualLeverage");
    expect(result.portfolioHealth).toHaveProperty("z2Ratio");
    expect(result.portfolioHealth).toHaveProperty("grossLeverage");
    expect(result.portfolioHealth).toHaveProperty("grossLeverageStatus");

    // 生命週期
    expect(result.lifecycleStage).toBe("累積期");
    expect(result.lifecycleReadOnly).toBe(true);

    // 策略結果
    expect(result.strategyScore).toBe(65);
    expect(result.strategyStatus).toBe("觀望");
    expect(result.strategyTarget).toBe("🔹 0050 DCA");
    expect(result.strategySuggestion).toBe("維持觀望");

    // 資料品質
    expect(result.dataQuality).toHaveProperty("rsi", "ok");
    expect(result.dataQuality).toHaveProperty("kd", "ok");
    expect(result.dataQuality).toHaveProperty("macd", "ok");
    expect(result.dataQuality).toHaveProperty("ma20", "ok");
    expect(result.dataQuality).toHaveProperty("ma60", "ok");
    expect(result.dataQuality).toHaveProperty("ma240", "ok");
    expect(result.dataQuality).toHaveProperty("atr", "ok");

    // 計算模式與時間戳
    expect(result.calculationMode).toBe("forward");
    expect(result.timestamp).toBeDefined();
    expect(result.dataAsOf).toBe("2026-08-01");

    // 假設與警告
    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.some((a) => a.includes("同比例聯動"))).toBe(true);
    expect(result.assumptions.some((a) => a.includes("極端行情"))).toBe(true);

    // 免責聲明
    expect(result.disclaimer).toContain("條件分析");
    expect(result.disclaimer).toContain("非價格預測");

    // 警告 (價格偏離 2.86% < 10%)
    expect(result.warnings).toEqual([]);
  });

  it("價格偏離 10-20% 產生黃色警告", async () => {
    // 180 vs 160 = 12.5% 偏離
    const result = await runForwardSimulation(mockSimulationInput, 160, 116.5);

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("10%");
    expect(result.warnings[0]).toContain("可能不反映單日情境");
  });

  it("價格偏離 >20% 產生紅色警告", async () => {
    // 180 vs 145 = 24.1% 偏離
    const result = await runForwardSimulation(mockSimulationInput, 145, 116.5);

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("20%");
    expect(result.warnings[0]).toContain("多日後狀態");
    expect(result.warnings[0]).toContain("路徑依賴性");
  });

  it("維持率計算正確", async () => {
    // portfolio: qty0050=10000, qtyZ2=5000, cash=50000, totalLoan=800000
    // 模擬價格: price0050=180, priceZ2=120
    // netAsset = 10000*180 + 5000*120 + 50000 - 800000 = 1,800,000 + 600,000 + 50,000 - 800,000 = 1,650,000
    // maintenanceMargin = 1,650,000 / 800,000 * 100 = 206.25%
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.maintenanceMargin).toBeCloseTo(206.25, 1);
  });

  it("呼叫 evaluateInvestmentSignal 並傳入正確參數", async () => {
    await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(evaluateInvestmentSignal).toHaveBeenCalledTimes(1);
    const calledWith = evaluateInvestmentSignal.mock.calls[0][0];
    expect(calledWith.price0050).toBe(180);
    expect(calledWith.currentPrice).toBe(120);
    expect(calledWith.portfolio).toEqual(mockSimulationInput.portfolio);
  });

  it("回應包含 timestamp (ISO 8601 格式)", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("dataAsOf 為 YYYY-MM-DD 格式", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("calculationMode 為 forward", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.calculationMode).toBe("forward");
  });

  it("assumptions 包含關鍵假設條件", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.assumptions.some((a) => a.includes("同比例聯動"))).toBe(true);
    expect(
      result.assumptions.some((a) =>
        a.includes("市場資料 (VIX、持倉、融資等) 維持不變"),
      ),
    ).toBe(true);
    expect(
      result.assumptions.some((a) => a.includes("單一最新收盤價情境")),
    ).toBe(true);
    expect(result.assumptions.some((a) => a.includes("極端行情"))).toBe(true);
  });

  it("disclaimer 明確指出非投資建議", async () => {
    const result = await runForwardSimulation(mockSimulationInput, 175, 116.5);

    expect(result.disclaimer).toContain("非價格預測");
    expect(result.disclaimer).toContain("非投資建議");
    expect(result.disclaimer).toContain("條件分析");
  });

  it("缺少部分 dataQuality 時補上 insufficient_data", async () => {
    const inputWithMissingQuality = {
      ...mockSimulationInput,
      dataQuality: { rsi: "ok" }, // 只提供 rsi
    };

    const result = await runForwardSimulation(
      inputWithMissingQuality,
      175,
      116.5,
    );

    expect(result.dataQuality.rsi).toBe("ok");
    expect(result.dataQuality.kd).toBe("insufficient_data");
    expect(result.dataQuality.macd).toBe("insufficient_data");
    expect(result.dataQuality.ma20).toBe("insufficient_data");
    expect(result.dataQuality.ma60).toBe("insufficient_data");
    expect(result.dataQuality.ma240).toBe("insufficient_data");
    expect(result.dataQuality.atr).toBe("insufficient_data");
  });
});
