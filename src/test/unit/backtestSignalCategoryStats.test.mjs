/**
 * backtestSignalCategoryStats.test.mjs
 * 回測 signalCategory 分組統計單元測試
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateSignalCategoryStats,
  generateMonthlyReportMarkdown,
  generateSignalCategoryReports,
  BACKTEST_DIR,
} from "../../modules/backtest/backtestSignalCategoryStats.mjs";

describe("backtestSignalCategoryStats", () => {
  let mockResults;

  beforeEach(() => {
    mockResults = [
      // 1月 - baseline 類別
      {
        date: "2024-01-01",
        signalCategory: "baseline",
        signal: "hold",
        score: 0.5,
        netAsset: 100000,
        returnPct: 0.1,
      },
      {
        date: "2024-01-02",
        signalCategory: "baseline",
        signal: "hold",
        score: 0.3,
        netAsset: 100100,
        returnPct: 0.1,
      },
      {
        date: "2024-01-03",
        signalCategory: "baseline",
        signal: "long",
        score: 2.5,
        netAsset: 100200,
        returnPct: 0.1,
      },
      // 1月 - deep_drop 類別
      {
        date: "2024-01-04",
        signalCategory: "deep_drop",
        signal: "long",
        score: 4.0,
        netAsset: 100300,
        returnPct: -0.5,
      },
      {
        date: "2024-01-05",
        signalCategory: "deep_drop",
        signal: "long",
        score: 3.8,
        netAsset: 100250,
        returnPct: -0.5,
      },
      // 2月 - panic 類別
      {
        date: "2024-02-01",
        signalCategory: "panic",
        signal: "long",
        score: 6.5,
        netAsset: 101000,
        returnPct: 1.2,
      },
      {
        date: "2024-02-02",
        signalCategory: "panic",
        signal: "short",
        score: -2.0,
        netAsset: 100800,
        returnPct: -1.0,
      },
      // 2月 - take_profit 類別
      {
        date: "2024-02-03",
        signalCategory: "take_profit",
        signal: "short",
        score: -1.5,
        netAsset: 102000,
        returnPct: 0.8,
      },
      // 2月 - rebalance 類別
      {
        date: "2024-02-04",
        signalCategory: "rebalance",
        signal: "hold",
        score: 0.0,
        netAsset: 101900,
        returnPct: -0.1,
      },
    ];
  });

  describe("calculateSignalCategoryStats()", () => {
    it("應正確計算各類別的基本統計", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      expect(stats.categories.baseline.count).toBe(3);
      expect(stats.categories.baseline.buyCount).toBe(1);
      expect(stats.categories.baseline.holdCount).toBe(2);
      expect(stats.categories.baseline.sellCount).toBe(0);

      expect(stats.categories.deep_drop.count).toBe(2);
      expect(stats.categories.deep_drop.buyCount).toBe(2);

      expect(stats.categories.panic.count).toBe(2);
      expect(stats.categories.panic.buyCount).toBe(1);
      expect(stats.categories.panic.sellCount).toBe(1);
    });

    it("應正確計算勝率", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      // baseline: 3筆都是 returnPct 0.1 (正) -> 勝率 100%
      expect(stats.categories.baseline.winRate).toBe(100);

      // deep_drop: 2筆都是 -0.5 (負) -> 勝率 0%
      expect(stats.categories.deep_drop.winRate).toBe(0);

      // panic: 1筆正 1筆負 -> 勝率 50%
      expect(stats.categories.panic.winRate).toBe(50);
    });

    it("應正確計算平均分數", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      // baseline: (0.5 + 0.3 + 2.5) / 3 = 1.1
      expect(stats.categories.baseline.avgScore).toBeCloseTo(1.1, 1);

      // deep_drop: (4.0 + 3.8) / 2 = 3.9
      expect(stats.categories.deep_drop.avgScore).toBeCloseTo(3.9, 1);
    });

    it("應正確計算平均報酬", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      // baseline: (0.1 + 0.1 + 0.1) / 3 = 0.1
      expect(stats.categories.baseline.avgReturn).toBeCloseTo(0.1, 1);

      // deep_drop: (-0.5 + -0.5) / 2 = -0.5
      expect(stats.categories.deep_drop.avgReturn).toBeCloseTo(-0.5, 1);
    });

    it("應正確生成月度拆解", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      expect(
        stats.categories.baseline.monthlyBreakdown["2024-01"],
      ).toBeDefined();
      expect(stats.categories.baseline.monthlyBreakdown["2024-01"].count).toBe(
        3,
      );
      expect(
        stats.categories.baseline.monthlyBreakdown["2024-01"].avgScore,
      ).toBeCloseTo(1.1, 1);

      expect(stats.categories.panic.monthlyBreakdown["2024-02"]).toBeDefined();
      expect(stats.categories.panic.monthlyBreakdown["2024-02"].count).toBe(2);
    });

    it("應正確生成全局月度統計", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      expect(stats.monthlyData["2024-01"].totalDays).toBe(5);
      expect(stats.monthlyData["2024-01"].categories.baseline).toBe(3);
      expect(stats.monthlyData["2024-01"].categories.deep_drop).toBe(2);

      expect(stats.monthlyData["2024-02"].totalDays).toBe(4);
    });

    it("空結果應回傳空物件", () => {
      const stats = calculateSignalCategoryStats([]);
      expect(stats.categories).toEqual({});
      expect(stats.summary).toEqual({});
    });

    it("結果為 null/undefined 時應回傳空物件", () => {
      const stats = calculateSignalCategoryStats(null);
      expect(stats.categories).toEqual({});

      const stats2 = calculateSignalCategoryStats(undefined);
      expect(stats2.categories).toEqual({});
    });

    it("summary 應包含正確的元資訊", () => {
      const stats = calculateSignalCategoryStats(mockResults);

      expect(stats.summary.totalDays).toBe(9);
      expect(stats.summary.totalCategories).toBe(5);
      expect(stats.summary.startDate).toBe("2024-01-01");
      expect(stats.summary.endDate).toBe("2024-02-04");
    });
  });

  describe("generateMonthlyReportMarkdown()", () => {
    it("應生成有效的 Markdown 報告", () => {
      const stats = calculateSignalCategoryStats(mockResults);
      const md = generateMonthlyReportMarkdown(stats);

      expect(md).toContain("# 回測 SignalCategory 月報");
      expect(md).toContain("2024-01-01 ~ 2024-02-04");
      // 使用中文冒號匹配
      expect(md).toContain("總天數");
      expect(md).toContain("10");
      expect(md).toContain("## 類別總覽");
      expect(md).toContain("baseline");
      expect(md).toContain("deep_drop");
      expect(md).toContain("panic");
      expect(md).toContain("take_profit");
      expect(md).toContain("rebalance");
      expect(md).toContain("## 月度明細");
      expect(md).toContain("2024-01");
      expect(md).toContain("2024-02");
    });

    it("空統計不應崩潰", () => {
      const emptyStats = {
        categories: {},
        monthlyData: {},
        summary: {
          startDate: "",
          endDate: "",
          totalDays: 0,
          totalCategories: 0,
        },
      };
      const md = generateMonthlyReportMarkdown(emptyStats);
      expect(md).toContain("回測 SignalCategory 月報");
    });
  });

  describe("generateSignalCategoryReports()", () => {
    it("應成功生成 CSV 和 Markdown 檔案", async () => {
      const stats = calculateSignalCategoryStats(mockResults);
      const testDir = "/tmp/backtest_test_" + Date.now();

      const result = await generateSignalCategoryReports(stats, testDir);

      expect(result.categoryCsv).toContain(testDir);
      expect(result.monthlyCsv).toContain(testDir);
      expect(result.markdown).toContain(testDir);
      expect(result.categoryCsv).toContain("_categories.csv");
      expect(result.monthlyCsv).toContain("_monthly.csv");
      expect(result.markdown).toContain("_report.md");
    });

    it("CSV 內容應正確", async () => {
      const stats = calculateSignalCategoryStats(mockResults);
      const testDir = "/tmp/backtest_test_" + Date.now();

      await generateSignalCategoryReports(stats, testDir);

      // 驗證分類 CSV 內容
      const fs = await import("fs/promises");
      const catCsv = await fs.readFile(
        `${testDir}/signal_category_2024-01-01_2024-02-04_${new Date().toISOString().split("T")[0]}_categories.csv`,
        "utf-8",
      );
      expect(catCsv).toContain(
        "category,count,buyCount,sellCount,holdCount,winRate,avgScore,avgReturn,totalReturn",
      );
      expect(catCsv).toContain("baseline");
      expect(catCsv).toContain("deep_drop");
    });
  });

  describe("BACKTEST_DIR", () => {
    it("應指向正確的路徑", () => {
      expect(BACKTEST_DIR).toContain("data/backtest");
    });
  });
});
