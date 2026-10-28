/**
 * @file marginStateMachine.mjs
 * @description 領先指標狀態機與個人真實維持率斷路器 (Defense & State Machine)
 * 實現個人防禦機制與四大雷達驅動之四狀態狀態機 (IDLE, TRIGGERED, CONTINUOUS_SHOCK, COOLDOWN)。
 */

/**
 * 系統狀態機狀態定義
 */
export const SYSTEM_STATES = Object.freeze({
  IDLE: "IDLE",
  TRIGGERED: "TRIGGERED",
  CONTINUOUS_SHOCK: "CONTINUOUS_SHOCK",
  COOLDOWN: "COOLDOWN",
});

/**
 * P-1 最高優先級個人維持率防禦斷路器
 * 依據個人總資產與總負債動態計算真實個人維持率。
 * 當個人維持率 < 160% 時，無論外部市場雷達訊號為何，強制凍結槓桿，保全帳戶流動性。
 *
 * @param {Object} input
 * @param {number} input.totalAssets - 個人帳戶總資產 (元)
 * @param {number} input.totalLiabilities - 個人帳戶總負債 (元)
 * @returns {Object} 斷路器評估結果
 */
export function evaluatePersonalMarginBreaker({
  totalAssets = 0,
  totalLiabilities = 0,
}) {
  if (totalLiabilities <= 0) {
    return {
      breakerTriggered: false,
      marginRatio: Infinity,
      constraints: {
        freeze00675L: false,
        allowLeft0050: true,
        p0Exempt: true,
      },
      cardSummary: null,
    };
  }

  const marginRatio = (totalAssets / totalLiabilities) * 100;

  if (marginRatio < 160.0) {
    const mrPct = marginRatio.toFixed(1);
    const summaryText = `🚨【個人維持率斷路器觸發】個人維持率僅 ${mrPct}% (< 160%)。觸發最高等級帳戶流動性保護：強制凍結 00675L 與加碼！P0 定期定額不受影響。`;

    return {
      breakerTriggered: true,
      marginRatio,
      constraints: {
        freeze00675L: true, // 嚴禁槓桿
        allowLeft0050: false, // 封鎖加碼
        p0Exempt: true, // P0 持續豁免
      },
      cardSummary: summaryText,
    };
  }

  return {
    breakerTriggered: false,
    marginRatio,
    constraints: {
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
    },
    cardSummary: null,
  };
}

/**
 * 狀態機流轉函數
 * 依照 D+1 結算結果推進狀態機
 *
 * @param {Object} input
 * @param {string} input.currentState - 目前系統狀態 (IDLE, TRIGGERED, CONTINUOUS_SHOCK, COOLDOWN)
 * @param {number} [input.cooldownDays] - 當前冷卻天數 (COOLDOWN 下有效)
 * @param {number} [input.activeDays] - 當前處於非 IDLE 狀態累計天數
 * @param {boolean} input.hasAnyRadarTriggered - 今日是否有任何極端雷達觸發
 * @returns {Object} 推進後的新狀態
 */
export function transitionLeadingIndicatorState({
  currentState = SYSTEM_STATES.IDLE,
  cooldownDays = 0,
  activeDays = 0,
  hasAnyRadarTriggered = false,
}) {
  let nextState = currentState;
  let nextCooldownDays = 0;
  let nextActiveDays = activeDays;

  switch (currentState) {
    case SYSTEM_STATES.IDLE:
      if (hasAnyRadarTriggered) {
        nextState = SYSTEM_STATES.TRIGGERED;
        nextCooldownDays = 0;
        nextActiveDays = 1;
      } else {
        nextState = SYSTEM_STATES.IDLE;
        nextCooldownDays = 0;
        nextActiveDays = 0;
      }
      break;

    case SYSTEM_STATES.TRIGGERED:
      nextActiveDays = activeDays + 1;
      if (hasAnyRadarTriggered) {
        nextState = SYSTEM_STATES.CONTINUOUS_SHOCK;
        nextCooldownDays = 0;
      } else {
        nextState = SYSTEM_STATES.COOLDOWN;
        nextCooldownDays = 1;
      }
      break;

    case SYSTEM_STATES.CONTINUOUS_SHOCK:
      nextActiveDays = activeDays + 1;
      if (hasAnyRadarTriggered) {
        nextState = SYSTEM_STATES.CONTINUOUS_SHOCK;
        nextCooldownDays = 0;
      } else {
        // F-1: 衝擊平息，進入冷卻期並起算 1
        nextState = SYSTEM_STATES.COOLDOWN;
        nextCooldownDays = 1;
      }
      break;

    case SYSTEM_STATES.COOLDOWN:
      nextActiveDays = activeDays + 1;
      if (hasAnyRadarTriggered) {
        // F-8: COOLDOWN 期間再次觸發，轉入 CONTINUOUS_SHOCK
        nextState = SYSTEM_STATES.CONTINUOUS_SHOCK;
        nextCooldownDays = 0;
      } else {
        const updatedCooldown = cooldownDays + 1;
        if (updatedCooldown >= 5) {
          // 連續 5 日無雷達觸發，回歸 IDLE
          nextState = SYSTEM_STATES.IDLE;
          nextCooldownDays = 0;
          nextActiveDays = 0;
        } else {
          nextState = SYSTEM_STATES.COOLDOWN;
          nextCooldownDays = updatedCooldown;
        }
      }
      break;

    default:
      nextState = SYSTEM_STATES.IDLE;
      nextCooldownDays = 0;
      nextActiveDays = 0;
      break;
  }

  // F-10: 連續 20 個交易日處於非 IDLE 狀態，標記長期防禦模式
  const isLongTermDefense = nextActiveDays >= 20;

  return {
    state: nextState,
    cooldownDays: nextCooldownDays,
    activeDays: nextActiveDays,
    isLongTermDefense,
  };
}
