// src/modules/sentiment/socialCollector.mjs
//
// 職責：社群輿情彙整採集器。
// 整合 PTT 與 Bluesky 雙軌爬蟲，執行關鍵字多空計分，
// 並追加寫入專案內的 data/sentiment/news_history.jsonl 歷史資料庫中。

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../utils/logger.mjs";
import { fetchPttStockPosts } from "./crawlers/pttCrawler.mjs";
import { fetchBskyStockPosts } from "./crawlers/bskyCrawler.mjs";
import { calcSocialSentimentScore } from "./crawlers/socialScoreCalculator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
export const DEFAULT_NEWS_HISTORY_PATH = path.resolve(
  PROJECT_ROOT,
  "data/sentiment/news_history.jsonl",
);

/**
 * 執行社群輿情雙軌採集與計分
 * @param {Object} options
 * @param {string} [options.historyPath]
 * @param {Array<string>} [options.keywords]
 * @returns {Promise<{date: string, score: number, itemsCount: number, record: Object}>}
 */
export async function collectSocialSentiment(options = {}) {
  const historyPath = options.historyPath || DEFAULT_NEWS_HISTORY_PATH;
  const keywords = options.keywords || ["台股", "0050", "台積電"];

  logger.info("📡 開始執行原生社群輿情採集 (PTT + Bluesky)...");

  // 1. 平行抓取 PTT 與 Bluesky
  const [pttItems, bskyItems] = await Promise.all([
    fetchPttStockPosts(2).catch((err) => {
      logger.warn({ err: err.message }, "PTT 抓取失敗，降級為空清單");
      return [];
    }),
    fetchBskyStockPosts(keywords).catch((err) => {
      logger.warn({ err: err.message }, "Bluesky 抓取失敗，降級為空清單");
      return [];
    }),
  ]);

  const allItems = [...pttItems, ...bskyItems];
  logger.info(
    {
      pttCount: pttItems.length,
      bskyCount: bskyItems.length,
      total: allItems.length,
    },
    "社群貼文採集完成",
  );

  // 2. 計算情緒分數
  const score = calcSocialSentimentScore(allItems);
  const todayStr = new Date().toISOString().slice(0, 10);

  // 3. 組裝歷史記錄物件
  const record = {
    date: todayStr,
    timestamp: new Date().toISOString(),
    score,
    sentiment_score: score,
    total_items: allItems.length,
    ptt_items: pttItems.length,
    bsky_items: bskyItems.length,
    topic_names: keywords,
    items: allItems.slice(0, 10), // 保留前 10 筆代表貼文供檢閱
  };

  // 4. 追加寫入 news_history.jsonl
  try {
    const dir = path.dirname(historyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(historyPath, JSON.stringify(record) + "\n", "utf-8");
    logger.info(
      { date: todayStr, score, historyPath },
      "社群歷史記錄已成功寫入",
    );
  } catch (err) {
    logger.error(err, "寫入社群歷史記錄失敗");
  }

  return {
    date: todayStr,
    score,
    itemsCount: allItems.length,
    record,
  };
}
