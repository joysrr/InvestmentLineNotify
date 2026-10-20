import { describe, it, expect } from "vitest";
import { evaluateOvernightShockRadar } from "../../../modules/strategy/radars/overnightShockRadar.mjs";
import {
  RADAR_IDS,
  NIGHT_SESSION_SEVERITY,
} from "../../../modules/strategy/radars/types.mjs";

describe("Radar 1: Overnight Shock Radar (evaluateOvernightShockRadar)", () => {
  // 生成測試用 250 天歷史收益率 (常態隨機分佈模擬)
  const generateHistory = (count = 250, mean = 0, std = 0.015) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      // 均勻分佈轉近似常態
      const u = Math.sin(i * 999) * std + mean;
      list.push(Number(u.toFixed(4)));
    }
    return list;
  };

  const mockSoxHistory = generateHistory(250, 0.0005, 0.018); // 標準差約 1.8%
  const mockTsmHistory = generateHistory(250, 0.0006, 0.019);

  it("TC-01: 常態波動時保持靜默 (IDLE, 未觸發)", () => {
    const result = evaluateOvernightShockRadar({
      rSox: -0.012, // -1.2% (常態)
      rTsm: -0.01, // -1.0%
      rNight: -0.004, // -0.4%
      soxHistory: mockSoxHistory,
      tsmHistory: mockTsmHistory,
    });

    expect(result.radarId).toBe(RADAR_IDS.OVERNIGHT_SHOCK);
    expect(result.triggered).toBe(false);
    expect(result.severity).toBe(NIGHT_SESSION_SEVERITY.NONE);
    expect(result.constraints.freeze00675L).toBe(false);
    expect(result.constraints.pauseP1).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toBeNull();
  });

  it("TC-02: 美股重挫 + 台指夜盤重挫 >= 1.0% (觸發強共振)", () => {
    const result = evaluateOvernightShockRadar({
      rSox: -0.045, // -4.5% (極端離群值, > P95, z-score < -2.0)
      rTsm: -0.042, // -4.2%
      rNight: -0.015, // -1.5% (同向且 >= 1.0%)
      soxHistory: mockSoxHistory,
      tsmHistory: mockTsmHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe(NIGHT_SESSION_SEVERITY.STRONG_RESONANCE);
    expect(result.constraints.freeze00675L).toBe(true);
    expect(result.constraints.pauseP1).toBe(true);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("強共振");
    expect(result.cardSummary).toContain("00675L 禁止買入");
  });

  it("TC-03: 美股重挫 + 台指夜盤普通跌幅 0.5% ~ 1.0% (觸發普通確認)", () => {
    const result = evaluateOvernightShockRadar({
      rSox: -0.04,
      rTsm: -0.038,
      rNight: -0.008, // -0.8% (同向且 0.5% <= |r| < 1.0%)
      soxHistory: mockSoxHistory,
      tsmHistory: mockTsmHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe(NIGHT_SESSION_SEVERITY.NORMAL_CONFIRM);
    expect(result.constraints.freeze00675L).toBe(true);
    expect(result.constraints.pauseP1).toBe(true);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("普通確認");
  });

  it("TC-04: 美股重挫 + 台指夜盤抗跌 < 0.5% 或逆向翻紅 (觸發背離鈍化)", () => {
    const result = evaluateOvernightShockRadar({
      rSox: -0.042,
      rTsm: -0.039,
      rNight: 0.003, // +0.3% (逆向翻紅抗跌)
      soxHistory: mockSoxHistory,
      tsmHistory: mockTsmHistory,
    });

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe(NIGHT_SESSION_SEVERITY.DIVERGENCE_BLUNT);
    expect(result.constraints.freeze00675L).toBe(true);
    expect(result.constraints.pauseP1).toBe(false); // P1 正常加碼！
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("夜盤抗跌背離");
    expect(result.cardSummary).toContain("P1 維持正常");
  });

  it("TC-05: 缺歷史數據時的安全降級處置 (Fallbacks)", () => {
    // 當歷史數據為空陣列時，依賴絕對門檻 (-3.5%) 作為安全兜底
    const result = evaluateOvernightShockRadar({
      rSox: -0.04, // -4.0%
      rTsm: -0.038,
      rNight: -0.012,
      soxHistory: [],
      tsmHistory: [],
    });

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe(NIGHT_SESSION_SEVERITY.STRONG_RESONANCE);
    expect(result.constraints.freeze00675L).toBe(true);
  });
});
