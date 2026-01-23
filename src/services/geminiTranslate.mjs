import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function translateEnToZhTW(textEn) {
  if (!textEn) return "";
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const prompt = [
    "你是一個專業翻譯。",
    "請把下面英文翻成「繁體中文（台灣用語）」。",
    "規則：",
    "1) 只輸出翻譯後的中文，不要加解釋、不加引號、不加前後贅詞。",
    "2) 保留原句語氣，避免過度口語。",
    "3) 若有人名或專有名詞，盡量音譯或保留原文。",
    "",
    "英文：",
    textEn,
  ].join("\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 256,
    },
  };

  const res = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    timeout: 20_000,
  });

  const text =
    res?.data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join("") ?? "";

  return text.trim();
}
