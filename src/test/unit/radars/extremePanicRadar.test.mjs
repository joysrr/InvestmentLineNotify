import { describe, it, expect } from "vitest";
import {
  evaluateExtremePanicRadar,
  evaluateTripleGate,
} from "../../../modules/strategy/radars/extremePanicRadar.mjs";
import { RADAR_IDS } from "../../../modules/strategy/radars/types.mjs";

describe("Radar 3: Extreme Panic Radar (evaluateExtremePanicRadar)", () => {
  // 生成 250 天歷史 VIX 序列 (常態區間 14 ~ 22)
  const generateVixHistory = (count = 250, base = 18) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const v = base + Math.sin(i * 0.2) * 4;
      list.push(Number(v.toFixed(1)));
    }
    return list;
  };

  const mockVixHistory = generateVixHistory(250);

  it("TC-01: 常態波動時保持靜默 (IDLE, 未觸發)", () => {
    const result = evaluateExtremePanicRadar({
      vix: 19.5,
      taiexReturn: -0.012, // -1.2%
      bias60: -0.035, // -3.5%
      vixHistory: mockVixHistory,
    });

    expect(result.radarId).toBe(RADAR_IDS.EXTREME_PANIC);
    expect(result.triggered).toBe(false);
    expect(result.constraints.allowLeft0050).toBe(false);
    expect(result.constraints.freeze00675L).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toBeNull();
  });

  it("TC-02: VIX 飆升至 38 突破 35 門檻 (觸發極度恐慌) — 無借款模式", () => {
    const result = evaluateExtremePanicRadar({
      vix: 38.0,
      taiexReturn: -0.03,
      bias60: -0.08,
      vixHistory: mockVixHistory,
      totalDebt: 0, // 無借款 → OPPORTUNITY
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true); // 啟動 0050 左側低接
    expect(result.constraints.freeze00675L).toBe(false); // Debt-aware: 無借款 → 限速加碼
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.cardSummary).toContain("極度恐慌雷達");
    expect(result.cardSummary).toContain("38.0");
    expect(result.cardSummary).toContain("0050 左側分批布局啟動");
    expect(result.cardSummary).toContain("00675L 限速加碼"); // Debt-aware 文案
  });

  it("TC-03: 大盤單日崩跌 <= -4.5% (歷史級單日重挫觸發) — 無借款模式", () => {
    const result = evaluateExtremePanicRadar({
      vix: 28.0,
      taiexReturn: -0.06, // -6%
      bias60: -0.05,
      vixHistory: mockVixHistory,
      totalDebt: 0, // 無借款 → OPPORTUNITY
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
    expect(result.constraints.freeze00675L).toBe(false); // Debt-aware: 無借款 → 限速加碼
  });

  it("TC-04: 季線負乖離率 <= -12% (深跌超賣觸發) — 無借款模式", () => {
    const result = evaluateExtremePanicRadar({
      vix: 27.5,
      taiexReturn: -0.02,
      bias60: -0.135, // -13.5%
      vixHistory: mockVixHistory,
      totalDebt: 0, // 無借款 → OPPORTUNITY
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
    expect(result.constraints.freeze00675L).toBe(false); // Debt-aware: 無借款 → 限速加碼
  });

  it("TC-05: 有借款時觸發 — DEFENSE 模式凍結 00675L", () => {
    const result = evaluateExtremePanicRadar({
      vix: 38.0,
      taiexReturn: -0.06,
      bias60: -0.135,
      vixHistory: mockVixHistory,
      totalDebt: 500000, // 有借款 → DEFENSE
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
    expect(result.constraints.freeze00675L).toBe(true); // Debt-aware: 有借款 → 嚴格凍結
    expect(result.cardSummary).toContain("00675L 嚴格凍結");
  });

  it("TC-05: 缺歷史數據時安全降級 (依賴絕對 35、-4.5%、-12% 門檻)", () => {
    const result = evaluateExtremePanicRadar({
      vix: 36.2,
      taiexReturn: -0.02,
      bias60: -0.05,
      vixHistory: [],
    });

    expect(result.triggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);
  });

  describe("Triple-Gate 00675L 右側解鎖評估 (evaluateTripleGate)", () => {
    it("三燈未全亮時保持鎖定", () => {
      // 情況 A：VIX 仍高於 28
      const gateA = evaluateTripleGate({
        currentVix: 30.0,
        peakVix: 45.0,
        taiexClose: 22000,
        taiexSma5: 21800,
      });
      expect(gateA.unlocked).toBe(false);
      expect(gateA.gate1_vixBelow28).toBe(false);
      expect(gateA.gate2_vixDrop20Pct).toBe(true); // 30 <= 45 * 0.8 (36)
      expect(gateA.gate3_closeAboveSma5).toBe(true);

      // 情況 B：大盤未站上 5MA
      const gateB = evaluateTripleGate({
        currentVix: 24.0,
        peakVix: 40.0,
        taiexClose: 21000,
        taiexSma5: 21500, // Close < SMA5
      });
      expect(gateB.unlocked).toBe(false);
      expect(gateB.gate3_closeAboveSma5).toBe(false);
    });

    it("三燈全亮時解鎖 00675L 右側加碼", () => {
      const gate = evaluateTripleGate({
        currentVix: 24.5, // <= 28 (Pass)
        peakVix: 38.0, // 24.5 <= 38.0 * 0.8 = 30.4 (Pass: 自峰值回落 >= 20%)
        taiexClose: 22200,
        taiexSma5: 22000, // 22200 >= 22000 (Pass: 站上 5MA)
      });

      expect(gate.unlocked).toBe(true);
      expect(gate.gate1_vixBelow28).toBe(true);
      expect(gate.gate2_vixDrop20Pct).toBe(true);
      expect(gate.gate3_closeAboveSma5).toBe(true);
      expect(gate.summary).toContain("三綠燈全亮");
    });
  });
});
