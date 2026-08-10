/**
 * backtestResults.test.mjs
 * 整合測試：回測結果核心功能 (直接測試模組函數)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("backtestResults 核心功能", () => {
  describe("queryBacktestResults", () => {
    it("應存在並可被導入", async () => {
      const { queryBacktestResults } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof queryBacktestResults).toBe("function");
    });
  });

  describe("getBacktestResult", () => {
    it("應存在並可被導入", async () => {
      const { getBacktestResult } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof getBacktestResult).toBe("function");
    });
  });

  describe("generateChartData", () => {
    it("應存在並可被導入", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof generateChartData).toBe("function");
    });

    it("生成權益曲線數據格式正確", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockResults = [
        {
          date: "2026-01-01",
          netAsset: 1000000,
          grossAsset: 1500000,
          leverage: 1.5,
          price0050: 150,
          qty0050: 100,
        },
        {
          date: "2026-01-02",
          netAsset: 1010000,
          grossAsset: 1515000,
          leverage: 1.5,
          price0050: 151,
          qty0050: 100,
        },
      ];

      const chartData = generateChartData(mockResults, "equity");

      expect(chartData).toBeDefined();
      expect(chartData.labels).toBeDefined();
      expect(Array.isArray(chartData.labels)).toBe(true);
      expect(chartData.datasets).toBeDefined();
      expect(Array.isArray(chartData.datasets)).toBe(true);
      expect(chartData.datasets.length).toBeGreaterThan(0);
    });

    it("生成回撤數據格式正確", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockResults = [
        { date: "2026-01-01", netAsset: 1000000, maxDrawdown: 0.05 },
        { date: "2026-01-02", netAsset: 1010000, maxDrawdown: 0.03 },
      ];

      const chartData = generateChartData(mockResults, "drawdown");

      expect(chartData).toBeDefined();
      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
    });

    it("生成 SignalCategory 分布數據格式正確", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockStats = {
        categories: {
          baseline: { count: 100, winRate: 0.5 },
          deep_drop: { count: 20, winRate: 0.6 },
          panic: { count: 5, winRate: 0.7 },
        },
      };

      const chartData = generateChartData(mockStats, "signalCategory");

      expect(chartData).toBeDefined();
      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
    });

    it("生成比較圖表數據格式正確", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockJobs = [
        {
          name: "job-1",
          summary: { returnPct: 0.1, finalLeverage: 1.5 },
          results: [{ netAsset: 1000000 }, { netAsset: 950000 }],
        },
        {
          name: "job-2",
          summary: { returnPct: 0.15, finalLeverage: 1.6 },
          results: [{ netAsset: 1000000 }, { netAsset: 1050000 }],
        },
      ];

      const chartData = generateChartData(mockJobs, "comparison");

      expect(chartData).toBeDefined();
      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets.length).toBe(3); // returnPct, maxDrawdown, finalLeverage
    });

    it("無效類型回傳空結構", async () => {
      const { generateChartData } =
        await import("../../modules/backtest/backtestResults.mjs");

      const chartData = generateChartData([], "invalid_type");

      expect(chartData).toBeDefined();
      expect(chartData.labels).toEqual([]);
      expect(chartData.datasets).toEqual([]);
    });
  });

  describe("exportResultsCSV", () => {
    it("應存在並可被導入", async () => {
      const { exportResultsCSV } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof exportResultsCSV).toBe("function");
    });

    it("生成 CSV 格式字串", async () => {
      const { exportResultsCSV } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockResult = {
        jobId: "job-1",
        summary: { returnPct: 0.15, maxDrawdown: 0.1 },
        results: [
          { date: "2026-01-01", equity: 1010000, drawdown: 0.05 },
          { date: "2026-01-02", equity: 1020000, drawdown: 0.03 },
        ],
      };

      const csv = exportResultsCSV(mockResult.results, mockResult.summary);

      expect(typeof csv).toBe("string");
      expect(csv).toContain("date,");
      expect(csv).toContain("2026-01-01");
      expect(csv).toContain("returnPct");
    });

    it("空結果回傳表頭", async () => {
      const { exportResultsCSV } =
        await import("../../modules/backtest/backtestResults.mjs");

      const csv = exportResultsCSV([], null);

      expect(typeof csv).toBe("string");
      expect(csv).toContain("date,netAsset");
    });
  });

  describe("exportResultsJSON", () => {
    it("應存在並可被導入", async () => {
      const { exportResultsJSON } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof exportResultsJSON).toBe("function");
    });

    it("生成 JSON 格式字串", async () => {
      const { exportResultsJSON } =
        await import("../../modules/backtest/backtestResults.mjs");

      const mockResult = {
        jobId: "job-1",
        name: "測試回測",
        config: {},
        createdAt: Date.now(),
        finishedAt: Date.now(),
        status: "completed",
        summary: { returnPct: 0.15 },
        results: [],
      };

      const json = exportResultsJSON(mockResult);

      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.jobId).toBe("job-1");
      expect(parsed.summary.returnPct).toBe(0.15);
    });
  });

  describe("listResultFiles", () => {
    it("應存在並可被導入", async () => {
      const { listResultFiles } =
        await import("../../modules/backtest/backtestResults.mjs");
      expect(typeof listResultFiles).toBe("function");
    });
  });

  describe("backtestQueue", () => {
    it("getAllJobs 和 JOB_STATUS 可被導入", async () => {
      const { getAllJobs, JOB_STATUS } =
        await import("../../modules/backtest/backtestQueue.mjs");
      expect(typeof getAllJobs).toBe("function");
      expect(JOB_STATUS).toBeDefined();
      expect(JOB_STATUS.WAITING).toBe("waiting");
      expect(JOB_STATUS.ACTIVE).toBe("active");
      expect(JOB_STATUS.COMPLETED).toBe("completed");
      expect(JOB_STATUS.FAILED).toBe("failed");
    });
  });
});
