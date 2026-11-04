/**
 * @file leadingIndicatorEvaluator.mjs
 * @description 領先指標策略評估引擎與 Telegram 警報格式化器 (Integration & Alerts)
 * 整合四大極端雷達感測器、個人維持率斷路器與核心狀態機。
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
} from "./marginStateMachine.mjs";
import { evaluateCashExposure } from "./cashExposureAdvisor.mjs";

/**
 * 格式化 Telegram 極端警報卡片
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
  cashExposureAnalysis = null,
} = {}) {
  const lines = [];

  // 1. 斷路器置頂警報 (若觸發)
  if (personalBreaker.breakerTriggered && personalBreaker.cardSummary) {
    lines.push(personalBreaker.cardSummary);
  }

  // 2. 頂部 1 行摘要
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
    ? "0050 啟動左側布局"
    : "0050 暫緩左側";
  const disciplineP0 = "P0 定期定額正常執行";

  lines.push(
    `├─ 🛡 行動紀律：${discipline00675L} | ${discipline0050} | ${disciplineP0}`,
  );

  // 5. F-10 長期防禦模式提示
  if (isLongTermDefense) {
    lines.push(`📊【系統長期防禦模式】已持續 ${activeDays} 日`);
  }

  // 6. 現金曝險摘要行 (底部)
  if (cashExposureAnalysis) {
    const { status, suggestedDcaAmt, exposureGap } = cashExposureAnalysis;
    if (status === "RECOMMEND_DCA") {
      lines.push(
        `└─ 💰 現金曝險：建議 DCA $${suggestedDcaAmt.toFixed(0)} | 曝險缺口 $${exposureGap.toFixed(0)}`,
      );
    } else if (status === "OVER_EXPOSED") {
      lines.push("└─ 💰 已達/超過 Kelly 建議曝險，維持 DCA，不加速");
    } else if (status === "INSUFFICIENT_CASH") {
      lines.push("└─ 💰 現金不足，維持基礎 DCA，等待現金補充");
    } else if (status === "DEFER") {
      lines.push("└─ 💰 市場雷達異常，暫緩加速，維持基礎 DCA");
    } else {
      lines.push("└─ 💰 現金曝險建議暫不提供");
    }
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
 * @returns {Object} 完整評估與執行約束
 */
export function evaluateLeadingIndicators({
  marketData = {},
  portfolio = {},
  currentState = SYSTEM_STATES.IDLE,
  cooldownDays = 0,
  activeDays = 0,
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
    bias60: marketData.bias60 === undefined ? 0 : marketData.bias60,
    bias60DataStatus: marketData.bias60DataStatus ?? "VERIFIED",
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
  const p0Exempt = true; // P0 定期定額永遠豁免

  // 3. P-1 個人真實維持率斷路器檢驗 (最高優先級凌駕)
  const personalBreaker = evaluatePersonalMarginBreaker({
    totalAssets: portfolio.totalAssets || 0,
    totalLiabilities: portfolio.totalLiabilities || 0,
  });

  if (personalBreaker.breakerTriggered) {
    freeze00675L = true;
    allowLeft0050 = false;
  }

  // 4. 狀態機推進
  const stateMachine = transitionLeadingIndicatorState({
    currentState,
    cooldownDays,
    activeDays,
    hasAnyRadarTriggered,
  });

  const constraints = {
    freeze00675L,
    allowLeft0050,
    p0Exempt,
  };

  // 6. 現金驅動曝險分析 (Sheet cash → Kelly 曝險缺口 → 行動建議)
  const cashExposureAnalysis = evaluateCashExposure({
    cash: portfolio.cash ?? 0,
    grossExposure: portfolio.currentExposure ?? 0,
    accountNetAsset: portfolio.accountNetAsset,
    kellyConservative: marketData.kellyConservative,
    radarTriggered: triggeredRadars.map((r) => r.radarId).filter(Boolean),
    totalDebt: portfolio.totalDebt ?? 0,
  });

  // 5. Telegram 卡片生成 (常態靜默：IDLE 且無任何觸發時為 null)
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
    telegramCard,
    cashExposureAnalysis,
  };
}
