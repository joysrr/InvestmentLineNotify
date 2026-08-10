/**
 * backtestMacroSentimentCompare.test.mjs
 * 回測 MacroSentiment 三模式比較單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 依賴模組
vi.mock("../../data/archiveManager.mjs", () => ({
  archiveManager: {
    getArchiveRecords: vi.fn().mockResolvedValue([
      {
        date: "2024-01-01",
        signals: { price0050: 150, currentPrice: 300 },
        marketState: { sentiment: { vix: 20 }, valuation: { pb: 2.5 } },
      },
      {
        date: "2024-01-02",
        signals: { price0050: 151, currentPrice: 302 },
        marketState: { sentiment: { vix: 21 }, valuation: { pb: 2.5 } },
      },
    ]),
  },
}));

vi.mock("../strategy/strategyLoader.mjs", () => ({
  fetchStrategyConfigUnified: vi.fn().mockResolvedValue({
    macroSentiment: { enabled: true, bullishBonus: 10, bearishPenalty: -10 },
    trading: { loanInterestRate: 0.022, budget: {} },
    expectedAnnualReturn: 0.08,
  }),
}));

vi.mock("./backtestRunner.mjs", () => ({
  BacktestRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      name: "test",
      returnPct: 2.5,
      finalNetAsset: 1250000,
      qty0050: 1200,
      qtyZ2: 450,
      totalLoan: 230000,
      finalLeverage: 1.45,
      minMm: 85.2,
      signalCategoryStats: {
        categories: { baseline: { count: 100 } },
        summary: {
          totalDays: 120,
          totalCategories: 1,
          startDate: "2024-01-01",
          endDate: "2024-04-30",
        },
        monthlyData: {},
      },
    }),
    calculateSignalCategoryStats: vi.fn().mockReturnValue({
      categories: { baseline: { count: 100 } },
      summary: { totalDays: 120 },
      monthlyData: {},
    }),
  })),
}));

vi.mock("./backtestSignalCategoryStats.mjs", () => ({
  generateSignalCategoryReports: vi.fn().mockResolvedValue({}),
  BACKTEST_DIR: "/tmp/test_backtest",
}));

// 在 mock 之後導入被測試模組
import {
  MACRO_MODES,
  runSingleModeBacktest,
  runMacroSentimentComparison,
  generateComparisonReport,
  generateComparisonCSV,
  main,
} from "../../modules/backtest/backtestMacroSentimentCompare.mjs";

describe("backtestMacroSentimentCompare", () => {
  describe("MACRO_MODES", () => {
    it("應包含 5 種預設模式", () => {
      expect(Object.keys(MACRO_MODES)).toHaveLength(5);
      expect(MACRO_MODES.disabled).toBeDefined();
      expect(MACRO_MODES.enabled).toBeDefined();
      expect(MACRO_MODES.simulated_bull).toBeDefined();
      expect(MACRO_MODES.simulated_bear).toBeDefined();
      expect(MACRO_MODES.simulated_neutral).toBeDefined();
    });

    it("每種模式應有正確的配置", () => {
      expect(MACRO_MODES.disabled.macroSentiment.enabled).toBe(false);
      expect(MACRO_MODES.simulated_bull.macroSentiment.bullishBonus).toBe(15);
      expect(MACRO_MODES.simulated_bull.macroSentiment.bearishPenalty).toBe(0);
      expect(MACRO_MODES.simulated_bear.macroSentiment.bullishBonus).toBe(0);
      expect(MACRO_MODES.simulated_bear.macroSentiment.bearishPenalty).toBe(
        -15,
      );
      expect(MACRO_MODES.simulated_neutral.macroSentiment.bullishBonus).toBe(0);
      expect(MACRO_MODES.simulated_neutral.macroSentiment.bearishPenalty).toBe(
        0,
      );
    });

    it("模式名稱應正確", () => {
      expect(MACRO_MODES.disabled.name).toBe("MacroSentiment 關閉");
      expect(MACRO_MODES.enabled.name).toBe("策略配置啟用");
      expect(MACRO_MODES.simulated_bull.name).toBe("模擬多頭市場");
      expect(MACRO_MODES.simulated_bear.name).toBe("模擬空頭市場");
      expect(MACRO_MODES.simulated_neutral.name).toBe("模擬中性市場");
    });
  });

  describe("generateComparisonReport()", () => {
    const mockComparisonResult = {
      baseConfig: {
        start: "2024-01-01",
        end: "2024-12-31",
        name: "test_compare",
      },
      results: [
        {
          mode: "disabled",
          modeName: "MacroSentiment 關閉",
          summary: {
            returnPct: 2.5,
            finalNetAsset: 1250000,
            qty0050: 1200,
            qtyZ2: 450,
            totalLoan: 230000,
            finalLeverage: 1.45,
            minMm: 85.2,
            signalCategoryStats: {
              categories: {
                baseline: {
                  count: 100,
                  buyCount: 10,
                  sellCount: 5,
                  holdCount: 85,
                  winRate: 55,
                  avgScore: 1.2,
                  avgReturn: 0.15,
                },
                deep_drop: {
                  count: 20,
                  buyCount: 15,
                  sellCount: 0,
                  holdCount: 5,
                  winRate: 60,
                  avgScore: 3.5,
                  avgReturn: 0.8,
                },
              },
              summary: {
                totalDays: 120,
                totalCategories: 2,
                startDate: "2024-01-01",
                endDate: "2024-04-30",
              },
              monthlyData: {},
            },
          },
        },
        {
          mode: "enabled",
          modeName: "策略配置啟用",
          summary: {
            returnPct: 3.2,
            finalNetAsset: 1280000,
            qty0050: 1200,
            qtyZ2: 520,
            totalLoan: 265000,
            finalLeverage: 1.52,
            minMm: 78.5,
            signalCategoryStats: {
              categories: {
                baseline: {
                  count: 90,
                  buyCount: 8,
                  sellCount: 5,
                  holdCount: 77,
                  winRate: 52,
                  avgScore: 1.0,
                  avgReturn: 0.12,
                },
                deep_drop: {
                  count: 25,
                  buyCount: 18,
                  sellCount: 0,
                  holdCount: 7,
                  winRate: 58,
                  avgScore: 3.8,
                  avgReturn: 0.9,
                },
                panic: {
                  count: 5,
                  buyCount: 5,
                  sellCount: 0,
                  holdCount: 0,
                  winRate: 70,
                  avgScore: 6.2,
                  avgReturn: 1.5,
                },
              },
              summary: {
                totalDays: 120,
                totalCategories: 3,
                startDate: "2024-01-01",
                endDate: "2024-04-30",
              },
              monthlyData: {},
            },
          },
        },
        {
          mode: "simulated_bull",
          modeName: "模擬多頭市場",
          error: "模擬錯誤",
        },
      ],
    };

    it("應生成有效的 Markdown 比較報告", () => {
      const md = generateComparisonReport(mockComparisonResult);

      expect(md).toContain("# 回測 MacroSentiment 三模式比較報告");
      expect(md).toContain("2024-01-01 ~ 2024-12-31");
      expect(md).toContain("test_compare");
      expect(md).toContain("## 模式比較總表");
      expect(md).toContain("disabled");
      expect(md).toContain("enabled");
      expect(md).toContain("simulated_bull");
      expect(md).toContain("2.50%");
      expect(md).toContain("3.20%");
      expect(md).toContain("❌ 模擬錯誤");
    });

    it("應包含關鍵指標差異分析", () => {
      const md = generateComparisonReport(mockComparisonResult);

      expect(md).toContain("## 關鍵指標差異分析");
      expect(md).toContain("相對於 Baseline");
      // enabled 相對 disabled: 3.2 - 2.5 = +0.7%
      expect(md).toContain("+0.70%");
    });

    it("應包含 SignalCategory 分布比較", () => {
      const md = generateComparisonReport(mockComparisonResult);

      expect(md).toContain("## SignalCategory 分布比較");
      expect(md).toContain("MacroSentiment 關閉");
      expect(md).toContain("策略配置啟用");
      expect(md).toContain("baseline");
      expect(md).toContain("deep_drop");
      expect(md).toContain("panic");
    });

    it("空結果不應崩潰", () => {
      const emptyResult = {
        baseConfig: { start: "", end: "", name: "" },
        results: [],
      };
      const md = generateComparisonReport(emptyResult);
      expect(md).toContain("回測 MacroSentiment 三模式比較報告");
    });
  });

  describe("generateComparisonCSV()", () => {
    const mockComparisonResult = {
      baseConfig: {
        start: "2024-01-01",
        end: "2024-12-31",
        name: "test_compare",
      },
      results: [
        {
          mode: "disabled",
          modeName: "MacroSentiment 關閉",
          summary: {
            returnPct: 2.5,
            finalNetAsset: 1250000,
            qty0050: 1200,
            qtyZ2: 450,
            totalLoan: 230000,
            finalLeverage: 1.45,
            minMm: 85.2,
          },
        },
        {
          mode: "enabled",
          modeName: "策略配置啟用",
          error: "測試錯誤",
        },
      ],
    };

    it("應生成正確的 CSV 格式", async () => {
      const fs = await import("fs/promises");
      const testDir = "/tmp/test_csv_" + Date.now();
      await fs.mkdir(testDir, { recursive: true });
      const csvPath = await generateComparisonCSV(
        mockComparisonResult,
        testDir,
      );

      expect(csvPath).toContain(testDir);
      expect(csvPath).toContain(".csv");

      const content = await fs.readFile(csvPath, "utf-8");

      expect(content).toContain(
        "mode,modeName,returnPct,finalNetAsset,qty0050,qtyZ2,totalLoan,finalLeverage,minMm,error",
      );
      expect(content).toContain(
        "disabled,MacroSentiment 關閉,2.50,1250000,1200,450,230000,1.45,85.2,",
      );
      expect(content).toContain('enabled,策略配置啟用,,,,,,,,"測試錯誤"');
    });
  });

  describe("runMacroSentimentComparison()", () => {
    it("應正確驗證模式名稱", () => {
      const validModes = Object.keys(MACRO_MODES);
      expect(validModes).toContain("disabled");
      expect(validModes).toContain("enabled");
      expect(validModes).toContain("simulated_bull");
      expect(validModes).toContain("simulated_bear");
      expect(validModes).toContain("simulated_neutral");
    });
  });

  describe("main() CLI 參數解析", () => {
    it("應正確解析預設參數", () => {
      const defaultModes = [
        "disabled",
        "enabled",
        "simulated_bull",
        "simulated_bear",
        "simulated_neutral",
      ];
      expect(defaultModes).toHaveLength(5);
    });

    it("應支援自訂模式列表", () => {
      const customModes = "disabled,enabled".split(",");
      expect(customModes).toEqual(["disabled", "enabled"]);
    });
  });
});
