import fs from "fs/promises";
import path from "path";

// 定義系統資料總目錄
const DATA_DIR = path.join(process.cwd(), "data");

// 定義子目錄結構
const DIRS = {
  MARKET: path.join(DATA_DIR, "market"),
  MARKET_HISTORY: path.join(DATA_DIR, "market", "history"),
  AI_LOGS: path.join(DATA_DIR, "ai_logs"),
  REPORTS: path.join(DATA_DIR, "reports"),
  STOCK_HISTORY: path.join(DATA_DIR, "stock_history"),
};

/**
 * 確保所有資料夾都存在
 */
async function ensureDirectories() {
  for (const dir of Object.values(DIRS)) {
    try {
      await fs.mkdir(dir, { recursive: true });
      // 確保 Git 能追蹤空資料夾
      const gitkeep = path.join(dir, ".gitkeep");
      await fs.writeFile(gitkeep, "").catch(() => {});
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
}

/**
 * 系統檔案與快取管理員 (Archive Manager)
 */
export const archiveManager = {
  // ==========================================================================
  // 1. 讀取與寫入 Market 快取 (供 Data Providers 使用)
  // ==========================================================================

  /**
   * 讀取最新的市場快取資料
   * @returns {Promise<Object|null>} 若無檔案則回傳 null
   */
  async getLatestMarketData() {
    try {
      const filePath = path.join(DIRS.MARKET, "latest.json");
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      return null;
    }
  },

  /**
   * 儲存市場資料 (同時更新 latest.json 與當日的 history 備份)
   * @param {Object} data - 包含 _meta 與 data 的完整物件
   */
  async saveMarketData(data) {
    await ensureDirectories();

    // 取得當前的日期 (台灣時間) 作為歷史檔名
    const twDateStr = new Date()
      .toLocaleDateString("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-"); // 產出 YYYY-MM-DD

    // 1. 寫入/覆寫最新狀態 (給下一次排程讀取)
    const latestPath = path.join(DIRS.MARKET, "latest.json");
    await fs.writeFile(latestPath, JSON.stringify(data, null, 2));

    // 2. 寫入歷史備份 (每日一檔，當日重複執行會覆寫)
    const historyPath = path.join(DIRS.MARKET_HISTORY, `${twDateStr}.json`);
    await fs.writeFile(historyPath, JSON.stringify(data, null, 2));

    console.log(`📝 [Archive] Market 快取已更新: ${latestPath}`);
  },

  // ==========================================================================
  // 2. 寫入除錯與報告檔案 (AI 飛行紀錄器 & 最終戰報)
  // ==========================================================================

  /**
   * 儲存 AI 軌跡與除錯用 Log (永遠覆寫，只保留該類型的最新一次紀錄)
   * @param {Object} payload - 包含 prompt, context, response 的物件 (需帶有 type 屬性)
   */
  async saveAiLog(payload) {
    await ensureDirectories();

    // 取得日誌類型 (如 "InvestmentAdvice", "MacroAnalysis")，若無則分類為 "Unknown"
    const logType = payload.type || "Unknown";

    // 檔名固定為該類型，例如：latest_InvestmentAdvice.json
    const fileName = `latest_${logType}.json`;
    const filePath = path.join(DIRS.AI_LOGS, fileName);

    // 雖然是覆寫檔案，但我們還是在內容裡面加上執行的時間戳記，方便你除錯時看時間
    const enrichedPayload = {
      _savedAt: new Date().toISOString(),
      ...payload,
    };

    await fs.writeFile(filePath, JSON.stringify(enrichedPayload, null, 2));
    console.log(`🧠 [Archive] AI 軌跡已更新: ${filePath}`);
  },

  /**
   * 儲存發送給 Telegram 的最終報告結果 (留存用)
   * @param {Object} reportData - 戰報物件
   */
  async saveReport(reportData) {
    await ensureDirectories();

    const twDate = new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
      .replace(/\//g, "-");
    const filePath = path.join(DIRS.REPORTS, `${twDate}.json`);

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));
  },

  // ==========================================================================
  // 3. 自動清理機制 (Retention Policy)
  // ==========================================================================

  /**
   * 清理過期的歷史檔案，避免 Git Repo 隨時間無限膨脹
   * @param {number} daysToKeep - 保留的天數 (預設 30 天)
   */
  async cleanOldArchives(daysToKeep = 30) {
    const now = Date.now();
    const msToKeep = daysToKeep * 24 * 60 * 60 * 1000;

    const targetDirs = [DIRS.MARKET_HISTORY, DIRS.AI_LOGS, DIRS.REPORTS];
    let deletedCount = 0;

    for (const dir of targetDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;

          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);

          // 如果檔案的最後修改時間超過保留期限，則刪除
          if (now - stats.mtimeMs > msToKeep) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.warn(`⚠️ [Archive] 清理 ${dir} 失敗:`, err.message);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(
        `🧹 [Archive] 自動清理完成，已刪除 ${deletedCount} 個超過 ${daysToKeep} 天的過期檔案。`,
      );
    }
  },

  // ==========================================================================
  // 4. 歷史股價資料庫 (Stock History)
  // ==========================================================================

  /**
   * 讀取本地的歷史股價資料庫
   * @param {string} stockNo - 股票代號 (例如 0050)
   * @param {string} monthKey - 年月 (例如 202603)
   * @returns {Promise<Array|null>} 若無檔案則回傳 null
   */
  async getStockHistory(stockNo, monthKey) {
    try {
      const fileName = `${stockNo}_${monthKey}.json`;
      const filePath = path.join(DIRS.STOCK_HISTORY, fileName);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      return null;
    }
  },

  /**
   * 儲存單月歷史股價至本地資料庫 (永久保存，不隨日期清理)
   * @param {string} stockNo - 股票代號
   * @param {string} monthKey - 年月
   * @param {Array} data - 股價資料陣列
   */
  async saveStockHistory(stockNo, monthKey, data) {
    await ensureDirectories();
    const fileName = `${stockNo}_${monthKey}.json`;
    const filePath = path.join(DIRS.STOCK_HISTORY, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`📊 [Archive] 歷史股價已存檔: ${fileName}`);
  },
};
