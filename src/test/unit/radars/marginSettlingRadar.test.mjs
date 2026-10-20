import { describe, it, expect } from "vitest";
import { evaluateMarginSettlingRadar } from "../../../modules/strategy/radars/marginSettlingRadar.mjs";
import { RADAR_IDS } from "../../../modules/strategy/radars/types.mjs";

describe("Radar 2: Margin Settling Radar (evaluateMarginSettlingRadar)", () => {
  // 生成 250 天歷史維持率序列 (常態區間 155% ~ 170%)
  const generateMarginHistory = (count = 250, base = 162) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const v = base + Math.sin(i * 0.1) * 6; // 156 ~ 168
      list.push(Number(v.toFixed(1)));
    }
    return list;
  };

  const mockMarginHistory = generateMarginHistory(250);

  it("TC-01: 常態高維持率時保持靜默 (IDLE, 未觸發)", () => {
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 165.2, // 165.2%
      marginBalanceChangePct: -0.005, // -0.5% (微幅減少)
      marginHistory: mockMarginHistory,
    });

    expect(result.radarId).toBe(RADAR_IDS.MARGIN_SETTLING);
    expect(result.triggered).toBe(false);
    expect(result.constraints.allowLeft0050).toBe(false);
    expect(result.constraints.freeze00675L).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toBeNull();
  });

  it("TC-02: 僅維持率低但無出清速度時不觸發 (雙條件防假訊號)", () => {
    // 維持率跌至 138% (< 140%)，但融資僅小減 -0.8% (出清尚未加速)
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 138.0,
      marginBalanceChangePct: -0.008, // -0.8% > -1.5%
      marginHistory: mockMarginHistory,
    });

    expect(result.triggered).toBe(false);
    expect(result.constraints.allowLeft0050).toBe(false);
    expect(result.cardSummary).toBeNull();
  });

  it("TC-03: 僅出清速度快但維持率仍高時不觸發 (雙條件防假訊號)", () => {
    // 融資單日大減 -2.0% (<-1.5%)，但維持率在 162% (高檔調節非斷頭出清)
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 162.0,
      marginBalanceChangePct: -0.02, // -2.0%
      marginHistory: mockMarginHistory,
    });

    expect(result.triggered).toBe(false);
    expect(result.constraints.allowLeft0050).toBe(false);
  });

  it("TC-04: 雙條件同時滿足 (維持率 < 140% 且 融資減幅 <= -1.5% 觸發)", () => {
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 136.5, // 斷頭邊緣
      marginBalanceChangePct: -0.018, // -1.8% 恐慌殺出
      marginHistory: mockMarginHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true); // 允許 0050 左側定錨低接
    expect(result.constraints.freeze00675L).toBe(true); // 00675L 凍結
    expect(result.constraints.pauseP1).toBe(false); // P1 預備金允許用於 0050
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("籌碼沉澱偵測器");
    expect(result.cardSummary).toContain("136.5%");
    expect(result.cardSummary).toContain("0050 啟動分批低接");
    expect(result.cardSummary).toContain("00675L 凍結");
  });

  it("TC-05: 相對分位數觸發 (維持率跌破 P10 且 出清速度滿足)", () => {
    // 假設一段歷史較高的維持率 (P10 約 148%)
    const highMarginHistory = generateMarginHistory(250, 155);
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 142.0, // 雖高於絕對 140%，但低於近 250 日之 P10
      marginBalanceChangePct: -0.016, // -1.6% <= -1.5%
      marginHistory: highMarginHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
    expect(result.constraints.freeze00675L).toBe(true);
  });

  it("TC-06: 歷史數據為空時安全降級 (依賴絕對門檻 140% 與 -1.5%)", () => {
    const result = evaluateMarginSettlingRadar({
      maintenanceRatio: 138.5,
      marginBalanceChangePct: -0.019,
      marginHistory: [],
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
  });
});
