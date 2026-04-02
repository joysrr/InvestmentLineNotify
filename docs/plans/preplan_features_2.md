# Pre-plan Features 2 (待評估與實作功能池)

## 📌【架構優化類】新聞採集與決策分析管線分離（News Pipeline Decoupling）

### 🎯 功能目標

將現有單一 GitHub Actions 工作流程中「新聞採集」與「AI 決策分析」兩個階段拆分為獨立的管線，透過本地 File System 的新聞池（News Pool）作為中介層，實現以下目標：

1. **新聞高頻採集**：新聞採集 Action 以比決策更高的頻率觸發（建議每 2~3 小時），讓新聞資料保持即時性。
2. **AI 去重節省成本**：透過標題 fingerprint + URL 二次去重機制，確保相同新聞不會被重複餵給 AI 處理，降低 token 消耗。
3. **決策流程解耦穩定**：決策 Action 不再依賴即時新聞抓取，直接讀取整理好的新聞池，即使新聞採集端偶發失敗，決策主流程仍可正常執行（降級讀昨日資料）。
4. **時效性標記優化**：對每篇新聞標記 `age_band`（時段分級），並更新 Macro Analyst prompt，讓 AI 在多空加權時能考量新聞時效，提升分析品質。

此功能為現有架構的**基礎設施優化**，不改變 AI 決策邏輯，但影響資料流的串接方式，需謹慎規劃異動範圍。

---

### 📁 影響範圍

| 模組 / 職責 | 預計異動 | 路徑 |
|---|---|---|
| 新聞採集排程（新增） | 新增獨立入口 `runNewsFetch.mjs`，作為新聞 Action 的執行起點 | `src/runNewsFetch.mjs` |
| 新聞池管理器（新增） | 新增 `newsPoolManager.mjs`，封裝 pool 讀寫、去重、TTL 清理、archive 歸檔邏輯 | `src/modules/data/newsPoolManager.mjs` |
| 新聞抓取模組 | 現有邏輯保留，新增 export 介面供 `runNewsFetch.mjs` 直接呼叫，移除與 `dailyCheck.mjs` 的耦合 | `src/modules/newsFetcher.mjs` |
| AI 決策管線入口 | `aiCoach.mjs` 中的新聞輸入來源，從「即時抓取結果」改為「讀取 filtered pool」 | `src/modules/ai/aiCoach.mjs` |
| AI Filter 結果回存 | News Filter 執行完成後，將含 AI summary 的過濾結果寫入 `pool_filtered_active.json` | `src/modules/ai/aiCoach.mjs` |
| Macro Analyst Prompt | 新增 `age_band` 欄位說明，指示 AI 在事件加權時應優先參考 `fresh` 級別新聞 | `src/modules/ai/prompts.mjs` |
| 資料預處理器 | 調整新聞資料輸入格式，加入 `age_band` 欄位的語意化處理 | `src/modules/ai/aiDataPreprocessor.mjs` |
| 新聞本地資料夾（新增） | 新增 `data/news/` 資料夾，存放 `pool_active.json`、`pool_filtered_active.json` 與 `archive/` | `data/news/` |
| GitHub Actions Workflow（新增） | 新增 `news-fetch.yml`，設定高頻觸發排程 | `.github/workflows/news-fetch.yml` |
| GitHub Actions Workflow（異動） | `daily-decision.yml`（原主流程）移除新聞抓取步驟，改為讀取 pool 介面 | `.github/workflows/daily-decision.yml` |
| archiveManager | 可選：記錄新聞池更新結果至系統 log | `src/modules/data/archiveManager.mjs` |

---

### ⚙️ 實作步驟草案 (Step-by-Step)

#### Step 1：定義新聞池（News Pool）資料結構

新增 `data/news/` 資料夾，包含以下兩個常駐檔案：

**`data/news/pool_active.json`**（原始新聞池，由新聞 Action 維護）
```json
{
  "last_updated": "2026-04-02T09:30:00+08:00",
  "fetch_count": 3,
  "window_hours": 24,
  "articles": [
    {
      "id": "sha256_fingerprint_hex",
      "url": "https://...",
      "title": "聯準會暗示維持利率不變",
      "source": "rss_tw",
      "fetched_at": "2026-04-02T07:00:00+08:00",
      "age_band": "fresh"
    }
  ]
}
```

**`data/news/pool_filtered_active.json`**（AI Filter 輸出，由決策 Action 維護）
```json
{
  "generated_at": "2026-04-02T15:00:00+08:00",
  "source_pool_updated_at": "2026-04-02T14:30:00+08:00",
  "articles": [
    {
      "id": "sha256_fingerprint_hex",
      "url": "https://...",
      "title": "聯準會暗示維持利率不變",
      "summary": "AI 產出的摘要內容...",
      "source": "rss_tw",
      "fetched_at": "2026-04-02T07:00:00+08:00",
      "age_band": "fresh",
      "importance_hint": "high"
    }
  ]
}
```

**`data/news/archive/YYYY-MM-DD.json`**（過期新聞歸檔，每日一份）

---

#### Step 2：新增 `newsPoolManager.mjs`，封裝 pool 核心邏輯

```js
// src/modules/data/newsPoolManager.mjs

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const POOL_PATH = "data/news/pool_active.json";
const ARCHIVE_DIR = "data/news/archive";
const TTL_HOURS = 24;

// age_band 分級定義
function getAgeBand(fetchedAt) {
  const ageHours = (Date.now() - new Date(fetchedAt).getTime()) / 3600000;
  if (ageHours <= 6) return "fresh";     // 0~6 小時
  if (ageHours <= 12) return "recent";   // 6~12 小時
  return "stale";                        // 12~24 小時
}

// 標題 fingerprint：normalize 後取 SHA-256 前 16 字元
function buildFingerprint(url, title) {
  const normalized = title.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "").slice(0, 40);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export async function loadPool() {
  try {
    const raw = await fs.readFile(POOL_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { last_updated: null, fetch_count: 0, window_hours: TTL_HOURS, articles: [] };
  }
}

export async function savePool(pool) {
  await fs.mkdir("data/news", { recursive: true });
  await fs.writeFile(POOL_PATH, JSON.stringify(pool, null, 2), "utf-8");
}

// 主要更新流程：去重 + TTL 清理 + archive 歸檔 + append 新文章
export async function updatePool(newArticles) {
  const pool = await loadPool();
  const now = Date.now();
  const cutoff = now - TTL_HOURS * 3600000;

  // 分離過期與有效文章
  const expired = pool.articles.filter(a => new Date(a.fetched_at).getTime() < cutoff);
  const active = pool.articles.filter(a => new Date(a.fetched_at).getTime() >= cutoff);

  // 歸檔過期新聞（依日期分組）
  if (expired.length > 0) {
    await archiveArticles(expired);
  }

  // 建立現有 fingerprint + url 的 Set，用於去重
  const seenIds = new Set(active.map(a => a.id));
  const seenUrls = new Set(active.map(a => a.url));

  // 過濾新文章：fingerprint 去重為主，URL 去重為輔
  const toAppend = [];
  for (const article of newArticles) {
    const id = buildFingerprint(article.url, article.title);
    if (seenIds.has(id) || seenUrls.has(article.url)) continue;
    seenIds.add(id);
    seenUrls.add(article.url);
    toAppend.push({
      id,
      url: article.url,
      title: article.title,
      source: article.source,
      fetched_at: new Date().toISOString(),
      age_band: "fresh", // 新抓到的必定是 fresh
    });
  }

  // 更新 age_band（現有 active 文章可能隨時間移至 recent/stale）
  const updatedActive = active.map(a => ({ ...a, age_band: getAgeBand(a.fetched_at) }));

  const updatedPool = {
    last_updated: new Date().toISOString(),
    fetch_count: (pool.fetch_count || 0) + 1,
    window_hours: TTL_HOURS,
    articles: [...updatedActive, ...toAppend],
  };

  await savePool(updatedPool);
  return { appended: toAppend.length, expired: expired.length, total: updatedPool.articles.length };
}

async function archiveArticles(articles) {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  // 依 fetched_at 日期分組歸檔
  const byDate = {};
  for (const a of articles) {
    const date = a.fetched_at.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(a);
  }
  for (const [date, items] of Object.entries(byDate)) {
    const archivePath = path.join(ARCHIVE_DIR, `${date}.json`);
    let existing = [];
    try {
      existing = JSON.parse(await fs.readFile(archivePath, "utf-8"));
    } catch {}
    await fs.writeFile(archivePath, JSON.stringify([...existing, ...items], null, 2));
  }
}

// 讀取 pool 用於 fallback（若 pool 為空則降級讀昨日 archive）
export async function loadPoolWithFallback() {
  const pool = await loadPool();
  if (pool.articles.length > 0) return { pool, isFallback: false };

  // 降級：讀昨日 archive
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const archivePath = path.join(ARCHIVE_DIR, `${yesterday}.json`);
  try {
    const raw = await fs.readFile(archivePath, "utf-8");
    const articles = JSON.parse(raw);
    console.warn(`[NewsPool][FALLBACK] 當日 pool 為空，降級使用昨日 archive：${yesterday}`);
    return {
      pool: { ...pool, articles, isFallback: true },
      isFallback: true,
    };
  } catch {
    console.error("[NewsPool][FALLBACK] 昨日 archive 亦不存在，回傳空 pool");
    return { pool, isFallback: false };
  }
}
```

---

#### Step 3：新增 `runNewsFetch.mjs`（新聞 Action 入口）

```js
// src/runNewsFetch.mjs

import { fetchAllNews } from "./modules/newsFetcher.mjs";
import { updatePool } from "./modules/data/newsPoolManager.mjs";
import { getMarketCache } from "./modules/providers/marketData.mjs"; // 共用 market cache
// 若 Search Queries Generator 需要動態關鍵字，在此呼叫
import { generateSearchQueries } from "./modules/ai/aiCoach.mjs";

async function runNewsFetch() {
  console.log("[NewsFetch] 開始執行新聞採集管線");

  try {
    // 1. 讀取 market cache（共用，不重新抓取）
    const marketSnapshot = await getMarketCache();

    // 2. 呼叫 Search Queries Generator 產生動態關鍵字
    const { twQueries, usQueries } = await generateSearchQueries(marketSnapshot);

    // 3. 抓取 RSS 新聞（靜態 base + 動態關鍵字）
    const rawArticles = await fetchAllNews({ twQueries, usQueries });

    // 4. 更新新聞池（去重 + TTL 清理 + archive + append）
    const result = await updatePool(rawArticles);

    console.log(
      `[NewsFetch] 完成。新增: ${result.appended} 篇，過期歸檔: ${result.expired} 篇，池中現有: ${result.total} 篇`
    );
  } catch (err) {
    console.error("[NewsFetch] 執行失敗：", err.message);
    process.exit(1);
  }
}

runNewsFetch();
```

---

#### Step 4：調整 `aiCoach.mjs` — 新聞來源改為讀 pool，Filter 結果回存

決策 Action 執行時，`aiCoach.mjs` 的新聞輸入來源從即時抓取改為讀取 pool：

```js
// aiCoach.mjs 調整重點（示意，非完整程式碼）

import { loadPoolWithFallback } from "../data/newsPoolManager.mjs";
import fs from "fs/promises";

const FILTERED_POOL_PATH = "data/news/pool_filtered_active.json";

export async function runAiPipeline(marketData, strategyResult) {
  // 1. 從 pool 讀取新聞（含 fallback 機制）
  const { pool, isFallback } = await loadPoolWithFallback();
  if (isFallback) {
    // 可在此加 Langfuse metadata 標記為 fallback 執行
  }

  const rawArticles = pool.articles;

  // 2. Search Queries Generator → 產生動態關鍵字
  //    （新聞 Action 已處理，此處若仍需在決策端補抓可保留，否則可移除）

  // 3. News Filter → 過濾並產生 AI summary
  const filteredResult = await runNewsFilter(rawArticles, marketData);

  // 4. Filter 結果回存至 pool_filtered_active.json
  try {
    await fs.writeFile(
      FILTERED_POOL_PATH,
      JSON.stringify({
        generated_at: new Date().toISOString(),
        source_pool_updated_at: pool.last_updated,
        articles: filteredResult.articles,
      }, null, 2)
    );
  } catch (err) {
    console.warn("[AiCoach] Filter 結果回存失敗，不影響主流程：", err.message);
  }

  // 5. 後續 Macro Analyst → Investment Coach 流程（不變）
  const macroResult = await runMacroAnalyst(filteredResult);
  const coachResult = await runInvestmentCoach(macroResult, strategyResult);

  return coachResult;
}
```

---

#### Step 5：更新 `prompts.mjs` — Macro Analyst 加入 age_band 指引

在 Macro Analyst 的 system prompt 中新增以下指引段落：

```js
// prompts.mjs 中 MACRO_ANALYST_SYSTEM_PROMPT 的新增段落（示意）

`
## 新聞時效性標記說明
每則新聞包含 age_band 欄位，代表該新聞距離現在的時間距離：
- fresh：0~6 小時內（最高時效，優先納入加權）
- recent：6~12 小時（次要參考）
- stale：12~24 小時（背景資訊，除非事件重大否則降低權重）

在進行事件影響力評分（1~5分）時，同等重要性的事件若 age_band 為 fresh，
建議在利多/利空加總中給予相對優先考量；stale 事件若已被後續新聞覆蓋，
可適度下調其影響力分數。
`
```

---

#### Step 6：新增 `news-fetch.yml`（GitHub Actions 新聞採集工作流程）

```yaml
# .github/workflows/news-fetch.yml

name: News Fetch Pipeline

on:
  schedule:
    # 每 3 小時執行一次（UTC 時間，對應台灣時間：07:00 / 10:00 / 13:00 / 16:00 / 19:00 / 22:00 / 01:00 / 04:00）
    - cron: "0 */3 * * *"
  workflow_dispatch: # 支援手動觸發

jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run news fetch
        env:
          GEMINI_API_KEY1: ${{ secrets.GEMINI_API_KEY1 }}
          # 視 Search Queries Generator 的 key 分配調整
        run: node src/runNewsFetch.mjs

      - name: Commit updated news pool
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update news pool [skip ci]"
          file_pattern: "data/news/pool_active.json data/news/archive/*.json"
```

---

#### Step 7：調整 `daily-decision.yml`（移除新聞抓取步驟）

原主流程 workflow 移除「新聞抓取」相關的環境變數與步驟（若有獨立的 news fetch env），保留決策分析所需的設定。主要異動為確認 `runDailyCheck.mjs` 的執行路徑正確讀取 pool，不再呼叫即時新聞抓取邏輯。

---

### ⚠️ 潛在挑戰與防禦機制

#### 1. 新聞池當日為空（首次觸發 / 新聞 Action 失敗）
- **防禦**：`loadPoolWithFallback()` 自動降級讀取昨日 archive
- **標記**：fallback 執行時記錄 `[FALLBACK]` log，並可於 Langfuse trace metadata 加入 `is_news_fallback: true` 供後續監控

#### 2. Market Cache 尚未更新（新聞 Action 早於 market Action 觸發）
- **防禦**：`getMarketCache()` 讀取 `data/market/latest.json`，並記錄 cache 時間戳至 log
- **策略**：Search Queries Generator 使用略舊的市場數據可接受，不中斷流程

#### 3. fingerprint 碰撞（不同新聞標題前 40 字相同）
- **防禦**：`buildFingerprint()` 結合 URL 二次去重；fingerprint 相同但 URL 不同的文章，以 URL 判斷確認是否真正重複

#### 4. Git Commit 衝突（兩個 Action 同時修改 data/news/）
- **防禦**：兩個 workflow 的觸發時間錯開，`news-fetch.yml` 的 cron 設計避免與 `daily-decision.yml` 的觸發時間重疊
- **補強**：git-auto-commit-action 設定 `push_options: '--force-with-lease'`，失敗時記錄 warning 不中斷

#### 5. archive 資料夾持續累積
- **策略**：可在 `archiveManager.mjs` 的定期清理機制中加入 `data/news/archive/` 的清理規則，保留近 30 天歸檔

#### 6. AI Filter 結果過期（pool 有更新但 filtered pool 未重新生成）
- **說明**：`pool_filtered_active.json` 只在決策 Action 執行時才更新，不隨新聞 Action 同步
- **策略**：決策端讀取時可比較 `source_pool_updated_at` 與當前 pool 的 `last_updated`，若差距過大可在 log 中標記提醒（不中斷流程）

---

### 🔁 資料流設計
```
【新聞採集管線（高頻，每 3 小時）】

GitHub Actions: news-fetch.yml
➔ src/runNewsFetch.mjs
→ 讀取 data/market/latest.json（共用 market cache）
→ 呼叫 Search Queries Generator（aiCoach.mjs export）
→ 取得動態關鍵字（twQueries / usQueries）
→ newsFetcher.mjs 抓取 RSS（靜態 base + 動態關鍵字）
→ newsPoolManager.updatePool()
 ├─ fingerprint + URL 去重
 ├─ 過期（>24h）文章移至 data/news/archive/YYYY-MM-DD.json
 ├─ 更新現有文章的 age_band（fresh / recent / stale）
 └─ append 新文章（age_band: "fresh"）
→ 寫入 data/news/pool_active.json
→ git-auto-commit（pool_active.json + archive/*.json）

【決策分析管線（每日一次，原觸發時間）】

GitHub Actions: daily-decision.yml
➔ src/runDailyCheck.mjs（原主流程，新聞來源改為讀 pool）
→ newsPoolManager.loadPoolWithFallback()
 ├─ 正常：讀取 data/news/pool_active.json
 └─ fallback：讀取 data/news/archive/昨日.json
→ aiCoach.mjs
 ├─ News Filter（含 age_band 資訊）→ 過濾 + AI summary
 ├─ 回存結果至 data/news/pool_filtered_active.json
 ├─ Macro Analyst（prompt 含 age_band 加權指引）
 └─ Investment Coach（流程不變）
→ 後續 Notifications / Google Sheets / archiveManager（不變）
```

---

### 📊 Langfuse Score 影響

本次架構調整不新增 Score Config 項目，但以下現有指標的計算來源需確認更新：

| Score 名稱 | 影響說明 |
|---|---|
| `Keyword_Yield_Rate` | 計算基礎不變，但 keyword 產生已移至新聞 Action，trace 歸屬需確認 |
| `Dynamic_Keyword_Yield_Rate` | 同上 |
| `Diversity_Score` | 輸入新聞已含 `age_band`，可於 comment 欄位補記 fresh/recent/stale 分布 |
| `Signal_to_Noise_Ratio` | 輸入規模可能因去重而減少，評分基準不變 |

---

### 🔖 備註

1. `data/news/` 資料夾需加入 `.gitignore` 白名單例外，確保 `pool_active.json` 和 `archive/` 可被 git-auto-commit 追蹤。
2. `pool_filtered_active.json` 建議**不納入 git 追蹤**（由決策 Action 在執行期間產生與使用，屬於暫態產物），可加入 `.gitignore`。
3. Search Queries Generator 在新聞端呼叫時，應使用獨立的 Langfuse trace（不與決策 Action 的 trace 共用），以維持兩條管線的可觀測性分離。
4. 後續若需進一步優化，可考慮在 `age_band` 基礎上加入 `importance_hint` 欄位（由 News Filter 回填），作為 Macro Analyst 加權的第二維度參考。