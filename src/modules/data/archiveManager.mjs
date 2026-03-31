// archiveManager.mjs
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const DIRS = {
  MARKET: path.join(DATA_DIR, "market"),
  MARKET_HISTORY: path.join(DATA_DIR, "market", "history"),
  AI_LOGS: path.join(DATA_DIR, "ai_logs"),
  REPORTS: path.join(DATA_DIR, "reports"),
  STOCK_HISTORY: path.join(DATA_DIR, "stock_history"),
  NEWS_LOGS: path.join(DATA_DIR, "news_logs"),
};

async function ensureDirectories() {
  for (const dir of Object.values(DIRS)) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const gitkeep = path.join(dir, ".gitkeep");
      await fs.writeFile(gitkeep, "").catch(() => { });
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
}

/** 取得台灣時間的 YYYY-MM-DD 字串 */
function getTwDateStr() {
  return new Date()
    .toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
}

export const archiveManager = {
  // ==========================================================================
  // 1. Market 快取
  // ==========================================================================

  async getLatestMarketData() {
    try {
      const content = await fs.readFile(path.join(DIRS.MARKET, "latest.json"), "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  },

  async saveMarketData(data) {
    await ensureDirectories();
    const twDateStr = getTwDateStr();
    const latestPath = path.join(DIRS.MARKET, "latest.json");
    await fs.writeFile(latestPath, JSON.stringify(data, null, 2));
    const historyPath = path.join(DIRS.MARKET_HISTORY, `${twDateStr}.json`);
    await fs.writeFile(historyPath, JSON.stringify(data, null, 2));
    console.log(`📝 [Archive] Market 快取已更新: ${latestPath}`);
  },

  // ==========================================================================
  // 2. AI 軌跡 Log
  // ==========================================================================

  async saveAiLog(payload) {
    await ensureDirectories();
    const logType = payload.type || "Unknown";
    const fileName = `latest_${logType}.json`;
    const filePath = path.join(DIRS.AI_LOGS, fileName);
    const enrichedPayload = { _savedAt: new Date().toISOString(), ...payload };
    await fs.writeFile(filePath, JSON.stringify(enrichedPayload, null, 2));
    console.log(`🧠 [Archive] AI 軌跡已更新: ${filePath}`);
  },

  async saveReport(reportData) {
    await ensureDirectories();
    const filePath = path.join(DIRS.REPORTS, `${getTwDateStr()}.json`);
    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));
  },

  // ==========================================================================
  // 3. 新聞篩選紀錄 (passedArticlesLog)
  // ==========================================================================

  /**
   * 儲存通過篩選的新聞文章紀錄 (每日一檔，同日重複執行會覆寫)
   * @param {Array<Object>} articles - 通過 isArticleValid 的文章陣列
   * @param {"TW"|"US"} region - 市場區域
   * @param {Object} [meta] - 額外的除錯資訊 (關鍵字來源、fetch 統計等)
   */
  async saveNewsLog(articles, region = "TW", meta = {}) {
    await ensureDirectories();
    const twDateStr = getTwDateStr();
    const fileName = `passedArticles_${region}_${twDateStr}.json`;
    const filePath = path.join(DIRS.NEWS_LOGS, fileName);

    const payload = {
      _savedAt: new Date().toISOString(),
      region,
      count: articles.length,
      ...meta,  // 可帶入 usedKeywords, fallbackTriggered 等除錯欄位
      articles,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    console.log(`📰 [Archive] 新聞篩選紀錄已儲存 (${region}): ${filePath} [${articles.length} 篇]`);
  },

  // ==========================================================================
  // 4. 自動清理 (Retention Policy)
  // ==========================================================================

  /**
   * @param {number} daysToKeep - 保留天數 (預設 30)
   * @param {number} aiLogDays  - AI_LOGS 另設保留天數 (預設不限，傳 0 跳過)
   */
  async cleanOldArchives(daysToKeep = 30, aiLogDays = 0) {
    const now = Date.now();
    const msToKeep = daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    // 有日期輪替的目錄：依 daysToKeep 清理
    const dateCycleDirs = [
      DIRS.MARKET_HISTORY,
      DIRS.REPORTS,
      DIRS.NEWS_LOGS,
    ];

    for (const dir of dateCycleDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > msToKeep) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") console.warn(`⚠️ [Archive] 清理 ${dir} 失敗:`, err.message);
      }
    }

    // AI_LOGS：固定覆寫型，通常不需清理；若有傳 aiLogDays 則額外清理
    if (aiLogDays > 0) {
      const aiMs = aiLogDays * 24 * 60 * 60 * 1000;
      try {
        const files = await fs.readdir(DIRS.AI_LOGS);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const filePath = path.join(DIRS.AI_LOGS, file);
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > aiMs) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") console.warn(`⚠️ [Archive] 清理 AI_LOGS 失敗:`, err.message);
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 [Archive] 自動清理完成，已刪除 ${deletedCount} 個超過保留期限的檔案。`);
    }
  },

  // ==========================================================================
  // 5. 歷史股價資料庫
  // ==========================================================================

  async getStockHistory(stockNo, monthKey) {
    try {
      const content = await fs.readFile(
        path.join(DIRS.STOCK_HISTORY, `${stockNo}_${monthKey}.json`), "utf-8"
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  },

  async saveStockHistory(stockNo, monthKey, data) {
    await ensureDirectories();
    const fileName = `${stockNo}_${monthKey}.json`;
    const filePath = path.join(DIRS.STOCK_HISTORY, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`📊 [Archive] 歷史股價已存檔: ${fileName}`);
  },
};