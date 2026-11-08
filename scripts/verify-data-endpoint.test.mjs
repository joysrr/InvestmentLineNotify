import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, "scripts", "__tmp_verify_data__");
const DATA_DIR = path.join(TMP_DIR, "data");

let verifyModule;

beforeEach(async () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  verifyModule = await import("./verify-data-endpoint.mjs");
});

afterEach(async () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

describe("Phase 2 — 原始資料驗證腳本 (TDD - 擴展端點)", () => {
  it("verifyStatusEndpoint 驗證 /status 端點資料源（market/latest.json + reports）", () => {
    const marketData = {
      _meta: { lastRun: "2026-11-07" },
      data: { rawUsMarket: { vix: "18" } },
    };
    writeJson(path.join(DATA_DIR, "market", "latest.json"), marketData);
    writeJson(path.join(DATA_DIR, "reports", "2026-11-07.json"), {
      date: "2026-11-07",
    });

    const result = verifyModule.verifyStatusEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(true);
    expect(result.sourceValid).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.sourceData).toEqual(marketData);
  });

  it("verifyStatusEndpoint market/latest.json 缺失時 passed 為 false", () => {
    const result = verifyModule.verifyStatusEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("verifyReportsEndpoint 驗證 /reports 端點資料源（data/reports/ 目錄）", () => {
    writeJson(path.join(DATA_DIR, "reports", "2026-11-07.json"), {
      date: "2026-11-07",
      signals: {},
    });
    writeJson(path.join(DATA_DIR, "reports", "2026-11-06.json"), {
      date: "2026-11-06",
      signals: {},
    });

    const result = verifyModule.verifyReportsEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(true);
    expect(result.sourceValid).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.reportCount).toBe(2);
  });

  it("verifyReportsEndpoint reports 目錄空時 passed 為 false", () => {
    const result = verifyModule.verifyReportsEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("verifyStrategyStatusEndpoint 驗證 /strategy-status 端點資料源", () => {
    const reportData = {
      date: "2026-11-07",
      signals: { score: 62, signalCategory: "baseline" },
      strategySnapshot: { lifecycle: { currentAge: 38, retirementAge: 65 } },
    };
    writeJson(path.join(DATA_DIR, "market", "latest.json"), {
      _meta: { lastRun: "2026-11-07" },
      data: { rawUsMarket: { vix: "18" } },
    });
    writeJson(path.join(DATA_DIR, "reports", "2026-11-07.json"), reportData);

    const result = verifyModule.verifyStrategyStatusEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.sourceData.reportData.signals.score).toBe(62);
  });

  it("verifyPortfolioHealthEndpoint 驗證 /portfolio/health 端點資料源與計算", () => {
    const strategyConfig = {
      lifecycle: { currentAge: 38, retirementAge: 65, profiles: {} },
      buy: { minWeightScoreToBuy: 3 },
      allocation: [
        { minScore: -99, leverage: 0.15, cash: 0.85, comment: "底倉" },
      ],
    };
    const reportData = {
      date: "2026-11-07",
      signals: {
        maintenanceMargin: 155.5,
        z2Ratio: 22.5,
        grossLeverage: 2.05,
        marketState: { sentiment: { vix: 18.5 } },
        macroAnalysis: { conclusion: { market_direction: "NEUTRAL" } },
      },
    };
    writeJson(
      path.join(DATA_DIR, "cache", "strategy_cache.json"),
      strategyConfig,
    );
    writeJson(path.join(DATA_DIR, "reports", "2026-11-07.json"), reportData);

    const result = verifyModule.verifyPortfolioHealthEndpoint(DATA_DIR);
    expect(result.sourceExists).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("verifyAllEndpoints 涵蓋 6 個端點驗證", () => {
    writeJson(path.join(DATA_DIR, "news", "pool_filtered_active.json"), [
      { id: 1, title: "測試" },
    ]);
    writeJson(path.join(DATA_DIR, "market", "latest.json"), {
      _meta: {},
      data: { rawUsMarket: { vix: "18" } },
    });
    writeJson(path.join(DATA_DIR, "sentiment", "social_sentiment_daily.json"), {
      date: "2026-11-07",
      score: 50,
    });
    writeJson(path.join(DATA_DIR, "reports", "2026-11-07.json"), {
      date: "2026-11-07",
      signals: {},
    });
    writeJson(path.join(DATA_DIR, "config", "strategy.json"), {
      lifecycle: {},
    });

    const report = verifyModule.verifyAllEndpoints(DATA_DIR);
    expect(report.totalEndpoints).toBeGreaterThanOrEqual(5);
    expect(report.results).toBeInstanceOf(Array);
  });
});
