// src/runSocialSentimentFetch.mjs
//
// 職責：Telegram Bot /sentiment 指令用 — 手動觸發社群情緒採集與快照生成。
// 100% 純 JS 原生實作，無 Python 與外部目錄相依。
//
// 流程：
// 1. 執行原生社群採集 (PTT + Bluesky) 並計分寫入 news_history.jsonl
// 2. 讀取 news_history.jsonl 與 reports 歷史價格
// 3. 透過 sentimentEngine 計算 3D/7D MA 與頂底背離
// 4. 寫入 data/sentiment/social_sentiment_daily.json 供 Mini App 與策略層使用

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.mjs";
import { DEFAULT_SENTIMENT_FILE_PATH } from "./modules/providers/socialSentimentProvider.mjs";
import {
  collectSocialSentiment,
  DEFAULT_NEWS_HISTORY_PATH,
} from "./modules/sentiment/socialCollector.mjs";
import { generateDailySnapshot } from "./modules/sentiment/sentimentEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.resolve(PROJECT_ROOT, "data/reports");

/**
 * 從 news_history.jsonl 讀取社群歷史記錄
 */
export function loadSentimentHistory(historyPath = DEFAULT_NEWS_HISTORY_PATH) {
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  const lines = fs.readFileSync(historyPath, "utf-8").split("\n");
  const records = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // 忽略單行壞死格式
    }
  }
  return records;
}

/**
 * 從 data/reports/YYYY-MM-DD.json 讀取價格歷史供背離比對
 */
export function loadPriceHistoryFromReports(reportsDir = REPORTS_DIR) {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const prices = [];

  for (const file of files) {
    try {
      const fullPath = path.resolve(reportsDir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const date = data.date || file.replace(".json", "");
      const close = data.price0050 || data.currentPrice || data.close;
      if (close !== undefined && close !== null) {
        prices.push({ date, close: Number(close) });
      }
    } catch {
      // 略過讀取失敗之個別檔案
    }
  }

  return prices;
}

/**
 * 手動觸發原生社群情緒採集與快照生成
 * @returns {Promise<{success: boolean, outputPath: string, snapshot?: Object, error?: string}>}
 */
export async function runSocialSentimentFetch() {
  logger.info("💬 [SocialSentiment] 開始原生手動觸發社群情緒採集與快照生成...");

  try {
    // 1. 原生採集並記錄
    const collection = await collectSocialSentiment();

    // 2. 載入歷史記錄
    const sentimentHistory = loadSentimentHistory();
    const priceHistory = loadPriceHistoryFromReports();

    // 3. 計算指標並生成每日快照
    const outputPath = DEFAULT_SENTIMENT_FILE_PATH;
    const snapshot = generateDailySnapshot(
      sentimentHistory,
      priceHistory,
      outputPath,
      {
        updatedAt: collection.record?.timestamp,
        sampleCount: collection.record?.total_items ?? collection.itemsCount,
        pttItems: collection.record?.ptt_items,
        bskyItems: collection.record?.bsky_items,
      },
    );

    logger.info(
      {
        date: snapshot.date,
        score: snapshot.score,
        ma3: snapshot.ma3,
        ma7: snapshot.ma7,
        outputPath,
      },
      "✅ [SocialSentiment] 原生社群情緒快照已成功更新",
    );

    return {
      success: true,
      outputPath,
      snapshot,
    };
  } catch (err) {
    logger.error(err, "❌ [SocialSentiment] 社群情緒更新過程失敗");
    return {
      success: false,
      outputPath: DEFAULT_SENTIMENT_FILE_PATH,
      error: err.message,
    };
  }
}
