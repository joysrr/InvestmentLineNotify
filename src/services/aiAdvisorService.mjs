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
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } 
  });

  // ⚡️ 執行預處理
  const cleanStrategy = minifyStrategy(strategy);
  const cleanData = minifyMarketData(marketData, portfolio);
  
  // 修改後的 Prompt 區塊
  const prompt = `
  [量化交易指令]
  ## 策略規則
  ${JSON.stringify(cleanStrategy)}

  ## 當前數據
  ${JSON.stringify(cleanData)}

  ## 任務
1. 核對指標並「逐項累加」計算總評分（指標 N/A 則不計分）。
2. 對照配置表（s 為門檻）給出執行動作。
3. 簡述理由（需提及乖離率與過熱狀態）與風險。

  ## 格式
  📊 策略診斷：[X] 分
  🎯 執行動作：[動作]
  📝 核心邏輯：•原因1 •原因2
  ⚠️ 風險提醒：[簡述]
  直接輸出，200字內。
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