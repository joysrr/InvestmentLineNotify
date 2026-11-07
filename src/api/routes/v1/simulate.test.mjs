import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import simulateRoute from "./simulate.mjs";

// Mock 所有依賴模塊
vi.mock("../../../modules/simulator/dataAdapter.mjs", () => ({
  buildSimulationInput: vi.fn(),
  getValidatedLatestReport: vi.fn(),
}));
vi.mock("../../../modules/simulator/forwardSimulator.mjs", () => ({
  runForwardSimulation: vi.fn(),
}));
vi.mock("../../../modules/simulator/reverseEngine.mjs", () => ({
  runReverseEngine: vi.fn(),
}));
vi.mock("../../../modules/simulator/sensitivityEngine.mjs", () => ({
  runSensitivitySingleParam: vi.fn(),
  runSensitivityMultiParam: vi.fn(),
}));
vi.mock("../../../modules/simulator/paretoEngine.mjs", () => ({
  runParetoAnalysis: vi.fn(),
}));
vi.mock("../../../modules/simulator/validator.mjs", () => ({
  validateForwardInput: vi.fn(),
  validateReverseInput: vi.fn(),
  validateBatchInput: vi.fn(),
  validateSensitivityInput: vi.fn(),
  validateParetoInput: vi.fn(),
  createErrorResponse: vi.fn((code, msg, type) => ({
    code,
    message: msg,
    type,
  })),
}));
vi.mock("../../../modules/simulator/constants.mjs", () => ({
  ERROR_CODES: {
    CONFLICT: "CONFLICT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
  HTTP_STATUS: {
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    OK: 200,
    BAD_REQUEST: 400,
  },
}));

describe("POST /api/v1/simulate (TDD Phase 3)", () => {
  let app;
  let validateForwardInput;
  let runForwardSimulation;
  let buildSimulationInput;
  let getValidatedLatestReport;

  beforeEach(async () => {
    const validator = await import("../../../modules/simulator/validator.mjs");
    const forwardSim =
      await import("../../../modules/simulator/forwardSimulator.mjs");
    const dataAdapter =
      await import("../../../modules/simulator/dataAdapter.mjs");

    validateForwardInput = validator.validateForwardInput;
    runForwardSimulation = forwardSim.runForwardSimulation;
    buildSimulationInput = dataAdapter.buildSimulationInput;
    getValidatedLatestReport = dataAdapter.getValidatedLatestReport;

    app = Fastify();
    await app.register(simulateRoute, { prefix: "/api/v1" });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("輸入驗證失敗時回傳 400", async () => {
    validateForwardInput.mockReturnValue({
      valid: false,
      errors: ["價格必須大於 0"],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/simulate",
      body: { price0050: -1 },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("驗證成功時執行正向模擬並回傳 200", async () => {
    validateForwardInput.mockReturnValue({
      valid: true,
      sanitized: { price0050: 100, priceZ2: 2.5 },
    });
    getValidatedLatestReport.mockResolvedValue({
      date: "2026-11-05",
      signals: {},
    });
    buildSimulationInput.mockResolvedValue({ input: "ok" });
    runForwardSimulation.mockResolvedValue({ finalValue: 150, profit: 50 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/simulate",
      body: { price0050: 100, priceZ2: 2.5 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.finalValue).toBe(150);
    expect(body.profit).toBe(50);
  });

  it("模擬拋出錯誤時回傳 500", async () => {
    validateForwardInput.mockReturnValue({
      valid: true,
      sanitized: { price0050: 100, priceZ2: 2.5 },
    });
    getValidatedLatestReport.mockRejectedValue(new Error("報表過期"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/simulate",
      body: { price0050: 100, priceZ2: 2.5 },
    });

    expect(res.statusCode).toBe(500);
  });
});
