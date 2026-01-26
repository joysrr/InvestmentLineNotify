import { GoogleGenerativeAI } from "@google/generative-ai";
import { minifyExplainInput } from "../utils/aiPreprocessor.mjs";
//import fs from 'fs';
//import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 將長字串壓成單行，避免 LLM 直接照抄造成爆行
function toOneLine(text) {
  if (text == null) return text;
  return String(text)
    .replace(/\r?\n+/g, "；")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 根據策略與現狀產生 AI 投資建議
 */
export async function getAiInvestmentAdvice(marketData, portfolio, strategy) {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ 缺少 GEMINI_API_KEY，跳過 AI 決策");
    return null;
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  });

  // ⚡️ 執行預處理
  const cleanData = minifyExplainInput(marketData, portfolio);
  // 防止某些欄位（如 reasonOneLine）含換行，導致 LLM照抄爆行
  if (cleanData?.conclusion?.reasonOneLine) {
    cleanData.conclusion.reasonOneLine = toOneLine(cleanData.conclusion.reasonOneLine);
  }

  const json = JSON.stringify(cleanData, null, 2);

  const prompt = `你是「投資戰報洞察教練」。我已經在 LINE 的其他區塊顯示了所有計算結果（例如市場狀態、行動建議、門檻對照、分數、指標數值）。
你的任務不是重複那些數字，而是基於下方資料，額外提供幾點「風險提醒、觀察重點、行動微調建議」，放進同一個 bubble。

硬性規則：
- 只能使用下方資料的資訊；不要推測、不要補資料。
- 不要原文重複這些欄位：conclusion.marketStatus、conclusion.target、conclusion.suggestionShort、entryCheck.drop.text、entryCheck.score.text。
- 允許 Markdown：粗體（用兩個星號）、條列（用 - 開頭）、引用（用 > 開頭）。
- 禁止表格、禁止程式碼區塊；輸出中不要出現反引號字元。
- 總行數12～15 行，每行盡量短，單行不超過約 30 個全形字。
- 若值為 null：寫「N/A（資料不足）」並避免下結論。
- 以「目標槓桿 ${strategy.leverage.targetMultiplier} 倍」為資產配置的核心基準。
- 實際槓桿 > 1.8x：定義為「過度擴張」，需嚴格禁止加碼並觀察維持率。
- 實際槓桿 1.6x ~ 1.8x：定義為「目標區間」，依策略紀律執行。
- 實際槓桿 < 1.6x：定義為「防禦狀態」，說明目前仍有風險承擔空間。

你必須輸出 3 個區塊（順序固定）：

**⚠️ 風險提示**
- 列出 2～3 點「目前最需要留意的風險」，來源可來自 riskWatch.overheat、riskWatch.sell、riskWatch.reversal、account。
- 每點只要說明「風險是什麼」與「為何現在要注意」，用自然語句即可，不要寫欄位名稱或路徑。
- 根據目前的「實際槓桿(account.actualLeverage)」倍數與「歷史位階(riskWatch.historicalLevel)」位階，說明資產配置是否過於激進或保守。
- 若「歷史位階(riskWatch.historicalLevel)」顯示過熱，請強調均值回歸的風險。

**✅ 下一步觀察清單**
- 列出 2～3 個「未來幾天要觀察的條件」，例如跌幅是否達門檻、轉弱觸發數是否接近門檻、賣出訊號是否開始累積。
- 每點格式像這樣：- 觀察：...；若發生 → 建議：...
- 不要再重複具體數字，只描述方向與條件（例如「跌幅接近 20% 門檻」）。

**🧭 行動微調建議**
- 列出 1～2 個「不改動核心策略」的微調建議，例如：保持禁止撥款紀律、避免追價、把注意力放在哪幾個指標上。
- 用平實語氣，專注在「今天應該怎麼看待這份戰報」。

最後一行（可選）：
> 若 disciplineReminder 不為 null，請用一句話引用它；否則省略。

重要：
- 不要寫出任何 JSON 欄位名稱或路徑（例如 riskWatch.xxx、entryCheck.xxx 等字樣）。只能用自然語句描述。
- 視覺上要簡潔，每個條列點只寫一行，不要換行分段。

以下是預處理資料（JSON，只能讀取，不要在輸出重貼）：
<JSON>
${json}
</JSON>
`;
  /*
    // ⚡️ 新增：將 Prompt 與數據輸出成暫存 JSON
    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        generatedPrompt: prompt
      };
  
      const tempFilePath = path.join(process.cwd(), 'temp_prompt.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(debugData, null, 2), 'utf8');
      console.log(`\n📝 [Debug] Prompt 已導出至: ${tempFilePath}`);
    } catch (err) {
      console.warn("⚠️ 無法寫入暫存 Prompt 檔案:", err.message);
    }
   */
  //console.log("prompt", prompt);
  try {
    //return "";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text()?.trim() ?? "";

    // 避免模型自己把整段用 ``` 包起來
    return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  } catch (error) {
    console.error("❌ Gemini AI 決策失敗:", error.message);
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}