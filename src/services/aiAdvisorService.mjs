import { GoogleGenerativeAI } from "@google/generative-ai";

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
    generationConfig: { temperature: 0.2, maxOutputTokens: 800 } 
  });

  const prompt = `
你是一位冷靜的台股量化交易官。請根據以下【策略規則】與【當前數據】計算評分並給出決策。

### 【策略規則 JSON】
${JSON.stringify(strategy, null, 2)}

### 【當前數據】
- 標的：0050 / 00675L
- 0050 價格：${marketData.price0050} (年線乖離率：${marketData.bias240}%)
- 00675L 價格：${marketData.currentPrice} (基準價：${marketData.basePrice})
- 近期高點回檔幅：${marketData.priceDropPercent}%
- 指標：RSI=${marketData.RSI}, K=${marketData.KD_K}, MACD=${marketData.macdStatus}
- 恐慌 VIX：${marketData.VIX}

### 【帳戶狀態】
- 預估維持率：${marketData.maintenanceMargin}%
- 正2 淨值佔比：${marketData.z2Ratio}%
- 現金餘額：${portfolio.cash} TWD

### 【執行要求】
1. 計算【買入評分 (Weight Score)】並對照策略中的 allocation 表。
2. 檢查維持率是否觸發 mmDanger (160%)。
3. 給出具體的【今日動作】(加碼/續抱/減碼/補錢)。
4. 輸出格式請包含：[評分診斷]、[目標配置]、[具體動作]、[理由]、[風險警語]。
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("❌ Gemini AI 決策失敗:", error.message);
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}