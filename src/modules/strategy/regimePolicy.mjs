/**
 * Regime-aware Policy Module
 * 
 * 根據 VIX 和 MacroSentiment 動態調整槓桿上限與交易模式
 * 
 * Regime 狀態定義：
 *   - NORMAL: VIX < 28 且 sentiment != BEAR → leverageMultiplier: 1.0, mode: normal
 *   - CAUTIOUS: 28 ≤ VIX < 35 或 sentiment = BEAR → leverageMultiplier: 0.75, mode: reduced
 *   - CRISIS: VIX ≥ 35 → leverageMultiplier: 0, mode: sell_only
 * 
 * @module strategy/regimePolicy
 */

/**
 * @typedef {'NORMAL' | 'CAUTIOUS' | 'CRISIS'} RegimeState
 */

/**
 * @typedef {Object} RegimeResult
 * @property {RegimeState} state - 當前 Regime 狀態
 * @property {number} leverageMultiplier - 槓桿調整倍率
 * @property {'normal' | 'reduced' | 'sell_only'} mode - 交易模式
 * @property {string} reason - 狀態判定原因
 * @property {Object} context - 判定上下文（VIX、sentiment 等）
 */

/**
 * 判定當前 Regime 狀態
 * 
 * 判定邏輯（優先級由高到低）：
 *   1. VIX ≥ vixAbsoluteOverride (35) → CRISIS（強制 Sell-only）
 *   2. VIX ≥ vixOverrideTrigger (28) 或 sentiment = BEAR → CAUTIOUS（降槓桿 25%）
 *   3. 其他情況 → NORMAL（正常模式）
 * 
 * @param {number} vix - 當前 VIX 指數
 * @param {string} sentiment - 宏觀情緒狀態（BULL | NEUTRAL | BEAR）
 * @param {Object} config - Regime 配置參數
 * @param {number} config.vixOverrideTrigger - VIX 警戒門檻（預設 28）
 * @param {number} config.vixAbsoluteOverride - VIX 絕對門檻（預設 35）
 * @param {number} config.cautiousLeverageReductionPct - CAUTIOUS 模式槓桿下修百分比（預設 25）
 * @returns {RegimeResult} Regime 判定結果
 */
export function determineRegime(vix, sentiment, config) {
  const vixOverrideTrigger = (config?.vixOverrideTrigger) ?? 28;
  const vixAbsoluteOverride = (config?.vixAbsoluteOverride) ?? 35;
  const cautiousLeverageReductionPct = (config?.cautiousLeverageReductionPct) ?? 25;
  
  const vixValue = Number.isFinite(vix) ? vix : 0;
  const sentimentValue = sentiment || 'NEUTRAL';
  
  // 優先級 1: VIX ≥ 35 → CRISIS（強制 Sell-only）
  if (vixValue >= vixAbsoluteOverride) {
    return {
      state: 'CRISIS',
      leverageMultiplier: 0,
      mode: 'sell_only',
      reason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${vixAbsoluteOverride}（強制 Sell-only）`,
      context: {
        vix: vixValue,
        sentiment: sentimentValue,
        vixOverrideTrigger,
        vixAbsoluteOverride
      }
    };
  }
  
  // 優先級 2: VIX ≥ 28 或 sentiment = BEAR → CAUTIOUS（降槓桿 25%）
  if (vixValue >= vixOverrideTrigger || sentimentValue === 'BEAR') {
    const triggerReason = [];
    if (vixValue >= vixOverrideTrigger) {
      triggerReason.push(`VIX ${vixValue.toFixed(1)} ≥ 警戒門檻 ${vixOverrideTrigger}`);
    }
    if (sentimentValue === 'BEAR') {
      triggerReason.push('MacroSentiment = BEAR');
    }
    
    return {
      state: 'CAUTIOUS',
      leverageMultiplier: (100 - cautiousLeverageReductionPct) / 100, // 0.75
      mode: 'reduced',
      reason: `${triggerReason.join(' 且 ')} → maxLeverage 下修 ${cautiousLeverageReductionPct}%`,
      context: {
        vix: vixValue,
        sentiment: sentimentValue,
        vixOverrideTrigger,
        vixAbsoluteOverride,
        cautiousLeverageReductionPct
      }
    };
  }
  
  // 優先級 3: 正常模式
  return {
    state: 'NORMAL',
    leverageMultiplier: 1.0,
    mode: 'normal',
    reason: `VIX ${vixValue.toFixed(1)} < ${vixOverrideTrigger} 且 sentiment = ${sentimentValue}（正常模式）`,
    context: {
      vix: vixValue,
      sentiment: sentimentValue,
      vixOverrideTrigger,
      vixAbsoluteOverride
    }
  };
}

/**
 * 計算 Regime 調整後的槓桿上限
 * 
 * @param {number} baseMaxLeverage - 基礎槓桿上限（來自 lifecycleProfile）
 * @param {RegimeResult} regimeResult - Regime 判定結果
 * @returns {number} 調整後的槓桿上限
 */
export function applyRegimeLeverage(baseMaxLeverage, regimeResult) {
  return baseMaxLeverage * regimeResult.leverageMultiplier;
}

/**
 * 判定是否允許新增戰術部位（00675L 加碼）
 * 
 * @param {RegimeResult} regimeResult - Regime 判定結果
 * @returns {boolean} 是否允許新增部位
 */
export function allowsTacticalEntry(regimeResult) {
  return regimeResult.mode !== 'sell_only';
}

/**
 * 判定是否啟動強制減倉
 * 
 * @param {RegimeResult} regimeResult - Regime 判定結果
 * @returns {boolean} 是否啟動強制減倉
 */
export function requiresForcedReduction(regimeResult) {
  return regimeResult.mode === 'sell_only';
}

/**
 * 生成 Regime 狀態描述（用於報表 / 通知）
 * 
 * @param {RegimeResult} regimeResult - Regime 判定結果
 * @returns {string} 狀態描述字串
 */
export function formatRegimeStatus(regimeResult) {
  const { state, mode, reason, context } = regimeResult;
  
  const stateEmoji = {
    'NORMAL': '✅',
    'CAUTIOUS': '⚠️',
    'CRISIS': '🚨'
  };
  
  const modeLabel = {
    'normal': '正常模式',
    'reduced': '降槓桿模式',
    'sell_only': '強制賣出模式'
  };
  
  return `${stateEmoji[state]} ${state} [${modeLabel[mode]}]\n${reason}`;
}

/**
 * 驗證 Regime 配置參數
 * 
 * @param {Object} config - Regime 配置
 * @param {number} config.vixOverrideTrigger - VIX 警戒門檻
 * @param {number} config.vixAbsoluteOverride - VIX 絕對門檻
 * @param {number} config.cautiousLeverageReductionPct - CAUTIOUS 模式槓桿下修百分比
 * @returns {{ valid: boolean, errors: string[] }} 驗證結果
 */
export function validateRegimeConfig(config = {}) {
  const errors = [];
  
  const vixOverrideTrigger = config.vixOverrideTrigger ?? 28;
  const vixAbsoluteOverride = config.vixAbsoluteOverride ?? 35;
  const cautiousLeverageReductionPct = config.cautiousLeverageReductionPct ?? 25;
  
  // 驗證 VIX 門檻邏輯
  if (!Number.isFinite(vixOverrideTrigger)) {
    errors.push('vixOverrideTrigger 必須是有效數值');
  } else if (vixOverrideTrigger < 0) {
    errors.push('vixOverrideTrigger 不能為負數');
  }
  
  if (!Number.isFinite(vixAbsoluteOverride)) {
    errors.push('vixAbsoluteOverride 必須是有效數值');
  } else if (vixAbsoluteOverride < 0) {
    errors.push('vixAbsoluteOverride 不能為負數');
  }
  
  // 驗證門檻大小關係
  if (vixOverrideTrigger >= vixAbsoluteOverride) {
    errors.push(`vixOverrideTrigger (${vixOverrideTrigger}) 必須小於 vixAbsoluteOverride (${vixAbsoluteOverride})`);
  }
  
  // 驗證槓桿下修百分比
  if (!Number.isFinite(cautiousLeverageReductionPct)) {
    errors.push('cautiousLeverageReductionPct 必須是有效數值');
  } else if (cautiousLeverageReductionPct < 0 || cautiousLeverageReductionPct > 100) {
    errors.push('cautiousLeverageReductionPct 必須介於 0-100 之間');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
