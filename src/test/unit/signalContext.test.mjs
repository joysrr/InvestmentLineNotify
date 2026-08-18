import { describe, expect, it } from "vitest";
import { buildSignalContext } from "../../domain/signalContext.mjs";

function makeHistory() {
  return Array.from({ length: 80 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1000,
  }));
}

describe("buildSignalContext raw market slots", () => {
  it("passes raw slots needed by market normalization", () => {
    const result = buildSignalContext({
      historyZ2: makeHistory(),
      history0050: makeHistory(),
      currentPriceZ2: 313.9,
      price0050: 106.45,
      basePrice: 184.9,
      vixData: { value: 29.07 },
      vixArr: [29.07],
      macroData: {
        rawValuation: { pb: 4.17, currentPR: 82.5 },
        rawMargin: { maintenanceRatio: 194.15 },
        rawFx: { currentRate: 31.882 },
        rawInstitutional: { totalNetBuy: 28074345 },
        rawCnn: { score: 64.97 },
      },
      macroMarketDirection: "NEUTRAL",
      valuationGuardState: {},
      pbRecords: [],
      pbRecordsObjects: [],
      usRisk: {},
      lastState: { qtyZ2: 250, qty0050: 13195, totalLoan: 0, cash: 190315 },
    });

    expect(result.signalData).toMatchObject({
      rawValuation: { pb: 4.17, currentPR: 82.5 },
      rawMargin: { maintenanceRatio: 194.15 },
      rawFx: { currentRate: 31.882 },
      rawInstitutional: { totalNetBuy: 28074345 },
      rawCnn: { score: 64.97 },
    });
  });

  it("bridges market history into scoring inputs without including today", () => {
    const result = buildSignalContext({
      historyZ2: makeHistory(),
      history0050: makeHistory(),
      currentPriceZ2: 313.9,
      price0050: 106.45,
      basePrice: 184.9,
      vixData: { value: 29.07 },
      vixArr: [29.07],
      macroData: {
        rawInstitutional: { date: "20260814", totalNetBuy: 28074345 },
      },
      marketHistory: [
        {
          date: "2026-08-13",
          data: {
            rawInstitutional: { date: "20260812", totalNetBuy: -1000000 },
          },
        },
        {
          date: "2026-08-14",
          data: {
            rawInstitutional: { date: "20260813", totalNetBuy: 5000000 },
          },
        },
      ],
      macroMarketDirection: "NEUTRAL",
      valuationGuardState: {},
      pbRecords: [],
      pbRecordsObjects: [],
      usRisk: {},
      lastState: {},
    });

    expect(result.signalData.institutionalNet).toBeCloseTo(28.074345, 6);
    expect(result.signalData.institutionalHistory).toEqual([-1, 5]);
  });

  it("records history freshness metadata for reproducibility", () => {
    const result = buildSignalContext({
      historyZ2: makeHistory(),
      history0050: makeHistory(),
      currentPriceZ2: 313.9,
      price0050: 106.45,
      basePrice: 184.9,
      vixData: { value: 29.07 },
      vixArr: [29.07],
      macroData: {},
      macroMarketDirection: "NEUTRAL",
      valuationGuardState: {},
      pbRecords: [],
      pbRecordsObjects: [],
      usRisk: {},
      lastState: {},
    });

    expect(result.signalData.historyMetadata).toEqual({
      z2: { count: 80, latestDate: "2026-03-21" },
      etf0050: { count: 80, latestDate: "2026-03-21" },
    });
  });
});
