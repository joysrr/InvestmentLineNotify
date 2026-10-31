/**
 * useTheoryData.test.js
 * Unit tests for useTheoryData composable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTheoryData } from "../composables/useTheoryData.js";
import * as api from "../api/index.js";

vi.mock("../api/index.js");

describe("useTheoryData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with null data and not loading", () => {
    const { data, loading, error } = useTheoryData();

    expect(data.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("should fetch and extract theoreticalShadow from latest report", async () => {
    const mockReport = {
      date: "2026-10-25",
      theoreticalShadow: {
        status: "AVAILABLE",
        theory: {
          grossExposure: 1847873.4,
          currentLeverage: 0.87,
        },
        inputs: {
          value0050: { value: 1847873.4 },
        },
      },
      portfolioSnapshot: {
        status: "DERIVED",
        accountNetAsset: 2118868.4,
      },
    };

    vi.mocked(api.fetchReports).mockResolvedValue([mockReport]);

    const { fetch, data, loading, error, isAvailable } = useTheoryData();

    await fetch();

    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(data.value).toEqual({
      date: "2026-10-25",
      theoreticalShadow: mockReport.theoreticalShadow,
      portfolioSnapshot: mockReport.portfolioSnapshot,
      isFromLastTradingDay: false,
      lastTradingDay: null,
    });
    expect(isAvailable.value).toBe(true);
  });

  it("should handle empty reports array", async () => {
    vi.mocked(api.fetchReports).mockResolvedValue([]);

    const { fetch, error, isEmpty } = useTheoryData();

    await fetch();

    expect(error.value).toBe("無報告數據");
    expect(isEmpty.value).toBe(true);
  });

  it("should handle null theoreticalShadow (non-trading day)", async () => {
    const mockReport = {
      date: "2026-10-26",
      theoreticalShadow: null,
      portfolioSnapshot: null,
    };

    vi.mocked(api.fetchReports).mockResolvedValue([mockReport]);

    const { fetch, data, isEmpty, isAvailable } = useTheoryData();

    await fetch();

    expect(data.value).toEqual({
      date: "2026-10-26",
      theoreticalShadow: null,
      portfolioSnapshot: null,
      isFromLastTradingDay: false,
      lastTradingDay: null,
    });
    expect(isEmpty.value).toBe(true);
    expect(isAvailable.value).toBe(false);
  });

  it("should handle UNAVAILABLE status", async () => {
    const mockReport = {
      date: "2026-10-25",
      theoreticalShadow: {
        status: "UNAVAILABLE",
        theory: null,
        inputs: null,
      },
    };

    vi.mocked(api.fetchReports).mockResolvedValue([mockReport]);

    const { fetch, isAvailable, theory, inputs } = useTheoryData();

    await fetch();

    expect(isAvailable.value).toBe(false);
    expect(theory.value).toBeNull();
    expect(inputs.value).toBeNull();
  });

  it("should handle API errors", async () => {
    vi.mocked(api.fetchReports).mockRejectedValue(new Error("Network error"));

    const { fetch, error, isEmpty } = useTheoryData();

    await fetch();

    expect(error.value).toBe("Network error");
    expect(isEmpty.value).toBe(true);
  });

  it("should expose computed properties correctly", async () => {
    const mockReport = {
      date: "2026-10-25",
      theoreticalShadow: {
        status: "AVAILABLE",
        theory: {
          grossExposure: 1847873.4,
          currentLeverage: 0.87,
        },
        inputs: {
          value0050: { value: 1847873.4 },
        },
      },
      portfolioSnapshot: {
        status: "DERIVED",
        accountNetAsset: 2118868.4,
      },
    };

    vi.mocked(api.fetchReports).mockResolvedValue([mockReport]);

    const { fetch, theory, inputs, portfolioSnapshot, reportDate } =
      useTheoryData();

    await fetch();

    expect(theory.value).toEqual({
      grossExposure: 1847873.4,
      currentLeverage: 0.87,
    });
    expect(inputs.value).toEqual({
      value0050: { value: 1847873.4 },
    });
    expect(portfolioSnapshot.value).toEqual({
      status: "DERIVED",
      accountNetAsset: 2118868.4,
    });
    expect(reportDate.value).toBe("2026-10-25");
  });
});
