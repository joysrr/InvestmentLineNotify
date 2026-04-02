// newsPoolManager.mjs
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const NEWS_DIR = path.join(DATA_DIR, "news");
const POOL_PATH = path.join(NEWS_DIR, "pool_active.json");
const FILTERED_POOL_PATH = path.join(NEWS_DIR, "pool_filtered_active.json");
const ARCHIVE_DIR = path.join(NEWS_DIR, "archive");

const TTL_HOURS = 24;

// ==========================================================================
// 工具函式
// ==========================================================================

/**
 * 依 fetched_at 計算 age_band
 * - fresh:  0~6 小時
 * - recent: 6~12 小時
 * - stale:  12~24 小時
 */
function getAgeBand(fetchedAt) {
  const ageHours = (Date.now() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (ageHours <= 6) return "fresh";
  if (ageHours <= 12) return "recent";
  return "stale";
}

/**
 * 標題 fingerprint：normalize 後取 SHA-256 前 16 字元
 * 中英文標題均適用
 */
function buildFingerprint(title) {
  const normalized = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, "")
    .slice(0, 40);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

async function ensureDirs() {
  await fs.mkdir(NEWS_DIR, { recursive: true });
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
}

// ==========================================================================
// 1. Pool 基本讀寫
// ==========================================================================

/**
 * 讀取目前的 pool_active.json
 * 若不存在則回傳空 pool 結構
 */
async function loadPool() {
  try {
    const raw = await fs.readFile(POOL_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      last_updated: null,
      fetch_count: 0,
      window_hours: TTL_HOURS,
      articles: [],
    };
  }
}

async function savePool(pool) {
  await ensureDirs();
  await fs.writeFile(POOL_PATH, JSON.stringify(pool, null, 2), "utf-8");
  console.log(`📰 [NewsPool] pool_active.json 已更新 (${pool.articles.length} 篇)`);
}

// ==========================================================================
// 2. Archive 歸檔（過期文章依 fetched_at 日期分組）
// ==========================================================================

async function archiveArticles(articles) {
  if (articles.length === 0) return;
  await ensureDirs();

  // 依 fetched_at 的日期（台北時區）分組
  const byDate = {};
  for (const a of articles) {
    const date = new Date(a.fetched_at)
      .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
      .replace(/\//g, "-");
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(a);
  }

  for (const [date, items] of Object.entries(byDate)) {
    const archivePath = path.join(ARCHIVE_DIR, `${date}.json`);
    let existing = [];
    try {
      existing = JSON.parse(await fs.readFile(archivePath, "utf-8"));
    } catch {
      // 檔案不存在則從空陣列開始
    }
    await fs.writeFile(
      archivePath,
      JSON.stringify([...existing, ...items], null, 2),
      "utf-8"
    );
    console.log(`📦 [NewsPool] 歸檔 ${items.length} 篇至 archive/${date}.json`);
  }
}

// ==========================================================================
// 3. 主要更新流程
// ==========================================================================

/**
 * 以新抓到的 RSS 文章更新 pool：
 * 1. 讀取現有 pool
 * 2. 過期文章（>TTL_HOURS）歸檔
 * 3. fingerprint + URL 去重後 append 新文章
 * 4. 更新現有文章的 age_band
 * 5. 寫回 pool_active.json
 *
 * @param {Array<Object>} newArticles - RSS item 物件陣列（需含 title, link, pubDate, source, _region）
 * @returns {{ appended: number, expired: number, total: number }}
 */
export async function updatePool(newArticles) {
  const pool = await loadPool();
  const cutoff = Date.now() - TTL_HOURS * 3_600_000;

  // 分離過期與有效文章
  const expired = pool.articles.filter(
    (a) => new Date(a.fetched_at).getTime() < cutoff
  );
  const active = pool.articles.filter(
    (a) => new Date(a.fetched_at).getTime() >= cutoff
  );

  // 歸檔過期文章
  await archiveArticles(expired);

  // 建立去重 Set
  const seenIds = new Set(active.map((a) => a.id));
  const seenUrls = new Set(active.map((a) => a.url));

  const now = new Date().toISOString();
  const toAppend = [];

  for (const article of newArticles) {
    const url = article.link || article.url || "";
    const title = article.title || "";
    if (!title || !url) continue;

    const id = buildFingerprint(title);

    // fingerprint 去重為主，URL 去重為輔
    if (seenIds.has(id) || seenUrls.has(url)) continue;
    seenIds.add(id);
    seenUrls.add(url);

    toAppend.push({
      id,
      url,
      link: url,                              // 保留 link 欄位供 Telegram 訊息組裝使用
      title,
      pubDate: article.pubDate || now,        // 保留原始 pubDate 供排序與顯示
      source: article.source || "unknown",
      _region: article._region || "TW",      // 保留 _region 供 AI / 推播分組
      fetched_at: now,
      age_band: "fresh",                      // 新抓到的必定是 fresh
    });
  }

  // 更新現有 active 文章的 age_band（隨時間推移可能從 fresh → recent → stale）
  const updatedActive = active.map((a) => ({
    ...a,
    age_band: getAgeBand(a.fetched_at),
  }));

  const updatedPool = {
    last_updated: now,
    fetch_count: (pool.fetch_count || 0) + 1,
    window_hours: TTL_HOURS,
    articles: [...updatedActive, ...toAppend],
  };

  await savePool(updatedPool);

  console.log(
    `✅ [NewsPool] 新增 ${toAppend.length} 篇，歸檔 ${expired.length} 篇，` +
    `池中現有 ${updatedPool.articles.length} 篇`
  );

  return {
    appended: toAppend.length,
    expired: expired.length,
    total: updatedPool.articles.length,
  };
}

// ==========================================================================
// 4. 決策端讀取（含 fallback）
// ==========================================================================

/**
 * 讀取 pool_active.json 供決策端使用
 * 若 pool 為空，自動降級讀取昨日 archive
 *
 * @returns {{ articles: Array, meta: Object, isFallback: boolean }}
 */
export async function loadPoolWithFallback() {
  const pool = await loadPool();

  if (pool.articles.length > 0) {
    return { articles: pool.articles, meta: pool, isFallback: false };
  }

  // 降級：讀取昨日 archive
  const yesterday = new Date(Date.now() - 86_400_000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");
  const archivePath = path.join(ARCHIVE_DIR, `${yesterday}.json`);

  try {
    const raw = await fs.readFile(archivePath, "utf-8");
    const articles = JSON.parse(raw);
    console.warn(
      `⚠️ [NewsPool][FALLBACK] 當日 pool 為空，降級使用昨日 archive：${yesterday} (${articles.length} 篇)`
    );
    return {
      articles,
      meta: { ...pool, isFallback: true, fallback_date: yesterday },
      isFallback: true,
    };
  } catch {
    console.error(
      `❌ [NewsPool][FALLBACK] 昨日 archive (${yesterday}) 亦不存在，回傳空陣列`
    );
    return { articles: [], meta: pool, isFallback: false };
  }
}

// ==========================================================================
// 5. Filtered Pool 讀寫（AI Filter 結果）
// ==========================================================================

/**
 * 將 AI News Filter 的過濾結果（含 summary）寫入 pool_filtered_active.json
 * 由決策 Action 的 filterAndCategorizeAllNewsWithAI 執行完成後呼叫
 *
 * @param {Array<Object>} filteredArticles - 含 summary 的過濾後文章陣列
 * @param {string} sourcePoolUpdatedAt     - 本次讀取的 pool 的 last_updated 時間戳
 */
export async function saveFilteredPool(filteredArticles, sourcePoolUpdatedAt) {
  await ensureDirs();
  const payload = {
    generated_at: new Date().toISOString(),
    source_pool_updated_at: sourcePoolUpdatedAt || null,
    count: filteredArticles.length,
    articles: filteredArticles,
  };
  await fs.writeFile(FILTERED_POOL_PATH, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`🧠 [NewsPool] pool_filtered_active.json 已更新 (${filteredArticles.length} 篇)`);
}

// ==========================================================================
// 6. Archive 清理（供 archiveManager.cleanOldArchives 延伸呼叫）
// ==========================================================================

/**
 * 清理超過保留期限的 archive 檔案
 * @param {number} daysToKeep - 保留天數（預設 30）
 */
export async function cleanOldNewsArchives(daysToKeep = 30) {
  const msToKeep = daysToKeep * 24 * 3_600_000;
  const now = Date.now();
  let deletedCount = 0;

  try {
    const files = await fs.readdir(ARCHIVE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(ARCHIVE_DIR, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > msToKeep) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`🧹 [NewsPool] 已清理 ${deletedCount} 個超過 ${daysToKeep} 天的 archive 檔案`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("⚠️ [NewsPool] 清理 archive 失敗：", err.message);
    }
  }
}
