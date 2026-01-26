import { GoogleGenerativeAI } from "@google/generative-ai";
import { minifyStrategy, minifyMarketData } from "../utils/aiPreprocessor.mjs";
//import fs from 'fs';
//import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
  const cleanStrategy = minifyStrategy(strategy);
  const cleanData = minifyMarketData(marketData, portfolio);
  
  // 修改後的 Prompt 區塊
  const prompt = `
[量化交易指令 - 嚴格執行]
## 1. 策略邏輯優先級 (由高至低)
1. 風控檢查：維持率 < mmDanger? -> 提示【⚠️風險：維持率過低】
2. 再平衡：z2Ratio > z2RatioHigh? -> 提示【⚖️再平衡：調降比重】
3. 賣出訊號：RSI/KD 超買達標? -> 提示【📉賣出訊號】
4. 極度過熱：(RSI>80, K>90, Bias>25) 達 2 項? -> 提示【🔥極度過熱：禁撥款】
5. 進場評分：依據累加權重得分。

## 2. 評分計算準則 (累加制)
- 跌幅分：對照 rules (d:跌幅, s:得分)。若無回檔數據則為 0。
- RSI分：RSI < oversold 則 +score。
- KD分：K < oversoldK 則 +score。
- MACD分：若 MACD 狀態為進場訊號則 +score (N/A 不計分)。

## 3. 輸入數據
策略規則：{{minifyStrategy}}
當前數據：{{minifyMarketData}}

## 4. 任務與輸出格式
請「先在內部計算」再輸出結果。
直接輸出以下格式，禁止開場白，總字數限制 250 字。

📊 **策略診斷：[總分] 分**
🎯 **執行動作：[由優先級決定之動作]**
📝 **核心邏輯**：
• [計算簡述：跌幅X分+RSI X分...]
• [優先級判斷理由：如已達過熱禁撥門檻]
⚠️ **風險提醒**：[簡短風險一句話]
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
  try {
    //return "";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("❌ Gemini AI 決策失敗:", error.message);
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}