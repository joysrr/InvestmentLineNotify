// ─────────────────────────────────────────────────────────────
// Priority 2：Gross Leverage 天花板（維持率正常後才執行）
// hardcap_breach → 強制降槓，Priority 高於 ceiling_breach
// ceiling_breach → 一票否決新增槓桿，但不強制砍倉
// ─────────────────────────────────────────────────────────────
/**
 * 評估 Gross Leverage 狀態並回傳風控結果物件
 * @param {GrossLeverageResult|null} grossLeverageResult - computeGrossLeverage 的回傳值
 * @param {Object} strategy - 策略設定，需含 strategy.grossLeverage.hardCap / ceiling
 * @param {boolean} isPanicBypass - 是否處於極端恐慌破冰狀態
 * @returns {Object|null} 風控結果物件，normal 狀態回傳 null
 */
export function evaluateGrossLeverage(
  grossLeverageResult,
  strategy,
  isPanicBypass,
) {
  const { hardCap, ceiling, recoveryTarget } = strategy.grossLeverage ?? {};

  if (grossLeverageResult) {
    if (grossLeverageResult.status === "error") {
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "error",
        grossLeverage: null,
        marketStatus: "⚠️【Gross Leverage 計算異常】",
        target: "🚫 保守封鎖",
        targetSuggestionShort:
          "帳戶淨值異常，Gross Leverage 無法計算，保守封鎖加碼",
        targetSuggestion: grossLeverageResult.message,
        suggestion: `• ${grossLeverageResult.message}`,
      };
    } else if (grossLeverageResult.status === "hardcap_breach") {
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "hardcap_breach",
        grossLeverage: grossLeverageResult.grossLeverage,
        marketStatus: "🚨【Gross Leverage 危機紅線】",
        target: "📉 強制降槓",
        targetSuggestionShort: `綜合曝險 ${grossLeverageResult.grossLeverage.toFixed(2)}x 超越危機紅線，強制賣出 00675L 降槓至 ${recoveryTarget}x`,
        targetSuggestion: grossLeverageResult.message,
        suggestion:
          `• 綜合曝險倍數（Gross Leverage）：${grossLeverageResult.grossLeverage.toFixed(2)}x\n` +
          `• 危機紅線：${hardCap}x\n` +
          `• 著陸目標：${recoveryTarget}x\n` +
          `• ⚠️ 必須一次性賣出足夠的 00675L，使曝險降至著陸目標，避免凌遲式砍倉\n` +
          `• 恐慌加碼通道在此狀態下完全封閉`,
      };
    }

    if (grossLeverageResult.status === "ceiling_breach") {
      const bypassWarning = isPanicBypass
        ? "\n\n⚠️ <b>極端恐慌破冰：估值防禦已 Bypass</b>\n⚠️ <b>但因 Gross Leverage 超限，加碼行為受限</b>"
        : "";
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "ceiling_breach",
        grossLeverage: grossLeverageResult.grossLeverage,
        marketStatus: isPanicBypass
          ? "🚨【恐慌破冰 + 曝險限縮】"
          : "⚠️【Gross Leverage 主動上限】",
        target: "🚫 禁止加碼",
        targetSuggestionShort: `綜合曝險 ${grossLeverageResult.grossLeverage.toFixed(2)}x 超額，${isPanicBypass ? "限縮為 0050 現貨" : "一票否決新增槓桿"}`,
        targetSuggestion: grossLeverageResult.message,
        suggestion:
          `• 綜合曝險倍數（Gross Leverage）：${grossLeverageResult.grossLeverage.toFixed(2)}x\n` +
          `• 主動上限：${ceiling}x\n` +
          `• ⚠️ 禁止新增質押借款與 00675L 買入\n` +
          `• 允許操作：0050 現貨買入（不增加借款槓桿）` +
          bypassWarning,
        panicBypassActive: isPanicBypass,
      };
    }
  }

  return null;
}
