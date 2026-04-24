export function evaluateGrossLeverage(
  grossLeverageResult,
  strategy,
  isPanicBypass,
) {
  // ─────────────────────────────────────────────────────────────
  // Priority 2：Gross Leverage 天花板（維持率正常後才執行）
  // hardcap_breach → 強制降槓，Priority 高於 ceiling_breach
  // ceiling_breach → 一票否決新增槓桿，但不強制砍倉
  // ─────────────────────────────────────────────────────────────
  if (grossLeverageResult) {
    if (grossLeverageResult.status === "hardcap_breach") {
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "hardcap_breach",
        grossLeverage: grossLeverageResult.grossLeverage,
        marketStatus: "🚨【Gross Leverage 危機紅線】",
        target: "📉 強制降槓",
        targetSuggestionShort: `綜合曝險 ${grossLeverageResult.grossLeverage.toFixed(2)}x 超越危機紅線，強制賣出 00675L 降槓至 ${grossLeverageResult.recoveryTarget}x`,
        targetSuggestion: grossLeverageResult.message,
        suggestion:
          `• 綜合曝險倍數（Gross Leverage）：${grossLeverageResult.grossLeverage.toFixed(2)}x\n` +
          `• 危機紅線：${strategy.grossLeverage.hardCap}x\n` +
          `• 著陸目標：${grossLeverageResult.recoveryTarget}x\n` +
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
          `• 主動上限：${strategy.grossLeverage.ceiling}x\n` +
          `• ⚠️ 禁止新增質押借款與 00675L 買入\n` +
          `• 允許操作：0050 現貨買入（不增加借款槓桿）` +
          bypassWarning,
        panicBypassActive: isPanicBypass,
      };
    }
  }

  return null;
}
