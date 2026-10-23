/**
 * portfolioHealthApi.test.mjs
 *
 * Integration tests for GET /api/portfolio/health
 * 測試 API 端點可用性、Query params、錯誤處理
 *
 * 測試案例：TC-016 ~ TC-017
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import portfolioHealthRoute, {
  resolveCurrentAge,
} from "../../api/routes/portfolioHealth.mjs";

describe("resolveCurrentAge", () => {
  it("uses age 33 when query and strategy lifecycle are absent", () => {
    expect(resolveCurrentAge({}, {})).toBe(33);
  });
});

// ─────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────

let fastify;

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await fastify.register(portfolioHealthRoute, { prefix: "/api" });
  await fastify.ready();
});

afterAll(async () => {
  await fastify.close();
});

// ─────────────────────────────────────────────────────────────
// TC-016: API Endpoint - Success Response
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Success Response (TC-016)", () => {
  it("GET /api/portfolio/health 應回傳 200 且包含完整健康度資料", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 35,
        currentGrossLeverage: 1.5,
        vix: 22,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);

    // 驗證基本欄位
    expect(body.status).toBeDefined();
    expect(body.score).toBeDefined();
    expect(body.components).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.recommendations).toBeDefined();
    expect(body.lightStatus).toBeDefined();
    expect(body.timestamp).toBeDefined();

    // 驗證 lightStatus 結構
    expect(body.lightStatus.emoji).toBeDefined();
    expect(body.lightStatus.label).toBeDefined();
    expect(body.lightStatus.color).toBeDefined();

    // 驗證 components 包含所有 6 個組件
    expect(body.components.margin).toBeDefined();
    expect(body.components.survival).toBeDefined();
    expect(body.components.decoupling).toBeDefined();
    expect(body.components.leverage).toBeDefined();
    expect(body.components.lifecycle).toBeDefined();
    expect(body.components.regime).toBeDefined();
  });

  it("應回傳 GREEN 狀態當所有參數健康", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 170,
        z2Ratio: 20,
        survivalDropPercent: 55,
        currentGrossLeverage: 1.1, // < 1.2 (2.0*0.6) → GREEN
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 53, // MID 階段 (lifecycleMaxLeverage = 2.0)
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe("GREEN");
    // 預期分數：(100*6)/6 = 100
    expect(body.score).toBe(100);
  });

  it("應回傳正確的 emoji 燈號", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 170,
        z2Ratio: 20,
        survivalDropPercent: 55,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    const body = JSON.parse(response.body);
    expect(body.lightStatus.emoji).toBe("🟢");
  });
});

// ─────────────────────────────────────────────────────────────
// TC-017: API Endpoint - Missing Parameters
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Missing Parameters (TC-017)", () => {
  it("所有參數缺失應使用預設值計算", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);

    // 應回傳有效回應（使用預設值）
    expect(body.status).toBeDefined();
    expect(body.score).toBeDefined();
    expect(typeof body.score).toBe("number");
  });

  it("缺少 currentAge 應仍能計算（無 lifecycleContext）", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 35,
        currentGrossLeverage: 1.5,
        vix: 22,
        macroSentiment: "BULL",
        // currentAge 缺失
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
    expect(body.score).toBeDefined();
    expect(body.components.lifecycle.details.yearsToRetirement).toBe(32);
  });

  it("缺少 macroSentiment 應使用預設值", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 35,
        currentGrossLeverage: 1.5,
        vix: 22,
        // macroSentiment 缺失
        currentAge: 55,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
  });

  it("部分參數缺失應使用預設值 0", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        // 其他參數缺失
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
    expect(body.score).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Query Parameters Validation
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Query Parameters", () => {
  it("應正確處理數值參數", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: "165", // 字串格式
        z2Ratio: "20",
        survivalDropPercent: "35",
        currentGrossLeverage: "1.5",
        vix: "22",
        currentAge: "55",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
  });

  it("應處理負數參數（已退休）", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.0,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 70, // 已退休
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
    // 已退休應為 PRE_RETIRE 階段
    expect(body.components.lifecycle.details.stage).toBe("PRE_RETIRE");
  });

  it("應處理邊界值參數", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 135, // 正好 marginCallThreshold
        z2Ratio: 45, // 正好 z2RatioHigh
        survivalDropPercent: 30, // 正好 GREEN/YELLOW 邊界
        currentGrossLeverage: 2.0, // 正好 ceiling
        vix: 28, // 正好 vixOverrideTrigger
        macroSentiment: "BULL",
        currentAge: 50, // 正好 15 年（MID 階段）
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Error Handling", () => {
  it("應處理無效的數值參數", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: "invalid",
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    // 無效數值會轉換為 0，不應該拋出錯誤
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
  });

  it("應處理 null 值參數", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: null,
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Response Format Validation
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Response Format", () => {
  it("應回傳正確的 Content-Type", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("components 的每個欄位應包含 status 和 score", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    const body = JSON.parse(response.body);

    const components = [
      "margin",
      "survival",
      "decoupling",
      "leverage",
      "lifecycle",
      "regime",
    ];

    for (const component of components) {
      expect(body.components[component]).toBeDefined();
      expect(body.components[component].status).toBeDefined();
      expect(body.components[component].score).toBeDefined();
      expect(["GREEN", "YELLOW", "RED"]).toContain(
        body.components[component].status,
      );
      expect(typeof body.components[component].score).toBe("number");
    }
  });

  it("recommendations 應為陣列格式", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 165,
        z2Ratio: 20,
        survivalDropPercent: 25,
        currentGrossLeverage: 1.2,
        vix: 18,
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    const body = JSON.parse(response.body);

    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Integration Scenarios
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health API - Integration Scenarios", () => {
  it("場景：健康帳戶應顯示 GREEN", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 180,
        z2Ratio: 20,
        survivalDropPercent: 55,
        currentGrossLeverage: 1.0,
        vix: 15,
        macroSentiment: "BULL",
        currentAge: 45,
      },
    });

    const body = JSON.parse(response.body);

    expect(body.status).toBe("GREEN");
    expect(body.score).toBe(100);
    expect(body.lightStatus.emoji).toBe("🟢");
  });

  it("場景：警告帳戶應顯示 YELLOW", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 148, // YELLOW
        z2Ratio: 35, // YELLOW
        survivalDropPercent: 40, // YELLOW
        currentGrossLeverage: 1.8, // YELLOW
        vix: 22, // GREEN
        macroSentiment: "BULL",
        currentAge: 55,
      },
    });

    const body = JSON.parse(response.body);

    // 多個 YELLOW 應導致總體 YELLOW
    expect(body.status).toBe("YELLOW");
    expect(body.score).toBeGreaterThanOrEqual(50);
    expect(body.score).toBeLessThan(80);
  });

  it("場景：危險帳戶應顯示 RED", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/portfolio/health",
      query: {
        maintenanceMargin: 130, // RED
        z2Ratio: 50, // RED
        survivalDropPercent: 60, // RED
        currentGrossLeverage: 2.6, // RED
        vix: 40, // RED (panic)
        macroSentiment: "BEAR",
        currentAge: 62,
      },
    });

    const body = JSON.parse(response.body);

    expect(body.status).toBe("RED");
    expect(body.score).toBeLessThan(50);
    expect(body.lightStatus.emoji).toBe("🔴");
  });
});
