import { describe, it, expect } from "vitest";
import { evaluateLeadingIndicators } from "../../../modules/strategy/leadingIndicatorEvaluator.mjs";
import { SYSTEM_STATES } from "../../../modules/strategy/marginStateMachine.mjs";

describe("Phase 5: Leading Indicator E2E Verification (TC-01 ~ TC-07)", () => {
  const normalPortfolio = {
    totalAssets: 3500000,
    totalLiabilities: 1500000, // 維持率 233.3% >= 160%
    netAssetValue: 2000000,
    currentExposure: 3000000, // 當前 GL = 1.5x
  };

  it("TC-01: 常態市況基準驗證 (四大雷達靜默、狀態保持 IDLE、P0 正常執行)", () => {
    const marketData = {
      rSox: 0.002,
      rTsm: 0.001,
      rNight: 0.001,
      maintenanceRatio: 166.0,
      marginBalanceChangePct: 0.001,
      vix: 15.0,
      taiexReturn: 0.002,
      bias60: 0.01,
      rsr: 5.0,
    };

    const result = evaluateLeadingIndicators({
      marketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.IDLE,
      cooldownDays: 0,
      activeDays: 0,
    });

    expect(result.hasAnyRadarTriggered).toBe(false);
    expect(result.stateMachine.state).toBe(SYSTEM_STATES.IDLE);
    expect(result.constraints.freeze00675L).toBe(false);
    expect(result.constraints.allowLeft0050).toBe(false);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.telegramCard).toBeNull(); // 常態靜默
  });

  it("TC-02: 美股隔夜重挫情境 (2024/08/02 模擬，Radar 1 強共振，凍結 00675L 並暫緩 P1)", () => {
    const marketData = {
      rSox: -0.071, // 費半 -7.1%
      rTsm: -0.046, // 台積電 ADR -4.6%
      rNight: -0.028, // 台指夜盤 -2.8%
      maintenanceRatio: 162.0,
      marginBalanceChangePct: -0.003,
      vix: 22.0,
      taiexReturn: -0.01,
      bias60: -0.03,
      rsr: 8.0,
    };

    const result = evaluateLeadingIndicators({
      marketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.IDLE,
      cooldownDays: 0,
      activeDays: 0,
    });

    expect(result.hasAnyRadarTriggered).toBe(true);
    expect(result.radars.overnightShock.triggered).toBe(true);
    expect(result.radars.overnightShock.subType).toBe("STRONG_RESONANCE");
    expect(result.stateMachine.state).toBe(SYSTEM_STATES.TRIGGERED);
    expect(result.constraints.freeze00675L).toBe(true);
    expect(result.constraints.p0Exempt).toBe(true);
    expect(result.telegramCard).toContain("美股隔夜衝擊");
    expect(result.telegramCard).toContain("00675L 禁止買入");
  });

  it("TC-03: 極端崩跌與籌碼沉澱 (2024/08/05 模擬，啟動 0050 左側第一批加碼並放寬 GL 至 2.7x)", () => {
    const marketData = {
      rSox: -0.01,
      rTsm: -0.01,
      rNight: -0.01,
      maintenanceRatio: 138.0, // < 140%
      marginBalanceChangePct: -0.062, // 融資大減 -6.2%
      vix: 45.0, // >= 35
      taiexReturn: -0.0835, // 跌 -8.35%
      bias60: -0.13, // 乖離 <= -12%
      rsr: 35.0, // 小台散戶多殺多 >= 30%
    };

    const result = evaluateLeadingIndicators({
      marketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.TRIGGERED,
      cooldownDays: 0,
      activeDays: 1,
    });

    // Radar 2, Radar 3, Radar 4 皆觸發
    expect(result.radars.marginSettling.triggered).toBe(true);
    expect(result.radars.extremePanic.triggered).toBe(true);
    expect(result.radars.retailSentiment.triggered).toBe(true);

    // 約束條件
    expect(result.constraints.freeze00675L).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(true);

    expect(result.telegramCard).toContain("籌碼沉澱偵測器");
    expect(result.telegramCard).toContain("0050 啟動左側布局");
  });

  it("TC-04: 個人維持率斷路器 P-1 強制凌駕 (個人維持率 < 160% 封鎖一切加碼)", () => {
    const panicMarketData = {
      rSox: -0.01,
      rTsm: -0.01,
      rNight: -0.01,
      maintenanceRatio: 138.0,
      marginBalanceChangePct: -0.062,
      vix: 45.0,
      taiexReturn: -0.0835,
      bias60: -0.13,
      rsr: 35.0,
    };

    const dangerousPortfolio = {
      totalAssets: 2300000,
      totalLiabilities: 1500000, // 230 / 150 = 153.3% < 160%
      netAssetValue: 800000,
      currentExposure: 2000000,
    };

    const result = evaluateLeadingIndicators({
      marketData: panicMarketData,
      portfolio: dangerousPortfolio,
      currentState: SYSTEM_STATES.TRIGGERED,
      cooldownDays: 0,
      activeDays: 1,
    });

    expect(result.personalBreaker.breakerTriggered).toBe(true);
    expect(result.constraints.allowLeft0050).toBe(false); // 被斷路器完全封鎖！
    expect(result.telegramCard).toContain("🚨【個人維持率斷路器觸發】");
  });

  it("TC-05: 震盪修復 F-1 連續無觸發退回冷卻 (從 CONTINUOUS_SHOCK 轉入 COOLDOWN)", () => {
    const calmMarketData = {
      rSox: 0.005,
      rTsm: 0.002,
      rNight: 0.001,
      maintenanceRatio: 161.0,
      marginBalanceChangePct: 0.001,
      vix: 20.0,
      taiexReturn: 0.005,
      bias60: -0.03,
      rsr: 2.0,
    };

    const result = evaluateLeadingIndicators({
      marketData: calmMarketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.CONTINUOUS_SHOCK,
      cooldownDays: 0,
      activeDays: 3,
    });

    expect(result.hasAnyRadarTriggered).toBe(false);
    expect(result.stateMachine.state).toBe(SYSTEM_STATES.COOLDOWN);
    expect(result.stateMachine.cooldownDays).toBe(1);
    expect(result.constraints.freeze00675L).toBe(false);
  });

  it("TC-06: 冷卻期重挫 F-8 重新激活 (在 COOLDOWN 遇新雷達觸發重置並切回 CONTINUOUS_SHOCK)", () => {
    const reShockMarketData = {
      rSox: -0.055,
      rTsm: -0.048,
      rNight: -0.02,
      maintenanceRatio: 155.0,
      marginBalanceChangePct: -0.004,
      vix: 25.0,
      taiexReturn: -0.015,
      bias60: -0.05,
      rsr: 12.0,
    };

    const result = evaluateLeadingIndicators({
      marketData: reShockMarketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.COOLDOWN,
      cooldownDays: 2,
      activeDays: 5,
    });

    expect(result.hasAnyRadarTriggered).toBe(true);
    expect(result.stateMachine.state).toBe(SYSTEM_STATES.CONTINUOUS_SHOCK);
    expect(result.stateMachine.cooldownDays).toBe(0); // 重置冷卻
    expect(result.constraints.freeze00675L).toBe(true);
  });

  it("TC-07: 系統長期防禦模式 F-10 提示 (持續狀態 >= 20 日顯示長期防禦警示)", () => {
    const calmMarketData = {
      rSox: 0.001,
      rTsm: 0.001,
      rNight: 0.001,
      maintenanceRatio: 162.0,
      marginBalanceChangePct: 0.001,
      vix: 19.0,
      taiexReturn: 0.001,
      bias60: -0.02,
      rsr: 3.0,
    };

    const result = evaluateLeadingIndicators({
      marketData: calmMarketData,
      portfolio: normalPortfolio,
      currentState: SYSTEM_STATES.COOLDOWN,
      cooldownDays: 1,
      activeDays: 21,
    });

    expect(result.stateMachine.isLongTermDefense).toBe(true);
    expect(result.telegramCard).toContain("📊【系統長期防禦模式】已持續 22 日");
  });
});
