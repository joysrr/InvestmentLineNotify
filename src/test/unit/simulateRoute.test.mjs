// src/test/unit/simulateRoute.test.mjs
// TDD: simulate.mjs route handler 分支覆蓋
// 覆蓋目標: handleError 5 個分支 + 各端點 validation 失敗 + 成功路徑

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../modules/simulator/dataAdapter.mjs", () => ({
  buildSimulationInput: vi.fn(),
  getValidatedLatestReport: vi.fn(),
}));

vi.mock("../../modules/simulator/forwardSimulator.mjs", () => ({
  runForwardSimulation: vi.fn(),
}));

vi.mock("../../modules/simulator/reverseEngine.mjs", () => ({
  runReverseEngine: vi.fn(),
}));

vi.mock("../../modules/simulator/sensitivityEngine.mjs", () => ({
  runSensitivitySingleParam: vi.fn(),
  runSensitivityMultiParam: vi.fn(),
}));

vi.mock("../../modules/simulator/paretoEngine.mjs", () => ({
  runParetoAnalysis: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_REPORT = {
  date: "2026-01-01",
  price0050: 170,
  currentPrice: 50,
};

const BASE_SIM_INPUT = {
  price0050: 170,
  currentPrice: 50,
  strategy: {},
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("simulateRoute - /api/v1/simulate branch coverage", () => {
  let app;
  let mocks;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.BYPASS_INIT_DATA = "true";

    const dataAdapter = await import(
      "../../modules/simulator/dataAdapter.mjs"
    );
    const forwardSim = await import(
      "../../modules/simulator/forwardSimulator.mjs"
    );
    const reverseEng = await import(
      "../../modules/simulator/reverseEngine.mjs"
    );
    const sensitivity = await import(
      "../../modules/simulator/sensitivityEngine.mjs"
    );
    const pareto = await import("../../modules/simulator/paretoEngine.mjs");

    mocks = {
      getValidatedLatestReport: dataAdapter.getValidatedLatestReport,
      buildSimulationInput: dataAdapter.buildSimulationInput,
      runForwardSimulation: forwardSim.runForwardSimulation,
      runReverseEngine: reverseEng.runReverseEngine,
      runSensitivitySingleParam: sensitivity.runSensitivitySingleParam,
      runSensitivityMultiParam: sensitivity.runSensitivityMultiParam,
      runParetoAnalysis: pareto.runParetoAnalysis,
    };

    mocks.getValidatedLatestReport.mockResolvedValue(BASE_REPORT);
    mocks.buildSimulationInput.mockResolvedValue(BASE_SIM_INPUT);

    // Build Fastify app with real simulate route
    app = Fastify({ logger: false });
    const { default: simulateRoute } = await import(
      "../../api/routes/v1/simulate.mjs"
    );
    await app.register(simulateRoute, { prefix: "/api/v1" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ── handleError branches ──────────────────────────────────────────────────

  describe("handleError - 5 個已知錯誤代碼分支", () => {
    it("HISTORY_INCOMPLETE -> 409", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("HISTORY_INCOMPLETE: missing data"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("CONFLICT");
    });

    it("REPORT_EXPIRED -> 409", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("REPORT_EXPIRED: old report"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toContain("戰報過期");
    });

    it("DATA_NOT_READY -> 409", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("DATA_NOT_READY: loading"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("DATA_NOT_READY");
    });

    it("STRATEGY_LOAD_FAILED -> 409", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("STRATEGY_LOAD_FAILED: config error"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(409);
    });

    it("未預期錯誤 -> 500", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("Some unexpected error"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("INTERNAL_ERROR");
    });
  });

  // ── POST /api/v1/simulate ──────────────────────────────────────────────────

  describe("POST /api/v1/simulate - 正向模擬", () => {
    it("validation 失敗 -> 400 (price0050 欄位)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: -1 },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("buildSimulationInput 失敗 -> handleError", async () => {
      mocks.buildSimulationInput.mockRejectedValue(
        new Error("HISTORY_INCOMPLETE: build failed"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(409);
    });

    it("成功 -> 200 + 結果", async () => {
      const mockResult = { simulatedPrice0050: 175, metrics: {} };
      mocks.runForwardSimulation.mockResolvedValue(mockResult);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate",
        payload: { price0050: 170, priceZ2: 50 },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── POST /api/v1/simulate/reverse ─────────────────────────────────────────

  describe("POST /api/v1/simulate/reverse - 反向推導", () => {
    it("validation 失敗 -> 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("getValidatedLatestReport 失敗 -> handleError", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("DATA_NOT_READY: no report"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: {
          target: { type: "maintenanceRatio", value: 1.5 },
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it("成功 -> 200 + disclaimer", async () => {
      mocks.runReverseEngine.mockResolvedValue({
        targetReturn: 0.2,
        requiredPrice: 200,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/reverse",
        payload: {
          target: { type: "maintenanceRatio", value: 1.5 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.disclaimer).toContain("反向推導");
    });
  });

  // ── POST /api/v1/simulate/batch ───────────────────────────────────────────

  describe("POST /api/v1/simulate/batch - 批次模擬", () => {
    it("validation 失敗 -> 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/batch",
        payload: { jobs: [] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("成功批次 -> 200 + totalJobs", async () => {
      mocks.runForwardSimulation.mockResolvedValue({ metrics: {} });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/batch",
        payload: {
          jobs: [
            { price0050: 170, priceZ2: 50 },
            { price0050: 180, priceZ2: 55 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalJobs).toBe(2);
    });

    it("批次中部分失敗 -> 200 + failed > 0", async () => {
      let call = 0;
      mocks.runForwardSimulation.mockImplementation(() => {
        call++;
        if (call % 2 === 0) return Promise.reject(new Error("Sim failed"));
        return Promise.resolve({ metrics: {} });
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/batch",
        payload: {
          jobs: [{ price0050: 170 }, { price0050: 180 }],
          options: { retryAttempts: 0, retryDelayMs: 0 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.failed).toBeGreaterThan(0);
    });

    it("priceZ2 可選 (??運算符) -> 從戰報推算", async () => {
      mocks.runForwardSimulation.mockResolvedValue({ metrics: {} });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/batch",
        payload: {
          jobs: [{ price0050: 170 }],
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── POST /api/v1/simulate/sensitivity ────────────────────────────────────

  describe("POST /api/v1/simulate/sensitivity - 敏感度分析", () => {
    const VALID_BODY = {
      baseParams: { price0050: 170, priceZ2: 50 },
      targetParam: "maintenance.protectTrigger",
      scanRange: { min: 110, max: 150, step: 10 },
      metrics: ["strategyScore"],
    };

    it("validation 失敗 -> 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/sensitivity",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("成功 (不含 multiParams) -> multiParam 為空", async () => {
      mocks.runSensitivitySingleParam.mockResolvedValue({ results: [] });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/sensitivity",
        payload: VALID_BODY,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.multiParam).toEqual({ results: [], keyDrivers: [] });
    });

    it("成功 (含 multiParams) -> runSensitivityMultiParam 被呼叫", async () => {
      mocks.runSensitivitySingleParam.mockResolvedValue({ results: [] });
      mocks.runSensitivityMultiParam.mockResolvedValue({
        results: [{ a: 1 }],
        keyDrivers: ["maintenance.protectTrigger"],
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/sensitivity",
        payload: {
          ...VALID_BODY,
          multiParams: [
            { path: "maintenance.protectTrigger", range: [110, 140] },
            { path: "maintenance.protectTarget", range: [120, 160] },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mocks.runSensitivityMultiParam).toHaveBeenCalled();
    });
  });

  // ── POST /api/v1/simulate/pareto ────────────────────────────────────────

  describe("POST /api/v1/simulate/pareto - Pareto 分析", () => {
    const VALID_BODY = {
      baseParams: { price0050: 170, priceZ2: 50 },
      scanParams: [
        {
          path: "maintenance.protectTrigger",
          range: [110, 150],
        },
      ],
      objectives: [
        { metric: "strategyScore", direction: "maximize" },
        { metric: "maintenanceMargin", direction: "maximize" },
      ],
    };

    it("validation 失敗 -> 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/pareto",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("成功 -> 200 + paretoFront", async () => {
      mocks.runParetoAnalysis.mockResolvedValue({
        allPoints: [{ x: 1, y: 2 }],
        paretoFront: [{ x: 1, y: 2 }],
        kneePoint: { x: 1, y: 2 },
        weights: { strategyScore: 0.5, maintenanceMargin: 0.5 },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/pareto",
        payload: VALID_BODY,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.paretoFront).toBeDefined();
      expect(body.disclaimer).toContain("Pareto");
    });

    it("getValidatedLatestReport 失敗 -> handleError", async () => {
      mocks.getValidatedLatestReport.mockRejectedValue(
        new Error("DATA_NOT_READY: pareto"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/simulate/pareto",
        payload: VALID_BODY,
      });

      expect(res.statusCode).toBe(409);
    });
  });
});
