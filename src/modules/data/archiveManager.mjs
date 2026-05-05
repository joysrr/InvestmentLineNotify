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
  CACHE: path.join(DATA_DIR, "cache"),
};

const FILES = {
  LAST_BUY: path.join(DATA_DIR, "last_buy.json"),
  STRATEGY_CACHE: path.join(DIRS.CACHE, "strategy_cache.json"),
  PB_HISTORY: path.join(DATA_DIR, "pbHistory.json"),
  VALUATION_GUARD_STATE: path.join(DATA_DIR, "valuationGuardState.json"),
  VIX_HISTORY: path.join(DATA_DIR, "vixHistory.json"),
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
      const content = await fs.readFile(
        path.join(DIRS.MARKET, "latest.json"),
        "utf-8",
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  },

  async saveMarketData(data) {
    await ensureDirectories();
    const twDateStr = getTwDateStr();
    const latestPath = path.join(DIRS.MARKET, "latest.json");
    const historyPath = path.join(DIRS.MARKET_HISTORY, `${twDateStr}.json`);
    try {
      await fs.writeFile(latestPath, JSON.stringify(data, null, 2));
      await fs.writeFile(historyPath, JSON.stringify(data, null, 2));
      console.log(`📝 [Archive] Market 快取已更新: ${latestPath}`);
    } catch (err) {
      console.error(`❌ [Archive] saveMarketData 寫入失敗:`, err.message);
      throw err;
    }
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
  // 2.x 報告讀取 Helper
  // ==========================================================================

  /**
   * 讀取最新的一份報告（data/reports/YYYY-MM-DD.json）
   * @returns {Promise<Object|null>} 報告物件，若無任何報告則回傳 null
   */
  async getLatestReport() {
    try {
      const files = await fs.readdir(DIRS.REPORTS);
      const candidates = files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .reverse(); // 由新到舊

      if (candidates.length === 0) {
        return null;
      }

      const latestFile = candidates[0];
      const filePath = path.join(DIRS.REPORTS, latestFile);
      const content = await fs.readFile(filePath, "utf-8");
      const report = JSON.parse(content);

      // 加上 date 欄位保險一下（通常檔內已有）
      if (!report.date) {
        report.date = latestFile.replace(".json", "");
      }

      return report;
    } catch (err) {
      console.warn("⚠️ [Archive] getLatestReport 失敗:", err.message);
      return null;
    }
  },

  /**
   * 讀取指定日期的報告（data/reports/YYYY-MM-DD.json）
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Promise<Object|null>} 報告物件，不存在則回傳 null
   */
  async getReportByDate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.warn("⚠️ [Archive] getReportByDate 參數格式不正確:", dateStr);
      return null;
    }

    try {
      const filePath = path.join(DIRS.REPORTS, `${dateStr}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      const report = JSON.parse(content);
      if (!report.date) {
        report.date = dateStr;
      }
      return report;
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("⚠️ [Archive] getReportByDate 讀取失敗:", err.message);
      }
      return null;
    }
  },

  // ==========================================================================
  // 3. 前次 AI 建議摘要（供連貫性注入使用）
  // ==========================================================================

  /**
   * 讀取最近一份（非今日）的 AI 投資建議摘要，用於注入 Prompt 增強連貫性。
   *
   * 從 data/reports/ 中讀取最新的一份報告（排除今日），
   * 萃取以下欄位作為「昨日建議摘要」：
   *   - date             ← 報告日期
   *   - ai.action_items  ← 上次行動清單
   *   - ai.mindset_advice← 上次心態建議
   *   - ai.risk_warnings ← 上次風險警示
   *   - signals.marketStatus     ← 昨日系統判定
   *   - signals.targetSuggestionShort ← 昨日短期建議
   *
   * 格式化為易讀的純文字，供 Prompt 直接注入。
   *
   * @returns {string} 格式化後的摘要字串；無歷史報告時回傳空字串 ""
   */
  async getPreviousAdviceSummary() {
    try {
      const files = await fs.readdir(DIRS.REPORTS);
      const todayStr = getTwDateStr();

      // 只找 YYYY-MM-DD.json 格式，且排除今日
      const candidates = files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .filter((f) => f.replace(".json", "") !== todayStr)
        .sort()
        .reverse(); // 最新的排前面

      if (candidates.length === 0) {
        console.log("ℹ️ [Archive] 無歷史報告，略過 PreviousAdviceSummary 注入");
        return "";
      }

      const latestFile = candidates[0];
      const dateKey = latestFile.replace(".json", "");
      const filePath = path.join(DIRS.REPORTS, latestFile);
      const content = await fs.readFile(filePath, "utf-8");
      const report = JSON.parse(content);

      const ai = report?.ai;
      const signals = report?.signals;

      // 若 ai 欄位不存在或格式不符，回傳空字串（首次執行 / AI 停用時）
      if (!ai || typeof ai !== "object") {
        console.log(`ℹ️ [Archive] ${dateKey} 無 AI 建議欄位，略過注入`);
        return "";
      }

      // 萃取欄位
      const actionItems =
        Array.isArray(ai.action_items) && ai.action_items.length > 0
          ? ai.action_items.map((a) => `  - ${a}`).join("\n")
          : "  - （無）";

      const mindset =
        typeof ai.mindset_advice === "string" && ai.mindset_advice.trim()
          ? ai.mindset_advice.trim()
          : "（無）";

      const riskWarnings =
        Array.isArray(ai.risk_warnings) && ai.risk_warnings.length > 0
          ? ai.risk_warnings.map((r) => `  - ${r}`).join("\n")
          : "  - （無）";

      const prevMarketStatus = signals?.marketStatus ?? "未知";
      const prevSuggestion = signals?.targetSuggestionShort ?? "未知";

      const summary = `
【前次 AI 建議摘要（${dateKey}）】
系統判定：${prevMarketStatus}
短期建議：${prevSuggestion}

上次行動清單：
${actionItems}

上次心態建議：
  ${mindset}

上次風險警示：
${riskWarnings}
`.trim();

      console.log(`✅ [Archive] 已載入前次建議摘要 (${dateKey})`);
      return summary;
    } catch (err) {
      console.warn("⚠️ [Archive] 讀取前次建議摘要失敗:", err.message);
      return "";
    }
  },

  /**
   * 列出所有歷史報告日期（YYYY-MM-DD 格式，由新到舊排序）
   * @returns {Promise<string[]>}
   */
  async listArchiveDates() {
    try {
      const files = await fs.readdir(DIRS.REPORTS);
      return files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .map((f) => f.replace(".json", ""))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  },

  /**
   * 取得指定天數前的歷史借貸總額 (totalLoan)
   * 用於計算 10 日滾動預算
   * @param {number} daysAgo - 偏移天數
   * @returns {Promise<number>} 失敗或無資料回傳 0
   */
  async getHistoricalLoan(daysAgo) {
    const dates = await this.listArchiveDates();
    if (dates.length === 0) return 0;

    // 計算目標日期字串
    const targetTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    const targetDateStr = new Date(targetTime)
      .toLocaleDateString("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");

    // 找到小於或等於目標日期的最接近的報表 (dates 已由新到舊排序)
    let targetDate = dates[dates.length - 1]; // fallback to oldest
    for (const d of dates) {
      if (d <= targetDateStr) {
        targetDate = d;
        break;
      }
    }

    try {
      const content = await fs.readFile(
        path.join(DIRS.REPORTS, `${targetDate}.json`),
        "utf-8",
      );
      const report = JSON.parse(content);
      // 依據報表結構萃取 totalLoan
      return report?.signals?.totalLoan || report?.portfolio?.totalLoan || 0;
    } catch {
      return 0;
    }
  },

  /**
   * 獲取買入日期後的所有最高價序列
   * @param {string} dateStr - 買入日期 (YYYY-MM-DD)
   * @param {string} stockNo - 股票代號 (預設 0050)
   * @returns {Promise<number[]>}
   */
  async getHighsSince(dateStr, stockNo = "0050") {
    try {
      const months = new Set();
      const now = new Date();

      const buyDateObj = new Date(dateStr);
      if (isNaN(buyDateObj.getTime())) return [];

      // 計算買入日與現在相差的月數 (至少 3 個月)
      const diffMonths =
        (now.getFullYear() - buyDateObj.getFullYear()) * 12 +
        (now.getMonth() - buyDateObj.getMonth());
      const lookupMonths = Math.max(3, diffMonths + 1);

      // 獲取所需涵蓋月份的資料
      for (let i = 0; i < lookupMonths; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        months.add(`${y}${m}`);
      }

      const sortedMonths = Array.from(months).sort();
      let allHighs = [];
      const buyKey = dateStr.replace(/-/g, "");

      for (const mKey of sortedMonths) {
        const hist = await this.getStockHistory(stockNo, mKey);
        if (hist && Array.isArray(hist)) {
          const rows = hist.filter((h) => h.date.replace(/-/g, "") >= buyKey);
          allHighs.push(...rows.map((r) => r.high));
        }
      }
      return allHighs;
    } catch {
      return [];
    }
  },

  // ==========================================================================
  // 4. VIX 歷史紀錄 (vixHistory)
  // ==========================================================================

  /**
   * 讀取 VIX 歷史紀錄
   * @returns {Promise<Array<{date: string, value: number}>>} VIX 歷史陣列，由舊到新排序
   */
  async getVixHistory() {
    try {
      const content = await fs.readFile(FILES.VIX_HISTORY, "utf-8");
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * 儲存當日 VIX 值到歷史紀錄
   * @param {number} value - VIX 值
   * @param {string} [dateStr] - 日期字串 YYYY-MM-DD，預設為今天
   */
  async saveVixHistory(value, dateStr = null) {
    await ensureDirectories();
    const twDateStr = dateStr || getTwDateStr();

    let history = await this.getVixHistory();

    // 移除同日的舊紀錄（避免重複）
    history = history.filter((entry) => entry.date !== twDateStr);

    // 新增當日紀錄
    history.push({
      date: twDateStr,
      value: Number(value),
    });

    // 按日期排序（由舊到新）
    history.sort((a, b) => a.date.localeCompare(b.date));

    // 只保留最近 90 天的資料
    const keepDays = 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    history = history.filter((entry) => new Date(entry.date) >= cutoff);

    await fs.writeFile(
      FILES.VIX_HISTORY,
      JSON.stringify(history, null, 2),
    );
    console.log(
      `📈 [Archive] VIX 歷史已更新: ${FILES.VIX_HISTORY} [${history.length} 筆]`,
    );
  },

  // ==========================================================================
  // 5. 新聞篩選紀錄 (passedArticlesLog)
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
      ...meta,
      articles,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    console.log(
      `📰 [Archive] 新聞篩選紀錄已儲存 (${region}): ${filePath} [${articles.length} 篇]`,
    );
  },

  // ==========================================================================
  // 5. 自動清理 (Retention Policy)
  // ==========================================================================

  /**
   * @param {number} daysToKeep - 保留天數 (預設 30)
   * @param {number} aiLogDays  - AI_LOGS 另設保留天數 (預設不限，傳 0 跳過)
   */
  async cleanOldArchives(daysToKeep = 30, aiLogDays = 0) {
    const now = Date.now();
    const msToKeep = daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const dateCycleDirs = [DIRS.MARKET_HISTORY, DIRS.REPORTS, DIRS.NEWS_LOGS];

    for (const dir of dateCycleDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const filePath = path.join(dir, file);
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.json$/);

          let fileTimeMs = 0;
          if (dateMatch) {
            fileTimeMs = new Date(`${dateMatch[1]}T00:00:00Z`).getTime();
          } else {
            const stats = await fs.stat(filePath);
            fileTimeMs = stats.mtimeMs;
          }

          if (now - fileTimeMs > msToKeep) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT")
          console.warn(`⚠️ [Archive] 清理 ${dir} 失敗:`, err.message);
      }
    }

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
        if (err.code !== "ENOENT")
          console.warn(`⚠️ [Archive] 清理 AI_LOGS 失敗:`, err.message);
      }
    }

    if (deletedCount > 0) {
      console.log(
        `🧹 [Archive] 自動清理完成，已刪除 ${deletedCount} 個超過保留期限的檔案。`,
      );
    }
  },

  // ==========================================================================
  // 6. 歷史股價資料庫
  // ==========================================================================

  async getStockHistory(stockNo, monthKey) {
    try {
      const content = await fs.readFile(
        path.join(DIRS.STOCK_HISTORY, `${stockNo}_${monthKey}.json`),
        "utf-8",
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

  // ==========================================================================
  // 7. lastBuyDate 本地備份（風控容錯）
  // ==========================================================================

  /**
   * 將最後一次主動買入日期備份至本地 data/last_buy.json
   * @param {string} dateStr - 日期字串，格式 YYYY-MM-DD 或 YYYY/MM/DD
   */
  async saveLastBuyDate(dateStr) {
    await ensureDirectories();
    const payload = {
      lastBuyDate: dateStr,
      updatedAt: new Date().toISOString(),
      source: "sheet",
    };
    await fs.writeFile(FILES.LAST_BUY, JSON.stringify(payload, null, 2));
    console.log(`💾 [Archive] lastBuyDate 本地備份已更新: ${dateStr}`);
  },

  /**
   * 讀取本地備份的最後買入日期
   * @returns {string|null} 日期字串，若檔案不存在或讀取失敗回傳 null
   */
  async getLastBuyDate() {
    try {
      const content = await fs.readFile(FILES.LAST_BUY, "utf-8");
      const data = JSON.parse(content);
      return data.lastBuyDate ?? null;
    } catch {
      return null;
    }
  },

  // ==========================================================================
  // 8. Strategy 本地備份（遠端不可用時 fallback）
  // ==========================================================================

  /**
   * 將已驗證的 strategy config 備份至本地 data/cache/strategy_cache.json
   * @param {Object} config - 已通過 validateStrategyConfig 的策略物件
   */
  async saveStrategyCache(config) {
    await ensureDirectories();
    const payload = {
      _cachedAt: new Date().toISOString(),
      config,
    };
    await fs.writeFile(FILES.STRATEGY_CACHE, JSON.stringify(payload, null, 2));
    console.log(`💾 [Archive] Strategy 本地備份已更新 (v${config.version})`);
  },

  /**
   * 讀取本地備份的 strategy config
   * @returns {Object|null} strategy 物件，若不存在或解析失敗回傳 null
   */
  async getStrategyCache() {
    try {
      const content = await fs.readFile(FILES.STRATEGY_CACHE, "utf-8");
      const data = JSON.parse(content);
      return data.config ?? null;
    } catch {
      return null;
    }
  },

  // ==========================================================================
  // 9. PB 歷史快取 & ValuationGuard 狀態（計畫 A / 計畫 B）
  // ==========================================================================

  /**
   * 讀取 PB 歷史序列快取（data/pbHistory.json）
   * 確保回傳結果為依日期升序排列且去重後的純陣列格式
   * @returns {Promise<Array<{date:string, pb:number}>>}
   */
  async getPbHistory() {
    try {
      const content = await fs.readFile(FILES.PB_HISTORY, "utf-8");
      const parsed = JSON.parse(content);
      // 容錯處理：可能是 { _meta, records: [...] } 或是純陣列 [...]
      const records = Array.isArray(parsed?.records)
        ? parsed.records
        : Array.isArray(parsed)
          ? parsed
          : [];
      return records.sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  },

  /**
   * 寫入 PB 歷史序列快取（data/pbHistory.json）
   * 寫入前執行去重與排序，確保資料整潔
   * @param {Array<{date:string, pb:number}>} data
   */
  async savePbHistory(data) {
    if (!Array.isArray(data)) return;

    await ensureDirectories();

    // 去重與過濾無效資料
    const map = new Map();
    for (const r of data) {
      if (r.date && Number.isFinite(r.pb) && r.pb > 0) {
        map.set(r.date, { date: r.date, pb: r.pb });
      }
    }

    // 排序
    const sorted = [...map.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    await fs.writeFile(FILES.PB_HISTORY, JSON.stringify(sorted, null, 2));
    console.log(
      `📈 [Archive] pbHistory 已更新（${sorted.length} 筆，已排序去重）`,
    );
  },

  /**
   * 追加當日 PB 紀錄（冪等，相同日期不重複寫入）
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @param {number} pb - 數值
   */
  async appendPbHistory(date, pb) {
    if (!date || !Number.isFinite(pb) || pb <= 0) {
      console.warn(`⚠️ [Archive] appendPbHistory 無效參數: ${date}, ${pb}`);
      return false;
    }

    const records = await this.getPbHistory();
    if (records.some((r) => r.date === date)) {
      console.log(`ℹ️ [Archive] PB 為 ${date} 的紀錄已存在，略過追加`);
      return false;
    }

    records.push({ date, pb });
    await this.savePbHistory(records);
    return true;
  },

  /**
   * 讀取 ValuationGuard 防禦鎖定狀態（data/valuationGuardState.json）
   * @returns {Object | null}
   */
  async getValuationGuardState() {
    try {
      const content = await fs.readFile(FILES.VALUATION_GUARD_STATE, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  },

  /**
   * 寫入 ValuationGuard 防禦鎖定狀態（data/valuationGuardState.json）
   * @param {Object} state - { defenseLatch, latchTriggeredAt, latchReason, updatedAt, ... }
   */
  async saveValuationGuardState(state) {
    await ensureDirectories();
    const payload = { ...state, updatedAt: new Date().toISOString() };
    await fs.writeFile(
      FILES.VALUATION_GUARD_STATE,
      JSON.stringify(payload, null, 2),
    );
    console.log(
      `🛡️ [Archive] valuationGuardState 已更新（defenseLatch: ${payload.defenseLatch}）`,
    );
  },
};
