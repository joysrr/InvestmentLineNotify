import { describe, expect, it } from "vitest";
import { IlnState } from "../../domain/ilnState.mjs";

describe("IlnState.toReportObject", () => {
  it("preserves raw institutional and stock margin slots", () => {
    const state = new IlnState({
      marketState: {},
      macroData: {
        rawInstitutional: { symbol: "0050", totalNetBuy: 28074345 },
        rawStockMargin: { symbol: "00675L", marginBalance: 12345 },
      },
      signals: {},
      strategySnapshot: {},
      ai: {},
      reportDate: "2026-08-17",
    });

    expect(state.toReportObject().macroData).toEqual({
      rawInstitutional: { symbol: "0050", totalNetBuy: 28074345 },
      rawStockMargin: { symbol: "00675L", marginBalance: 12345 },
    });
  });
});
