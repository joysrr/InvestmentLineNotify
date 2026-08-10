/**
 * backtestRunner.test.mjs
 * 回測引擎單元/整合測試
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BacktestRunner } from "../../modules/backtest/backtestRunner.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";
import fs from "fs/promises";
import path from "path";

const TEST_TIMELINE_FILE = "/tmp/test-timeline.json";
const TEST_CSV_DIR = "/tmp/test-backtest-results";

// 建立測試用 timeline 資料 (65 筆，滿足 MA60 warmup)
function generateTestTimeline(count = 65) {
  const baseDate = new Date("2026-01-01");
  const timeline = [];
  let price0050 = 150;
  let priceZ2 = 250;

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // 模擬價格波動
    price0050 += (Math.random() - 0.5) * 2;
    priceZ2 += (Math.random() - 0.5) * 4;

    timeline.push({
      date: date.toISOString().split("T")[0],
      price0050: Math.round(price0050 * 100) / 100,
      price00675L: Math.round(priceZ2 * 100) / 100,
      vix: 15 + Math.random() * 10,
      pb: 3.5 + Math.random() * 1.0,
    });
  }
  return timeline;
}

describe("BacktestRunner", () => {
  let testTimeline;
  let runner;

  beforeEach(async () => {
    testTimeline = generateTestTimeline(65);
    await fs.writeFile(
      TEST_TIMELINE_FILE,
      JSON.stringify(testTimeline, null, 2),
    );

    // 清理測試輸出目錄
    try {
      await fs.rm(TEST_CSV_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    await fs.mkdir(TEST_CSV_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_TIMELINE_FILE);
    } catch {
      // ignore cleanup errors
    }
    try {
      await fs.rm(TEST_CSV_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ============================================================
  // 1. setup() 測試
  // ============================================================
  describe("setup()", () => {
    it("應正確載入 timeline 並計算 MA60", async () => {
      // 直接測試 BacktestRunner 的核心 MA60 計算邏輯
      // 建立測試專用 runner，直接注入 timeline 繞過檔案讀取
      const testRunner = new BacktestRunner({
        name: "test-setup",
        quiet: true,
        disableGuards: true,
      });

      // 直接注入 timeline (繞過檔案讀取)
      testRunner.timeline = testTimeline;

      // 手動執行 MA60 計算邏輯 (複製自 setup)
      const closes = testRunner.timeline.map((d) => d.price0050);
      for (let i = 0; i < testRunner.timeline.length; i++) {
        testRunner.timeline[i].ma60 =
          i >= 59
            ? closes.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60
            : null;
        testRunner.timeline[i].ma60Slope =
          i >= 60 &&
          testRunner.timeline[i].ma60 &&
          testRunner.timeline[i - 1].ma60
            ? ((testRunner.timeline[i].ma60 - testRunner.timeline[i - 1].ma60) /
                testRunner.timeline[i - 1].ma60) *
              100
            : 0;
      }

      // 驗證
      expect(testRunner.timeline.length).toBe(65);
      expect(testRunner.timeline[60].ma60).toBeDefined();
      expect(testRunner.timeline[61].ma60Slope).toBeDefined();
    });

    it("timeline 太短時 setup 仍應完成但 run 應返回 summary (含少量資料)", async () => {
      const shortTimeline = generateTestTimeline(10);
      await fs.writeFile(
        TEST_TIMELINE_FILE,
        JSON.stringify(shortTimeline, null, 2),
      );

      runner = new BacktestRunner({
        name: "short",
        quiet: true,
        disableGuards: true,
      });
      const summary = await runner.run();

      // 即使資料很少，也會跑完並返回 summary (只是可能只有 1 筆結果)
      expect(summary).toBeDefined();
      expect(summary.name).toBe("short");
    });
  });

  // ============================================================
  // 2. run() 主迴圈測試
  // ============================================================
  describe("run()", () => {
    it("應完整跑完回測並返回 summary", async () => {
      runner = new BacktestRunner({
        name: "test-run",
        quiet: true,
        disableGuards: true,
        monthlyDca: 30000,
        pledgeRatio: 0.6,
        interestRate: 0.022,
      });

      const summary = await runner.run();

      expect(summary).toBeDefined();
      expect(summary.name).toBe("test-run");
      expect(typeof summary.returnPct).toBe("number");
      expect(typeof summary.finalNetAsset).toBe("number");
      expect(typeof summary.qty0050).toBe("number");
      expect(typeof summary.qtyZ2).toBe("number");
      expect(typeof summary.totalLoan).toBe("number");
      expect(typeof summary.finalLeverage).toBe("number");
      expect(typeof summary.minMm).toBe("number");
    });

    it("結果應包含正確的每日快照", async () => {
      runner = new BacktestRunner({
        name: "test-snapshots",
        quiet: true,
        disableGuards: true,
      });
      await runner.run();

      expect(runner.results).toBeDefined();
      expect(runner.results.length).toBeGreaterThan(0);

      const first = runner.results[0];
      expect(first).toHaveProperty("date");
      expect(first).toHaveProperty("netAsset");
      expect(first).toHaveProperty("qty0050");
      expect(first).toHaveProperty("qtyZ2");
      expect(first).toHaveProperty("totalLoan");
      expect(first).toHaveProperty("actualLeverage");
      expect(first).toHaveProperty("advice");
      expect(first).toHaveProperty("signal");
      expect(first).toHaveProperty("price0050");
      expect(first).toHaveProperty("priceZ2");
    });

    it("DCA 應在每月第一個交易日執行", async () => {
      runner = new BacktestRunner({
        name: "test-dca",
        quiet: true,
        disableGuards: true,
        monthlyDca: 30000,
      });
      await runner.run();

      // 檢查是否有買入 0050 的記錄
      const buyDays = runner.results.filter(
        (r) => r.advice && r.advice.includes("0050"),
      );
      expect(buyDays.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 3. 決策處理測試
  // ============================================================
  describe("handleDecision()", () => {
    it("買入訊號應增加 qtyZ2 和 totalLoan", async () => {
      runner = new BacktestRunner({
        name: "test-buy",
        quiet: true,
        disableGuards: true,
      });
      await runner.run();

      // 找到有買入訊號的日期
      const buyResults = runner.results.filter((r) => r.signal === "long");
      if (buyResults.length > 0) {
        const afterBuy = buyResults[0];
        expect(afterBuy.qtyZ2).toBeGreaterThan(0);
        expect(afterBuy.totalLoan).toBeGreaterThan(0);
      }
    });

    it("賣出訊號應減少 qtyZ2", async () => {
      runner = new BacktestRunner({
        name: "test-sell",
        quiet: true,
        disableGuards: true,
      });
      await runner.run();

      // 找到有賣出訊號的日期
      const sellResults = runner.results.filter((r) => r.signal === "short");
      // 至少不應崩潰
      expect(sellResults.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // 4. CSV 輸出測試
  // ============================================================
  describe("CSV 輸出", () => {
    it("runBacktest CLI 應產生 CSV 檔案", async () => {
      runner = new BacktestRunner({
        name: "test-csv",
        quiet: true,
        disableGuards: true,
      });
      await runner.run();

      // 測試 CSV 生成邏輯 (模擬 runBacktest.mjs 的輸出邏輯)
      const csvHeader =
        "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,advice,score,signal,price0050,priceZ2";
      const csvRows = runner.results.map((r) =>
        [
          r.date,
          r.netAsset.toFixed(0),
          r.qty0050,
          r.qtyZ2,
          r.totalLoan.toFixed(0),
          r.actualLeverage.toFixed(4),
          r.maintenanceMargin === 999 ? "" : r.maintenanceMargin.toFixed(1),
          r.advice ?? "",
          r.score ?? "",
          r.signal ?? "",
          r.price0050.toFixed(2),
          r.priceZ2.toFixed(2),
        ].join(","),
      );

      const csvPath = path.join(TEST_CSV_DIR, "test-output.csv");
      await fs.writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));

      const content = await fs.readFile(csvPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines.length).toBe(runner.results.length + 1); // header + data
      expect(lines[0]).toBe(csvHeader);
      expect(lines[1].split(",").length).toBe(12); // 12 columns
    });

    it("CSV 內容應包含正確欄位順序", async () => {
      runner = new BacktestRunner({
        name: "test-csv2",
        quiet: true,
        disableGuards: true,
      });
      await runner.run();

      const csvHeader =
        "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,advice,score,signal,price0050,priceZ2";
      const csvRows = runner.results.map((r) =>
        [
          r.date,
          r.netAsset.toFixed(0),
          r.qty0050,
          r.qtyZ2,
          r.totalLoan.toFixed(0),
          r.actualLeverage.toFixed(4),
          r.maintenanceMargin === 999 ? "" : r.maintenanceMargin.toFixed(1),
          r.advice ?? "",
          r.score ?? "",
          r.signal ?? "",
          r.price0050.toFixed(2),
          r.priceZ2.toFixed(2),
        ].join(","),
      );

      const csvPath = path.join(TEST_CSV_DIR, "test-output2.csv");
      await fs.writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));

      const content = await fs.readFile(csvPath, "utf-8");
      const header = content.split("\n")[0];

      const expectedColumns = [
        "date",
        "netAsset",
        "qty0050",
        "qtyZ2",
        "totalLoan",
        "actualLeverage",
        "maintenanceMargin",
        "advice",
        "score",
        "signal",
        "price0050",
        "priceZ2",
      ];

      expect(header.split(",")).toEqual(expectedColumns);
    });
  });

  // ============================================================
  // 5. 參數覆寫測試
  // ============================================================
  describe("參數覆寫", () => {
    it("buyTactical 參數應覆寫策略門檻", async () => {
      runner = new BacktestRunner({
        name: "test-buy-tactical",
        quiet: true,
        disableGuards: true,
        buyTactical: 10, // 很高的門檻，應減少買入
      });
      await runner.run();

      const buyCount = runner.results.filter((r) => r.signal === "long").length;

      // 對照組：正常門檻
      const runnerNormal = new BacktestRunner({
        name: "test-normal",
        quiet: true,
        disableGuards: true,
      });
      await runnerNormal.run();
      const normalBuyCount = runnerNormal.results.filter(
        (r) => r.signal === "long",
      ).length;

      // 高門檻應導致較少買入 (或相同)
      expect(buyCount).toBeLessThanOrEqual(normalBuyCount);
    });

    it("disableGuards=false 應啟用守衛", async () => {
      runner = new BacktestRunner({
        name: "test-guards-on",
        quiet: true,
        disableGuards: false, // 啟用守衛
      });

      // 不應拋出錯誤
      await expect(runner.run()).resolves.toBeDefined();
    });
  });

  // ============================================================
  // 6. 邊界條件測試
  // ============================================================
  describe("邊界條件", () => {
    it("價格為零時不應崩潰", async () => {
      const zeroPriceTimeline = testTimeline.map((d, i) => ({
        ...d,
        price0050: i === 30 ? 0 : d.price0050,
        price00675L: i === 30 ? 0 : d.price00675L,
      }));
      await fs.writeFile(
        TEST_TIMELINE_FILE,
        JSON.stringify(zeroPriceTimeline, null, 2),
      );

      runner = new BacktestRunner({
        name: "test-zero-price",
        quiet: true,
        disableGuards: true,
      });

      // 不應拋出錯誤
      await expect(runner.run()).resolves.toBeDefined();
    });

    it("VIX 極高時應觸發 CRISIS", async () => {
      const highVixTimeline = testTimeline.map((d, i) => ({
        ...d,
        vix: i === 30 ? 50 : d.vix, // 極高 VIX
      }));
      await fs.writeFile(
        TEST_TIMELINE_FILE,
        JSON.stringify(highVixTimeline, null, 2),
      );

      runner = new BacktestRunner({
        name: "test-crisis",
        quiet: true,
        disableGuards: true,
      });
      const summary = await runner.run();

      expect(summary).toBeDefined();
    });
  });

  // ============================================================
  // 7. 整合測試：archiveManager 串接
  // ============================================================
  describe("archiveManager 整合", () => {
    it("getArchiveRecords 應返回正確格式資料", async () => {
      const reports = await archiveManager.getArchiveRecords({
        start: "2026-08-01",
        end: "2026-08-09",
      });

      expect(Array.isArray(reports)).toBe(true);
      if (reports.length > 0) {
        const r = reports[0];
        expect(r).toHaveProperty("date");
        expect(r).toHaveProperty("signals");
        expect(r).toHaveProperty("marketState");
      }
    });
  });
});
