import { describe, expect, it } from "vitest";
import { buildDataEvidenceReport } from "../../../modules/verification/dataEvidenceReport.mjs";

describe("data evidence report", () => {
  it("builds externally verifiable evidence for a persisted market metric", () => {
    const report = buildDataEvidenceReport({
      generatedAt: "2026-10-21T13:00:00.000Z",
      market: {
        _meta: {
          lastRun: "2026-10-21T12:19:54.469Z",
          sources: {
            twMarketValuation: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
              provider: "twMarketValuation",
              dataset: "rawValuation",
              rawHash: "sha256:example",
              integrity: "verified",
            },
          },
        },
        data: {
          rawValuation: {
            pb: 4.05,
            date: "20261020",
          },
        },
      },
    });

    expect(report.schemaVersion).toBe("1.0");
    expect(report.generatedAt).toBe("2026-10-21T13:00:00.000Z");
    expect(report.instructions.length).toBeGreaterThan(0);
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.rawValuation.pb",
          value: 4.05,
          source: expect.objectContaining({
            provider: "twMarketValuation",
            status: "SUCCESS",
            lastFetch: "2026-10-21T12:19:54.469Z",
          }),
          temporal: expect.objectContaining({
            dataDate: "20261020",
            freshnessBasis: expect.any(String),
          }),
          verification: expect.objectContaining({
            background: expect.any(String),
            checks: expect.arrayContaining([expect.any(String)]),
          }),
        }),
      ]),
    );
  });

  it("includes persisted market, history, and sentiment evidence with temporal context", () => {
    const report = buildDataEvidenceReport({
      generatedAt: "2026-10-21T13:00:00.000Z",
      market: {
        _meta: {
          lastRun: "2026-10-21T12:19:54.469Z",
          sources: {
            cnnFearGreed: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
            },
            twMarketOverview: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
            },
          },
        },
        data: {
          rawCnn: { score: 29.03, timestamp: "2026-10-21T11:59:42.000Z" },
          rawMarketOverview: { taiex: 46292.93, date: "1151020" },
        },
      },
      pbHistory: [{ date: "20261020", pb: 4.05 }],
      vixHistory: [{ date: "2026-10-21", value: 28.09 }],
      sentiment: {
        date: "2026-10-21",
        updatedAt: "2026-10-21T04:00:42.402Z",
        score: 39,
        ma3: 33.7,
        ma7: 34.6,
        sampleCount: 122,
        pttItems: 20,
        bskyItems: 102,
      },
    });

    expect(report.items.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "data.rawCnn.score",
        "data.rawMarketOverview.taiex",
        "data.pbHistory.latest.pb",
        "data.vixHistory.latest.value",
        "data.sentiment.social_sentiment_daily.score",
      ]),
    );
    const cnn = report.items.find((item) => item.field === "data.rawCnn.score");
    expect(cnn.temporal.dataDate).toBe("2026-10-21T11:59:42.000Z");
    expect(cnn.verification.externalAgentStatus).toBe(
      "PENDING_EXTERNAL_VERIFICATION",
    );
  });

  it("includes theoreticalShadow evidence (Kelly, mu/sigma, regime, leverage) when daily report is present", () => {
    const report = buildDataEvidenceReport({
      generatedAt: "2026-10-27T13:00:00.000Z",
      latestReport: {
        date: "2026-10-27",
        theoreticalShadow: {
          status: "AVAILABLE",
          asOf: "2026-10-27T06:30:00.000Z",
          marketRegime: {
            regime: "BULL",
            mu: 0.342376,
            sigma: 0.309606,
            sampleDays: 125,
          },
          kellyLimits: {
            conservative: 1.6033,
            full: 3.2066,
          },
          theory: {
            currentLeverage: 0.8718,
            accountNetAsset: 2113682.6,
            grossExposure: 1842687.6,
          },
        },
      },
    });

    const fields = report.items.map((item) => item.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "theoreticalShadow.kellyLimits.conservative",
        "theoreticalShadow.kellyLimits.full",
        "theoreticalShadow.marketRegime.mu",
        "theoreticalShadow.marketRegime.sigma",
        "theoreticalShadow.marketRegime.regime",
        "theoreticalShadow.theory.currentLeverage",
      ]),
    );

    const halfKelly = report.items.find(
      (item) => item.field === "theoreticalShadow.kellyLimits.conservative",
    );
    expect(halfKelly.value).toBe(1.6033);
    expect(halfKelly.unit).toBe("倍");
    expect(halfKelly.source.provider).toBe("theoreticalEngine");
    expect(halfKelly.temporal.dataDate).toBe("2026-10-27");
    expect(halfKelly.verification.checks.length).toBeGreaterThan(0);
    expect(halfKelly.verification.calculation).toContain("凱莉");
  });
});

// ============================================================
// 新增測試：Portfolio 和 Strategy 欄位覆蓋度
// ============================================================

test("buildDataEvidenceReport should include portfolio fields when latestReport provided", () => {
  const mockLatestReport = {
    date: "2026-11-01",
    portfolio: {
      totalValue: 1200000,
      qty0050: 12000,
      qtyZ2: 6000,
      cash: 80000,
      totalLoan: 900000,
      lastBuyDate: "2026-07-15",
    },
    signals: {
      netAsset: 1050000,
      actualLeverage: 1.75,
      grossLeverage: 2.05,
    },
  };

  const report = buildDataEvidenceReport({
    market: { data: {} },
    pbHistory: [],
    vixHistory: [],
    sentiment: null,
    latestReport: mockLatestReport,
  });

  // 應該包含 portfolio 相關欄位
  const portfolioItems = report.items.filter((item) =>
    item.field.startsWith("portfolio."),
  );

  expect(portfolioItems.length).toBeGreaterThanOrEqual(8);

  // 檢查關鍵欄位
  const fields = portfolioItems.map((i) => i.field);
  expect(fields).toContain("portfolio.totalValue");
  expect(fields).toContain("portfolio.netAsset");
  expect(fields).toContain("portfolio.actualLeverage");
  expect(fields).toContain("portfolio.totalLoan");
});

test("buildDataEvidenceReport should include strategy/signals fields", () => {
  const mockLatestReport = {
    date: "2026-11-01",
    signals: {
      suggestion: "維持觀望",
      signalDirection: "long",
      score: 62,
      weightScore: 62,
      signalCategory: "baseline",
      target: "🔹 0050 DCA",
      status: "🌱",
      regimeResult: { state: "NORMAL", leverageMultiplier: 1 },
      budgetInfo: {
        dailyAvailable: 50000,
        tacticalPool: 48500,
      },
    },
  };

  const report = buildDataEvidenceReport({
    market: { data: {} },
    pbHistory: [],
    vixHistory: [],
    sentiment: null,
    latestReport: mockLatestReport,
  });

  // 應該包含 strategy 相關欄位
  const strategyItems = report.items.filter((item) =>
    item.field.startsWith("strategy."),
  );

  expect(strategyItems.length).toBeGreaterThanOrEqual(10);

  // 檢查關鍵欄位
  const fields = strategyItems.map((i) => i.field);
  expect(fields).toContain("strategy.suggestion");
  expect(fields).toContain("strategy.score");
  expect(fields).toContain("strategy.signalDirection");
  expect(fields).toContain("strategy.signalCategory");
});

test("buildDataEvidenceReport should include theoretical fields when present", () => {
  const mockLatestReport = {
    date: "2026-11-01",
    theoreticalShadow: {
      theory: {
        kellyCriterion: {
          optimalLeverage: 0.65,
          recommendation: "可加碼",
        },
        crashTolerance: {
          safetyMargin: 0.3,
          maxDrawdown: 0.45,
        },
        marketRegime: {
          state: "BULL",
          confidence: 0.85,
        },
      },
    },
  };

  const report = buildDataEvidenceReport({
    market: { data: {} },
    pbHistory: [],
    vixHistory: [],
    sentiment: null,
    latestReport: mockLatestReport,
  });

  // 應該包含 theoretical 相關欄位
  const theoreticalItems = report.items.filter((item) =>
    item.field.startsWith("theoretical."),
  );

  expect(theoreticalItems.length).toBeGreaterThanOrEqual(5);

  // 檢查關鍵欄位
  const fields = theoreticalItems.map((i) => i.field);
  expect(fields).toContain("theoretical.kellyCriterion.optimalLeverage");
  expect(fields).toContain("theoretical.crashTolerance.safetyMargin");
});

test("portfolio and strategy items should have complete verification metadata", () => {
  const mockLatestReport = {
    date: "2026-11-01",
    portfolio: { totalValue: 1200000, netAsset: 1050000 },
    signals: { suggestion: "BUY", score: 70 },
  };

  const report = buildDataEvidenceReport({
    market: { data: {} },
    pbHistory: [],
    vixHistory: [],
    sentiment: null,
    latestReport: mockLatestReport,
  });

  const newItems = report.items.filter(
    (item) =>
      item.field.startsWith("portfolio.") || item.field.startsWith("strategy."),
  );

  newItems.forEach((item) => {
    // 每個欄位都應該有完整的 verification
    expect(item.verification).toBeDefined();
    expect(item.verification.background).toBeTruthy();
    expect(item.verification.background.length).toBeGreaterThan(20);
    expect(item.verification.checks).toBeInstanceOf(Array);
    expect(item.verification.checks.length).toBeGreaterThan(0);
    expect(item.verification.calculation).toBeTruthy();

    // 每個欄位都應該有 source
    expect(item.source).toBeDefined();
    expect(item.source.provider).toBe("InvestmentLineNotify");
    expect(item.source.dataset).toBe("dailyReport");

    // 每個欄位都應該有 temporal
    expect(item.temporal).toBeDefined();
    expect(item.temporal.dataDate).toBe("2026-11-01");
  });
});
