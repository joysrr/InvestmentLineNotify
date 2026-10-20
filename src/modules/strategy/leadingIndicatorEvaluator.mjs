/**
 * @file leadingIndicatorEvaluator.mjs
 * @description 領先指標策略評估引擎與 Telegram 警報格式化器 (Integration & Alerts)
 * 整合四大極端雷達感測器、P-1 個人維持率斷路器、核心狀態機與動態加碼額度試算。
 */

import {
  RADAR_IDS,
  evaluateOvernightShockRadar,
  evaluateMarginSettlingRadar,
  evaluateExtremePanicRadar,
  evaluateRetailSentimentRadar,
} from "./radars/index.mjs";

import {
  SYSTEM_STATES,
  evaluatePersonalMarginBreaker,
  transitionLeadingIndicatorState,
  evaluateP1Allocation,
} from "./marginStateMachine.mjs";

/**
 * 格式化 Telegram 極端警報卡片 (遵循 F-7「1 行摘要 + 詳情卡 + P1 餘額行」)
 * @param {Object} input
 * @returns {string} 格式化後的 Telegram 訊息字串
 */
export function formatLeadingIndicatorTelegramCard({
  state = SYSTEM_STATES.IDLE,
  activeDays = 0,
  isLongTermDefense = false,
  triggeredRadars = [],
  personalBreaker = {},
  constraints = {},
  p1Balance = 450000,
  usedBatches = 0,
  p1Allocation0050 = null,
} = {}) {
  const lines = [];

  // 1. 斷路器置頂警報 (若觸發)
  if (personalBreaker.breakerTriggered && personalBreaker.cardSummary) {
    lines.push(personalBreaker.cardSummary);
  }

  // 2. 頂部 1 行摘要 (F-7)
  const radarNames = {
    [RADAR_IDS.OVERNIGHT_SHOCK]: "美股隔夜衝擊",
    [RADAR_IDS.MARGIN_SETTLING]: "籌碼沉澱偵測器",
    [RADAR_IDS.EXTREME_PANIC]: "歷史級極度恐慌",
    [RADAR_IDS.RETAIL_SENTIMENT]: "小台多殺多警報",
  };

  const triggeredLabels = triggeredRadars.map(
    (r) => radarNames[r.radarId] || r.radarId,
  );
  const summaryLine =
    triggeredLabels.length > 0
      ? `🚨【極端雷達矩陣警報】${triggeredLabels.join(" 觸發 | ")} 觸發`
      : `⚠️【極端雷達矩陣】狀態機運行中 (${state})`;
  lines.push(summaryLine);

  // 3. 詳情卡條目
  triggeredRadars.forEach((radar, idx) => {
    if (radar.cardSummary) {
      lines.push(`├─ 詳情卡 ${idx + 1}：${radar.cardSummary}`);
    }
  });

  // 4. 行動紀律行
  const discipline00675L = constraints.freeze00675L
    ? "00675L 禁止買入"
    : "00675L 允許動能";
  const discipline0050 = constraints.allowLeft0050
    ? p1Allocation0050 && p1Allocation0050.allowed
      ? `0050 建議加碼 ${p1Allocation0050.allocatedAmount.toLocaleString()} 元`
      : "0050 啟動左側布局"
    : "0050 暫緩左側";
  const disciplineP0 = "P0 定期定額正常執行";

  lines.push(
    `├─ 🛡 行動紀律：${discipline00675L} | ${discipline0050} | ${disciplineP0}`,
  );

  // 5. 底部 P1 預備金餘額行 (F-7)
  lines.push(
    `└─ 💰 P1 預備金餘額：${Number(p1Balance).toLocaleString()} 元（本波已動用：${usedBatches} / 3 批）`,
  );

  // 6. F-10 長期防禦模式提示
  if (isLongTermDefense) {
    lines.push(`📊【系統長期防禦模式】已持續 ${activeDays} 日`);
  }

  return lines.join("\n");
}

/**
 * 策略評估引擎統一入口
 * @param {Object} input
 * @param {Object} input.marketData - 市場行情數據
 * @param {Object} input.portfolio - 個人投資組合與財務數據
 * @param {string} [input.currentState] - 狀態機當前狀態
 * @param {number} [input.cooldownDays] - 當前冷卻天數
 * @param {number} [input.activeDays] - 非 IDLE 累計天數
 * @param {number} [input.usedBatches] - 本波已執行 P1 加碼批次數
 * @returns {Object} 完整評估與執行約束
 */
export function evaluateLeadingIndicators({
  marketData = {},
  portfolio = {},
  currentState = SYSTEM_STATES.IDLE,
  cooldownDays = 0,
  activeDays = 0,
  usedBatches = 0,
} = {}) {
  // 1. 執行四大純感測器雷達
  const radar1 = evaluateOvernightShockRadar({
    rSox: marketData.rSox === undefined ? 0 : marketData.rSox,
    rTsm: marketData.rTsm === undefined ? 0 : marketData.rTsm,
    rNight: marketData.rNight === undefined ? 0 : marketData.rNight,
    nightDataStatus: marketData.nightDataStatus ?? "VERIFIED",
    soxHistory: marketData.soxHistory ?? [],
    tsmHistory: marketData.tsmHistory ?? [],
  });

  const radar2 = evaluateMarginSettlingRadar({
    maintenanceRatio: marketData.maintenanceRatio || 160.0,
    marginBalanceChangePct: marketData.marginBalanceChangePct || 0,
    marginHistory: marketData.marginHistory || [],
  });

  const radar3 = evaluateExtremePanicRadar({
    vix: marketData.vix || 18.0,
    taiexReturn: marketData.taiexReturn || 0,
    bias60: marketData.bias60 || 0,
    vixHistory: marketData.vixHistory || [],
  });

  const radar4 = evaluateRetailSentimentRadar({
    rsr: marketData.rsr ?? null,
    rsrHistory: marketData.rsrHistory || [],
    dataStatus: marketData.retailSentimentDataStatus ?? "UNAVAILABLE",
  });

  const allRadars = [radar1, radar2, radar3, radar4];
  const triggeredRadars = allRadars.filter((r) => r.triggered);
  const hasAnyRadarTriggered = triggeredRadars.length > 0;

  // 2. 感測器約束聯集整合
  let freeze00675L = allRadars.some((r) => r.constraints.freeze00675L);
  let allowLeft0050 = allRadars.some((r) => r.constraints.allowLeft0050);
  let pauseP1 = allRadars.some((r) => r.constraints.pauseP1);
  const p0Exempt = true; // P0 定期定額永遠豁免

  // 3. P-1 個人真實維持率斷路器檢驗 (最高優先級凌駕)
  const personalBreaker = evaluatePersonalMarginBreaker({
    totalAssets: portfolio.totalAssets || 0,
    totalLiabilities: portfolio.totalLiabilities || 0,
  });

  if (personalBreaker.breakerTriggered) {
    freeze00675L = true;
    allowLeft0050 = false;
    pauseP1 = true;
  }

  // 4. 狀態機推進
  const stateMachine = transitionLeadingIndicatorState({
    currentState,
    cooldownDays,
    activeDays,
    hasAnyRadarTriggered,
  });

  // 5. 0050 P1 加碼額度試算 (若允許加碼且個人斷路器未觸發)
  let p1Allocation0050 = { allowed: false, allocatedAmount: 0 };
  if (allowLeft0050 && !personalBreaker.breakerTriggered) {
    const isExtremePanic = radar3.triggered;
    p1Allocation0050 = evaluateP1Allocation({
      targetAsset: "0050",
      portfolio,
      isExtremePanic,
    });
  }

  const constraints = {
    freeze00675L,
    allowLeft0050,
    pauseP1,
    p0Exempt,
  };

  // 6. Telegram 卡片生成 (常態靜默：IDLE 且無任何觸發時為 null)
  let telegramCard = null;
  const isAlertNeeded =
    hasAnyRadarTriggered ||
    personalBreaker.breakerTriggered ||
    stateMachine.state !== SYSTEM_STATES.IDLE;

  if (isAlertNeeded) {
    telegramCard = formatLeadingIndicatorTelegramCard({
      state: stateMachine.state,
      activeDays: stateMachine.activeDays,
      isLongTermDefense: stateMachine.isLongTermDefense,
      triggeredRadars,
      personalBreaker,
      constraints,
      p1Balance: portfolio.p1Balance || 450000,
      usedBatches,
      p1Allocation0050,
    });
  }

  return {
    hasAnyRadarTriggered,
    radars: {
      overnightShock: radar1,
      marginSettling: radar2,
      extremePanic: radar3,
      retailSentiment: radar4,
    },
    triggeredRadars,
    personalBreaker,
    constraints,
    stateMachine,
    p1Allocation0050,
    telegramCard,
  };
}
