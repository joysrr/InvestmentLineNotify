import { describe, expect, it } from "vitest";
import { buildSignalContext } from "../../domain/signalContext.mjs";

describe("signalContext - TAIEX bias60", () => {
  it("使用台股大盤歷史收盤價計算 bias60", () => {
    const history = Array.from({ length: 60 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      high: 101,
      low: 99,
      close: 100,
    }));
    const taiexHistory = Array.from({ length: 60 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      close: index === 59 ? 110 : 100,
    }));

    const { signalData } = buildSignalContext({
      historyZ2: history,
      history0050: history,
      taiexHistory: { status: "available", data: taiexHistory, count: 60 },
      currentPriceZ2: 100,
      price0050: 100,
      basePrice: 100,
      vixData: null,
      vixArr: [],
      macroData: {},
      macroMarketDirection: null,
      valuationGuardState: {},
      pbRecords: [],
      pbRecordsObjects: [],
      usRisk: {},
      marketHistory: [],
      lastState: {},
    });

    const expected = (110 - 100.16666666666667) / 100.16666666666667;
    expect(signalData.bias60).toBeCloseTo(expected);
    expect(signalData.bias60DataStatus).toBe("VERIFIED");
  });

  it("沒有足夠大盤資料時保留 null", () => {
    const { signalData } = buildSignalContext({
      historyZ2: [],
      history0050: [],
      taiexHistory: { status: "insufficient_history", data: [], count: 0 },
      macroData: {},
      vixArr: [],
      valuationGuardState: {},
      pbRecords: [],
      pbRecordsObjects: [],
      usRisk: {},
      marketHistory: [],
      lastState: {},
    });

    expect(signalData.bias60).toBeNull();
    expect(signalData.bias60DataStatus).toBe("INSUFFICIENT_HISTORY");
  });
});
