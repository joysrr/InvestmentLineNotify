/**
 * backtestResults.test.mjs
 * 回測結果查詢 API 單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateChartData,
  exportResultsCSV,
} from "../../modules/backtest/backtestResults.mjs";

// 使用 vi.hoisted 確保 mock 資料在 vi.mock 之前定義
const { mockJobs } = vi.hoisted(() => {
  const jobs = [
    {
      jobId: "job-001",
      name: "test-run-1",
      status: "completed",
      config: { start: "2024-01-01", end: "2024-12-31", disableGuards: true },
      createdAt: Date.now() - 86400000,
      finishedAt: Date.now() - 80000000,
      summary: {
        returnPct: 15.2,
        finalNetAsset: 1150000,
        qty0050: 1000,
        qtyZ2: 400,
        totalLoan: 200000,
        finalLeverage: 1.45,
        minMm: 82.5,
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
            totalDays: 125,
            totalCategories: 3,
            startDate: "2024-01-01",
            endDate: "2024-05-05",
          },
        },
      },
      results: [
        {
          date: "2024-01-01",
          netAsset: 1000000,
          qty0050: 1000,
          qtyZ2: 0,
          totalLoan: 0,
          actualLeverage: 1.0,
          maintenanceMargin: 999,
          signalCategory: "baseline",
          signalType: "baseline",
          price0050: 150,
          priceZ2: 300,
        },
        {
          date: "2024-01-02",
          netAsset: 1005000,
          qty0050: 1000,
          qtyZ2: 50,
          totalLoan: 15000,
          actualLeverage: 1.02,
          maintenanceMargin: 120,
          signalCategory: "baseline",
          signalType: "baseline",
          price0050: 151,
          priceZ2: 302,
        },
      ],
    },
    {
      jobId: "job-002",
      name: "test-run-2",
      status: "completed",
      config: { start: "2024-01-01", end: "2024-12-31", disableGuards: false },
      createdAt: Date.now() - 172800000,
      finishedAt: Date.now() - 160000000,
      summary: {
        returnPct: 12.8,
        finalNetAsset: 1128000,
        qty0050: 1000,
        qtyZ2: 350,
        totalLoan: 180000,
        finalLeverage: 1.38,
        minMm: 85.2,
        signalCategoryStats: {
          categories: {
            baseline: {
              count: 110,
              buyCount: 8,
              sellCount: 6,
              holdCount: 96,
              winRate: 52,
              avgScore: 1.0,
              avgReturn: 0.12,
            },
            deep_drop: {
              count: 15,
              buyCount: 10,
              sellCount: 0,
              holdCount: 5,
              winRate: 58,
              avgScore: 3.8,
              avgReturn: 0.9,
            },
          },
          summary: {
            totalDays: 125,
            totalCategories: 2,
            startDate: "2024-01-01",
            endDate: "2024-05-05",
          },
        },
      },
      results: [],
    },
    {
      jobId: "job-003",
      name: "test-run-3",
      status: "failed",
      config: { start: "2024-01-01", end: "2024-12-31" },
      createdAt: Date.now() - 259200000,
      error: "Timeline data insufficient",
    },
  ];
  return { mockJobs: jobs };
});

// Mock 依賴模組
vi.mock("../../modules/backtest/backtestQueue.mjs", () => ({
  getJobStatus: vi.fn().mockImplementation((jobId) => {
    return mockJobs.find((j) => j.jobId === jobId) || null;
  }),
  getAllJobs: vi.fn().mockResolvedValue(mockJobs),
}));

describe("backtestResults", () => {
  describe("generateChartData()", () => {
    it("應生成權益曲線數據", () => {
      const results = [
        { date: "2024-01-01", netAsset: 1000000 },
        { date: "2024-01-02", netAsset: 1005000 },
        { date: "2024-01-03", netAsset: 998000 },
        { date: "2024-01-04", netAsset: 1010000 },
      ];

      const chartData = generateChartData(results, "equity");

      expect(chartData.labels).toEqual([
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
      ]);
      expect(chartData.datasets).toHaveLength(1);
      expect(chartData.datasets[0].label).toBe("策略淨值");
      expect(chartData.datasets[0].data).toEqual([
        1000000, 1005000, 998000, 1010000,
      ]);
    });

    it("應生成回撤數據", () => {
      const results = [
        { date: "2024-01-01", netAsset: 1000000 },
        { date: "2024-01-02", netAsset: 1050000 }, // peak
        { date: "2024-01-03", netAsset: 1000000 }, // -4.76%
        { date: "2024-01-04", netAsset: 950000 }, // -9.52%
        { date: "2024-01-05", netAsset: 1020000 }, // recovery
      ];

      const chartData = generateChartData(results, "drawdown");

      expect(chartData.labels).toHaveLength(5);
      expect(chartData.datasets[0].label).toBe("回撤 %");
      // 最大回撤應為 9.52%
      const maxDrawdown = Math.min(...chartData.datasets[0].data);
      expect(maxDrawdown).toBeCloseTo(-9.52, 1);
    });

    it("應生成 SignalCategory 分布數據", () => {
      const summary = {
        signalCategoryStats: {
          categories: {
            baseline: {
              count: 100,
              buyCount: 10,
              sellCount: 5,
              holdCount: 85,
              winRate: 55,
              avgScore: 1.2,
            },
            deep_drop: {
              count: 20,
              buyCount: 15,
              sellCount: 0,
              holdCount: 5,
              winRate: 60,
              avgScore: 3.5,
            },
            panic: {
              count: 5,
              buyCount: 5,
              sellCount: 0,
              holdCount: 0,
              winRate: 70,
              avgScore: 6.2,
            },
          },
        },
      };

      const chartData = generateChartData(summary, "signalCategory");

      expect(chartData.labels).toEqual(["baseline", "deep_drop", "panic"]);
      expect(chartData.datasets).toHaveLength(3); // count + winRate + avgScore
      expect(chartData.datasets.find((d) => d.label === "天數").data).toEqual([
        100, 20, 5,
      ]);
      expect(chartData.datasets.find((d) => d.label === "勝率 %").data).toEqual(
        [55, 60, 70],
      );
    });

    it("空結果應回傳空圖表結構", () => {
      const chartData = generateChartData([], "equity");

      expect(chartData.labels).toEqual([]);
      expect(chartData.datasets).toHaveLength(1);
      expect(chartData.datasets[0].data).toEqual([]);
    });
  });

  describe("exportResultsCSV()", () => {
    it("應生成正確的 CSV 格式", () => {
      const results = [
        {
          date: "2024-01-01",
          netAsset: 1000000,
          qty0050: 1000,
          qtyZ2: 0,
          totalLoan: 0,
          actualLeverage: 1.0,
          maintenanceMargin: 999,
          signalCategory: "baseline",
          signalType: "baseline",
          price0050: 150,
          priceZ2: 300,
        },
        {
          date: "2024-01-02",
          netAsset: 1005000,
          qty0050: 1000,
          qtyZ2: 50,
          totalLoan: 15000,
          actualLeverage: 1.02,
          maintenanceMargin: 120,
          signalCategory: "baseline",
          signalType: "baseline",
          price0050: 151,
          priceZ2: 302,
        },
      ];

      const csv = exportResultsCSV(results);

      const lines = csv.split("\n");
      expect(lines[0]).toBe(
        "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,signalCategory,signalType,price0050,priceZ2",
      );
      // 實際輸出格式：actualLeverage 4 位小數、maintenanceMargin 999 為空、價格 2 位小數
      expect(lines[1]).toContain(
        "2024-01-01,1000000,1000,0,0,1.0000,,baseline,baseline,150.00,300.00",
      );
      expect(lines[2]).toContain(
        "2024-01-02,1005000,1000,50,15000,1.0200,120.0,baseline,baseline,151.00,302.00",
      );
    });

    it("CSV 應包含 signalCategory 和 signalType 欄位", () => {
      const results = [
        {
          date: "2024-01-01",
          netAsset: 1000000,
          signalCategory: "deep_drop",
          signalType: "tactical_drop",
        },
      ];
      const csv = exportResultsCSV(results);

      const header = csv.split("\n")[0];
      expect(header).toContain("signalCategory");
      expect(header).toContain("signalType");
    });
  });
});
