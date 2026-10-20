import { describe, it, expect } from "vitest";
import * as Radars from "../../../modules/strategy/radars/index.mjs";

describe("Radars Module Entrypoint (index.mjs)", () => {
  it("正確導出所有四大雷達函數與型別常數", () => {
    expect(typeof Radars.evaluateOvernightShockRadar).toBe("function");
    expect(typeof Radars.evaluateMarginSettlingRadar).toBe("function");
    expect(typeof Radars.evaluateExtremePanicRadar).toBe("function");
    expect(typeof Radars.evaluateTripleGate).toBe("function");
    expect(typeof Radars.evaluateRetailSentimentRadar).toBe("function");
    expect(typeof Radars.calculateRsrFromTaifex).toBe("function");
    expect(typeof Radars.createRadarResult).toBe("function");
    expect(Radars.RADAR_IDS).toBeDefined();
    expect(Radars.NIGHT_SESSION_SEVERITY).toBeDefined();
  });
});
