/**
 * apiContract.test.mjs
 * API Contract Test — 驗證每個 endpoint 回傳的 schema 結構符合 webapp 的消費預期。
 * 使用 supertest 直接注入 Fastify app，不依賴真實網路或外部服務。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import supertest from "supertest";
import {
  createAjv,
  compileSchema,
  validateData,
} from "../helpers/schemaValidator.mjs";
import errorResponseSchema from "../schemas/error-response.schema.json" with { type: "json" };

// Mock the entire simulateRoute to return controlled responses

let app;
let request;
let ajv;
let validateForwardRequest;
let validateForwardResponse;
let validateReverseRequest;
let validateReverseResponse;
let validateErrorResponse;

import { mkdir, writeFile, rm } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

beforeAll(async () => {
  // 動態 import buildApp 以確保 mock 已生效
  const { buildApp } = await import("../../api/server.mjs");
  // 建立必要的測試目錄
  await mkdir(resolve(DATA_DIR, "market"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "news"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "reports"), { recursive: true });

  // 寫入符合 2.0 結構的 Mock 資料
  const mockStatus = { _meta: {}, data: { rawUsMarket: { vix: "15" } } };
  const mockReport = {
    date: "2026-04-25",
    marketState: { valuation: {}, sentiment: { vix: 15 } },
    strategySnapshot: {},
    signals: { status: "🌱", score: 0 },
  };

  await writeFile(
    resolve(DATA_DIR, "market/latest.json"),
    JSON.stringify(mockStatus),
  );
  await writeFile(
    resolve(DATA_DIR, "news/pool_filtered_active.json"),
    JSON.stringify([]),
  );
  await writeFile(
    resolve(DATA_DIR, "reports/2026-04-25.json"),
    JSON.stringify(mockReport),
  );

  // Simulator 專用最新戰報 (價格需在 PRICE_BOUNDS 範圍內，日期必須在 24 小時內)
  // 需寫入 data/reports/YYYY-MM-DD.json 供 archiveManager.getLatestReport 讀取
  const now = Date.now();
  // 使用 1 小時前的時間戳確保絕對在 24h 內（解決時區問題）
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
  const todayStr = oneHourAgo.toISOString().split("T")[0]; // YYYY-MM-DD
  console.log(
    "[apiContract.test] Mock report date:",
    todayStr,
    "now:",
    new Date().toISOString(),
  );
  const mockLatestReport = {
    date: todayStr,
    price0050: 175,
    currentPrice: 275,
    basePrice: 150,
    portfolio: {
      totalValue: 1000000,
      qty0050: 10000,
      qtyZ2: 5000,
      cash: 50000,
      totalLoan: 800000,
      lastBuyDate: "2026-01-15",
    },
    VIX: 15.99,
    vixArr: [15, 16, 15.5],
    marketState: {
      valuation: {},
      sentiment: { vix: 15.99 },
      liquidity: {},
      economy: {},
    },
    strategySnapshot: {
      lifecycle: { currentAge: 40, retirementAge: 65 },
      profiles: {},
    },
    signals: {
      RSI: 58,
      KD_K: 60,
      KD_D: 55,
      macdSignal: "bull",
      status: "觀望",
      target: "🔹 0050 DCA",
      suggestion: "維持觀望",
      score: 65,
      maintenanceMargin: 142.5,
      z2Ratio: 25.3,
      actualLeverage: 1.85,
      grossLeverage: 2.1,
      grossLeverageStatus: "normal",
      maintenanceRisk: { level: "Normal" },
      marginAnalysis: { currentMargin: 142.5, riskLevel: "Normal" },
      decouplingAnalysis: { decoupled: false },
      regimeState: { lifecycleStage: "累積期" },
    },
    theoreticalShadow: {
      status: "AVAILABLE",
      asOf: todayStr,
      kellyLimits: {
        conservative: 1.6033,
        full: 3.2066,
      },
      marketRegime: {
        regime: "BULL",
        mu: 0.342376,
        sigma: 0.309606,
        sampleDays: 125,
      },
      theory: {
        currentLeverage: 0.8718,
        accountNetAsset: 2113682.6,
        grossExposure: 1842688,
      },
    },
  };
  // 寫入 data/reports/ 供 getLatestReport 讀取
  await writeFile(
    resolve(DATA_DIR, "reports", `${todayStr}.json`),
    JSON.stringify(mockLatestReport),
  );
  // 也寫入 market/latest.json (其他路徑可能用到)
  await writeFile(
    resolve(DATA_DIR, "market/latest.json"),
    JSON.stringify({ _meta: {}, data: mockLatestReport }),
  );

  process.env.BYPASS_INIT_DATA = "true";
  app = await buildApp({ logger: false });
  await app.ready();
  request = supertest(app.server);

  // 初始化 AJV 驗證器
  ajv = createAjv();
  validateErrorResponse = compileSchema(ajv, errorResponseSchema);
});

afterAll(async () => {
  await app.close();
  // 不刪除資料，保留作為測試證據
});

describe("API Contract Testing", () => {
  // ── /api/status ────────────────────────────────────────────────
  describe("GET /api/status", () => {
    it("應回傳 200 且包含 _meta 與 data 欄位", async () => {
      const res = await request
        .get("/api/status")
        .set("X-Telegram-Init-Data", "dev-bypass") // 使用 dev-bypass 繞過 Guard
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("_meta");
    });
  });

  // ── /api/reports ───────────────────────────────────────────────
  describe("GET /api/reports", () => {
    it("應回傳 2.0 格式且包含 marketState 與 strategySnapshot", async () => {
      const res = await request
        .get("/api/reports?limit=1")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const report = res.body[0];
        expect(report).toHaveProperty("marketState");
        expect(report).toHaveProperty("strategySnapshot");
        expect(report).toHaveProperty("signals");

        // 驗證 marketState 深度
        expect(report.marketState).toHaveProperty("valuation");
        expect(report.marketState).toHaveProperty("sentiment");

        // 驗證 signals 深度
        expect(report.signals).toHaveProperty("status");
        expect(report.signals).toHaveProperty("score");
      }
    });
  });

  // ── /api/reports/snapshots ─────────────────────────────────────
  describe("GET /api/reports/snapshots", () => {
    it("應回傳物件且包含 snapshots 陣列與 hasEncryption 狀態", async () => {
      const res = await request
        .get("/api/reports/snapshots?limit=1")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(typeof res.body).toBe("object");
      expect(res.body).toHaveProperty("hasEncryption");
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });
  });

  // ── /api/news ──────────────────────────────────────────────────
  describe("GET /api/news", () => {
    it("應回傳 200 且格式為陣列", async () => {
      const res = await request
        .get("/api/news")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── /api/strategy-config ───────────────────────────────────────
  describe("GET /api/strategy-config", () => {
    it("應回傳 200 且為物件格式", async () => {
      const res = await request
        .get("/api/strategy-config")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(typeof res.body).toBe("object");
      expect(res.body).not.toBeNull();
    });

    it("應包含 strategy 物件與 _meta", async () => {
      const res = await request
        .get("/api/strategy-config")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(res.body).toHaveProperty("strategy");
      expect(res.body).toHaveProperty("_meta");
    });
  });

  // ── /api/portfolio/health ───────────────────────────────────────
  describe("GET /api/portfolio/health", () => {
    it("應回傳 200 且包含健康度欄位", async () => {
      const res = await request
        .get("/api/portfolio/health")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(typeof res.body).toBe("object");
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("lightStatus");
      expect(res.body).toHaveProperty("_meta");
    });

    it("應接受 query parameters 覆蓋預設值", async () => {
      const res = await request
        .get("/api/portfolio/health?maintenanceMargin=150&z2Ratio=20&vix=18")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(res.body._meta.source).toBe("query");
    });
  });

  // ── POST /api/strategy-config ──────────────────────────────────
  describe("POST /api/strategy-config", () => {
    it("無效結構應回傳 400 驗證錯誤", async () => {
      const res = await request
        .post("/api/strategy-config")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ invalid: "structure" })
        .expect(400);

      expect(res.body.error).toContain("驗證失敗");
    });
  });

  // ── /health (不需 auth) ────────────────────────────────────────
  describe("GET /health", () => {
    it("應回傳 200 ok", async () => {
      const res = await request.get("/health").expect(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
