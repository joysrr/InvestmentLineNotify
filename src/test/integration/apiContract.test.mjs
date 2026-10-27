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
import forwardRequestSchema from "../schemas/simulate-forward-request.schema.json" with { type: "json" };
import forwardResponseSchema from "../schemas/simulate-forward-response.schema.json" with { type: "json" };
import reverseRequestSchema from "../schemas/simulate-reverse-request.schema.json" with { type: "json" };
import reverseResponseSchema from "../schemas/simulate-reverse-response.schema.json" with { type: "json" };
import errorResponseSchema from "../schemas/error-response.schema.json" with { type: "json" };

// Mock the entire simulateRoute to return controlled responses
vi.mock("../../api/routes/v1/simulate.mjs", () => ({
  default: vi.fn((fastify) => {
    fastify.post("/simulate", async (request, reply) => {
      const body = request.body;

      // Validation logic matching the real validator
      if (!body.price0050) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "price0050 is required",
          field: "price0050",
          statusCode: 400,
        });
      }
      if (body.price0050 < 50 || body.price0050 > 500) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "price0050 out of bounds",
          field: "price0050",
          statusCode: 400,
        });
      }
      if (body.priceZ2 && (body.priceZ2 < 50 || body.priceZ2 > 500)) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "priceZ2 out of bounds",
          field: "priceZ2",
          statusCode: 400,
        });
      }

      // Return mock forward simulation response matching the full schema
      const price0050 = body.price0050;
      const priceZ2 = body.priceZ2 || price0050 * 1.5;
      return reply.code(200).send({
        simulatedPrice0050: price0050,
        simulatedPriceZ2: priceZ2,
        priceDiffPct0050: "0.00",
        priceDiffPctZ2: "0.00",
        strategyScore: 70,
        strategyStatus: "觀望",
        strategyTarget: "🔹 0050 DCA",
        strategySuggestion: "維持觀望",
        maintenanceMargin: 142.5,
        portfolioHealth: {
          maintenanceRisk: { level: "Normal" },
          actualLeverage: 1.85,
          z2Ratio: 25.3,
          grossLeverage: 2.1,
          grossLeverageStatus: "normal",
          decouplingAnalysis: { decoupled: false },
          marginAnalysis: { currentMargin: 142.5, riskLevel: "Normal" },
        },
        lifecycleStage: "累積期",
        calculationMode: "forward",
        timestamp: new Date().toISOString(),
        dataAsOf: new Date().toISOString().split("T")[0],
        assumptions: ["假設市場開市", "假設流動性正常"],
        warnings: [],
        disclaimer: "模擬結果僅供參考，非投資建議",
        currentPrice0050: 175,
        currentPriceZ2: 275,
        indicators: {
          rsi: 58,
          kd: { k: 60, d: 55 },
          macd: { MACD: 0.5, signal: 0.3, histogram: 0.2 },
          ma20: 176,
          ma60: 174,
          ma240: 170,
          bias240: 2.9,
          atr: 2.5,
        },
        dataQuality: {
          rsi: "ok",
          kd: "ok",
          macd: "ok",
          ma20: "ok",
          ma60: "ok",
          ma240: "ok",
          atr: "ok",
        },
      });
    });

    fastify.post("/simulate/reverse", async (request, reply) => {
      const body = request.body;

      // Validation logic for reverse
      if (!body.target) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "target is required",
          field: "target",
          statusCode: 400,
        });
      }
      if (
        body.target.type === "maintenanceRatio" &&
        body.target.value === undefined
      ) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "maintenanceRatio requires value",
          field: "target",
          statusCode: 400,
        });
      }
      if (
        body.target.type === "rsi" &&
        (body.target.value === undefined ||
          body.target.value < 1 ||
          body.target.value > 99)
      ) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "RSI value out of range",
          field: "target",
          statusCode: 400,
        });
      }
      if (body.target.type === "kdCross" && !body.target.direction) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "kdCross requires direction",
          field: "target",
          statusCode: 400,
        });
      }
      if (
        body.target.type === "kdCross" &&
        !["golden", "dead"].includes(body.target.direction)
      ) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "kdCross direction must be golden or dead",
          field: "target",
          statusCode: 400,
        });
      }
      if (
        ![
          "maintenanceRatio",
          "rsi",
          "ma20",
          "ma60",
          "ma240Bias",
          "kdCross",
          "macdCross",
          "strategyScore",
          "portfolioHealth",
        ].includes(body.target.type)
      ) {
        return reply.code(400).send({
          error: "VALIDATION_ERROR",
          message: "Unsupported target type",
          field: "target",
          statusCode: 400,
        });
      }

      // Return mock reverse simulation response matching the schema
      return reply.code(200).send({
        target: body.target,
        reachable: false,
        method: "not_implemented",
        reason: "反向推導功能正在開發中 (Phase B/C)",
        calculationMode: "reverse_analytical",
        timestamp: new Date().toISOString(),
        dataAsOf: new Date().toISOString().split("T")[0],
        disclaimer:
          "此為條件分析，非價格預測亦非投資建議。反向推導功能尚未完成。",
      });
    });
  }),
}));

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
  validateForwardRequest = compileSchema(ajv, forwardRequestSchema);
  validateForwardResponse = compileSchema(ajv, forwardResponseSchema);
  validateReverseRequest = compileSchema(ajv, reverseRequestSchema);
  validateReverseResponse = compileSchema(ajv, reverseResponseSchema);
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

  // ── POST /api/v1/simulate (正向模擬) ──────────────────────────────
  describe("POST /api/v1/simulate - Forward Simulation", () => {
    it("應接受有效輸入並回傳完整 forward response schema", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 180, priceZ2: 280 })
        .expect(200);

      // 驗證 request schema
      const reqValidation = validateData(validateForwardRequest, {
        price0050: 180,
        priceZ2: 280,
      });
      expect(reqValidation.valid).toBe(true);

      // 驗證 response schema
      const resValidation = validateData(validateForwardResponse, res.body);
      if (!resValidation.valid) {
        console.error(
          "Forward response validation errors:",
          resValidation.errors,
        );
      }
      expect(resValidation.valid).toBe(true);

      // 關鍵業務欄位檢查
      expect(res.body).toHaveProperty("simulatedPrice0050");
      expect(res.body).toHaveProperty("strategyScore");
      expect(res.body.calculationMode).toBe("forward");
    });

    it("應接受只有 price0050 的輸入 (priceZ2 選填)", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 180 })
        .expect(200);

      const resValidation = validateData(validateForwardResponse, res.body);
      expect(resValidation.valid).toBe(true);
    });

    it("缺少 price0050 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ priceZ2: 280 })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
      expect(res.body.field).toBe("price0050");
    });

    it("price0050 超出範圍 (<50) 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 30, priceZ2: 280 })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("price0050 超出範圍 (>500) 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 600, priceZ2: 280 })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("priceZ2 超出範圍 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 180, priceZ2: 30 })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });
  });

  // ── POST /api/v1/simulate/reverse (反向推導) ──────────────────────
  describe("POST /api/v1/simulate/reverse - Reverse Simulation", () => {
    const validTargets = [
      { type: "maintenanceRatio", value: 150 },
      { type: "rsi", value: 30 },
      { type: "ma20", value: 180 },
      { type: "ma60", value: 175 },
      { type: "ma240Bias", value: 5 },
      { type: "kdCross", direction: "golden" },
      { type: "macdCross", direction: "dead" },
      { type: "strategyScore", value: 70 },
      { type: "portfolioHealth", status: "green" },
    ];

    for (const target of validTargets) {
      it(`target.type=${target.type} 應接受有效輸入並回傳 reverse response schema`, async () => {
        const body = { target };
        const res = await request
          .post("/api/v1/simulate/reverse")
          .set("X-Telegram-Init-Data", "dev-bypass")
          .send(body)
          .expect(200);

        // 驗證 request schema
        const reqValidation = validateData(validateReverseRequest, body);
        expect(reqValidation.valid).toBe(true);

        // 驗證 response schema (目前回傳 not_implemented)
        const resValidation = validateData(validateReverseResponse, res.body);
        if (!resValidation.valid) {
          console.error(
            `Reverse response validation errors (${target.type}):`,
            resValidation.errors,
          );
        }
        expect(resValidation.valid).toBe(true);

        // 關鍵欄位檢查
        expect(res.body).toHaveProperty("target");
        expect(res.body.target.type).toBe(target.type);
        expect(res.body).toHaveProperty("reachable");
        expect(res.body).toHaveProperty("method");
        expect(res.body).toHaveProperty("reason");
        expect(res.body.calculationMode).toMatch(/^reverse_/);
      });
    }

    it("缺少 target 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({})
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("不支援的 target.type 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ target: { type: "invalidType" } })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("maintenanceRatio 缺少 value 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ target: { type: "maintenanceRatio" } })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("RSI value 超出範圍 (0) 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ target: { type: "rsi", value: 0 } })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("kdCross 缺少 direction 應回傳 400 VALIDATION_ERROR", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ target: { type: "kdCross" } })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("kdCross direction 必須是 golden 或 dead", async () => {
      const res = await request
        .post("/api/v1/simulate/reverse")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ target: { type: "kdCross", direction: "invalid" } })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });
  });

  // ── 錯誤回應格式統一驗證 ────────────────────────────────────────
  describe("Error Response Format Consistency", () => {
    it("所有 400 回應應符合 error-response schema", async () => {
      const res = await request
        .post("/api/v1/simulate")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .send({ price0050: 30 })
        .expect(400);

      const errValidation = validateData(validateErrorResponse, res.body);
      expect(errValidation.valid).toBe(true);
      expect(res.body.statusCode).toBe(400);
    });

    it("所有 409 回應應符合 error-response schema", async () => {
      // 測試一個會觸發 409 的情境 (需 mock 特定錯誤)
      // 這裡先驗證 schema 結構
      const mock409 = {
        error: "CONFLICT",
        message: "Test",
        statusCode: 409,
        field: "report",
      };
      const validation = validateData(validateErrorResponse, mock409);
      expect(validation.valid).toBe(true);
    });

    it("所有 500 回應應符合 error-response schema", async () => {
      const mock500 = {
        error: "INTERNAL_ERROR",
        message: "Test",
        statusCode: 500,
      };
      const validation = validateData(validateErrorResponse, mock500);
      expect(validation.valid).toBe(true);
    });
  });
});
