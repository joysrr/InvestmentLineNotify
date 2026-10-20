import { describe, it, expect } from "vitest";
import { evaluateRetailSentimentRadar } from "../../../modules/strategy/radars/retailSentimentRadar.mjs";
import { RADAR_IDS } from "../../../modules/strategy/radars/types.mjs";

describe("Radar 4: Retail Sentiment Radar (evaluateRetailSentimentRadar)", () => {
  // 生成 250 天歷史 RSR 序列 (常態區間 -15% ~ +15%)
  const generateRsrHistory = (count = 250) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const v = Math.sin(i * 0.15) * 12; // -12 ~ +12
      list.push(Number(v.toFixed(1)));
    }
    return list;
  };

  const mockRsrHistory = generateRsrHistory(250);

  it("TC-01: 常態多空比震盪時保持靜默 (IDLE, 未觸發)", () => {
    const result = evaluateRetailSentimentRadar({
      rsr: 8.5, // +8.5%
      rsrHistory: mockRsrHistory,
    });

    expect(result.radarId).toBe(RADAR_IDS.RETAIL_SENTIMENT);
    expect(result.triggered).toBe(false);
    expect(result.subType).toBe("NEUTRAL");
    expect(result.constraints.freeze00675L).toBe(false);
    expect(result.constraints.pauseP1).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toBeNull();
  });

  it("TC-02: 散戶多單嚴重套牢 (RSR >= +30% 觸發多殺多警報)", () => {
    const result = evaluateRetailSentimentRadar({
      rsr: 34.2, // +34.2%
      rsrHistory: mockRsrHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.subType).toBe("LONG_LIQUIDATION");
    expect(result.constraints.freeze00675L).toBe(true); // 嚴禁槓桿進場
    expect(result.constraints.pauseP1).toBe(true); // P1 暫緩
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("多殺多崩跌警報");
    expect(result.cardSummary).toContain("+34.2%");
    expect(result.cardSummary).toContain("00675L 嚴格凍結");
  });

  it("TC-03: 散戶空單被強烈軋空 (RSR <= -30% 觸發軋空強多訊號)", () => {
    const result = evaluateRetailSentimentRadar({
      rsr: -32.5, // -32.5%
      rsrHistory: mockRsrHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.subType).toBe("SHORT_SQUEEZE");
    expect(result.constraints.freeze00675L).toBe(false); // 順勢動能，不凍結
    expect(result.constraints.pauseP1).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("軋空強多訊號");
    expect(result.cardSummary).toContain("-32.5%");
  });

  it("TC-04: F-4 防假陽性雙邊界檢驗 (低波動期 RSR = +15% 即使高於歷史 P90 亦不誤觸)", () => {
    // 假設過去歷史都在 -5% ~ +5% 極窄區間
    const narrowRsrHistory = generateRsrHistory(250).map((v) =>
      Number((v * 0.3).toFixed(1)),
    );
    const result = evaluateRetailSentimentRadar({
      rsr: 14.0, // 雖高於歷史 P90，但未達絕對下限 +20%
      rsrHistory: narrowRsrHistory,
    });

    expect(result.triggered).toBe(false);
    expect(result.subType).toBe("NEUTRAL");
  });

  it("TC-05: F-4 相對分位數達標且滿足絕對門檻 (RSR >= P90 且 RSR >= +20% 觸發)", () => {
    const result = evaluateRetailSentimentRadar({
      rsr: 22.0, // 高於歷史 P90 且 >= +20%
      rsrHistory: mockRsrHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.subType).toBe("LONG_LIQUIDATION");
  });

  it("TC-06: 歷史數據為空時安全降級 (依賴絕對 +/-30% 門檻)", () => {
    const resultCrash = evaluateRetailSentimentRadar({
      rsr: 31.0,
      rsrHistory: [],
    });
    expect(resultCrash.triggered).toBe(true);
    expect(resultCrash.subType).toBe("LONG_LIQUIDATION");

    const resultSqueeze = evaluateRetailSentimentRadar({
      rsr: -31.0,
      rsrHistory: [],
    });
    expect(resultSqueeze.triggered).toBe(true);
    expect(resultSqueeze.subType).toBe("SHORT_SQUEEZE");
  });

  it("TC-07: 提供從小台法人數據直接計算 RSR 的工具函數", () => {
    const { calculateRsrFromTaifex } = evaluateRetailSentimentRadar;
    // 全市場 OI: 100,000 口
    // 三大法人淨多單: 20,000 口 -> 散戶部位 = -20,000 口 (淨空)
    const rsr = calculateRsrFromTaifex({
      totalOi: 100000,
      institutionalNetOi: 20000,
    });
    expect(rsr).toBe(-20.0); // 散戶 -20%
  });
});
