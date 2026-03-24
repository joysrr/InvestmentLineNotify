import { GoogleGenAI } from "@google/genai";

// 參數&初始化
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
].filter(Boolean);
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";

// 對每個 KEY 建立對應的 GoogleGenAI 實例
const aiInstances = GEMINI_API_KEYS.map(
  (key) => new GoogleGenAI({ apiKey: key }),
);

// 可重試的錯誤判斷
function isRetryableError(error) {
  const msg = error.message || "";
  // 503 UNAVAILABLE 或 429 RATE_LIMIT
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("429") ||
    msg.includes("RATE_LIMIT") ||
    msg.includes("quota")
  );
}

// Exponential Backoff + Jitter
function getBackoffDelay(attempt, baseDelay = 2000) {
  const exponential = baseDelay * Math.pow(2, attempt); // 2s, 4s, 8s ...
  const jitter = Math.random() * 1000; // 0~1000ms 隨機
  return exponential + jitter;
}

export async function callGemini(userPrompt, systemInstruction, options = {}) {
  if (GEMINI_API_KEYS.length === 0) {
    console.warn("⚠️ 缺少 GEMINI_API_KEYS，跳過 AI 決策");
    return null;
  }

  const keyIndex = options.keyIndex ?? 0;
  const resolvedIndex = keyIndex < aiInstances.length ? keyIndex : 0;
  const ai = aiInstances[resolvedIndex];

  const maxRetries = options.maxRetries ?? 3; // 預設最多重試 3 次

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxOutputTokens ?? 8192,
          responseMimeType: options.responseMimeType ?? "text/plain",
          responseSchema: options.responseSchema,
          thinkingConfig: options.thinkingConfig,
        },
      });

      let text = response.text?.trim?.() ?? "";

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
      const isLast = attempt === maxRetries;
      const canRetry = isRetryableError(error);

      if (canRetry && !isLast) {
        const delay = getBackoffDelay(attempt);
        console.warn(
          `⚠️ Gemini 第 ${attempt + 1} 次失敗 (key: ${resolvedIndex})，` +
            `${(delay / 1000).toFixed(1)}s 後重試... 原因: ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `❌ Gemini API 呼叫失敗 (key: ${resolvedIndex}):`,
          error.message,
        );
        throw error;
      }
    }
  }
}

/**
 * 獲取AI可用模型清單
 */
export async function listAllModels() {
  console.log("正在獲取可用模型清單...\n");

  try {
    // 呼叫 ai.models.list()
    const ai = aiInstances[0]; // 使用第一組 KEY 查詢模型清單
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
