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
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } 
  });

  // 修改後的 Prompt 區塊
  const prompt = `
  你是一位精通台股槓桿投資的「資深量化分析師」。請針對以下數據提供客觀診斷。

  ### 【策略準則】
  ${JSON.stringify({ buy: strategy.buy, allocation: strategy.allocation, threshold: strategy.threshold })}

  ### 【當前數據】
  - 標的：0050 / 00675L
  - 數據指標：RSI ${marketData.RSI}, K ${marketData.KD_K}, 240MA乖離 ${marketData.bias240}%
  - 帳戶狀態：維持率 ${marketData.maintenanceMargin}%, 現金 ${portfolio.cash}

  ### 【執行要求】
  1. **策略評分**：嚴格依據準則計算總分。
  2. **操作建議**：給出明確動作 (加碼/續抱/減碼/補錢)。
  3. **邏輯說明**：條列 2 點核心依據，語氣需平穩專業。
  4. **風險提示**：簡述當前最需注意的風險。

  ### 【回覆規範】
  - **語氣**：專業、冷靜、客觀。
  - **格式**：
    📊 **策略診斷：[X] 分**
    🎯 **執行動作：[動作名稱]**
    📝 **核心邏輯**：
    • [依據 1]
    • [依據 2]
    ⚠️ **風險提醒**：[簡短內容]
  - **字數**：嚴格限制在 400 字以內，禁止開場白。
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