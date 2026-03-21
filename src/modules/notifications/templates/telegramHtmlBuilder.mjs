import { escapeHTML } from "../../../utils/coreUtils.mjs";

// ── 常數 ──────────────────────────────────────────────────────
const GOAL_ASSET = 74_800_000;
const GOAL_YEARS = 33;

// ── 輔助函式 ──────────────────────────────────────────────────

/** 純 ASCII 進度條（無 <pre> 版本，避免被複製按鈕遮擋）*/
function goalBar(current, target, width = 15) {
  const c = Number(current),
    t = Number(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0)
    return "◽".repeat(width);

  const filled = Math.max(1, Math.round(Math.min(1, c / t) * width));

  // 使用實心與空心小方塊 (這兩個符號在大多數手機字體下寬度一致)
  return "◾".repeat(filled) + "◽".repeat(width - filled);
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

/** 觸發比例 icon（用於大標題旁，改用輕量級幾何圖形） */
function signalIcon(triggered, total) {
  const ratio = triggered / total;
  if (ratio === 0) return "✅"; // 安全
  if (ratio <= 0.33) return "❕"; // 稍微留意
  if (ratio <= 0.66) return "⚠️"; // 警告
  return "🚨"; // 高度危險
}

/**
 * 進場評分列
 * 優化：有分數顯示 ✅，沒分數顯示 灰色的 ➖，避免滿滿的紅綠燈
 */
function scoreRow(label, score, info) {
  const isScored = Number.isFinite(score) && score > 0;
  const icon = isScored ? "✅" : "➖";
  const scoreStr = Number.isFinite(score) ? `${score}pt` : "--";

  // 當沒有分數時，字體顏色稍微調淡 (透過 HTML i 標籤營造次要感)
  if (isScored) {
    return `${icon} <b>${label}</b>  <code>${scoreStr}</code>  <i>${escapeHTML(info || "─")}</i>`;
  } else {
    return `${icon} <i>${label}  <code>${scoreStr}</code>  ${escapeHTML(info || "─")}</i>`;
  }
}

/**
 * 訊號列（轉弱/賣出）
 * 優化：觸發顯示 ⚠️，未觸發顯示 ▫️ (極簡灰點)
 */
function signalRow({ name, value, condition, triggered }) {
  const icon = triggered ? "⚠️" : "▫️";

  // 如果觸發，文字維持粗體；如果未觸發，使用斜體降低存在感
  if (triggered) {
    return `${icon} <b>${name}</b>  <code>${String(value ?? "--")}</code>  <i>${escapeHTML(condition || "")}</i>`;
  } else {
    return `${icon} <i>${name}  <code>${String(value ?? "--")}</code>  ${escapeHTML(condition || "")}</i>`;
  }
}

// ── 主函式 ────────────────────────────────────────────────────

export function buildTelegramMessages({
  result,
  vixData,
  usRisk,
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
  const mmSafe = !hasLoan || (Number.isFinite(mm) && mm > 160);
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
  let vixLabel = "正常 😐";
  if (Number.isFinite(vixValue)) {
    if (vixValue < vixLow) vixLabel = "過度安逸 😴";
    else if (vixValue > vixHigh) vixLabel = "恐慌 😱";
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

  // ── 價格變動（result.priceChangePercent）──
  const priceChangePct = Number(result.priceChangePercent || 0);
  const changeIcon =
    priceChangePct > 0 ? "📈" : priceChangePct < 0 ? "📉" : "➖";

  // ── 持股 / 現金 ──
  const qty0050 = Number(config.qty0050).toLocaleString("en-US");
  const qtyZ2 = Number(config.qtyZ2).toLocaleString("en-US");
  const cashReserve = Number(config.cash || 0).toLocaleString("en-US");

  // ── 目標達成率 ──
  const goalPct = ((currentAsset / GOAL_ASSET) * 100).toFixed(2);

  // ── 觸發數 ──
  const reversalTriggered = r.triggeredCount ?? 0;
  const reversalTotal = r.totalFactor ?? 4;
  const sellTriggered = s.signalCount ?? 0;
  const sellTotal = s.total ?? 3;

  // 使用輕盈的虛線分隔符號
  const SEP = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

  // ══════════════════════════════════════════════════════════════
  // 第一則：市場概況 ＋ 進場評分 ＋ 目標進度
  // ══════════════════════════════════════════════════════════════

  // 進場評分：每指標獨立一行，不依賴對齊
  const scoreSection = [
    scoreRow("跌幅", dropScore, w.dropInfo),
    scoreRow("RSI", rsiScore, w.rsiInfo),
    scoreRow("MACD", macdScore, w.macdInfo),
    scoreRow("KD", kdScore, w.kdInfo),
    SEP,
    `${scoreOk ? "✅" : "❌"} <b>總分 <code>${Number.isFinite(score) ? score : "--"}pt</code></b>  門檻 <code>${Number.isFinite(minScore) ? minScore : "--"}pt</code>  ${scoreOk ? "達標可入場" : "觀望"}`,
  ].join("\n");

  // 目標進度條：移除 <pre>，避免被 Telegram 原生複製按鈕遮擋
  const goalSection = [
    `🎯 <b>目標進度</b>  ·  ${GOAL_YEARS} 年計畫`,
    `〔${goalBar(currentAsset, GOAL_ASSET)}〕 <b>${goalPct}%</b>`,
    `  <tg-spoiler>$${(currentAsset / 10000).toFixed(0)}萬 ／ 目標 $${(GOAL_ASSET / 10000).toFixed(0)}萬</tg-spoiler>`,
  ].join("\n");

  const msg1Text = `\
🗓 <b>投資戰情日報</b>  ·  <code>${escapeHTML(dateText)}</code>

🚦 狀態：<b>${escapeHTML(result.marketStatus || "未明")}</b>
📌 行動：<b>${escapeHTML(result.target || "觀望")}</b>
<blockquote expandable>${escapeHTML(result.suggestion || result.targetSuggestion || result.targetSuggestionShort || "無建議")}</blockquote>

🌐 <b>市場概況</b>
${SEP}
🇹🇼 台指 VIX  <code>${Number.isFinite(vixValue) ? vixValue.toFixed(2) : "N/A"}</code>  ${vixLabel}
🇺🇸 美股 VIX  <code>${escapeHTML(usRisk?.vix || "N/A")}</code>  ${escapeHTML(usRisk?.riskIcon || "")}
📊 S&amp;P500   <code>${spxText}</code>  ${spxEmoji}
📍 歷史位階  <b>${escapeHTML(result.historicalLevel || "N/A")}</b>

📊 <b>進場評分</b>
${SEP}
${scoreSection}

⚠️ <b>風險雷達</b>
${SEP}
${signalIcon(reversalTriggered, reversalTotal)} 轉弱訊號  <code>${reversalTriggered} / ${reversalTotal}</code> 個
${signalIcon(sellTriggered, sellTotal)} 賣出訊號  <code>${sellTriggered} / ${sellTotal}</code> 個
${rsiAlert ? "🔴" : "🟢"} RSI   <code>${Number.isFinite(rsi) ? rsi.toFixed(1) : "--"}</code>
${dAlert ? "🔴" : "🟢"} KD(D) <code>${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "--"}</code>
${biasAlert ? "🔴" : "🟢"} 乖離率 <code>${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "--"}</code>

${goalSection}`.trim();

  // ══════════════════════════════════════════════════════════════
  // 第二則：訊號詳情 ＋ 技術指標 ＋ 帳戶快照 (隱私加強版)
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

  const msg2Text = `\
🔬 <b>技術指標</b>
${SEP}
${rsiAlert ? "🔴" : "🟢"} RSI    <code>${Number.isFinite(rsi) ? rsi.toFixed(1) : "N/A"}</code>
${dAlert ? "🔴" : "🟢"} KD(D)  <code>${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "N/A"}</code>
${biasAlert ? "🔴" : "🟢"} 乖離率 <code>${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "N/A"}</code>
💰 現價  <code>$${Number(result.currentPrice || 0).toFixed(2)}</code>  ${changeIcon} <code>${priceChangePct >= 0 ? "+" : ""}${priceChangePct.toFixed(1)}%</code>
📌 基準價 <code>$${Number(result.basePrice || 0).toFixed(2)}</code>

🟡 <b>轉弱監控</b>  <i>（${reversalTriggered}/${reversalTotal}）</i>
${SEP}
${reversalSignals.map(signalRow).join("\n")}

🔴 <b>賣出訊號</b>  <i>（${sellTriggered}/${sellTotal}）</i>
${SEP}
${sellSignals.map(signalRow).join("\n")}

🏦 <b>帳戶快照</b> (點擊顯示金額)
${SEP}
💼 帳戶淨值    <tg-spoiler><code>$${Math.floor(currentAsset).toLocaleString("en-US")}</code></tg-spoiler>
🏗 總資產(含貸) <tg-spoiler><code>$${Math.floor(grossAsset).toLocaleString("en-US")}</code></tg-spoiler>
${levInfo.icon} 實際槓桿    <code>${Number.isFinite(levValue) ? levValue.toFixed(2) + " 倍" : "--"}</code>  <b>${levInfo.label}</b>
${mmInfo.icon} 維持率      <code>${hasLoan && Number.isFinite(mm) ? mm.toFixed(0) + "%" : "未借款"}</code>  <b>${mmInfo.label}</b>
${z2Safe ? "🟢" : "🔴"} 00675L佔比  <code>${Number.isFinite(z2Ratio) ? z2Ratio.toFixed(1) + "%" : "N/A"}</code>  <i>上限 ${z2TargetPct.toFixed(0)}%</i>
💵 現金儲備    <tg-spoiler><code>$${cashReserve}</code></tg-spoiler>
💳 借款金額    <tg-spoiler><code>$${Number(totalLoan).toLocaleString("en-US")}</code></tg-spoiler>

📦 <b>持倉配置</b>
${SEP}
🛡 0050    <code>${qty0050}</code> 股
⚔️ 0067L   <code>${qtyZ2}</code> 股`.trim();

  // ══════════════════════════════════════════════════════════════
  // 第三則：AI 策略 ＋ 每日一句
  // ══════════════════════════════════════════════════════════════

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
🤖 <b>AI 教練洞察</b>
${SEP}
${aiTextHtml}

<blockquote expandable><b>🧠 教練內心推演：</b>
${escapeHTML(aiAdvice?.internalThinking || "無")}</blockquote>

📈 <b>持紀律，享複利</b>
<blockquote>${quoteBlock}</blockquote>`.trim();

  return [
    { text: msg1Text },
    { text: msg2Text },
    { text: msg3Text, sheetUrl, strategyUrl },
  ];
}
