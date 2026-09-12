/**
 * Macro Regime Classifier (宏觀與市場狀態進階四象限分類器)
 *
 * 解決因子逆向抵銷、散戶籌碼過熱、實質持有成本與狀態震盪問題
 *
 * 四象限狀態：
 *   - BULL_TREND: 多頭強趨勢 (Price > MA60, Slope >= 0, VIX < 20) -> 動能 70%, 槓桿 1.0
 *   - BULL_VOLATILE: 劇烈震盪多頭 (Price > MA60, 20 <= VIX < 35) -> 左側超跌 60%, 啟動融資阻尼器
 *   - BEAR_PANIC: 恐慌危機 (VIX >= 35) -> 強制 Sell-only, 槓桿 0
 *   - BEAR_CHOPPY: 陰跌盤整 (Price <= MA60, VIX < 20) -> 僅 DCA, 阻斷戰術加碼
 *
 * @module strategy/macroRegimeClassifier
 */

export const MacroRegimeState = {
  BULL_TREND: "BULL_TREND",
  BULL_VOLATILE: "BULL_VOLATILE",
  BEAR_PANIC: "BEAR_PANIC",
  BEAR_CHOPPY: "BEAR_CHOPPY",
};

/**
 * 評估單日即時象限 (未套用遲滯)
 * @private
 */
function evaluateRawState({ price0050, ma60, ma60Slope = 0, vix }) {
  const vixVal = Number.isFinite(vix) ? vix : 18;
  const priceVal = Number.isFinite(price0050) ? price0050 : ma60;
  const maVal = Number.isFinite(ma60) ? ma60 : priceVal;
  const slopeVal = Number.isFinite(ma60Slope) ? ma60Slope : 0;

  // 1. 最高優先級：VIX >= 35 進入極端恐慌
  if (vixVal >= 35) {
    return MacroRegimeState.BEAR_PANIC;
  }

  const isBull = priceVal >= maVal && slopeVal >= -0.001;

  if (isBull) {
    if (vixVal >= 20) {
      return MacroRegimeState.BULL_VOLATILE;
    }
    return MacroRegimeState.BULL_TREND;
  }

  // 空頭或盤整
  if (vixVal >= 20) {
    return MacroRegimeState.BEAR_PANIC; // 高波空頭視為恐慌
  }
  return MacroRegimeState.BEAR_CHOPPY;
}

/**
 * 分類宏觀市場狀態 (包含遲滯機制、阻尼器與動態權重)
 *
 * @param {Object} currentData
 * @param {number} currentData.price0050 - 0050 當前價格
 * @param {number} currentData.ma60 - 季線 (MA60)
 * @param {number} [currentData.ma60Slope] - 季線斜率
 * @param {number} currentData.vix - 當前 VIX
 * @param {number} [currentData.marginChangePercent5d] - 5日融資增減比率 (%)
 * @param {number} [currentData.indexChangePercent5d] - 5日大盤增減比率 (%)
 * @param {Object} [previousState] - 前一日狀態紀錄 (供遲滯判定)
 * @returns {Object} 判定結果物件
 */
export function classifyMacroRegime(currentData, previousState = null) {
  const rawState = evaluateRawState(currentData);

  let finalState = rawState;
  let consecutiveDays = 1;
  let candidateState = null;
  let candidateDays = 0;

  // 套用遲滯機制 (Hysteresis Filter)
  if (previousState && previousState.state) {
    const prevState = previousState.state;

    if (rawState === MacroRegimeState.BEAR_PANIC) {
      // 危機防守：0 延遲即刻進入
      finalState = MacroRegimeState.BEAR_PANIC;
      candidateState = null;
      candidateDays = 0;
      consecutiveDays =
        prevState === MacroRegimeState.BEAR_PANIC
          ? (previousState.consecutiveDays || 1) + 1
          : 1;
    } else if (rawState === prevState) {
      // 狀態維持不變
      finalState = prevState;
      candidateState = null;
      candidateDays = 0;
      consecutiveDays = (previousState.consecutiveDays || 1) + 1;
    } else {
      // 發生狀態切換請求，檢查確認門檻
      // 恢復至 BULL_TREND 需 5 天，其他降級轉換需 2 天
      const requiredDays = rawState === MacroRegimeState.BULL_TREND ? 5 : 2;

      if (previousState.candidateState === rawState) {
        candidateDays = (previousState.candidateDays || 0) + 1;
        if (candidateDays >= requiredDays) {
          // 通過確認期，正式切換
          finalState = rawState;
          consecutiveDays = 1;
          candidateState = null;
          candidateDays = 0;
        } else {
          // 未達確認天數，維持原狀態
          finalState = prevState;
          candidateState = rawState;
          consecutiveDays = (previousState.consecutiveDays || 1) + 1;
        }
      } else {
        // 第一天出現新候選狀態
        finalState = prevState;
        candidateState = rawState;
        candidateDays = 1;
        consecutiveDays = (previousState.consecutiveDays || 1) + 1;
      }
    }
  }

  // 評估散戶融資過熱阻尼器
  const margin5d = currentData.marginChangePercent5d ?? 0;
  const index5d = currentData.indexChangePercent5d ?? 0;
  const isMarginOverheated = margin5d > 2.0 && margin5d > index5d * 1.5;

  // 依最終狀態設定交易模式與動態權重
  let mode = "normal";
  let leverageMultiplier = 1.0;
  let weights = { momentum: 0.33, contrarianDca: 0.33, institutional: 0.34 };
  let costOfCarryFilterActive = false;
  let reason = "";

  switch (finalState) {
    case MacroRegimeState.BULL_TREND:
      mode = "trend_offensive";
      leverageMultiplier = 1.0;
      weights = { momentum: 0.7, contrarianDca: 0.0, institutional: 0.3 };
      reason = "強趨勢多頭：指數位於季線之上且波動率平穩，動能因子主導";
      break;

    case MacroRegimeState.BULL_VOLATILE:
      mode = "dip_buying";
      leverageMultiplier = 0.8;
      weights = { momentum: 0.15, contrarianDca: 0.6, institutional: 0.25 };
      reason = "高波動多頭：指數高檔但振幅加劇，以逢低超跌買進為主";
      break;

    case MacroRegimeState.BEAR_PANIC:
      mode = "sell_only";
      leverageMultiplier = 0.0;
      weights = { momentum: 0.0, contrarianDca: 0.0, institutional: 0.0 };
      reason = "極端恐慌危機：VIX 超標或流動性風險，強制 Sell-only 保全部位";
      break;

    case MacroRegimeState.BEAR_CHOPPY:
      mode = "dca_only";
      leverageMultiplier = 0.5;
      weights = {
        momentum: 0.0,
        tacticalDca: 0.0,
        contrarianDca: 0.0,
        institutional: 0.0,
      };
      costOfCarryFilterActive = true;
      reason =
        "陰跌盤整期：指數跌破季線，實質持有成本高，嚴禁戰術加碼，僅執行基礎 DCA";
      break;
  }

  // 計算阻尼乘數
  let dampingMultiplier = 1.0;
  if (finalState === MacroRegimeState.BEAR_PANIC) {
    dampingMultiplier = 0.0;
  } else if (isMarginOverheated) {
    dampingMultiplier = 0.5;
  }

  return {
    state: finalState,
    mode,
    leverageMultiplier,
    weights,
    dampingMultiplier,
    isMarginOverheated,
    costOfCarryFilterActive,
    consecutiveDays,
    candidateState,
    candidateDays,
    reason,
  };
}
