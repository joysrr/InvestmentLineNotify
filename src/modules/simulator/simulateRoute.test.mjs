// src/modules/simulator/simulateRoute.test.mjs
// 整合測試：API 端到端 (DEC-27)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { buildApp } from "../../api/server.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import fs from "fs/promises";

// Set test environment to bypass initDataGuard
process.env.NODE_ENV = "dev";
process.env.BYPASS_INIT_DATA = "true";

// Mock fs.stat for cache mtime check
vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
  },
  stat: vi.fn(),
}));

// Mock archiveManager
vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestReport: vi.fn(),
    getStockHistory: vi.fn(),
  },
}));

// Mock calculateIndicators with importOriginal to preserve kdCrossUp, etc.
vi.mock("../strategy/indicators.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    calculateIndicators: vi.fn((history) => {
      const closes = history.map((h) => h.close);
      return {
        closes,
        highs: history.map((h) => h.high),
        lows: history.map((h) => h.low),
        rsiArr: new Array(closes.length).fill(50),
        macdArr: new Array(closes.length).fill({
          MACD: 0,
          signal: 0,
          histogram: 0,
        }),
        kdArr: new Array(closes.length).fill({ k: 50, d: 50 }),
        ma20Arr: new Array(closes.length).fill(170),
        ma60Arr: new Array(closes.length).fill(165),
        ma240Arr: new Array(closes.length).fill(155),
        ma60Slope: new Array(closes.length).fill(0.1),
        atrArr: new Array(closes.length).fill(2),
        ma240: 155,
      };
    }),
  };
});

// Mock strategyLoader to return a valid strategy config
vi.mock("../strategy/strategyLoader.mjs", () => ({
  fetchStrategyConfigUnified: vi.fn().mockResolvedValue({
    version: "2.8.0",
    grossLeverage: {
      enabled: true,
      maxRatio: 2.5,
      warnRatio: 2.0,
    },
    trading: {
      cooldownDays: 20,
      budget: { dailyMaxPct: 5, rollingDays: 10, rollingMaxPct: 15 },
    },
    buy: {
      dropScoreRules: [
        { minDrop: 0, score: 10, label: "微跌" },
        { minDrop: 2, score: 20, label: "小跌" },
        { minDrop: 5, score: 30, label: "中跌" },
        { minDrop: 8, score: 40, label: "大跌" },
        { minDrop: 12, score: 50, label: "暴跌" },
      ],
      rsi: { oversold: 30, score: 15 },
      kd: {
        oversoldK: 20,
        crossLevelThreshold: 50,
        lookbackDays: 18,
        score: 10,
        dOverheatLevel: 80,
      },
      macd: { score: 10 },
    },
    sell: {
      trailingStop: { enabled: true, activationPct: 5, trailPct: 3 },
      overheat: {
        enabled: true,
        bias240Threshold: 20,
        rsiThreshold: 70,
        kdThreshold: 80,
        dOverheatLevel: 80,
      },
    },
    threshold: {
      dOverheatLevel: 80,
      rsiOverheatLevel: 70,
      bias240OverheatLevel: 20,
      overheatCount: 2,
    },
    maintenance: {
      marginCallThreshold: 135,
      frozenZone: 145,
      protectTrigger: 160,
      protectTarget: 180,
    },
    macroSentiment: {
      enabled: true,
      bearishCooldownMultiplier: 1.5,
    },
    overrideHierarchy: {
      panicBypassEnabled: true,
      panicBypassDropPct: 15,
      panicVixThreshold: 30,
    },
    valuationGuard: {
      enabled: true,
      latch: { triggerPb: 1.3, unlockMa60SlopeThreshold: 0.1 },
    },
  }),
}));

// Mock validateStrategyConfig
vi.mock("../strategy/validateStrategyConfig.mjs", () => ({
  validateStrategyConfig: vi.fn(),
}));

function createMockHistoryFile(stockNo, monthKey, count = 20) {
  const basePrice = stockNo === "0050" ? 170 : 110;
  return Array.from({ length: count }, (_, i) => ({
    date: `${monthKey.slice(0, 4)}-${monthKey.slice(4)}-${String(i + 1).padStart(2, "0")}`,
    open: basePrice + Math.random() * 2,
    high: basePrice + Math.random() * 3,
    low: basePrice - Math.random() * 2,
    close: basePrice + (Math.random() - 0.5) * 4,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
  }));
}

function getRequiredMonthKeys() {
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return monthKeys.reverse();
}

describe("simulateRoute - API 整合測試", () => {
  let app;
  const today = new Date().toISOString().split("T")[0];
  const requiredMonthKeys = getRequiredMonthKeys();

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockLatestReport = {
      date: today,
      currentPrice: 116.5,
      price0050: 175.0,
      basePrice: 115.0,
      VIX: 18.5,
      macroMarketDirection: "NEUTRAL",
      portfolio: {
        qty0050: 10000,
        qtyZ2: 5000,
        cash: 50000,
        totalLoan: 800000,
        lastBuyDate: "2026-01-15",
      },
      vixArr: Array.from({ length: 30 }, () => 15 + Math.random() * 10),
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
    };

    archiveManager.getLatestReport.mockResolvedValue(mockLatestReport);
    archiveManager.getStockHistory.mockImplementation((stockNo, monthKey) => {
      return createMockHistoryFile(stockNo, monthKey, 20);
    });

    // Mock fs.stat 回傳 mtime <= cached.mtime (快取有效)
    fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 1000 });

    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  describe("POST /api/v1/simulate - 正向模擬", () => {
    it("正常請求回傳 200 完整結果", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.simulatedPrice0050).toBe(180);
      expect(body.currentPrice0050).toBe(175);
      expect(body.indicators).toBeDefined();
      expect(body.maintenanceMargin).toBeDefined();
      expect(body.strategyScore).toBeDefined();
      expect(body.calculationMode).toBe("forward");
      expect(body.timestamp).toBeDefined();
      expect(body.dataAsOf).toBe(today);
      expect(body.liveBaseline).toEqual(
        expect.objectContaining({
          marginPolicy: "recalculate_from_simulated_portfolio",
          fxPolicy: "not_applied",
        }),
      );
      expect(body.assumptions).toEqual(
        expect.arrayContaining([
          expect.stringContaining("live raw margin 僅作 baseline"),
          expect.stringContaining("FX 僅保存為 baseline"),
        ]),
      );
    });

    it("提供 priceZ2 時使用指定值", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180, priceZ2: 125 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.simulatedPriceZ2).toBe(125);
    });

    it("缺少 price0050 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { priceZ2: 120 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.message).toContain("price0050");
      expect(body.field).toBe("price0050");
    });

    it("price0050 低於 50 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 49 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("price0050 高於 500 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 501 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("price0050 非數字回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: "abc" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("價格偏離 10-20% 回傳 warnings", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 195 }, // 175 -> 195 = 11.4%
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.warnings.length).toBe(1);
      expect(body.warnings[0]).toContain("10%");
    });

    it("價格偏離 >20% 回傳 warnings", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 215 }, // 175 -> 215 = 22.9%
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.warnings.length).toBe(1);
      expect(body.warnings[0]).toContain("20%");
    });

    it("缺月資料回傳 409 HISTORY_INCOMPLETE", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180 },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("CONFLICT");
      expect(body.message).toContain("歷史資料不完整");
    });

    it("戰報過期回傳 409 REPORT_EXPIRED", async () => {
      archiveManager.getLatestReport.mockResolvedValue({
        date: "2026-07-01", // 過期
        currentPrice: 116.5,
        price0050: 175,
        portfolio: {
          qty0050: 10000,
          qtyZ2: 5000,
          cash: 50000,
          totalLoan: 800000,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180 },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("CONFLICT");
      expect(body.message).toContain("戰報過期");
    });

    it("戰報缺少必要欄位回傳 409 DATA_NOT_READY", async () => {
      archiveManager.getLatestReport.mockResolvedValue({
        date: today,
        currentPrice: 116.5,
        price0050: 175,
        portfolio: null, // 缺少 portfolio
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180 },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("DATA_NOT_READY");
    });
  });

  describe("POST /api/v1/simulate/reverse - 反向推導", () => {
    it("正常請求回傳 200 與完整結果", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "maintenanceRatio", value: 150 } },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.target.type).toBe("maintenanceRatio");
      expect(body.reachable).toBe(true);
      expect(body.method).toBe("analytical");
      expect(body.results).toBeDefined();
      expect(body.results.price0050).toBeGreaterThan(0);
      expect(body.calculationMode).toBe("reverse_analytical");
    });

    it("rsi 目標回傳 200 與二分搜尋結果", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "rsi", value: 55 } }, // 使用較容易達成的目標
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.target.type).toBe("rsi");
      // RSI 可能因模擬資料限制無法達成
      // 若 reachable: true 則檢查 results；若 reachable: false 則檢查 reason
      expect(body.method).toMatch(/binary_search/);
      if (body.reachable) {
        expect(body.results).toBeDefined();
      } else {
        expect(body.reason).toBeDefined();
      }
    });

    it("ma20 目標回傳 200 與解析解結果", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "ma20", value: 193.5 } },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.target.type).toBe("ma20");
      expect(body.reachable).toBe(true);
      expect(body.method).toBe("analytical");
    });

    it("kdCross 掃描目標回傳 200", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "kdCross", direction: "golden" } },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.target.type).toBe("kdCross");
      expect(body.method).toBe("scan");
    });

    it("缺少 target 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("不支援的 target.type 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "unknownType" } },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.message).toContain("不支援的目標類型");
    });

    it("maintenanceRatio 缺少 value 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "maintenanceRatio" } },
      });

      expect(response.statusCode).toBe(400);
    });

    it("RSI value 超出範圍回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "rsi", value: 100 } },
      });

      expect(response.statusCode).toBe(400);
    });

    it("kdCross 缺少 direction 回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "kdCross" } },
      });

      expect(response.statusCode).toBe(400);
    });

    it("kdCross direction 錯誤回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: { target: { type: "kdCross", direction: "up" } },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("認證與速率限制", () => {
    it("dev 環境繞過 initDataGuard", async () => {
      // 在測試環境中 NODE_ENV 通常是 test，但 buildApp 會設定 logger level
      // 重點是驗證不需 X-Telegram-Init-Data header 即可存取
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 180 },
      });

      // 應該成功 (不被 403 擋下)
      expect(response.statusCode).not.toBe(403);
    });

    it("health 端點不需認證", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe("ok");
    });
  });
});
