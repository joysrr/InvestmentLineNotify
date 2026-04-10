// periodReportBuilder.mjs
// 將 stats + aiSummary + accuracyStats 格式化為 Telegram HTML 訊息陣列
// 週報：2 則（msg1 數據摘要含訊號回顧、msg2 AI 分析）
// 月報：3 則（msg1 數據摘要、msg2 AI 分析、msg3 訊號準確率回顧）

const TREND_ICON = { up: "↗", down: "↘", flat: "→" };
const DIRECTION_ICON = { BULLISH: "📈", BEARISH: "📉", NEUTRAL: "⚖️" };

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatNum(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v.toFixed(digits);
}

function formatPct(v) {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

/**
 * 建立訊號準確率區塊的 HTML 段落
 * @param {Object} acc - buildSignalAccuracyStats 的結果
 * @param {"weekly"|"monthly"} period
 * @returns {string}
 */
function buildAccuracySection(acc, period) {
  if (!acc) return "";

  const lines = [];
  const isWeekly = period === "weekly";

  lines.push("");
  lines.push("━━ 訊號回顧 ━━");

  const buyIcon = acc.buySignalCount > 0 ? "🟢" : "⚪";
  const blockIcon = acc.cooldownBlockedCount > 0 ? "⏸" : "✅";
  lines.push(`${buyIcon} 觸發買進：${acc.buySignalCount} 次  ${blockIcon} 冷卻封鎖：${acc.cooldownBlockedCount} 次`);

  if (acc.totalEligibleDays > 0 && acc.cooldownBlockedCount > 0) {
    const blockRatePct = (acc.cooldownBlockRate * 100).toFixed(0);
    lines.push(`（達標日封鎖率：${blockRatePct}%）`);
  }

  if (isWeekly) {
    lines.push(`<i>訊號後報酬率於月報公佈</i>`);
    return lines.join("\n");
  }

  if (acc.buySignalCount === 0) {
    lines.push("本月無觸發買進訊號，無法計算報酬率。");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("平均報酬率（訊號後）");

  const returnLabels = { d5: "+5日", d10: "+10日", d20: "+20日" };
  let hasAnyReturn = false;
  for (const [key, label] of Object.entries(returnLabels)) {
    const avg = acc.avgReturn?.[key];
    const wr = acc.winRate?.[key];
    if (avg == null) {
      lines.push(`  ${label}：資料不足，暫不顯示`);
    } else {
      hasAnyReturn = true;
      const wrPct = wr != null ? `  勝率 ${(wr * 100).toFixed(0)}%` : "";
      const avgIcon = avg >= 0 ? "✅" : "🔴";
      lines.push(`  ${avgIcon} ${label}：${formatPct(avg)}${wrPct}`);
    }
  }

  if (!hasAnyReturn) {
    lines.push("後續報酬資料尚不充足，待下次月報更新。");
    return lines.join("\n");
  }

  if (acc.signalDetails?.length > 0) {
    lines.push("");
    lines.push("逐筆明細（+5日報酬）");
    for (const d of acc.signalDetails) {
      const r5 = d.returns?.d5;
      let returnText;
      if (!r5?.available) {
        returnText = "資料待補";
      } else {
        const icon = r5.pct >= 0 ? "▲" : "▼";
        returnText = `${icon} ${formatPct(r5.pct)}`;
      }
      const leverText = d.leveragePct != null ? `  構桿 ${d.leveragePct}%` : "";
      lines.push(`  ${d.date}  ${returnText}${leverText}`);
    }
  }

  if (acc.dataNote) {
    lines.push("");
    lines.push(`<i>⚠️ ${escHtml(acc.dataNote)}</i>`);
  }

  return lines.join("\n");
}

/**
 * 建立 Telegram 訊息陣列（完整版）
 * @param {Object} stats          - buildPeriodStats 結果
 * @param {Object|null} aiSummary - generatePeriodAiSummary 結果
 * @param {"weekly"|"monthly"} period
 * @param {Object|null} accuracyStats - buildSignalAccuracyStats 結果（可選）
 * @returns {Array<{text: string}>}
 */
export function buildPeriodReportMessages(stats, aiSummary, period, accuracyStats = null) {
  const isWeekly = period === "weekly";
  const periodLabel = isWeekly ? "週報" : "月報";
  const header = isWeekly ? "📊 本週策略摘要" : "📋 本月策略摘要";
  const { from, to } = stats.dateRange;

  // ── 訊息 1：數據摘要 ─────────────────────────────────────────────────────────
  const lines1 = [];

  lines1.push(`<b>${header}｜${from} – ${to}</b>`);
  lines1.push(`交易日：${stats.tradingDays} 天\n`);

  lines1.push("━━ 訊號趨勢 ━━");
  for (const d of stats.dailySignals) {
    const score = d.weightScore > 0 ? ` score:${d.weightScore}` : "";
    const macro = d.macroDirection ? ` [${d.macroDirection === "BULLISH" ? "多" : d.macroDirection === "BEARISH" ? "空" : "中"}]` : "";
    lines1.push(`${d.date} ${escHtml(d.target)}${score}${macro}`);
  }
  lines1.push("");

  lines1.push("━━ 技術指標均値 ━━");
  const { rsi, kdK, bias240 } = stats.indicators;
  lines1.push(`RSI：${formatNum(rsi.avg)}  趨勢：${TREND_ICON[rsi.trend] ?? "→"} (${rsi.min}~${rsi.max})`);
  lines1.push(`KD-K：${formatNum(kdK.avg)}  趨勢：${TREND_ICON[kdK.trend] ?? "→"} (${kdK.min}~${kdK.max})`);
  lines1.push(`乖離率：${formatNum(bias240.avg)}%  趨勢：${TREND_ICON[bias240.trend] ?? "→"} (${bias240.min}~${bias240.max})`);
  lines1.push("");

  lines1.push("━━ 過熱狀態 ━━");
  const { overheatDays, totalDays, isEscalating } = stats.overheat;
  const overheatIcon = overheatDays === 0 ? "✅" : overheatDays >= totalDays * 0.6 ? "🔥" : "⚠️";
  const escalateText = overheatDays > 0 ? (isEscalating ? " 持續升溫" : " 趨於緩和") : "";
  lines1.push(`${overheatIcon} 本週期 ${overheatDays}/${totalDays} 天觸發過熱因子${escalateText}`);
  lines1.push("");

  lines1.push("━━ 總經方向分布 ━━");
  const { bullishDays, bearishDays, neutralDays, dominantDirection } = stats.macro;
  const dIcon = DIRECTION_ICON[dominantDirection] ?? "⚖️";
  lines1.push(`多頭 ${bullishDays}天 | 空頭 ${bearishDays}天 | 中性 ${neutralDays}天`);
  lines1.push(`主導方向：${dominantDirection} ${dIcon}`);
  lines1.push("");

  lines1.push("━━ 冷卻期 ━━");
  if (stats.cooldown.blockedDays === 0) {
    lines1.push("本週期無買入訊號被冷卻擋住 ✅");
  } else {
    lines1.push(`⏸ 共 ${stats.cooldown.blockedDays} 天達買入門滝但被冷卻期擋住`);
    for (const b of stats.cooldown.blockedDetails) {
      lines1.push(`  ${b.date}  score:${b.weightScore}  剩餘 ${b.daysLeft} 天`);
    }
  }

  if (stats.signalQuality) {
    lines1.push("");
    lines1.push("━━ 訊號品質（月報）━━");
    const sq = stats.signalQuality;
    lines1.push(`達買入門滝：${sq.buyTriggeredDays}/${sq.totalTradingDays} 天`);
    lines1.push(`過熱封鎖：${sq.overheatBlockedDays} 天`);
    lines1.push(`冷卻封鎖：${sq.cooldownBlockedDays} 天`);
  }

  if (isWeekly && accuracyStats) {
    lines1.push(buildAccuracySection(accuracyStats, period));
  }

  const msg1 = lines1.join("\n");

  // ── 訊息 2：AI 分析 ───────────────────────────────────────────────────
  const lines2 = [];
  lines2.push(`<b>🤖 AI ${periodLabel}分析</b>\n`);

  lines2.push("━━ 策略一致性 ━━");
  const { isConsistent, flipCount } = stats.consistency;
  if (isConsistent) {
    lines2.push("✅ 本週期訊號方向完全一致，無多空翻轉");
  } else {
    lines2.push(`⚠️ 方向翻轉 ${flipCount} 次，策略訊號出現矛盾`);
  }
  lines2.push("");

  if (aiSummary) {
    if (aiSummary.topRiskEvents?.length) {
      lines2.push("━━ 本週期最大風险事件 ━━");
      for (const ev of aiSummary.topRiskEvents) {
        lines2.push(`• ${escHtml(ev)}`);
      }
      lines2.push("");
    }

    if (aiSummary.consistencyComment) {
      lines2.push("━━ AI 一致性評語 ━━");
      lines2.push(escHtml(aiSummary.consistencyComment));
      lines2.push("");
    }

    if (aiSummary.periodOutlook) {
      const outlookLabel = isWeekly ? "🔭 下週展望" : "🔭 下月展望";
      lines2.push(`━━ ${outlookLabel} ━━`);
      lines2.push(escHtml(aiSummary.periodOutlook));
    }
  } else {
    lines2.push("⚠️ AI 分析本次暫不可用，請參考數據摘要");
  }

  const msg2 = lines2.join("\n");

  if (isWeekly) return [{ text: msg1 }, { text: msg2 }];

  // ── 訊息 3：月報訊號準確率回顧 ───────────────────────────────────────
  const lines3 = [];
  lines3.push(`<b>🎯 訊號準確率回顧｜${from} – ${to}</b>`);
  lines3.push(buildAccuracySection(accuracyStats, period));
  const msg3 = lines3.join("\n");

  return [{ text: msg1 }, { text: msg2 }, { text: msg3 }];
}

// ── 精簡提醒卡（MiniApp 指向模式） ─────────────────────────────

/**
 * 建構週報 / 月報精簡提醒卡，適用於 MiniApp 指向模式。
 * 僅發送一則訊息 + 「📲 開啟投資儀表板」 WebApp 按鈕。
 * 詳細數據全部至 Mini App 週報 / 月報 Tab 查看。
 *
 * @param {Object} stats       - buildPeriodStats 結果
 * @param {Object|null} aiSummary
 * @param {"weekly"|"monthly"} period
 * @param {string} webAppUrl   - TELEGRAM_WEBAPP_URL
 * @returns {Array<{text: string, pin: boolean, webAppUrl: string}>}
 */
export function buildCompactPeriodMessage(stats, aiSummary, period, webAppUrl) {
  const isWeekly  = period === "weekly";
  const header    = isWeekly ? "📊 本週策略摘要" : "📋 本月策略摘要";
  const { from, to } = stats.dateRange;

  const SEP = "\n─────────────────\n";

  // ── 技術指標均値 ──
  const { rsi, kdK, bias240 } = stats.indicators;
  const rsiAvg   = formatNum(rsi.avg,    1);
  const kdkAvg   = formatNum(kdK.avg,    1);
  const biasAvg  = formatNum(bias240.avg, 1);
  const rsiTrend  = TREND_ICON[rsi.trend]    ?? "→";
  const kdkTrend  = TREND_ICON[kdK.trend]    ?? "→";
  const biasTrend = TREND_ICON[bias240.trend] ?? "→";

  // ── 過熱狀態 ──
  const { overheatDays, totalDays, isEscalating } = stats.overheat;
  const overheatEmoji = overheatDays === 0 ? "✅" : overheatDays >= totalDays * 0.6 ? "🔥" : "⚠️";
  const escalateHint  = overheatDays > 0 ? (isEscalating ? " 升溫中" : " 緩和中") : "";
  const overheatLine  = `${overheatEmoji} 過熱 ${overheatDays}/${totalDays} 天${escalateHint}`;

  // ── 總經方向 ──
  const { bullishDays, bearishDays, neutralDays, dominantDirection } = stats.macro;
  const dirIcon    = DIRECTION_ICON[dominantDirection] ?? "⚖️";
  const macroLine  = `${dirIcon} 多 ${bullishDays}天 / 空 ${bearishDays}天 / 中 ${neutralDays}天  《${dominantDirection}》`;

  // ── 冷卻期 ──
  const blockedDays  = stats.cooldown.blockedDays ?? 0;
  const cooldownLine = blockedDays > 0
    ? `⏸ 冷卻期封鎖 ${blockedDays} 天`
    : `✅ 無冷卻封鎖`;

  // ── 訊號一致性 ──
  const { isConsistent, flipCount } = stats.consistency;
  const consistLine = isConsistent
    ? "✅ 方向一致"
    : `⚠️ 翻轉 ${flipCount} 次`;

  // ── AI 展望第一句 ──
  const outlookFirstLine = aiSummary?.periodOutlook
    ? `\n🔭 ${escHtml(aiSummary.periodOutlook.split("\n")[0].slice(0, 60))}${aiSummary.periodOutlook.length > 60 ? "…" : ""}`
    : "";

  // ── 訊號統計 ──
  const buyCount     = stats.dailySignals?.filter(d => d.target?.includes("買") || d.weightScore > 0).length ?? 0;
  const signalLine   = `🟢 達買入闀値 ${buyCount} 天  ${consistLine}`;

  const text =
    `<b>${header}</b>  <code>${escHtml(from)} – ${escHtml(to)}</code>  <i>${stats.tradingDays} 交易日</i>${SEP}` +
    `📊 RSI <code>${rsiAvg}</code>${rsiTrend}  ` +
    `KD-K <code>${kdkAvg}</code>${kdkTrend}  ` +
    `乖離 <code>${biasAvg}%</code>${biasTrend}\n` +
    `${overheatLine}  ·  ${cooldownLine}\n` +
    `${macroLine}\n` +
    `${signalLine}` +
    `${outlookFirstLine}\n\n` +
    `📲 詳細數據與 AI 分析請到 Mini App 查看`;

  return [
    {
      text,
      pin: false,               // 週報/月報不釘選，避免鏋展日報釘選卡
      disable_notification: false, // 週報/月報讓它鸣鈴
      webAppUrl,
    },
  ];
}
