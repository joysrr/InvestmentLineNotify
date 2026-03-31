import { escapeHTML, TwDate } from "../../../utils/coreUtils.mjs";

// ── 常數 ──────────────────────────────────────────────────────
const GOAL_ASSET = 74_800_000;
const GOAL_YEARS = 33;

// ── 輔助函式 ──────────────────────────────────────────────────

/** 緊湊型點陣進度條 */
function goalBar(current, target, width = 20) {
  const c = Number(current),
    t = Number(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) {
    return "░".repeat(width); // 空白底
  }
  const filled = Math.max(1, Math.round(Math.min(1, c / t) * width));
  // █ 是實心方塊，░ 是點陣陰影
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** 維持率標籤（改用警告標誌與柔和顏色） */
function mmTag(mm, hasLoan) {
  if (!hasLoan || !Number.isFinite(mm)) return { icon: "▫️", label: "未借款" };
  if (mm >= 250) return { icon: "🛡️", label: "極度安全" };
  if (mm >= 180) return { icon: "✅", label: "健康" };
  if (mm >= 150) return { icon: "⚠️", label: "警戒" };
  return { icon: "🚨", label: "危險" };
}

/** 槓桿標籤（降低圓點飽和度，改用更專業的符號） */
function levTag(lev, targetMulti) {
  const v = Number(lev);
  if (!Number.isFinite(v) || v <= 0) return { icon: "▫️", label: "--" };
  if (v > targetMulti) return { icon: "⚠️", label: "超標" };
  if (v === targetMulti) return { icon: "⚖️", label: "滿載" };
  if (v < 1.2) return { icon: "🔹", label: "保守" };
  return { icon: "🔸", label: "適中" };
}

/** 觸發比例 icon */
function signalIcon(triggered, total) {
  const ratio = triggered / total;
  if (ratio === 0) return "▫️"; // 0觸發，用中性空方塊
  if (ratio <= 0.33) return "🔸"; // 輕微
  if (ratio <= 0.66) return "⚠️"; // 警告
  return "🔥"; // 高度觸發，用火代表熱度而非警車
}

/** PE 位階判定 */
function peStatus(pe) {
  if (pe == null) return { label: "N/A", emoji: "⬜" };
  if (pe < 12) return { label: "極度低估", emoji: "🧊" };
  if (pe < 15) return { label: "低估", emoji: "❄️" };
  if (pe < 20) return { label: "合理", emoji: "⚖️" };
  if (pe < 25) return { label: "偏高", emoji: "🔸" };
  return { label: "高估", emoji: "🔥" };
}

/** PB 位階判定 */
function pbStatus(pb) {
  if (pb == null) return { label: "N/A", emoji: "⬜" };
  if (pb < 1.5) return { label: "極度低估", emoji: "🧊" };
  if (pb < 2.0) return { label: "低估", emoji: "❄️" };
  if (pb < 3.0) return { label: "合理", emoji: "⚖️" };
  if (pb < 4.0) return { label: "偏高", emoji: "🔸" };
  return { label: "高估", emoji: "🔥" };
}

/** 格式化估值日期 (YYYYMMDD → MM/DD) */
function fmtValDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return "";
  return `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
}

/** 進場評分列 (有分數給星星，沒分數留白) */
function scoreRow(label, score, info) {
  const isScored = Number.isFinite(score) && score > 0;
  const icon = isScored ? "⭐" : "➖";
  const scoreStr = Number.isFinite(score) ? `${score}pt` : "--";

  if (isScored) {
    return `${icon} <b>${label}</b>  <code>${scoreStr}</code>  <i>${escapeHTML(info || "─")}</i>`;
  } else {
    return `${icon} <i>${label}  <code>${scoreStr}</code>  ${escapeHTML(info || "─")}</i>`;
  }
}

/** 訊號列（轉弱/賣出）(觸發用閃電/鈴鐺，未觸發用點) */
function signalRow({ name, value, condition, triggered }) {
  const icon = triggered ? "⚡" : "▫️"; // 觸發用閃電，更有動作感

  if (triggered) {
    return `${icon} <b>${name}</b>  <code>${String(value ?? "--")}</code>  <i>${escapeHTML(condition || "")}</i>`;
  } else {
    return `${icon} <i>${name}  <code>${String(value ?? "--")}</code>  ${escapeHTML(condition || "")}</i>`;
  }
}

// ── 主程式 ──────────────────────────────────────────────────

export function buildTelegramMessages({
  result,
  vixData,
  usRisk,
  macroData,
  macroAnalysis,
  config,
  dateText,
  aiAdvice,
  quote,
}) {
  const strategy = result.strategy || {};
  const th = strategy.threshold || {};
  const buyTh = strategy.buy || {};
  const sellTh = strategy.sell || {};
  const s = result.sellSignals ?? { flags: {} };
  const r = result.reversal ?? {};
  const w = result.weightDetails ?? {};

  // ── 資產數值 ──
  const currentAsset = Number(result.netAsset || 0);
  const totalLoan = Number(result.totalLoan || 0);
  const grossAsset = currentAsset + totalLoan;
  const mm = Number(result.maintenanceMargin);
  const hasLoan = totalLoan > 0;
  const mmInfo = mmTag(mm, hasLoan);

  // ── 槓桿 ──
  const levValue = Number(result.actualLeverage);
  const targetMulti = Number.isFinite(strategy.leverage?.targetMultiplier)
    ? strategy.leverage.targetMultiplier
    : 1.8;
  const levInfo = levTag(levValue, targetMulti);

  // ── 00675L 佔比 ──
  const z2Ratio = Number(result.z2Ratio);
  const z2TargetPct = Number.isFinite(th.z2TargetRatio)
    ? th.z2TargetRatio * 100
    : 40;
  const z2Safe = z2Ratio <= z2TargetPct;

  // ── VIX ──
  const vixValue = vixData?.value != null ? Number(vixData.value) : NaN;
  const vixLow = Number.isFinite(th.vixLowComplacency)
    ? th.vixLowComplacency
    : 13.5;
  const vixHigh = Number.isFinite(th.vixHighFear) ? th.vixHighFear : 20;
  let vixLabel = "正常 ⚖️"; // 中性
  if (Number.isFinite(vixValue)) {
    if (vixValue < vixLow)
      vixLabel = "過度安逸 ❄️"; // 呼應貪婪/安逸的冷卻感
    else if (vixValue > vixHigh) vixLabel = "恐慌 🔥"; // 呼應危險/過熱
  }

  // ── 進場評分 ──
  const score = Number(result.weightScore);
  const minScore = Number(buyTh.minWeightScoreToBuy ?? NaN);
  const scoreOk =
    Number.isFinite(score) && Number.isFinite(minScore) && score >= minScore;

  const dropScore = Number.isFinite(w.dropScore) ? w.dropScore : 0;
  const rsiScore = Number.isFinite(w.rsiScore) ? w.rsiScore : 0;
  const macdScore = Number.isFinite(w.macdScore) ? w.macdScore : 0;
  const kdScore = Number.isFinite(w.kdScore) ? w.kdScore : 0;

  // ── 技術指標 ──
  const rsi = Number(result.RSI);
  const kd_d = Number(result.KD_D);
  const kd_k = Number(result.KD_K);
  const kdCons = Math.min(kd_k, kd_d);
  const bias = Number(result.bias240);
  const rsiAlert =
    Number.isFinite(rsi) && rsi > Number(th.rsiOverheatLevel ?? 80);
  const dAlert =
    Number.isFinite(kd_d) && kd_d > Number(th.dOverheatLevel ?? 90);
  const biasAlert =
    Number.isFinite(bias) && bias > Number(th.bias240OverheatLevel ?? 25);

  // ── S&P 500 ──
  let spxText = escapeHTML(usRisk?.spxChg || "N/A");
  let spxEmoji = "";
  if (spxText !== "N/A") {
    const n = parseFloat(spxText);
    if (n > 0) {
      spxText = `+${spxText}`;
      spxEmoji = "📈";
    } else if (n < 0) {
      spxEmoji = "📉";
    } else {
      spxEmoji = "➖";
    }
  }

  // ── 總經與籌碼 (Macro & Chip) ──
  // 1. CNN 恐懼貪婪
  const cnnScore = macroData?.rawCnn?.score;
  const cnnRating = macroData?.rawCnn?.rating || "未知";
  let cnnEmoji = "⚖️"; // 中性改用天平
  if (cnnScore <= 25)
    cnnEmoji = "❄️"; // 恐慌(冷)
  else if (cnnScore >= 75) cnnEmoji = "🔥"; // 貪婪(熱)
  const cnnText = Number.isFinite(cnnScore)
    ? `${cnnScore}pt ${cnnEmoji} ${cnnRating}`
    : "N/A";

  // 2. 台股融資維持率
  const mmMargin = macroData?.rawMargin?.maintenanceRatio;
  let marginEmoji = "✅";
  if (mmMargin < 145) marginEmoji = "🚨";
  else if (mmMargin < 155) marginEmoji = "⚠️";
  const marginText = Number.isFinite(mmMargin)
    ? `${mmMargin.toFixed(1)}% ${marginEmoji}`
    : "N/A";

  // 3. USD/TWD 匯率 (帶漲跌)
  const fxRate =
    macroData?.rawFx?.currentRate || macroData?.rawFx?.exchangeRate;
  const fxChange = macroData?.rawFx?.changePercent;
  let fxEmoji = "➖";
  let fxTrend = "";
  if (Number.isFinite(fxChange)) {
    if (fxChange > 0.1) {
      fxEmoji = "📉";
      fxTrend = "台幣貶值";
    } else if (fxChange < -0.1) {
      fxEmoji = "📈";
      fxTrend = "台幣升值";
    }
  }
  const fxText = Number.isFinite(fxRate)
    ? `${fxRate.toFixed(2)} ${fxEmoji} ${fxTrend}`
    : "N/A";

  // 4. 景氣燈號
  const ndcDate = macroData?.rawNdc?.date || "";
  const ndcScore = macroData?.rawNdc?.score;
  const ndcLight = macroData?.rawNdc?.light || "未知";
  const ndcColor = macroData?.rawNdc?.lightColor;
  // 依照顏色給燈號 Emoji
  const lightEmojiMap = {
    red: "🔥", // 紅燈：過熱
    "yellow-red": "🏜️", // 黃紅燈：溫熱
    green: "🌿", // 綠燈：穩定成長
    "yellow-blue": "❄️", // 黃藍燈：降溫
    blue: "🧊", // 藍燈：冰凍
  };
  const ndcEmoji = lightEmojiMap[ndcColor] || "⬜";
  const ndcText = Number.isFinite(ndcScore)
    ? `${ndcScore}pt ${ndcEmoji} ${ndcLight.split(" ")[0]}${ndcDate ? " (" + ndcDate + ")" : ""}`
    : "N/A";

  // 5. 大盤估值 PE / PB
  const rawVal = macroData?.rawValuation;
  const peVal = rawVal?.pe ?? null;
  const pbVal = rawVal?.pb ?? null;
  const valDateStr = fmtValDate(rawVal?.date);
  const peInfo = peStatus(peVal);
  const pbInfo = pbStatus(pbVal);
  const peText = peVal != null
    ? `${peVal} ${peInfo.emoji} ${peInfo.label}${valDateStr ? " (" + valDateStr + ")" : ""}`
    : "N/A";
  const pbText = pbVal != null
    ? `${pbVal} ${pbInfo.emoji} ${pbInfo.label}${valDateStr ? " (" + valDateStr + ")" : ""}`
    : "N/A";

  // ── 價格變動 ──
  const priceChangePct = Number(result.priceChangePercent || 0);
  const changeIcon =
    priceChangePct > 0 ? "📈" : priceChangePct < 0 ? "📉" : "➖";

  // ── 持股 / 現金 (格式化數字) ──
  const qty0050Str = Number(config.qty0050).toLocaleString("en-US");
  const qtyZ2Str = Number(config.qtyZ2).toLocaleString("en-US");
  const cashReserveStr = Number(config.cash || 0).toLocaleString("en-US");

  // ── 目標達成率 ──
  const goalPct = ((currentAsset / GOAL_ASSET) * 100).toFixed(2);

  // ── 觸發數 ──
  const reversalTriggered = r.triggeredCount ?? 0;
  const reversalTotal = r.totalFactor ?? 4;
  const sellTriggered = s.signalCount ?? 0;
  const sellTotal = s.total ?? 3;

  // 輕盈的虛線分隔符號，加一點留白，視覺更開闊
  const SEP = "\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";

  // 取得當下時間
  const now = TwDate(); // 台北時間小時數
  const twHour = now.hour;
  const timeTag = TwDate().formatDateTime();

  // 根據排程時間判定標籤
  let timeLabel = "📊 投資戰報";
  if (twHour === 7) {
    timeLabel = "🌅 盤前推演"; // 07:45 觸發
  } else if (twHour === 10) {
    timeLabel = "📈 盤中速報"; // 10:00 觸發
  } else if (twHour === 12) {
    timeLabel = "🕛 午盤速報"; // 12:00 觸發
  } else if (twHour === 14 || twHour === 15) {
    timeLabel = "🌙 盤後總結"; // 14:40 觸發
  } else if (twHour >= 21 && twHour <= 23) {
    timeLabel = "🦉 夜間國際觀測"; // 預留給晚間排程
  }

  // ══════════════════════════════════════════════════════════════
  // 第一則：市場概況 ＋ 進場評分 ＋ 目標進度
  // ══════════════════════════════════════════════════════════════

  const sVal = Number.isFinite(score) ? score : "--";
  const mVal = Number.isFinite(minScore) ? minScore : "--";

  const scoreSection = [
    scoreRow("跌幅", dropScore, w.dropInfo),
    scoreRow("RSI", rsiScore, w.rsiInfo),
    scoreRow("MACD", macdScore, w.macdInfo),
    scoreRow("KD", kdScore, w.kdInfo),
    `<blockquote>${scoreOk ? "🟢 <b>條件達標，可評估入場</b>" : "⏸️ <b>條件未滿，請維持觀望</b>"}\n總計得分：<code>${sVal}</code> pt (門檻 <code>${mVal}</code>)</blockquote>`,
  ].join("\n");

  // 目標進度條：拿掉 <code>，並確保 tg-spoiler 內只有純文字
  // 使用 \u200B (Zero-width space) 或是全形空白 \u3000 來把複製按鈕推開
  // 這裡我們用兩個半形空白加上一個全形空白，確保尾部有足夠的緩衝區
  const paddedPct = String(goalPct).padStart(5, " ");
  const goalSection = [
    `🎯 <b>目標進度</b>  ·  ${GOAL_YEARS} 年計畫`,
    `<code>[${goalBar(currentAsset, GOAL_ASSET, 20)}] ${paddedPct}%   </code>`, // 👈 注意 % 後面故意留了 3 個空白
    `  <tg-spoiler>$${(currentAsset / 10000).toFixed(0)}萬 ／ 目標 $${(GOAL_ASSET / 10000).toFixed(0)}萬</tg-spoiler>`,
  ].join("\n");

  const msg1Text = `\
<blockquote><code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\
${SEP}\<b>${timeLabel}</b>${SEP}\
🚦 狀態：<b>${escapeHTML(result.marketStatus || "未明")}</b>
📌 行動：<b>${escapeHTML(result.target || "觀望")}</b> ─ <i>${escapeHTML(result.targetSuggestionShort || "無特殊操作")}</i>
<blockquote expandable>${escapeHTML(result.suggestion || "無進階說明")}</blockquote>\
${SEP}\🌐 <b>市場概況</b>${SEP}\
🇺🇸 美股 VIX  <code>${escapeHTML(usRisk?.vix || "N/A")}</code>  ${escapeHTML(usRisk?.riskIcon || "")}
🇺🇸 貪婪指數 <code>${cnnText}</code>
📊 S&amp;P500   <code>${spxText}</code>  ${spxEmoji}
🇹🇼 台股 VIX <code>${escapeHTML(vixValue || "N/A")}</code>  ${escapeHTML(vixLabel || "")}
🇹🇼 景氣燈號 <code>${ndcText}</code>
🇹🇼 大盤維持 <code>${marginText}</code>
🇹🇼 大盤 PE  <code>${peText}</code>
🇹🇼 大盤 PB  <code>${pbText}</code>
💵 美元台幣 <code>${fxText}</code>
📍 歷史位階  <b>${escapeHTML(result.historicalLevel || "N/A")}</b>\
${SEP}\📊 <b>進場評分</b>${SEP}\
${scoreSection}\
${SEP}\📡 <b>風險雷達</b>${SEP}\
${signalIcon(reversalTriggered, reversalTotal)} 轉弱訊號  <code>${reversalTriggered} / ${reversalTotal}</code> 個
${signalIcon(sellTriggered, sellTotal)} 賣出訊號  <code>${sellTriggered} / ${sellTotal}</code> 個
${rsiAlert ? "🔥" : "▫️"} RSI   <code>${Number.isFinite(rsi) ? rsi.toFixed(1) : "--"}</code>
${dAlert ? "🔥" : "▫️"} KD(D) <code>${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "--"}</code>
${biasAlert ? "🔥" : "▫️"} 乖離率 <code>${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "--"}</code>

${goalSection}`.trim();

  // ══════════════════════════════════════════════════════════════
  // 第二則：訊號詳情 ＋ 技術指標 ＋ 帳戶快照 (全面隱藏敏感數字)
  // ══════════════════════════════════════════════════════════════

  const reversalSignals = [
    {
      name: "RSI 轉弱",
      value: Number.isFinite(rsi) ? rsi.toFixed(1) : "--",
      condition: `>${th.rsiReversalLevel} → <${th.rsiReversalLevel}`,
      triggered: Boolean(r.rsiDrop),
    },
    {
      name: "KD(保守)轉弱",
      value: Number.isFinite(kdCons) ? kdCons.toFixed(1) : "--",
      condition: `>${th.kReversalLevel} → <${th.kReversalLevel}`,
      triggered: Boolean(r.kdDrop),
    },
    {
      name: "KD 死叉",
      value: r.kdBearCross ? "死叉" : "未發生",
      condition: "K▽D",
      triggered: Boolean(r.kdBearCross),
    },
    {
      name: "MACD 死叉",
      value: r.macdBearCross ? "死叉" : "未發生",
      condition: "DIF▽DEA",
      triggered: Boolean(r.macdBearCross),
    },
  ];

  const sellSignals = [
    {
      name: "RSI",
      value: s.flags.rsiSell ? "已觸發" : "未觸發",
      condition: `>${sellTh.rsi?.overbought} → ${sellTh.rsi?.overbought}↘`,
      triggered: Boolean(s.flags.rsiSell),
    },
    {
      name: "KD",
      value: s.flags.kdSell ? "已觸發" : "未觸發",
      condition: `K↘D & min≥${sellTh.kd?.overboughtK} | D↘${sellTh.kd?.overboughtK}`,
      triggered: Boolean(s.flags.kdSell),
    },
    {
      name: "MACD",
      value: s.flags.macdSell ? "已觸發" : "未觸發",
      condition: "DIF↘DEA & +→−",
      triggered: Boolean(s.flags.macdSell),
    },
  ];

  // 注意：此區塊所有 <tg-spoiler> 內不再包覆 <code>，以避免 Telegram 解析失效
  const msg2Text = `\
<blockquote><code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\
${SEP}\🔬 <b>技術指標</b>${SEP}\
${rsiAlert ? "🔥" : "▫️"} RSI    <code>${Number.isFinite(rsi) ? rsi.toFixed(1) : "N/A"}</code>
${dAlert ? "🔥" : "▫️"} KD(D)  <code>${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "N/A"}</code>
${biasAlert ? "🔥" : "▫️"} 乖離率 <code>${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "N/A"}</code>
💰 現價  <code>$${Number(result.currentPrice || 0).toFixed(2)}</code>  ${changeIcon} <code>${priceChangePct > 0 ? "+" : ""}${priceChangePct.toFixed(1)}%</code>
📌 基準價 <code>$${Number(result.basePrice || 0).toFixed(2)}</code>\
${SEP}\📡 <b>轉弱監控</b>  <i>（${reversalTriggered}/${reversalTotal}）</i>${SEP}\
${reversalSignals.map(signalRow).join("\n")}\
${SEP}\🛎️ <b>賣出訊號</b>  <i>（${sellTriggered}/${sellTotal}）</i>${SEP}\
${sellSignals.map(signalRow).join("\n")}\
${SEP}\🏦 <b>帳戶快照</b>${SEP}\
💼 帳戶淨值    <tg-spoiler>$${Math.floor(currentAsset).toLocaleString("en-US")}</tg-spoiler>
🏗 總資產(含貸) <tg-spoiler>$${Math.floor(grossAsset).toLocaleString("en-US")}</tg-spoiler>
${levInfo.icon} 實際槓桿    <tg-spoiler>${Number.isFinite(levValue) ? levValue.toFixed(2) + " 倍" : "--"}</tg-spoiler>  <b>${levInfo.label}</b>
${mmInfo.icon} 維持率      <tg-spoiler>${hasLoan && Number.isFinite(mm) ? mm.toFixed(0) + "%" : "未借款"}</tg-spoiler>  <b>${mmInfo.label}</b>
${z2Safe ? "✅" : "⚠️"} 00675L佔比  <tg-spoiler>${Number.isFinite(z2Ratio) ? z2Ratio.toFixed(1) + "%" : "N/A"}</tg-spoiler>  <i>上限 ${z2TargetPct.toFixed(0)}%</i>
💵 現金儲備    <tg-spoiler>$${cashReserveStr}</tg-spoiler>
💳 借款金額    <tg-spoiler>$${Number(totalLoan).toLocaleString("en-US")}</tg-spoiler>\
${SEP}\📦 <b>持倉配置</b>${SEP}\
🛡 0050    <tg-spoiler>${qty0050Str} 股</tg-spoiler>
⚔️ 0067L   <tg-spoiler>${qtyZ2Str} 股</tg-spoiler>`.trim();

  // ══════════════════════════════════════════════════════════════
  // 第三則：AI 策略 ＋ 每日一句
  // ══════════════════════════════════════════════════════════════

  // 建構總經多空對決區塊
  let macroAnalysisSection = "";
  if (macroAnalysis && macroAnalysis.conclusion) {
    const {
      bull_events = [],
      bear_events = [],
      neutral_events = [],
      total_bull_score = 0,
      total_bear_score = 0,
      conclusion,
    } = macroAnalysis;

    const topBull = bull_events
      .map((e) => `🟢 [+${e.score}] ${escapeHTML(e.event)}`)
      .join("\n");
    const topBear = bear_events
      .map((e) => `🔴 [-${e.score}] ${escapeHTML(e.event)}`)
      .join("\n");
    const topNeutral = neutral_events
      .map((e) => `⏳ [觀望] ${escapeHTML(e.event)}`)
      .join("\n");

    const eventsList = [topBull, topBear, topNeutral]
      .filter(Boolean)
      .join("\n\n");

    const takeawaysText = (conclusion.key_takeaways || [])
      .map((k) => `◦ <i>${escapeHTML(k)}</i>`)
      .join("\n");

    macroAnalysisSection = `\
🌍 <b>AI 總經多空對決</b> ［${escapeHTML(conclusion.market_direction || "未知")}］\
${SEP}\
🎯 <b>市場主軸：</b>${escapeHTML(conclusion.short_summary || "無")}
⚖️ <b>多空積分：</b>多 <code>${total_bull_score}</code> vs 空 <code>${total_bear_score}</code>

<b>📌 核心驅動邏輯：</b>
${takeawaysText}

<blockquote expandable><b>🔥 重大驅動事件：</b>
${eventsList || "無顯著事件"}</blockquote>`.trim();
  }

  let aiTextHtml = "🔄 數據分析中，請稍候...";
  if (aiAdvice?.finalAdviceText) {
    aiTextHtml = escapeHTML(aiAdvice.finalAdviceText)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/^#+\s(.+)/gm, "<b>$1</b>")
      .replace(/^[-•]\s+/gm, "◦ ")
      .replace(/\n{3,}/g, "\n\n");
  }

  const quoteAuthor = escapeHTML(quote?.author || "Unknown");
  const quoteBlock = `<i>${escapeHTML(quote?.quote || "")}</i>\n\n— <b>${quoteAuthor}</b>`;

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=drivesdk`
    : null;
  const strategyUrl = process.env.STRATEGY_URL || null;

  const msg3Text = `\
<blockquote><code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\
${SEP}\
${macroAnalysisSection}\
${SEP}🤖 <b>AI 教練洞察</b>\
${SEP}\
${aiTextHtml}

<blockquote expandable><b>🧠 教練內心推演：</b>
${escapeHTML(aiAdvice?.internalThinking || "無")}</blockquote>\
${SEP}\📈 <b>每日一句</b>${SEP}\
<blockquote>${quoteBlock}</blockquote>`.trim();

  return [
    { text: msg1Text, pin: true }, // 第一則：會響鈴/震動、釘選
    { text: msg2Text, disable_notification: true }, // 第二則：無聲
    { text: msg3Text, disable_notification: true, sheetUrl, strategyUrl }, // 第三則：無聲
  ];
}
