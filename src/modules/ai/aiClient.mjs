import { GoogleGenAI } from "@google/genai";

// 參數&初始化
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * 共用的 AI 呼叫函數，統一處理設定與錯誤
 */
export async function callGemini(userPrompt, systemInstruction, options = {}) {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ 缺少 GEMINI_API_KEY，跳過 AI 決策");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.1,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        responseMimeType: options.responseMimeType ?? "text/plain",
        responseSchema: options.responseSchema,
        thinkingConfig: options.thinkingConfig,
      },
    });

    let text = response.text?.trim?.() ?? "";

    // 統一清理 Markdown 標籤防呆
    if (options.responseMimeType === "application/json") {
      text = text
        .replace(/^```json\n?/, "")
        .replace(/```$/, "")
        .trim();
    } else {
      text = text
        .replace(/^```[a-zA-Z]*\n?/, "")
        .replace(/```$/, "")
        .trim();
    }

    return text;
  } catch (error) {
    console.error("❌ Gemini API 呼叫失敗:", error.message);
    throw error; // 讓外層去決定怎麼 fallback
  }
}

/**
 * 獲取AI可用模型清單
 */
export async function listAllModels() {
  console.log("正在獲取可用模型清單...\n");

  try {
    // 呼叫 ai.models.list()
    const models = await ai.models.list();

    let count = 1;
    // 由於 models 是一個異步的 Pager (迭代器)，我們使用 for await 迴圈
    for await (const model of models) {
      // 過濾出支援 "generateContent" (文字/JSON 生成) 的模型
      if (
        model.supportedActions &&
        model.supportedActions.includes("generateContent")
      ) {
        console.log(`${count}. 模型名稱: ${model.name}`);
        count++;
      }
    }

    console.log(
      "\n✅ 查詢完畢！請從上方挑選一個模型名稱放入 GEMINI_MODEL 中。",
    );
  } catch (error) {
    console.error("獲取模型失敗:", error);
  }
}
