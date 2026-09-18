---
type: plan
status: in-progress
last_updated: 2026-09-18
tags:
  - social-sentiment
  - mini-app
  - scheduling
  - observability
wiki_links: []
---

# 社群情緒快照與 Mini App 可追溯顯示實作計畫

**狀態：** in-progress  
**建立日期：** 2026-09-18  
**負責範圍：** 社群情緒採集、既有新聞排程整合、快照資料契約、API 與 Mini App 顯示  
**追蹤原則：** 每個任務依 RED → GREEN → REFACTOR → VERIFY 執行，完成一個可獨立驗證的任務後提交 commit。

## Goal

將社群情緒採集綁定至現有每 4 小時新聞排程，並在 Mini App 中提供具備更新時間、資料新鮮度、樣本統計與實際判斷依據的獨立「社群情緒觀察」區塊；不新增 VM Cron，也不把社群情緒混入總經多空分數。

## Architecture

`src/runSocialSentimentFetch.mjs` 繼續作為 `/sentiment` 與排程共用的唯一社群情緒入口。`src/scheduler/newsFetch.mjs` 在新聞池更新後呼叫此入口，社群採集失敗時記錄警告但不阻斷新聞排程。每日快照維持 `data/sentiment/social_sentiment_daily.json` 的 Daily Upsert 方式，增加可追溯 metadata。Mini App 維持 `MacroBattleView` 頁面，但將社群資訊視為與總經多空分析平行的獨立區塊；詳細依據以 Bottom Sheet 呈現。

## Global Constraints

- 不新增 VM Cron；沿用 `scripts/vm-news-fetch.sh` 既有每 4 小時排程。
- `/sentiment` 手動指令與新聞排程必須共用 `runSocialSentimentFetch()`。
- 社群採集失敗不得阻斷新聞池更新或主交易／風控流程。
- 每日情緒快照採同日覆寫（Daily Upsert），不可改成高頻追加快照檔。
- 主系統維持 Node.js 原生 ESM，使用 `.mjs`／現有 Vue JavaScript 慣例，不引入 Python 或外部專案相依。
- 不將社群情緒分數直接併入總經多空積分。
- 所有新行為必須先有失敗測試，再寫最小實作。
- UI 必須維持手機 RWD、三層資訊金字塔與可讀的空資料／過期資料狀態。
- 不在本計畫中修復無關的 `docs/README.md` 或 `validate-wiki-index.mjs` 斷鏈問題。

## Success Criteria

- 現有新聞排程執行時，會呼叫與 `/sentiment` 相同的社群快照流程。
- 社群採集失敗時，新聞排程仍能完成並明確記錄失敗原因。
- 快照包含可驗證的更新時間、資料日期、總樣本數、PTT／Bluesky 分布、分數語意與趨勢資訊。
- API 回傳資料與 provider 正規化契約一致。
- Mini App 主畫面清楚區分「總經多空對決」與「社群情緒觀察」。
- 使用者可由 Bottom Sheet 查看分數計算依據、均線依據、樣本統計與代表性資料。
- 後端相關測試、前端單元測試、完整驗證與必要 E2E 均通過。

---

## Task 1：確認新聞排程共用社群情緒入口

**目的：** 讓現有每 4 小時 `runNewsFetch()` 依附執行社群情緒更新，不新增排程。

**Files:**

- Modify: `src/scheduler/newsFetch.mjs`
- Test: `src/test/unit/scheduler/newsFetch.test.mjs`
- Reference: `src/runSocialSentimentFetch.mjs`
- Reference: `src/bot.mjs`
- Reference: `scripts/vm-news-fetch.sh`

**Produces:** `runNewsFetch()` 在新聞池處理完成後，以受控錯誤隔離方式呼叫 `runSocialSentimentFetch()`；回傳既有 `{ appended, total }` 契約，不因社群更新失敗而改變新聞排程結果。

- [ ] **Step 1：寫失敗測試**

在 `newsFetch.test.mjs` 建立 mock，驗證新聞流程會呼叫 `runSocialSentimentFetch()`，並驗證該呼叫 rejection 不會使 `runNewsFetch()` rejection。

預期測試名稱：

```text
runNewsFetch triggers shared social sentiment snapshot update
runNewsFetch keeps news result when social sentiment update fails
```

- [ ] **Step 2：執行測試確認 RED**

```bash
npx vitest run src/test/unit/scheduler/newsFetch.test.mjs
```

預期：新增測試失敗，因 `runNewsFetch()` 尚未呼叫社群情緒入口。

- [ ] **Step 3：寫最小實作**

在 `src/scheduler/newsFetch.mjs` 使用靜態 import 匯入 `runSocialSentimentFetch`，於新聞池更新完成後呼叫：

```js
try {
  const sentimentResult = await runSocialSentimentFetch();
  if (!sentimentResult.success) {
    logger.warn(
      { error: sentimentResult.error },
      "[NewsFetch] 社群情緒快照更新失敗",
    );
  }
} catch (err) {
  logger.warn({ error: err.message }, "[NewsFetch] 社群情緒快照更新發生例外");
}
```

不得改變新聞池的回傳值或錯誤處理契約。

- [ ] **Step 4：執行測試確認 GREEN**

```bash
npx vitest run src/test/unit/scheduler/newsFetch.test.mjs
```

預期：該測試檔全部通過。

- [ ] **Step 5：提交**

```bash
git add src/scheduler/newsFetch.mjs src/test/unit/scheduler/newsFetch.test.mjs
git commit -m "feat: update social sentiment with news schedule"
```

---

## Task 2：補足每日快照的可追溯 metadata

**目的：** 讓快照不只保存數字，也保存判斷來源與計算依據。

**Files:**

- Modify: `src/modules/sentiment/sentimentEngine.mjs`
- Modify: `src/runSocialSentimentFetch.mjs`
- Test: `src/test/sentiment/sentimentEngine.test.mjs`
- Test: `src/test/runSocialSentimentFetch.test.mjs`
- Reference: `src/modules/sentiment/socialCollector.mjs`

**Produces:** `generateDailySnapshot()` 接受採集 metadata 並產出以下欄位：

```js
{
  date: "YYYY-MM-DD",
  updatedAt: "ISO-8601 timestamp",
  score: Number,
  scoreLabel: "恐慌|偏空|中性|偏多|過熱",
  trend: "升溫|降溫|穩定",
  ma3: Number,
  ma7: Number,
  delta: Number,
  sampleCount: Number,
  pttItems: Number,
  bskyItems: Number,
  divergenceStatus: String,
  divergenceDetail: String,
  signals: String[],
  hotTopics: Object[]
}
```

分數語意門檻固定為：`0–29 恐慌`、`30–44 偏空`、`45–55 中性`、`56–70 偏多`、`71–100 過熱`。趨勢以 `ma3 - ma7` 判斷，差值大於 `1` 為升溫、小於 `-1` 為降溫、其餘為穩定。

- [ ] **Step 1：寫失敗測試**

在 sentiment engine 測試中加入：

```js
it("每日快照應保存更新時間、來源樣本統計與白話判斷", () => {
  const snapshot = generateDailySnapshot(history, [], null, {
    updatedAt: "2026-09-18T00:05:14.000Z",
    sampleCount: 42,
    pttItems: 30,
    bskyItems: 12,
  });

  expect(snapshot.updatedAt).toBe("2026-09-18T00:05:14.000Z");
  expect(snapshot.sampleCount).toBe(42);
  expect(snapshot.pttItems).toBe(30);
  expect(snapshot.bskyItems).toBe(12);
  expect(snapshot.scoreLabel).toBeDefined();
  expect(snapshot.trend).toBeDefined();
  expect(snapshot.delta).toBeDefined();
});
```

- [ ] **Step 2：執行測試確認 RED**

```bash
npx vitest run src/test/sentiment/sentimentEngine.test.mjs
```

預期：metadata 斷言失敗，因現行快照沒有這些欄位。

- [ ] **Step 3：寫最小實作**

調整 `generateDailySnapshot(sentimentHistory, priceHistory, outputPath, metadata = {})`，將 metadata 寫入快照；由 `runSocialSentimentFetch()` 使用 `collectSocialSentiment()` 的 `record` 填入實際時間與 PTT／Bluesky／總樣本數。

同日快照寫入必須維持單一檔案覆寫，並保留既有 `date`、`score`、`ma3`、`ma7`、`divergenceStatus`、`signals`、`hotTopics` 欄位。

- [ ] **Step 4：執行測試確認 GREEN**

```bash
npx vitest run src/test/sentiment/sentimentEngine.test.mjs src/test/runSocialSentimentFetch.test.mjs
```

預期：相關測試全部通過。

- [ ] **Step 5：提交**

```bash
git add src/modules/sentiment/sentimentEngine.mjs src/runSocialSentimentFetch.mjs src/test/sentiment/sentimentEngine.test.mjs src/test/runSocialSentimentFetch.test.mjs
git commit -m "feat: add traceable sentiment snapshot metadata"
```

---

## Task 3：統一社群情緒 API 與 provider 資料契約

**目的：** API 不再直接透傳未正規化 JSON，確保 Mini App 收到穩定欄位與 safe fallback。

**Files:**

- Modify: `src/api/routes/socialSentiment.mjs`
- Test: `src/api/routes/socialSentiment.test.mjs`
- Modify only if required: `src/modules/providers/socialSentimentProvider.mjs`
- Existing test: `src/modules/providers/socialSentimentProvider.test.mjs`

**Produces:** `GET /api/social-sentiment` 使用 `fetchSocialSentimentData()`，成功回傳正規化資料；檔案不存在或格式錯誤時回傳既有安全預設值，且保留 `reason`／log 可診斷性。

- [ ] **Step 1：寫失敗測試**

加入 API 測試，驗證：

```text
新 metadata 欄位會被保留並回傳
快照檔案缺少 optional metadata 時仍回傳合法 fallback 欄位
```

- [ ] **Step 2：執行測試確認 RED**

```bash
npx vitest run src/api/routes/socialSentiment.test.mjs
```

預期：新欄位正規化／fallback 測試失敗。

- [ ] **Step 3：寫最小實作**

將 route 改為呼叫 `fetchSocialSentimentData()`，並擴充 provider 的正規化欄位；不讓 API 直接暴露任意 JSON 結構。

- [ ] **Step 4：執行測試確認 GREEN**

```bash
npx vitest run src/api/routes/socialSentiment.test.mjs src/modules/providers/socialSentimentProvider.test.mjs
```

預期：API 與 provider 測試全部通過。

- [ ] **Step 5：提交**

```bash
git add src/api/routes/socialSentiment.mjs src/api/routes/socialSentiment.test.mjs src/modules/providers/socialSentimentProvider.mjs src/modules/providers/socialSentimentProvider.test.mjs
git commit -m "feat: normalize social sentiment api contract"
```

---

## Task 4：Mini App 社群情緒獨立區塊與可追溯摘要

**目的：** 在同一個 `MacroBattleView` 中清楚分隔總經多空分析與社群情緒觀察，不新增頂層頁面。

**Files:**

- Modify: `webapp/src/components/macro/SocialSentimentCard.vue`
- Modify: `webapp/src/views/MacroBattleView.vue` only if section boundary or event wiring requires it
- Test: `webapp/src/test/SocialSentimentCard.test.js`
- Test: `webapp/src/test/MacroBattleView.test.js` or the existing relevant Macro Battle test
- Reference: `webapp/src/api/index.js`

**Component map:**

- `MacroBattleView.vue`：只負責取得資料與組合區塊，不新增社群判讀邏輯。
- `SocialSentimentCard.vue`：負責摘要狀態、更新時間、趨勢與抽屜開啟事件。
- `SocialSentimentEvidenceSheet.vue`：負責呈現樣本統計、計分依據與代表性話題；若現有專案沒有 Bottom Sheet 共用元件，建立此單一責任組件。

**Produces:** 主卡片至少顯示：

```text
社群情緒觀察
中性偏多 · 57.0 分
短線趨勢：穩定
資料更新：2026/09/18 08:05
樣本：42 筆（PTT 30、Bluesky 12）
背離狀態：正常
查看判斷依據
```

Bottom Sheet 顯示：

```text
本次判斷依據
- 分數區間與白話定義
- 看多／看空／中性樣本統計（若資料契約提供）
- 3D／7D 均線與 delta
- 背離檢查期間與結果
- 代表性話題、來源、情緒標籤與連結
```

- [ ] **Step 1：寫失敗測試**

測試使用固定 fixture，驗證 DOM 包含：

```text
social-sentiment-card
更新時間
樣本數
PTT
Bluesky
白話情緒標籤
判斷依據觸發按鈕
```

並驗證點擊後 Bottom Sheet 顯示計分依據，空 URL 不渲染成可點擊的壞連結。

- [ ] **Step 2：執行測試確認 RED**

```bash
cd webapp && npx vitest run src/test/SocialSentimentCard.test.js
```

預期：新增斷言失敗，因現有卡片只有數字與話題。

- [ ] **Step 3：寫最小實作**

加入：

- `scoreLabel`、`trend`、`updatedAt`、`sampleCount` 與來源統計顯示。
- 更新時間格式化函式，保留原始 ISO 時間於 `title` 或可存取文字中。
- `open-evidence` 事件與 Bottom Sheet 顯示狀態。
- 過期資料提示：若 `updatedAt` 超過既定資料新鮮度門檻，顯示「資料可能過期」而非假裝最新。
- `hotTopics` 的 `url` 為空時顯示純文字，不渲染無效 `<a>`。
- 保留目前手機版折行與既有色彩語意，避免橫向溢出。

在 `MacroBattleView.vue` 將社群區塊標題與總經多空區塊明確分隔，不將社群分數併入 `bullScore`／`bearScore`。

- [ ] **Step 4：執行測試確認 GREEN**

```bash
cd webapp && npx vitest run src/test/SocialSentimentCard.test.js
```

再執行相關 Macro Battle 測試，預期全部通過。

- [ ] **Step 5：提交**

```bash
git add webapp/src/components/macro/SocialSentimentCard.vue webapp/src/views/MacroBattleView.vue webapp/src/test/SocialSentimentCard.test.js
 git commit -m "feat: show traceable social sentiment evidence"
```

---

## Task 5：文件與排程資料流同步

**目的：** 讓現行文件能準確描述社群情緒已依附新聞排程的事實。

**Files:**

- Modify: `docs/modules/operations/schedules.md`
- Modify: `docs/modules/_index.md` only if current script inventory needs a correction
- Modify: `docs/TESTING.md` only if test command documentation requires it

**Required documentation changes:**

- 在排程總表明確標示 `vm-news-fetch.sh` 同時更新新聞池與社群情緒快照。
- 記錄 `/sentiment` 是手動立即觸發入口，但不再是唯一更新入口。
- 記錄快照路徑 `data/sentiment/social_sentiment_daily.json` 與 `news_history.jsonl`。
- 記錄社群採集失敗不阻斷新聞排程。
- 記錄 Mini App 的社群情緒區塊與 Bottom Sheet 判斷依據。

- [ ] **Step 1：先確認文件驗證入口**

先檢查 `package.json` 與 `scripts/` 目前實際存在的文件驗證命令；不得引用不存在的驗證腳本。若沒有專用文件檢查入口，至少執行：

```bash
git diff --check
```

- [ ] **Step 2：修改文件**

只同步本計畫實際落地的路徑與行為，不補寫尚未實作的欄位。

- [ ] **Step 3：驗證文件**

```bash
git diff --check
```

- [ ] **Step 4：提交**

```bash
git add docs/modules/operations/schedules.md docs/modules/_index.md docs/TESTING.md
git commit -m "docs: document scheduled social sentiment updates"
```

---

## Task 6：完整驗證與交付檢查

**Files:**

- No planned source changes.
- Any unexpected generated file must be reviewed and excluded unless explicitly required by the task.

- [ ] **Step 1：執行後端與前端相關測試**

```bash
npx vitest run src/test/unit/scheduler/newsFetch.test.mjs src/test/sentiment/sentimentEngine.test.mjs src/test/runSocialSentimentFetch.test.mjs src/api/routes/socialSentiment.test.mjs src/modules/providers/socialSentimentProvider.test.mjs
cd webapp && npx vitest run src/test/SocialSentimentCard.test.js
```

- [ ] **Step 2：執行完整驗證**

```bash
npm run verify
```

成功條件：lint 0 errors、所有既有測試通過、OpenAPI 無 breaking changes。

- [ ] **Step 3：必要時執行 Mini App E2E**

依專案既有 `verify-pages.sh`／Playwright 流程執行，測試社群情緒區塊可顯示、Bottom Sheet 可開啟、手機寬度不溢出；執行後清理所有 API、Vite、Playwright 與 Chromium 程序。

- [ ] **Step 4：檢查追蹤完整性**

```bash
git diff --check
git status --short --branch
git log --oneline -8
```

確認所有計畫 checkbox 與實際 commit 對應，沒有未追蹤資料或秘密內容。

- [ ] **Step 5：計畫結案**

全部驗證通過後：

1. 將本文件 `status` 改為 `completed`、`progress: 100%`。
2. 以 `git mv` 移至 `docs/plans/completed/`。
3. 依實際存在的文件工具更新 Wiki 索引；若 validator 仍不存在，於交付報告明確記錄，不虛構通過結果。
4. 建立最後結案 commit。

---

## 回滾策略

- 若 Task 1 失敗：回退該 task commit，新聞排程恢復只更新新聞池；`/sentiment` 仍可獨立使用。
- 若 Task 2 或 Task 3 失敗：保留舊快照欄位相容性，回退 metadata／API commit，不刪除既有快照檔。
- 若 Task 4 失敗：回退 UI commit，保留後端排程與資料契約變更；前端繼續使用既有欄位。
- 若完整驗證失敗：停止後續任務，依失敗測試建立 regression test，不以跳過驗證或忽略錯誤方式提交。

## 目前狀態

- [x] 根因確認：`/sentiment` 是唯一目前會更新快照的流程。
- [x] 設計決策：社群情緒在 `MacroBattleView` 中維持獨立區塊，不新增頂層頁面。
- [x] 設計決策：詳細依據使用 Bottom Sheet。
- [x] 計畫落地至 `docs/plans/active/`。
- [ ] Task 1：排程綁定
- [ ] Task 2：快照 metadata
- [ ] Task 3：API 契約
- [ ] Task 4：Mini App UI
- [ ] Task 5：文件同步
- [ ] Task 6：完整驗證與結案
