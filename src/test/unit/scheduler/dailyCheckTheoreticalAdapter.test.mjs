/**
 * dailyCheckTheoreticalAdapter 單元測試
 * 測試 theoreticalShadow 建構邏輯與錯誤處理
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../../../src/modules/strategy/theoreticalEngine.mjs", () => ({
  calculateGrossExposure: vi.fn(),
  calculateCurrentLeverage: vi.fn(),
  calculateEstimatedMaintenance: vi.fn(),
  calculateHumanCapital: vi.fn(),
  calculateTrueExposure: vi.fn(),
  calculateCrashTolerance: vi.fn(),
  calculateKellyLimits: vi.fn(),
  calculateLaplaceCriterion: vi.fn(),
  calculateTobinSeparation: vi.fn(),
}));

vi.mock("../../../../src/utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("dailyCheckTheoreticalAdapter.buildTheoreticalShadowForReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("portfolioSnapshot UNAVAILABLE 時應返回 UNAVAILABLE theoreticalShadow", async () => {
    // Arrange
    const { buildTheoreticalShadowForReport } =
      await import("../../../../src/scheduler/dailyCheckTheoreticalAdapter.mjs");

    const input = {
      dateText: "2026-11-01",
      portfolio: { totalValue: 1000000 },
      portfolioSnapshot: {
        status: "UNAVAILABLE",
        reason: "MISSING_PORTFOLIO",
      },
      price0050Snapshot: { price: 180, asOf: "2026-11-01" },
      priceZ2Snapshot: { price: 280, asOf: "2026-11-01" },
    };

    // Act
    const result = await buildTheoreticalShadowForReport(input);

    // Assert
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBe("PORTFOLIO_SNAPSHOT_UNAVAILABLE");
  });

  it("價格快照缺失時應返回 UNAVAILABLE theoreticalShadow", async () => {
    // Arrange
    const { buildTheoreticalShadowForReport } =
      await import("../../../../src/scheduler/dailyCheckTheoreticalAdapter.mjs");

    const input = {
      dateText: "2026-11-01",
      portfolio: { totalValue: 1000000, cash: 500000 },
      portfolioSnapshot: {
        status: "available",
        totalValue: 1000000,
        cash: 500000,
        accountNetAsset: 900000,
        collateralValue: 1200000,
        source: "test",
        asOf: "2026-11-01",
      },
      price0050Snapshot: null, // 缺失
      priceZ2Snapshot: { price: 280, asOf: "2026-11-01" },
    };

    // Act
    const result = await buildTheoreticalShadowForReport(input);

    // Assert
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toContain("PRICE_SNAPSHOT");
  });

  it("計算函數全部成功時應返回 AVAILABLE theoreticalShadow", async () => {
    // Arrange
    const theoreticalEngine =
      await import("../../../../src/modules/strategy/theoreticalEngine.mjs");

    // Mock 所有計算函數返回成功（使用正確的返回格式）
    vi.mocked(theoreticalEngine.calculateGrossExposure).mockReturnValue({
      status: "OK",
      grossExposure: 1800000,
    });
    vi.mocked(theoreticalEngine.calculateCurrentLeverage).mockReturnValue({
      status: "OK",
      currentLeverage: 2.0,
    });
    vi.mocked(theoreticalEngine.calculateEstimatedMaintenance).mockReturnValue({
      status: "OK",
      maintenanceRatio: 1.5,
      estimatedMaintenance: "NO_DEBT",
    });
    vi.mocked(theoreticalEngine.calculateHumanCapital).mockReturnValue({
      status: "OK",
      humanCapital: 5000000,
      presentValue: 5000000,
    });
    vi.mocked(theoreticalEngine.calculateTrueExposure).mockReturnValue({
      status: "OK",
      trueExposure: 0.36,
    });
    vi.mocked(theoreticalEngine.calculateCrashTolerance).mockReturnValue({
      status: "ESTIMATED",
      crashTolerance: 0.4,
    });
    vi.mocked(theoreticalEngine.calculateKellyLimits).mockReturnValue({
      status: "OK",
      halfKelly: 0.5,
      kellyMax: 1.0,
    });
    vi.mocked(theoreticalEngine.calculateLaplaceCriterion).mockReturnValue({
      status: "OK",
      minimaxLoss: -50000,
      worstScenario: "CRASH",
    });
    vi.mocked(theoreticalEngine.calculateTobinSeparation).mockReturnValue({
      status: "OK",
      riskyRatio: 0.7,
      riskFreeRatio: 0.3,
    });

    const { buildTheoreticalShadowForReport } =
      await import("../../../../src/scheduler/dailyCheckTheoreticalAdapter.mjs");

    const input = {
      dateText: "2026-11-01",
      portfolio: {
        totalValue: 1000000,
        cash: 500000,
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 100000,
      },
      portfolioSnapshot: {
        status: "available",
        totalValue: 1000000,
        cash: 500000,
        accountNetAsset: 900000,
        collateralValue: 1200000,
        grossExposure: 1800000,
        source: "test",
        asOf: "2026-11-01",
      },
      price0050Snapshot: { price: 180, asOf: "2026-11-01" },
      priceZ2Snapshot: { price: 280, asOf: "2026-11-01" },
    };

    // Act
    const result = await buildTheoreticalShadowForReport(input);

    // Assert
    expect(result.status).toBe("AVAILABLE");
    expect(result.theory).toBeDefined();
    expect(result.theory.humanCapital).toBe(5000000);
    expect(result.theory.trueExposure).toBe(0.36);
    expect(result.theory.crashTolerance.maxDrawdownTolerance).toBe(0.4);
    expect(result.theory.kellyLimits.conservative).toBe(0.5);
    expect(result.theory.laplaceCriterion.minimaxLoss).toBe(-50000);
    expect(result.theory.tobinSeparation).toBeNull(); // ⚠️ 已停用：不追蹤 00740B
  });

  it("humanCapital 計算失敗時該欄位應為 null 但整體仍 AVAILABLE", async () => {
    // Arrange
    const theoreticalEngine =
      await import("../../../../src/modules/strategy/theoreticalEngine.mjs");

    vi.mocked(theoreticalEngine.calculateGrossExposure).mockReturnValue({
      status: "OK",
      grossExposure: 1800000,
    });
    vi.mocked(theoreticalEngine.calculateCurrentLeverage).mockReturnValue({
      status: "OK",
      leverage: 2.0,
    });
    vi.mocked(theoreticalEngine.calculateEstimatedMaintenance).mockReturnValue({
      status: "OK",
      maintenance: 1.5,
    });
    // humanCapital 失敗
    vi.mocked(theoreticalEngine.calculateHumanCapital).mockReturnValue({
      status: "UNAVAILABLE",
      reason: "MISSING_CASH_FLOWS",
    });
    // trueExposure 依賴 humanCapital，也會失敗
    vi.mocked(theoreticalEngine.calculateTrueExposure).mockReturnValue(null);

    const { buildTheoreticalShadowForReport } =
      await import("../../../../src/scheduler/dailyCheckTheoreticalAdapter.mjs");

    const input = {
      dateText: "2026-11-01",
      portfolio: {
        totalValue: 1000000,
        cash: 500000,
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 100000,
      },
      portfolioSnapshot: {
        status: "available",
        totalValue: 1000000,
        cash: 500000,
        accountNetAsset: 900000,
        collateralValue: 1200000,
        source: "test",
        asOf: "2026-11-01",
      },
      price0050Snapshot: { price: 180, asOf: "2026-11-01" },
      priceZ2Snapshot: { price: 280, asOf: "2026-11-01" },
    };

    // Act
    const result = await buildTheoreticalShadowForReport(input);

    // Assert
    expect(result.status).toBe("AVAILABLE");
    expect(result.theory.humanCapital).toBeNull();
    expect(result.theory.trueExposure).toBeNull();
  });

  it("Laplace 和 Tobin 計算失敗時對應欄位應為 null", async () => {
    // Arrange
    const theoreticalEngine =
      await import("../../../../src/modules/strategy/theoreticalEngine.mjs");

    // 核心計算成功
    vi.mocked(theoreticalEngine.calculateGrossExposure).mockReturnValue({
      status: "OK",
      grossExposure: 1800000,
    });
    vi.mocked(theoreticalEngine.calculateCurrentLeverage).mockReturnValue({
      status: "OK",
      currentLeverage: 2.0,
    });
    vi.mocked(theoreticalEngine.calculateEstimatedMaintenance).mockReturnValue({
      status: "OK",
      maintenanceRatio: 1.5,
    });
    vi.mocked(theoreticalEngine.calculateHumanCapital).mockReturnValue({
      status: "OK",
      humanCapital: 5000000,
    });
    vi.mocked(theoreticalEngine.calculateTrueExposure).mockReturnValue({
      status: "OK",
      trueExposure: 0.36,
    });
    vi.mocked(theoreticalEngine.calculateCrashTolerance).mockReturnValue({
      status: "ESTIMATED",
      crashTolerance: 0.4,
    });
    vi.mocked(theoreticalEngine.calculateKellyLimits).mockReturnValue({
      status: "OK",
      halfKelly: 0.5,
      kellyMax: 1.0,
    });
    // Laplace 失敗
    vi.mocked(theoreticalEngine.calculateLaplaceCriterion).mockReturnValue({
      status: "UNAVAILABLE",
      reason: "MISSING_SCENARIOS",
      minimaxLoss: null,
    });
    // Tobin 失敗
    vi.mocked(theoreticalEngine.calculateTobinSeparation).mockReturnValue({
      status: "UNAVAILABLE",
      reason: "MISSING_BOND_DATA",
      riskyRatio: null,
    });

    const { buildTheoreticalShadowForReport } =
      await import("../../../../src/scheduler/dailyCheckTheoreticalAdapter.mjs");

    const input = {
      dateText: "2026-11-01",
      portfolio: {
        totalValue: 1000000,
        cash: 500000,
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 100000,
      },
      portfolioSnapshot: {
        status: "available",
        totalValue: 1000000,
        cash: 500000,
        accountNetAsset: 900000,
        collateralValue: 1200000,
        source: "test",
        asOf: "2026-11-01",
      },
      price0050Snapshot: { price: 180, asOf: "2026-11-01" },
      priceZ2Snapshot: { price: 280, asOf: "2026-11-01" },
    };

    // Act
    const result = await buildTheoreticalShadowForReport(input);

    // Assert
    expect(result.status).toBe("AVAILABLE");
    expect(result.theory.humanCapital).toBe(5000000);
    expect(result.theory.trueExposure).toBe(0.36);
    // Laplace 和 Tobin 失敗時，對應欄位應為 null
    expect(result.theory.laplaceCriterion).toBeNull();
    expect(result.theory.tobinSeparation).toBeNull();
  });
});
