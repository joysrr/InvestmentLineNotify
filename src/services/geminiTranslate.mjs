import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 官方建議：除非有特定需求，不然用最新的穩定版名稱即可
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * 簡單的延遲函式
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 初始化 Gen AI SDK
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function translateEnToZhTW(textEn) {
  if (!textEn) return "";
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ No GEMINI_API_KEY provided, skipping translation.");
    return "";
  }

  const prompt = `你是一個專業翻譯。
請把下面英文翻成「繁體中文（台灣用語）」。

規則：
1) 必須完整翻譯整句話，不可省略後半部。
2) 只輸出翻譯後的中文，不要加解釋、不加引號、不加前後贅詞。
3) 保留原句的哲學語氣與修辭比喻。

英文：
${textEn}`;

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 使用 Google Gen AI SDK 的 generateContent
      const resp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          temperature: 0.3,
          maxOutputTokens: 500,
          // 如果未來要加 thinkingConfig / structured output，也在這裡擴充
        },
      });

      // Node.js 版 Gen AI SDK 支援直接用 .text() 取整體文字 [web:51][web:117]
      const text = resp.text?.trim?.() ?? "";
      return text;

    } catch (error) {
      const status = error.status || error.response?.status;
      const isRateLimit = status === 429;

      if (isRateLimit || (status >= 500)) {
        console.warn(
          `⚠️ Gemini ${status} Error (Attempt ${attempt}/${MAX_RETRIES}). Retrying in 3s...`,
        );

        if (attempt === MAX_RETRIES) {
          console.error("❌ Gemini translation failed after retries.");
          return "";
        }
        await sleep(3000);
      } else {
        console.error("❌ Gemini Error:", error.message);
        return "";
      }
    }
  }

  return "";
}
