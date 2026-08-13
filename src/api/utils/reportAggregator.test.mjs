// src/api/utils/reportAggregator.test.mjs
// TDD: Report Aggregator 測試

import { describe, it, expect } from "vitest";
import {
  getISOWeekKey,
  getMonthKey,
  buildSummary,
  aggregateByWeek,
  aggregateByMonth,
} from "./reportAggregator.mjs";

describe("reportAggregator - 報表彙總工具", () => {
  describe("getISOWeekKey - ISO 週鍵值", () => {
    it("2024-01-01 (週一) → 2024-W01", () => {
      expect(getISOWeekKey("2024-01-01")).toBe("2024-W01");
    });

    it("2024-01-07 (週日) → 2024-W01", () => {
      expect(getISOWeekKey("2024-01-07")).toBe("2024-W01");
    });

    it("2024-12-30 (週一) → 2025-W01 (跨年週)", () => {
      // 2024-12-30 屬於 2025 年第 1 週 (ISO 週制)
      expect(getISOWeekKey("2024-12-30")).toBe("2025-W01");
    });

    it("2025-01-01 (週三) → 2025-W01", () => {
      expect(getISOWeekKey("2025-01-01")).toBe("2025-W01");
    });
  });

  describe("getMonthKey - 月鍵值", () => {
    it("2024-01-15 → 2024-01", () => {
      expect(getMonthKey("2024-01-15")).toBe("2024-01");
    });

    it("2024-12-31 → 2024-12", () => {
      expect(getMonthKey("2024-12-31")).toBe("2024-12");
    });
  });

  describe("buildSummary - 跨週期摘要統計", () => {
    it("空陣列回傳空摘要", () => {
      const result = buildSummary([]);
      expect(result.avgRSI).toBeNull();
      expect(result.avgKD_K).toBeNull();
      expect(result.avgKD_D).toBeNull();
      expect(result.avgBias240).toBeNull();
      expect(result.scoreRange).toBeNull();
      expect(result.decisions).toEqual([]);
    });

    it("計算平均值與範圍", () => {
      const reports = [
        {
          signals: {
            RSI: 60,
            KD_K: 65,
            KD_D: 55,
            bias240: 2.5,
            weightScore: 5.0,
            target: "0050",
          },
        },
        {
          signals: {
            RSI: 70,
            KD_K: 75,
            KD_D: 65,
            bias240: 3.0,
            weightScore: 6.0,
            target: "Z2",
          },
        },
        {
          signals: {
            RSI: 50,
            KD_K: 55,
            KD_D: 45,
            bias240: 1.5,
            weightScore: 4.0,
            target: "0050",
          },
        },
      ];

      const result = buildSummary(reports);
      expect(result.avgRSI).toBe(60.0); // (60+70+50)/3 = 60
      expect(result.avgKD_K).toBe(65.0);
      expect(result.avgKD_D).toBe(55.0);
      expect(result.avgBias240).toBe(2.3); // (2.5+3.0+1.5)/3 = 2.333... → 2.3
      expect(result.scoreRange).toEqual({ min: 4.0, max: 6.0 });
      expect(result.decisions).toEqual(["0050", "Z2"]);
    });

    it("缺少 signals 字段被過濾", () => {
      const reports = [{ signals: { RSI: 60 } }, { signals: {} }, {}];

      const result = buildSummary(reports);
      expect(result.avgRSI).toBe(60.0);
      expect(result.avgKD_K).toBeNull();
    });

    it("去重 decisions", () => {
      const reports = [
        { signals: { target: "0050" } },
        { signals: { target: "0050" } },
        { signals: { target: "Z2" } },
      ];

      const result = buildSummary(reports);
      expect(result.decisions).toEqual(["0050", "Z2"]);
    });
  });

  describe("aggregateByWeek - 週彙總", () => {
    it("單一週期", () => {
      const reports = [
        { date: "2024-01-03", signals: { weightScore: 5 } }, // Wed
        { date: "2024-01-02", signals: { weightScore: 4 } }, // Tue
        { date: "2024-01-01", signals: { weightScore: 3 } }, // Mon
      ];

      const result = aggregateByWeek(reports, 10);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe("2024-W01");
      expect(result[0].startDate).toBe("2024-01-01");
      expect(result[0].endDate).toBe("2024-01-03");
      expect(result[0].tradingDays).toBe(3);
      expect(result[0].lastReport.date).toBe("2024-01-03");
    });

    it("多週期各取最新報表", () => {
      const reports = [
        { date: "2024-01-12", signals: { weightScore: 8 } }, // Fri 週 2
        { date: "2024-01-11", signals: { weightScore: 7 } }, // Thu
        { date: "2024-01-05", signals: { weightScore: 6 } }, // Fri 週 1
        { date: "2024-01-04", signals: { weightScore: 5 } }, // Thu
      ];

      const result = aggregateByWeek(reports, 10);

      expect(result).toHaveLength(2);
      // DESC by endDate
      expect(result[0].period).toBe("2024-W02");
      expect(result[0].endDate).toBe("2024-01-12");
      expect(result[0].lastReport.signals.weightScore).toBe(8);

      expect(result[1].period).toBe("2024-W01");
      expect(result[1].endDate).toBe("2024-01-05");
      expect(result[1].lastReport.signals.weightScore).toBe(6);
    });

    it("limit 限制筆數", () => {
      const reports = [
        { date: "2024-01-19", signals: {} },
        { date: "2024-01-12", signals: {} },
        { date: "2024-01-05", signals: {} },
      ];

      const result = aggregateByWeek(reports, 2);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe("2024-W03");
      expect(result[1].period).toBe("2024-W02");
    });

    it("summary 包含統計資料", () => {
      const reports = [
        {
          date: "2024-01-03",
          signals: { RSI: 60, weightScore: 5, target: "0050" },
        },
        {
          date: "2024-01-02",
          signals: { RSI: 70, weightScore: 6, target: "Z2" },
        },
      ];

      const result = aggregateByWeek(reports, 10);

      expect(result[0].summary.avgRSI).toBe(65.0);
      expect(result[0].summary.scoreRange).toEqual({ min: 5.0, max: 6.0 });
      expect(result[0].summary.decisions).toEqual(["Z2", "0050"]);
    });

    it("空陣列回傳空陣列", () => {
      expect(aggregateByWeek([], 10)).toEqual([]);
    });
  });

  describe("aggregateByMonth - 月彙總", () => {
    it("單一月期", () => {
      const reports = [
        { date: "2024-01-31", signals: { weightScore: 5 } },
        { date: "2024-01-15", signals: { weightScore: 4 } },
        { date: "2024-01-02", signals: { weightScore: 3 } },
      ];

      const result = aggregateByMonth(reports, 10);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe("2024-01");
      expect(result[0].startDate).toBe("2024-01-02");
      expect(result[0].endDate).toBe("2024-01-31");
      expect(result[0].tradingDays).toBe(3);
      expect(result[0].lastReport.signals.weightScore).toBe(5);
    });

    it("多月期各取最新報表", () => {
      const reports = [
        { date: "2024-02-29", signals: { weightScore: 8 } },
        { date: "2024-02-15", signals: { weightScore: 7 } },
        { date: "2024-01-31", signals: { weightScore: 6 } },
        { date: "2024-01-15", signals: { weightScore: 5 } },
      ];

      const result = aggregateByMonth(reports, 10);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe("2024-02");
      expect(result[0].endDate).toBe("2024-02-29");
      expect(result[0].lastReport.signals.weightScore).toBe(8);

      expect(result[1].period).toBe("2024-01");
      expect(result[1].endDate).toBe("2024-01-31");
      expect(result[1].lastReport.signals.weightScore).toBe(6);
    });

    it("空陣列回傳空陣列", () => {
      expect(aggregateByMonth([], 10)).toEqual([]);
    });
  });
});
