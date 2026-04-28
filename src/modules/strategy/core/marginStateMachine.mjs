function resolveThresholds(maint) {
  return {
    marginCallThreshold: maint.marginCallThreshold ?? 135,
    frozenZone: maint.frozenZone ?? 145,
    protectTrigger: maint.protectTrigger ?? 160,
    protectTarget: maint.protectTarget ?? 180,
  };
}

/**
 * 維持率 4 層狀態機判斷
 * @param {number} mm - 當前維持率(%)
 * @param {Object} maint - strategy.maintenance
 * @returns {'critical'|'frozen'|'protect'|'normal'}
 */
export function getMarginLayer(mm, maint) {
  const { marginCallThreshold, frozenZone, protectTrigger } =
    resolveThresholds(maint);

  if (mm < marginCallThreshold) return "critical"; // 🔴 斷頭危機
  if (mm < frozenZone) return "frozen"; // 🟠 高危凍結
  if (mm < protectTrigger) return "protect"; // 🟡 預備金防禦
  return "normal"; // 🟢 常態運行
}

export function evaluateMarginLayer(marginLayer, ctx, strategy, reserveStatus) {
  const { maintenanceMargin, totalLoan = 0 } = ctx;
  const { marginCallThreshold, frozenZone, protectTrigger, protectTarget } =
    resolveThresholds(strategy.maintenance);
  // 🔴 Layer 0：斷頭危機 < marginCallThreshold(135)
  // 強制市價降槓桿警示，一票否決所有加碼，優先指示補足保證金
  if (marginLayer === "critical") {
    return {
      maintenanceLayer: marginLayer,
      marketStatus: "🔴【斷頭危機】",
      target: "🛑 強制降槓桿",
      targetSuggestionShort: "立即補保證金或市價降槓桿，禁止一切加碼",
      targetSuggestion:
        "維持率已低於斷頭警戒線，必須立即行動：補充保證金或市價賣出 00675L 降槓桿",
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (斷頭門檻 ${marginCallThreshold}%)\n` +
        `• ⚠️ 警告：系統已進入強制降槓桿模式，所有加碼操作被一票否決\n` +
        `• 優先行動 1：立即補充保證金（現金或追加擔保品）\n` +
        `• 優先行動 2：若無現金，市價賣出部分 00675L 降低槓桿\n` +
        `• 目標：維持率回升至 ${frozenZone}% 以上後再評估後續操作`,
      maintenanceMargin,
      marginCallThreshold,
    };
  }

  // 🟠 Layer 1：高危凍結 135–145% (frozenZone)
  // 禁止所有新進場，強烈通知補足保證金
  if (marginLayer === "frozen") {
    const impliedCollateral = (maintenanceMargin / 100) * totalLoan; // 由維持率反推的隱含擔保品
    const targetCollateral = (frozenZone / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - impliedCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: marginLayer,
      marketStatus: "🟠【高危凍結】",
      target: "🚫 禁止進場",
      targetSuggestionShort: "禁止所有新進場；強烈建議立即補足保證金",
      targetSuggestion: `維持率 ${maintenanceMargin.toFixed(0)}% 進入高危走廊（${marginCallThreshold}–${frozenZone}%），禁止任何新開倉，請立即補足保證金`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (高危區間 ${marginCallThreshold}–${frozenZone}%)\n` +
        `• 🚫 所有新進場操作已凍結（包含 0050 DCA 與 00675L 加碼）\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元（補至解凍線 ${frozenZone}%）\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金補充保證金或買入 0050" : "優先補充現金至帳戶"}\n` +
        `2. 嚴禁在此區間追加 00675L 槓桿部位\n` +
        `3. 維持率回升至 ${frozenZone}% 以上後，自動解除凍結`,
      maintenanceMargin,
      frozenZone,
      needAmount,
      reserveSufficient,
    };
  }

  // 🟡 Layer 2：預備金防禦 145–160% (protectTrigger)
  // 暫停高槓桿加碼，優先充實擔保品，允許 baseline DCA
  if (marginLayer === "protect") {
    const impliedCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (protectTarget / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - impliedCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: marginLayer,
      marketStatus: "🛡️【維持率低於安全線】",
      target: "🧯 預備金防禦",
      targetSuggestionShort: "動用預備金或補充抵押品；允許 0050 DCA",
      targetSuggestion: `維持率低於 ${protectTrigger}%，建議動用預備金買入 0050 或補充現金，目標維持率 ${protectTarget}%`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (低於安全線 ${protectTrigger}%)\n` +
        `• 補足目標：${protectTarget}%\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 當前預備金：${reserveStatus.currentReserve.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金買入 0050 (提升抵押品價值)" : "優先補充現金還款"}\n` +
        `2. ${reserveSufficient ? "或補充現金還款 (降低借款)" : "或動用部分預備金買入 0050"}\n` +
        `3. 暫停 00675L 槓桿加碼，允許 0050 baseline DCA 維持`,
      maintenanceMargin,
      protectTrigger,
      protectTarget,
      reserveStatus,
      needAmount,
      reserveSufficient,
    };
  }

  return null;
}
