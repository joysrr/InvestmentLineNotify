import { escapeHTML } from "../../../utils/coreUtils.mjs";

// 將原本傳入 buildFlexCarouselFancy 的參數轉化為 Telegram 訊息陣列
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
  const s = result.sellSignals || { flags: {} };
  const r = result.reversal || {};

  // 基本數值處理
  const currentAsset = Number(result.netAsset || 0);
  const grossAsset = currentAsset + Number(result.totalLoan || 0);
  const mm = Number(result.maintenanceMargin);
  const hasLoan = Number(result.totalLoan) > 0;
  const displayGrossAsset = Math.floor(grossAsset).toLocaleString("zh-TW");

  // VIX 處理
  const vixValue = vixData?.value != null ? Number(vixData.value) : NaN;
  const vixLow = Number.isFinite(th.vixLowComplacency)
    ? th.vixLowComplacency
    : 13.5;
  const vixHigh = Number.isFinite(th.vixHighFear) ? th.vixHighFear : 20;
  let vixEmoji = "😐";
  if (Number.isFinite(vixValue)) {
    if (vixValue < vixLow) vixEmoji = "😴";
    else if (vixValue > vixHigh) vixEmoji = "😱";
  }

  const w = result.weightDetails ?? {};
  const score = Number(result.weightScore);
  const minScore = Number(buyTh.minWeightScoreToBuy ?? NaN);
  const scoreOk =
    Number.isFinite(score) && Number.isFinite(minScore) && score >= minScore;

  // 技術指標處理
  const rsi = Number(result.RSI);
  const kd_d = Number(result.KD_D);
  const bias = Number(result.bias240);

  let spxText = escapeHTML(usRisk?.spxChg || "N/A");
  let spxEmoji = "";
  if (spxText !== "N/A") {
    const spxNum = parseFloat(spxText);
    if (spxNum > 0) {
      spxText = `+${spxText}`;
      spxEmoji = "📈";
    } else if (spxNum < 0) {
      spxEmoji = "📉";
    } else {
      spxEmoji = "➖";
    }
  }

  const qty0050 = Number(config.qty0050).toLocaleString("en-US");
  const qtyZ2 = Number(config.qtyZ2).toLocaleString("en-US");

  // ============== 第一則訊息：HTML 高質感儀表板 ==============
  // HTML 模式語法：
  // <b>粗體</b>
  // <code>等寬灰底字</code>
  // <blockquote>引用區塊</blockquote>

  let msg1Text = `
<b>📊 投資戰報</b> ｜ <code>${escapeHTML(dateText)}</code>
狀態：<b>${escapeHTML(result.marketStatus || "未明")}</b>
📌 核心行動：<b>${escapeHTML(result.target || "觀望")}</b>
<small>${escapeHTML(result.suggestion || "無")}</small>

<b>📈 市場指標</b>
• 台指VIX： <code>${escapeHTML(vixValue.toFixed(2))}</code> ${vixEmoji}
• 美股VIX： <code>${escapeHTML(usRisk?.vix || "N/A")}</code> ${escapeHTML(usRisk?.riskIcon || "")}
• S&P500： <code>${spxText}</code> ${spxEmoji}
• 歷史位階： <b>${escapeHTML(result.historicalLevel || "N/A")}</b>

<b>🟢 進場訊號</b>
• 跌幅： <code>${Number.isFinite(w.dropScore) ? w.dropScore : "--"}</code> 分 (${escapeHTML(w.dropInfo || "--")})
• RSI： <code>${Number.isFinite(w.rsiScore) ? w.rsiScore : "--"}</code> 分 (${escapeHTML(w.rsiInfo || "--")})
• MACD： <code>${Number.isFinite(w.macdScore) ? w.macdScore : "--"}</code> 分 (${escapeHTML(w.macdInfo || "--")})
• KD： <code>${Number.isFinite(w.kdScore) ? w.kdScore : "--"}</code> 分 (${escapeHTML(w.kdInfo || "--")})
• 總評分： <code>${Number.isFinite(score) ? score : "--"} / ${minScore}</code> ${scoreOk ? "✅ 達標" : "❌ 未達"}

<b>📉 轉弱與風險</b>
• RSI： <code>${Number.isFinite(rsi) ? rsi.toFixed(1) : "--"}</code>
• KD(D)： <code>${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "--"}</code>
• 乖離率： <code>${Number.isFinite(bias) ? bias.toFixed(1) : "--"}%</code>
• 轉弱觸發： <code>${r.triggeredCount ?? 0} / ${r.totalFactor ?? 4}</code>
• 賣出觸發： <code>${s.signalCount ?? 0} / ${s.total ?? 3}</code>
`.trim();

  // ============== 第二則訊息：技術指標與帳戶配置 ==============

  let msg2Text = `
<b>🔍 技術指標</b>
• RSI： <code>${Number.isFinite(result.RSI) ? result.RSI.toFixed(1) : "N/A"}</code>
• KD(D)： <code>${Number.isFinite(result.KD_D) ? result.KD_D.toFixed(1) : "N/A"}</code>
• 乖離率： <code>${Number.isFinite(result.bias240) ? result.bias240.toFixed(1) + "%" : "N/A"}</code>
• 現價： <code>$${Number(result.currentPrice || 0).toFixed(2)}</code>
• 基準價： <code>$${Number(result.basePrice || 0).toFixed(2)}</code>
• 變動率： <code>${Number(result.changeRate || 0).toFixed(2)}%</code>

<b>🛡 帳戶配置</b>
• 實際槓桿： <code>${result.actualLeverage.toFixed(2)} 倍</code>
• 維持率： <code>${hasLoan && Number.isFinite(mm) ? mm.toFixed(0) + "%" : "未動用"}</code>
• 總資產： <code>$${displayGrossAsset}</code>
• 🛡 0050： <code>${qty0050}</code> 股
• ⚔️ 0067L： <code>${qtyZ2}</code> 股
• 借款金額： <code>$${escapeHTML(result.totalLoan?.toLocaleString() || "0")}</code> 元
`.trim();

  // ============== 第三則訊息：AI 洞察與心法 ==============

  // 處理 AI Markdown 轉 HTML (只抓 AI 產出的 **粗體** 轉成 <b>)
  let aiTextHtml = "數據分析中...";
  if (aiAdvice) {
    aiTextHtml = escapeHTML(aiAdvice)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // 處理 **粗體**
      .replace(/\*(.*?)\*/g, "<b>$1</b>"); // 處理 *粗體*
  }

  let quoteText = `<i>${escapeHTML(quote.quote)}</i>`; // <i> 是斜體

  // 利用 <blockquote> 產生漂亮的左側垂直線
  let msg3Text = `<b>🤖 AI 策略領航</b>\n\n<blockquote>${aiTextHtml}</blockquote>\n\n<b>💡 每日一句</b>\n<blockquote>${quoteText}</blockquote>`;

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=drivesdk`
    : null;
  const strategyUrl = process.env.STRATEGY_URL || null;

  return [
    { text: msg1Text },
    { text: msg2Text },
    { text: msg3Text, sheetUrl, strategyUrl },
  ];
}
