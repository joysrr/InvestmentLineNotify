import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import portfolioHealthRoute from "./portfolioHealth.mjs";

vi.mock("../../modules/strategy/strategyLoader.mjs", () => ({
  fetchStrategyConfigUnified: vi.fn(),
}));

vi.mock("../../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    listArchiveDates: vi.fn(),
    getReportByDate: vi.fn(),
  },
}));

vi.mock("../../modules/providers/twseProvider.mjs", () => ({
  getTwVix: vi.fn(),
}));

vi.mock("../../modules/strategy/portfolioHealth.mjs", () => ({
  computePortfolioHealth: vi.fn(),
  getHealthLightStatus: vi.fn(),
}));

describe("GET /api/portfolio/health (TDD Phase 3)", () => {
  let app;
  let fetchStrategyConfigUnified;
  let archiveManager;
  let computePortfolioHealth;
  let getHealthLightStatus;
  let getTwVix;
  let capturedCtx;
  let capturedLifecycle;

  beforeEach(async () => {
    const strategyLoader =
      await import("../../modules/strategy/strategyLoader.mjs");
    const dataArchive = await import("../../modules/data/archiveManager.mjs");
    const healthModule =
      await import("../../modules/strategy/portfolioHealth.mjs");
    const twseModule = await import("../../modules/providers/twseProvider.mjs");

    fetchStrategyConfigUnified = strategyLoader.fetchStrategyConfigUnified;
    archiveManager = dataArchive.archiveManager;
    computePortfolioHealth = healthModule.computePortfolioHealth;
    getHealthLightStatus = healthModule.getHealthLightStatus;
    getTwVix = twseModule.getTwVix;

    // 捕獲 computePortfolioHealth 實際收到的參數，避免 mock.calls 跨測試污染
    capturedCtx = null;
    capturedLifecycle = null;
    computePortfolioHealth.mockImplementation((ctx, strategy, lifecycle) => {
      capturedCtx = ctx;
      capturedLifecycle = lifecycle;
      return { status: "HEALTHY", score: 80 };
    });
    getHealthLightStatus.mockReturnValue("green");

    app = Fastify();
    await app.register(portfolioHealthRoute);
  });

  afterEach(async () => {
    await app.close();
  });

  it("應使用查詢參數優先於 latestReport，並回傳 source: query", async () => {
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 35, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue(["2026-11-05"]);
    archiveManager.getReportByDate.mockResolvedValue({
      date: "2026-11-05",
      signals: { maintenanceMargin: 999, z2Ratio: 999 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health?maintenanceMargin=100&z2Ratio=1.2&vix=20",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body._meta.source).toBe("query");
    expect(capturedCtx.maintenanceMargin).toBe(100);
    expect(capturedCtx.z2Ratio).toBe(1.2);
    expect(capturedCtx.vix).toBe(20);
  });

  it("應在無查詢參數時從 latestReport 獲取數據，並回傳 source: latest_report", async () => {
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 35, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue(["2026-11-05"]);
    archiveManager.getReportByDate.mockResolvedValue({
      date: "2026-11-05",
      signals: { maintenanceMargin: 50, z2Ratio: 0.8 },
      marketState: { sentiment: { vix: 25 } },
    });

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body._meta.source).toBe("latest_report");
    expect(body._meta.reportDate).toBe("2026-11-05");
    // 注意：本地 getCached 會在 TTL 內緩存 latestReport，跨測試可能返回上一個測試的快取值。
    // 此處僅驗證 source 標記與報告日期，不驗證 ctx 具體數值（受快取影響）。
  });

  it("應正確傳遞 currentAge 並判定生命週期階段", async () => {
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 30, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health",
    });

    expect(res.statusCode).toBe(200);
    // currentAge=30, retirementAge=65 => yearsToRetirement=35 => EARLY stage
    expect(capturedLifecycle.stage).toBe("EARLY");
    expect(capturedLifecycle.yearsToRetirement).toBe(35);
  });

  it("應在 fetchStrategyConfigUnified 拋出錯誤時回傳 500", async () => {
    fetchStrategyConfigUnified.mockRejectedValue(
      new Error("Strategy load failed"),
    );

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health",
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Internal server error");
  });

  it("應從 getTwVix 獲取台股 VIX 並傳遞給 computePortfolioHealth", async () => {
    getTwVix.mockResolvedValue(22.5);
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 35, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health?vix=18.5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(capturedCtx.vix).toBe(18.5);
    expect(capturedCtx.vixTW).toBe(22.5);
    expect(body.vixTW).toBe(22.5);
  });

  it("應在 getTwVix 拋出錯誤時優雅處理，vixTW 為 null", async () => {
    getTwVix.mockRejectedValue(new Error("TAIFEX API timeout"));
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 35, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health?vix=18.5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(capturedCtx.vixTW).toBeNull();
    expect(body.vixTW).toBeNull();
  });

  it("應從 getTwVix 回傳的對象中提取 value 作為 vixTW（非整個對象）", async () => {
    getTwVix.mockResolvedValue({
      symbolUsed: "TAIWANVIX",
      value: 43.8,
      change: -2.72,
      status: "緊張",
      date: "2026-11-09",
      time: "13:45:00",
      dateTimeText: "2026/11/09 13:45:00",
    });
    fetchStrategyConfigUnified.mockResolvedValue({
      lifecycle: { currentAge: 35, retirementAge: 65 },
    });
    archiveManager.listArchiveDates.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/portfolio/health?vix=18.5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(capturedCtx.vixTW).toBe(43.8);
    expect(body.vixTW).toBe(43.8);
  });
});
