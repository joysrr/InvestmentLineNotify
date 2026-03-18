const token = process.env.TELEGRAM_API_TOKEN;
const chatId = process.env.TELEGRAM_USER_ID;

export async function sendTelegramBatch(messages) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const payload = {
      chat_id: chatId,
      text: msg.text,
      parse_mode: "HTML",
      disable_web_page_preview: true, // 避免貼連結時跑出超大網頁預覽
    };

    // 如果這則訊息有包含網址，自動幫它加上 Inline Keyboard 按鈕
    const buttons = [];
    if (msg.sheetUrl) {
      buttons.push({ text: "📊 財富領航表", url: msg.sheetUrl });
    }
    if (msg.strategyUrl) {
      buttons.push({ text: "📄 策略設定檔", url: msg.strategyUrl });
    }

    if (buttons.length > 0) {
      payload.reply_markup = {
        // Inline 鍵盤，這裡設定為同一列橫向排開
        inline_keyboard: [buttons],
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!resData.ok) {
        console.error(`❌ 第 ${i + 1} 則發送失敗:`, resData.description);
      } else {
        console.log(`✅ 第 ${i + 1} 則發送成功`);
      }
    } catch (err) {
      console.error(`❌ 網路錯誤:`, err);
    }
  }
}

function escapeHTML(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

<b>🛡 帳戶配置</b>
• 實際槓桿： <code>${result.actualLeverage} 倍</code>
• 維持率： <code>${hasLoan && Number.isFinite(mm) ? mm.toFixed(0) + "%" : "未動用"}</code>
• 總資產： <code>$${displayGrossAsset}</code>
• 🛡 0050： <code>${qty0050}</code> 股
• ⚔️ 0067L： <code>${qtyZ2}</code> 股
`.trim();

  // ============== 第二則訊息：AI 洞察與心法 ==============

  // 處理 AI Markdown 轉 HTML (只抓 AI 產出的 **粗體** 轉成 <b>)
  let aiTextHtml = "數據分析中...";
  if (aiAdvice) {
    aiTextHtml = escapeHTML(aiAdvice)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // 處理 **粗體**
      .replace(/\*(.*?)\*/g, "<b>$1</b>"); // 處理 *粗體*
  }

  const en = quote?.textEn || quote?.textZh || "Discipline beats prediction.";
  let quoteText = `<i>${escapeHTML(en)}</i>`; // <i> 是斜體
  if (quote?.textZh && quote.textZh !== quote.textEn) {
    quoteText += `\n<i>${escapeHTML(quote.textZh)}</i>`;
  }

  // 利用 <blockquote> 產生漂亮的左側垂直線
  let msg2Text = `<b>🤖 AI 策略領航</b>\n\n<blockquote>${aiTextHtml}</blockquote>\n\n<b>💡 每日紀律</b>\n<blockquote>${quoteText}</blockquote>`;

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=drivesdk`
    : null;
  const strategyUrl = process.env.STRATEGY_URL || null;

  return [{ text: msg1Text }, { text: msg2Text, sheetUrl, strategyUrl }];
}
