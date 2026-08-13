// src/api/utils/snapshotAggregator.test.mjs
// TDD: Snapshot Aggregator 測試

import { describe, it, expect } from "vitest";
import {
  calcNetValueCost,
  calcNetValueMarket,
  normaliseSnapshot,
  aggregateSnapshotsByWeek,
  aggregateSnapshotsByMonth,
} from "./snapshotAggregator.mjs";

describe("snapshotAggregator - 快照彙總工具", () => {
  describe("calcNetValueCost - 成本基礎淨值", () => {
    it("兩檔位數量和貸款皆為 0 回傳 null", () => {
      expect(
        calcNetValueCost({ qty0050: 0, qtyZ2: 0, totalLoan: 0 }),
      ).toBeNull();
    });

    it("有持倉計算成本淨值", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
        avgCost0050: 80,
        avgCostZ2: 40,
      };
      // (1000 * 80) + (500 * 40) - 50000 = 80000 + 20000 - 50000 = 50000
      expect(calcNetValueCost(snap)).toBe(50000);
    });

    it("有貸款但無持倉回傳負值", () => {
      const snap = {
        qty0050: 0,
        qtyZ2: 0,
        totalLoan: 10000,
        avgCost0050: 0,
        avgCostZ2: 0,
      };
      expect(calcNetValueCost(snap)).toBe(-10000);
    });

    it("缺少 avgCost 視為 0", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 0,
        totalLoan: 0,
      };
      expect(calcNetValueCost(snap)).toBe(0);
    });

    it("null 快照回傳 null", () => {
      expect(calcNetValueCost(null)).toBeNull();
    });
  });

  describe("calcNetValueMarket - 市場價格淨值", () => {
    it("無價格欄位回傳 null", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
        avgCost0050: 80,
        avgCostZ2: 40,
      };
      expect(calcNetValueMarket(snap)).toBeNull();
    });

    it("有價格計算市值淨值", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
        price0050: 85,
        priceZ2: 45,
      };
      // (1000 * 85) + (500 * 45) - 50000 = 85000 + 22500 - 50000 = 57500
      expect(calcNetValueMarket(snap)).toBe(57500);
    });

    it("有貸款但無持倉回傳負值", () => {
      const snap = {
        qty0050: 0,
        qtyZ2: 0,
        totalLoan: 10000,
        price0050: 85,
        priceZ2: 45,
      };
      expect(calcNetValueMarket(snap)).toBe(-10000);
    });

    it("缺少價格視為 0", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 0,
        totalLoan: 0,
        price0050: 85,
      };
      expect(calcNetValueMarket(snap)).toBe(85000);
    });

    it("null 快照回傳 null", () => {
      expect(calcNetValueMarket(null)).toBeNull();
    });

    it("無持倉無貸款回傳 null", () => {
      const snap = {
        qty0050: 0,
        qtyZ2: 0,
        totalLoan: 0,
        price0050: 85,
        priceZ2: 45,
      };
      expect(calcNetValueMarket(snap)).toBeNull();
    });
  });

  describe("normaliseSnapshot - 標準化快照", () => {
    it("輸出標準欄位", () => {
      const snap = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
        cash: 20000,
        avgCost0050: 80,
        avgCostZ2: 40,
        price0050: 85,
        priceZ2: 45,
        lastBuyDate: "2024-01-10",
      };

      const result = normaliseSnapshot("2024-01-15", snap);

      expect(result.date).toBe("2024-01-15");
      expect(result.qty0050).toBe(1000);
      expect(result.qtyZ2).toBe(500);
      expect(result.totalLoan).toBe(50000);
      expect(result.cash).toBe(20000);
      expect(result.avgCost0050).toBe(80);
      expect(result.avgCostZ2).toBe(40);
      expect(result.price0050).toBe(85);
      expect(result.priceZ2).toBe(45);
      expect(result.lastBuyDate).toBe("2024-01-10");
      expect(result.netValueCost).toBe(50000);
      expect(result.netValueMarket).toBe(57500);
    });

    it("缺少欄位使用預設值", () => {
      const snap = {};
      const result = normaliseSnapshot("2024-01-15", snap);

      expect(result.qty0050).toBe(0);
      expect(result.qtyZ2).toBe(0);
      expect(result.totalLoan).toBe(0);
      expect(result.cash).toBe(0);
      expect(result.avgCost0050).toBeNull();
      expect(result.avgCostZ2).toBeNull();
      expect(result.price0050).toBeNull();
      expect(result.priceZ2).toBeNull();
      expect(result.lastBuyDate).toBeNull();
      expect(result.netValueCost).toBeNull();
      expect(result.netValueMarket).toBeNull();
    });
  });

  describe("aggregateSnapshotsByWeek - 週彙總", () => {
    it("單一週期取最後一天", () => {
      const entries = [
        { date: "2024-01-15", snap: { qty0050: 1000 } }, // Mon
        { date: "2024-01-16", snap: { qty0050: 1100 } }, // Tue
        { date: "2024-01-17", snap: { qty0050: 1200 } }, // Wed
      ];

      const result = aggregateSnapshotsByWeek(entries, 10);

      expect(result).toHaveLength(1);
      expect(result[0].period).toMatch(/^2024-W/);
      expect(result[0].endDate).toBe("2024-01-17");
      expect(result[0].tradingDays).toBe(3);
      expect(result[0].qty0050).toBe(1200); // 最後一天的值
    });

    it("多週期各取最後一天", () => {
      const entries = [
        { date: "2024-01-22", snap: { qty0050: 1500 } }, // 週 4 (Mon)
        { date: "2024-01-19", snap: { qty0050: 1400 } }, // 週 3 (Fri)
        { date: "2024-01-18", snap: { qty0050: 1300 } }, // 週 3 (Thu)
        { date: "2024-01-12", snap: { qty0050: 1100 } }, // 週 2 (Fri)
        { date: "2024-01-11", snap: { qty0050: 1000 } }, // 週 2 (Thu)
      ];

      const result = aggregateSnapshotsByWeek(entries, 10);

      expect(result).toHaveLength(3);
      // DESC 由最新到最舊
      expect(result[0].endDate).toBe("2024-01-22");
      expect(result[0].qty0050).toBe(1500);
      expect(result[1].endDate).toBe("2024-01-19");
      expect(result[1].qty0050).toBe(1400);
      expect(result[2].endDate).toBe("2024-01-12");
      expect(result[2].qty0050).toBe(1100);
    });

    it("limit 限制回傳筆數", () => {
      const entries = [
        { date: "2024-01-22", snap: { qty0050: 1500 } },
        { date: "2024-01-19", snap: { qty0050: 1400 } },
        { date: "2024-01-12", snap: { qty0050: 1100 } },
      ];

      const result = aggregateSnapshotsByWeek(entries, 2);

      expect(result).toHaveLength(2);
      expect(result[0].endDate).toBe("2024-01-22");
      expect(result[1].endDate).toBe("2024-01-19");
    });

    it("空陣列回傳空陣列", () => {
      expect(aggregateSnapshotsByWeek([], 10)).toEqual([]);
    });
  });

  describe("aggregateSnapshotsByMonth - 月彙總", () => {
    it("單一月期取最後一天", () => {
      const entries = [
        { date: "2024-01-31", snap: { qty0050: 1200 } },
        { date: "2024-01-15", snap: { qty0050: 1000 } },
        { date: "2024-01-02", snap: { qty0050: 800 } },
      ];

      const result = aggregateSnapshotsByMonth(entries, 10);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe("2024-01");
      expect(result[0].endDate).toBe("2024-01-31");
      expect(result[0].tradingDays).toBe(3);
      expect(result[0].qty0050).toBe(1200);
    });

    it("多月期各取最後一天", () => {
      const entries = [
        { date: "2024-02-29", snap: { qty0050: 2000 } },
        { date: "2024-02-15", snap: { qty0050: 1800 } },
        { date: "2024-01-31", snap: { qty0050: 1500 } },
        { date: "2024-01-15", snap: { qty0050: 1200 } },
      ];

      const result = aggregateSnapshotsByMonth(entries, 10);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe("2024-02");
      expect(result[0].endDate).toBe("2024-02-29");
      expect(result[0].qty0050).toBe(2000);
      expect(result[1].period).toBe("2024-01");
      expect(result[1].endDate).toBe("2024-01-31");
      expect(result[1].qty0050).toBe(1500);
    });

    it("空陣列回傳空陣列", () => {
      expect(aggregateSnapshotsByMonth([], 10)).toEqual([]);
    });
  });
});
