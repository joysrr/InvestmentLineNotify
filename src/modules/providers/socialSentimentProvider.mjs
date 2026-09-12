/**
 * socialSentimentProvider.mjs
 * 社群情緒資料適配器 (PTT + Bluesky + MA + Divergence)
 *
 * 遵循 Safe-Fallback 原則：
 * 當外部定格 JSON 缺失、權限不足或毀損時，回傳標準預設值，確保主交易與風控系統 100% 不受阻斷。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SENTIMENT_FILE_PATH = path.resolve(
  __dirname,
  "../../../data/sentiment/social_sentiment_daily.json",
);

/**
 * 預設社群情緒數據契約結構 (Safe-Fallback)
 */
export const DEFAULT_SOCIAL_SENTIMENT = Object.freeze({
  date: new Date().toISOString().slice(0, 10),
  score: 50,
  ma3: 50,
  ma7: 50,
  divergenceStatus: "資料不足",
  signals: [],
  hotTopics: [],
});

/**
 * 安全數值轉換輔助函式
 */
function safeNumber(val, fallback = 50) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 讀取並正規化社群情緒定格數據
 * @param {string} [filePath] 定格檔案路徑
 * @returns {Promise<{success: boolean, data: Object, reason?: string}>}
 */
export async function fetchSocialSentimentData(
  filePath = DEFAULT_SENTIMENT_FILE_PATH,
) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        reason: "FILE_NOT_FOUND",
        data: { ...DEFAULT_SOCIAL_SENTIMENT },
      };
    }

    const raw = await fs.promises.readFile(filePath, "utf-8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        reason: "JSON_PARSE_ERROR",
        data: { ...DEFAULT_SOCIAL_SENTIMENT },
      };
    }

    const normalizedData = {
      date:
        typeof parsed.date === "string"
          ? parsed.date
          : DEFAULT_SOCIAL_SENTIMENT.date,
      score: safeNumber(parsed.score, 50),
      ma3: safeNumber(parsed.ma3, 50),
      ma7: safeNumber(parsed.ma7, 50),
      divergenceStatus:
        typeof parsed.divergenceStatus === "string"
          ? parsed.divergenceStatus
          : "NONE",
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      hotTopics: Array.isArray(parsed.hotTopics)
        ? parsed.hotTopics.map((topic) => ({
            title: String(topic.title || ""),
            source: String(topic.source || "PTT"),
            sentiment: String(topic.sentiment || "NEUTRAL"),
            url: String(topic.url || ""),
          }))
        : [],
    };

    return {
      success: true,
      data: normalizedData,
    };
  } catch (err) {
    return {
      success: false,
      reason: err.message || "UNKNOWN_ERROR",
      data: { ...DEFAULT_SOCIAL_SENTIMENT },
    };
  }
}
