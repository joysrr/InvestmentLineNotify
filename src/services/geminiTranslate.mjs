import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 官方建議：除非有特定需求，不然用最新的穩定版名稱即可
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * 簡單的延遲函式
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 初始化 SDK
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function translateEnToZhTW(textEn) {
  if (!textEn) return "";
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ No GEMINI_API_KEY provided, skipping translation.");
    return "";
  }

  // 設定 Model
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    // 官方建議直接在 model 設定中包含 generationConfig
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  });

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
      // 官方推薦使用 generateContent
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text.trim();

    } catch (error) {
      // SDK 的錯誤物件中通常包含 status
      const status = error.status || error.response?.status;
      const isRateLimit = status === 429;

      if (isRateLimit || (status >= 500)) {
        console.warn(`⚠️ Gemini ${status} Error (Attempt ${attempt}/${MAX_RETRIES}). Retrying in 3s...`);

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
