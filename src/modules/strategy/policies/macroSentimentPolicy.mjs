/**
 * VIX 情緒短路機制：判斷是否應覆蓋 AI BEARISH 的懲罰效果
 *
 * 短路條件（二選一，滿足其一即觸發）：
 *   1. 絕對短路：vixValue >= vixAbsoluteOverride（預設 35）— 無論趨勢強制觸發
 *   2. 趨勢短路：vixValue >= vixOverrideTrigger（預設 28）且 vixTrend === 'falling'
 *
 * vixTrend 由 vixArr 末兩筆自動推算：
 *   - vixArr 最後一筆 < 倒數第二筆 → 'falling'
 *   - vixArr 最後一筆 > 倒數第二筆 → 'rising'
 *   - 相等或資料不足 → 'flat'
 *
 * 若 config 欄位 vixOverrideTrigger / vixAbsoluteOverride 不存在，
 * 視為功能停用，直接回傳 overrideActive: false。
 *
 * @param {number} vixValue - 當前 VIX 數值
 * @param {number[]} vixArr - VIX 歷史序列（至少需 2 筆才能判斷趨勢）
 * @param {Object} config - 完整 strategy config
 * @returns {{ overrideActive: boolean, overrideReason: string, vixTrend: string }}
 */
export function resolveVixOverride(vixValue, vixArr, config) {
  const cfg = config?.macroSentiment;

  // 功能未設定 → 停用
  if (cfg?.vixOverrideTrigger == null && cfg?.vixAbsoluteOverride == null) {
    return { overrideActive: false, overrideReason: "", vixTrend: "unknown" };
  }

  const absoluteThreshold = cfg.vixAbsoluteOverride ?? 35;
  const trendThreshold = cfg.vixOverrideTrigger ?? 28;

  // 推算 vixTrend 從歷史序列末兩筆
  let vixTrend = "flat";
  if (Array.isArray(vixArr) && vixArr.length >= 2) {
    const prev = vixArr[vixArr.length - 2];
    const curr = vixArr[vixArr.length - 1];
    if (Number.isFinite(prev) && Number.isFinite(curr)) {
      if (curr < prev) vixTrend = "falling";
      else if (curr > prev) vixTrend = "rising";
    }
  }

  // 絕對短路（無論趨勢）
  if (Number.isFinite(vixValue) && vixValue >= absoluteThreshold) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${absoluteThreshold}（強制短路）`,
      vixTrend,
    };
  }

  // 趨勢短路（需 falling）
  if (
    Number.isFinite(vixValue) &&
    vixValue >= trendThreshold &&
    vixTrend === "falling"
  ) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 趨勢門檻 ${trendThreshold} 且趨勢下行（趨勢短路）`,
      vixTrend,
    };
  }

  // 未觸發
  return { overrideActive: false, overrideReason: "", vixTrend };
}

/**
 * 從 strategy.macroSentiment config 與外部傳入的 market_direction
 * 組裝成 computeEntryScore 所需的 macroSentiment 物件。
 * 若功能未啟用或無方向資料，回傳 null。
 *
 * 若 vixOverride.overrideActive === true，
 * bearishPenalty 強制設為 0（短路屏蔽），並在回傳物件中標記短路狀態。
 *
 * @param {string|null} marketDirection - 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
 * @param {Object} strategy - 完整策略設定
 * @param {{ overrideActive: boolean, overrideReason: string }} vixOverride - VIX 短路狀態
 * @returns {Object|null}
 */
export function resolveMacroSentiment(marketDirection, strategy, vixOverride) {
  const cfg = strategy?.macroSentiment;
  if (!cfg?.enabled || !marketDirection) return null;

  const isOverrideActive = vixOverride?.overrideActive === true;

  // bearishPenalty：短路啟動時強制為 0，正常時從 config 讀取
  const effectivePenalty = isOverrideActive ? 0 : (cfg.bearishPenalty ?? 0);

  return {
    direction: marketDirection,
    bonus: cfg.bullishBonus ?? 0,
    penalty: effectivePenalty,
    // 短路標記：供 Telegram 模板識別並顯示 ⚡ VIX 情緒短路 提示
    vixOverrideActive: isOverrideActive,
    vixOverrideReason: isOverrideActive
      ? (vixOverride.overrideReason ?? "")
      : "",
  };
}
