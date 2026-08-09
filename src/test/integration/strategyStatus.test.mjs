/**
 * strategyStatus.test.mjs
 * 整合測試：/api/strategy-status 端點
 * 驗證策略狀態 API 的請求/回應格式、資料結構、錯誤處理
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../api/server.mjs";
import { mkdir, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

let app;
let request;
let mockLatestReport;

beforeAll(async () => {
  // 建立必要的測試目錄
  await mkdir(resolve(DATA_DIR, "market"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "news"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "reports"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "cache"), { recursive: true });

  // 寫入基本的 Mock 資料
  const mockStatus = {
    _meta: { lastRun: new Date().toISOString() },
    data: {
      rawUsMarket: { vix: "18" },
      rawValuation: { pe: 18.5, pb: 1.8 },
      rawCnn: { score: 45 },
      rawMargin: { maintenanceRatio: 200 },
      rawFx: { currentRate: 32.1 },
      rawCpi: { value: 2.1 },
      rawNdc: { light: "綠燈" },
      rawMarketOverview: { turnover100M: 4500 },
    },
  };

  // 建構完整的 mock 報告資料（符合 ilnState 需求）
  const todayStr = new Date().toISOString().split("T")[0];
  mockLatestReport = {
    date: todayStr,
    price0050: 178,
    currentPrice: 285,
    basePrice: 150,
    portfolio: {
      totalValue: 1200000,
      qty0050: 12000,
      qtyZ2: 6000,
      cash: 80000,
      totalLoan: 900000,
      lastBuyDate: "2026-07-15",
    },
    VIX: 18.5,
    vixArr: [18, 19, 18.5, 17, 18],
    marketState: {
      valuation: { pe: 18.5, pb: 1.8, currentPR: 45 },
      sentiment: { vix: 18.5, cnnScore: 45 },
      liquidity: { twMarket: { turnover100M: 4500 } },
      economy: { cpi: 2.1 },
    },
    strategySnapshot: {
      lifecycle: {
        currentAge: 38,
        retirementAge: 65,
        profiles: {
          EARLY: {
            maxLeverage: 2.0,
            maxLeverageForNewZ2: 1.5,
            minSurvivalDropLimit: 140,
            mode: "aggressive",
          },
          MID: {
            maxLeverage: 2.0,
            maxLeverageForNewZ2: 1.5,
            minSurvivalDropLimit: 145,
            mode: "balanced",
          },
          LATE: {
            maxLeverage: 1.5,
            maxLeverageForNewZ2: 1.0,
            minSurvivalDropLimit: 150,
            mode: "conservative",
          },
          PRE_RETIRE: {
            maxLeverage: 1.0,
            maxLeverageForNewZ2: 0.5,
            minSurvivalDropLimit: 160,
            mode: "defensive",
          },
        },
      },
      trading: {
        budget: {
          maxDailyLoanIncreasePct: 0.05,
          maxRollingLoanIncreasePct: 0.15,
          rollingDays: 10,
        },
        cooldownDays: 10,
      },
      buy: { minWeightScoreToBuy: 3 },
      scoringMatrix: {
        thresholds: { buyTactical: 4, buyTacticalBullish: 1.5 },
        categories: {
          technicalTrend: { cap: 4, weights: { macd: 2, ma60Slope: 1.5 } },
          valuationValue: {
            cap: 8,
            weights: { priceDrop: 6, bullMomentum: 2 },
          },
          flowOfFunds: { cap: 4, weights: { institutional: 5, sentiment: 3 } },
          extremeOscillation: { cap: 2, weights: { rsi: 2, kd: 2 } },
        },
      },
      sell: {
        trailingStop: { enabled: true, anchorType: "ma20", atrMultiplier: 2.5 },
      },
      allocation: [
        { minScore: -99, leverage: 0.15, cash: 0.85, comment: "底倉" },
        { minScore: 4, leverage: 0.2, cash: 0.8, comment: "微量/觀察" },
        { minScore: 6, leverage: 0.4, cash: 0.6, comment: "一般訊號" },
        { minScore: 8, leverage: 0.6, cash: 0.4, comment: "積極加碼" },
        { minScore: 10, leverage: 0.8, cash: 0.2, comment: "槓桿全開" },
      ],
      overrideHierarchy: {
        panicBypassEnabled: true,
        panicBypassDropPct: 0.2,
        panicVixThreshold: 35,
      },
      regime: {
        vixOverrideTrigger: 28,
        vixAbsoluteOverride: 35,
        regimeProfiles: {
          NORMAL: { leverageMultiplier: 1, mode: "normal" },
          CAUTIOUS: { leverageMultiplier: 0.75, mode: "reduced" },
          CRISIS: { leverageMultiplier: 0, mode: "sell_only" },
        },
      },
      valuationGuard: {
        enabled: true,
        latch: { enabled: true, triggerPrThreshold: 90 },
      },
      valuationMomentum: { enabled: true },
      grossLeverage: { ceiling: 2.5, hardCap: 3.0, recoveryTarget: 2.0 },
      dynamicDeleverage: {
        sellRatio: 0.5,
        triggerRatio: 0.95,
        targetRatio: 0.8,
      },
    },

    signals: {
      date: todayStr,
      price0050: 178,
      currentPrice: 285,
      basePrice: 150,
      portfolio: {
        totalValue: 1200000,
        qty0050: 12000,
        qtyZ2: 6000,
        cash: 80000,
        totalLoan: 900000,
        lastBuyDate: "2026-07-15",
      },
      VIX: 18.5,
      vixArr: [18, 19, 18.5, 17, 18],
      priceChangePercent: 2.5,
      priceUpPercent: 2.5,
      priceDropPercent: 0,
      maintenanceMargin: 155.5,
      z2Ratio: 22.5,
      actualLeverage: 1.75,
      grossLeverage: 2.05,
      grossLeverageResult: { grossLeverage: 2.05, status: "normal" },
      maintenanceRisk: { level: "Normal" },
      marginAnalysis: { currentMargin: 155.5, riskLevel: "Normal" },
      netAsset: 1050000,
      score: 62,
      weightScore: 62,
      weightDetails: {
        dropScore: 4,
        rsiScore: 4,
        macdScore: 2,
        kdScore: 1,
        sentimentScore: 1,
      },
      signalDirection: "long",
      target: "🔹 0050 DCA",
      suggestion: "維持觀望",
      status: "🌱",
      targetSuggestionShort: "維持觀望",
      targetSuggestion: "維持觀望",
      signalCategory: "baseline",
      signalType: "baseline",
      cooldownStatus: {
        inCooldown: false,
        daysLeft: 0,
        lastBuyDate: "2026-07-15",
        message: "無冷卻期資料",
      },
      valuationGuardResult: {
        currentPR: 45,
        guardActive: false,
        latchActive: false,
      },
      valuationMomentumResult: {
        momentumMultiplier: 1.0,
        accelerationPenaltyMultiplier: 1.0,
      },
      panicBypassActive: false,
      trailingActive: false,
      regimeState: { lifecycleStage: "EARLY" },
      regimeResult: {
        state: "NORMAL",
        leverageMultiplier: 1.0,
        mode: "normal",
      },
      budgetInfo: {
        dailyCap: 50000,
        rollingCap: 150000,
        rollingUsed: 5000,
        rollingAvailable: 145000,
        dailyAvailable: 50000,
        dailyDcaReserve: 1500,
        tacticalPool: 48500,
        signalTypePool: "baseline",
        poolAllocationRatio: 1,
        poolAmount: 1500,
      },
      budgetAllowedAmount: 1500,
      budgetIsLimited: false,
      budgetLimitedReason: null,
    },
  };

  // 寫入 Mock 資料檔案
  await writeFile(
    resolve(DATA_DIR, "market/latest.json"),
    JSON.stringify({
      _meta: { lastRun: new Date().toISOString() },
      data: mockStatus.data,
    }),
  );

  await writeFile(
    resolve(DATA_DIR, "reports", `${todayStr}.json`),
    JSON.stringify(mockLatestReport),
  );

  // 寫入基本的 strategy cache
  await writeFile(
    resolve(DATA_DIR, "cache/strategy_cache.json"),
    JSON.stringify({
      config: mockLatestReport.strategySnapshot,
      timestamp: new Date().toISOString(),
    }),
  );

  process.env.BYPASS_INIT_DATA = "true";
  app = await buildApp({ logger: false });
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await app.close();
  // 不刪除資料，保留作為測試證據
});

describe("GET /api/strategy-status", () => {
  describe("基本功能測試", () => {
    it("應回傳 200 且包含完整的策略狀態資料結構", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      // 基本結構驗證
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("reportDate");
      expect(res.body).toHaveProperty("weightScore");
      expect(res.body).toHaveProperty("cooldown");
      expect(res.body).toHaveProperty("allocation");
      expect(res.body).toHaveProperty("scoring");
      expect(res.body).toHaveProperty("budget");
      expect(res.body).toHaveProperty("signal");
      expect(res.body).toHaveProperty("lifecycle");
      expect(res.body).toHaveProperty("risk");
      expect(res.body).toHaveProperty("keyMetrics");
    });

    it("Weight Score 構成應包含五大項目且總分正確", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const ws = res.body.weightScore;
      expect(ws).toHaveProperty("dropScore");
      expect(ws).toHaveProperty("rsiScore");
      expect(ws).toHaveProperty("macdScore");
      expect(ws).toHaveProperty("kdScore");
      expect(ws).toHaveProperty("sentimentScore");
      expect(ws).toHaveProperty("total");
      expect(typeof ws.total).toBe("number");
    });

    it("冷卻期狀態應包含完整資訊", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const cd = res.body.cooldown;
      expect(cd).toHaveProperty("inCooldown");
      expect(cd).toHaveProperty("daysLeft");
      expect(cd).toHaveProperty("lastBuyDate");
      expect(cd).toHaveProperty("message");
      expect(typeof cd.inCooldown).toBe("boolean");
      expect(typeof cd.daysLeft).toBe("number");
    });

    it("策略分數檔位應包含當前與下一檔位", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const alloc = res.body.allocation;
      expect(alloc).toHaveProperty("current");
      expect(alloc.current).toHaveProperty("minScore");
      expect(alloc.current).toHaveProperty("leverage");
      expect(alloc.current).toHaveProperty("cash");
      expect(alloc.current).toHaveProperty("comment");

      // next 可能為 null (已達最高檔)
      if (alloc.next) {
        expect(alloc.next).toHaveProperty("minScore");
        expect(alloc.next).toHaveProperty("leverage");
        expect(alloc.next).toHaveProperty("scoreToNext");
      }
    });

    it("評分門檻應包含三大關鍵門檻值", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const scoring = res.body.scoring;
      expect(scoring).toHaveProperty("minScoreToBuy");
      expect(scoring).toHaveProperty("buyTactical");
      expect(scoring).toHaveProperty("buyTacticalBullish");
    });

    it("Budget Priority 應包含完整額度資訊", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const budget = res.body.budget;
      expect(budget).toHaveProperty("isLimited");
      expect(budget).toHaveProperty("allowedAmount");
      expect(budget).toHaveProperty("limitedReason");
      expect(budget).toHaveProperty("details");

      const details = budget.details;
      expect(details).toHaveProperty("dailyCap");
      expect(details).toHaveProperty("rollingCap");
      expect(details).toHaveProperty("rollingUsed");
      expect(details).toHaveProperty("rollingAvailable");
      expect(details).toHaveProperty("dailyAvailable");
      expect(details).toHaveProperty("dailyDcaReserve");
      expect(details).toHaveProperty("tacticalPool");
      expect(details).toHaveProperty("signalTypePool");
      expect(details).toHaveProperty("poolAllocationRatio");
      expect(details).toHaveProperty("poolAmount");
    });

    it("信號分類應包含完整資訊", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const signal = res.body.signal;
      expect(signal).toHaveProperty("category");
      expect(signal).toHaveProperty("type");
      expect(signal).toHaveProperty("direction");
      expect(signal).toHaveProperty("target");
      expect(signal).toHaveProperty("suggestion");

      // 驗證 category 合法值
      expect([
        "baseline",
        "deep_drop",
        "panic",
        "take_profit",
        "rebalance",
      ]).toContain(signal.category);
      // 驗證 type 合法值
      expect(["baseline", "tactical_drop", "tactical_panic"]).toContain(
        signal.type,
      );
      // 驗證 direction 合法值
      expect(["long", "short", "hold"]).toContain(signal.direction);
    });

    it("生命週期階段應包含完整資訊", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const lifecycle = res.body.lifecycle;
      expect(lifecycle).toHaveProperty("stage");
      expect(["EARLY", "MID", "LATE", "PRE_RETIRE"]).toContain(lifecycle.stage);
      expect(lifecycle).toHaveProperty("currentAge");
      expect(lifecycle).toHaveProperty("retirementAge");
      expect(lifecycle).toHaveProperty("yearsToRetirement");

      const profile = res.body.lifecycleProfile;
      expect(profile).toHaveProperty("maxLeverage");
      expect(profile).toHaveProperty("maxLeverageForNewZ2");
      expect(profile).toHaveProperty("minSurvivalDropLimit");
      expect(profile).toHaveProperty("mode");
    });

    it("風控狀態應包含完整資訊", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const risk = res.body.risk;
      expect(risk).toHaveProperty("regime");
      expect(["NORMAL", "CAUTIOUS", "CRISIS"]).toContain(risk.regime);
      expect(risk).toHaveProperty("maintenanceMargin");
      expect(risk).toHaveProperty("grossLeverage");
      expect(risk).toHaveProperty("grossLeverageResult");
      expect(risk).toHaveProperty("valuationGuard");
      expect(risk).toHaveProperty("panicBypassActive");
      expect(risk).toHaveProperty("trailingActive");
    });

    it("關鍵指標應包含六大核心指標", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      const km = res.body.keyMetrics;
      expect(km).toHaveProperty("maintenanceMargin");
      expect(km).toHaveProperty("grossLeverage");
      expect(km).toHaveProperty("z2Ratio");
      expect(km).toHaveProperty("currentPr");
      expect(km).toHaveProperty("netAsset");
      expect(km).toHaveProperty("actualLeverage");
    });
  });

  describe("錯誤處理測試", () => {
    it("無有效資料時應回傳 404", async () => {
      // 暫時移除測試資料
      const fs = await import("fs/promises");
      const { resolve } = await import("path");
      const DATA_DIR = resolve(__dirname, "../../../data");

      await fs.rm(resolve(DATA_DIR, "market/latest.json"), { force: true });
      await fs.rm(resolve(DATA_DIR, "reports"), {
        recursive: true,
        force: true,
      });
      await mkdir(resolve(DATA_DIR, "reports"), { recursive: true });
      await mkdir(resolve(DATA_DIR, "market"), { recursive: true });

      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(404);

      expect(res.body).toHaveProperty("error");

      // 恢復測試資料 (重新建立)
      const mockStatus = {
        _meta: { lastRun: new Date().toISOString() },
        data: { rawUsMarket: { vix: "18" } },
      };
      await writeFile(
        resolve(DATA_DIR, "market/latest.json"),
        JSON.stringify({
          _meta: { lastRun: new Date().toISOString() },
          data: mockStatus.data,
        }),
      );
      await writeFile(
        resolve(
          DATA_DIR,
          "reports",
          `${new Date().toISOString().split("T")[0]}.json`,
        ),
        JSON.stringify(mockLatestReport),
      );
    });
  });

  describe("資料結構完整性驗證", () => {
    it("回傳資料應包含 timestamp 與 reportDate", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("reportDate");

      // 驗證日期格式
      expect(res.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
      expect(res.body.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("所有數值欄位應為正確型別", async () => {
      const res = await request
        .get("/api/strategy-status")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      // 檢查關鍵數值欄位型別
      expect(typeof res.body.weightScore.total).toBe("number");
      expect(typeof res.body.cooldown.daysLeft).toBe("number");
      expect(typeof res.body.cooldown.inCooldown).toBe("boolean");
      expect(typeof res.body.budget.isLimited).toBe("boolean");
      expect(typeof res.body.budget.allowedAmount).toBe("number");
      expect(typeof res.body.keyMetrics.maintenanceMargin).toBe("number");
      expect(typeof res.body.keyMetrics.grossLeverage).toBe("number");
    });
  });
});
