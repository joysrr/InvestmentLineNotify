# 文件更新 Cache（2026-04-04）

> 此檔案為本次文件整理作業的暫存記錄，作業完成後可刪除。
> **若整理過程中斷，請從此檔案還原狀態後繼續。**

---

## 作業目標
1. 根據程式碼現況更新所有系統文件（中英混合）
2. 將 `finish_features.md` 內容整合進各模組文件（方案 B，直接融入，不留 log）
3. 整合完成後清空 `finish_features.md`

---

## finish_features.md 原始內容摘要（備份重點）

### 主要功能：新聞關鍵字系統重構
- `KeywordEntry` schema：`{ keyword: string, searchType: "intitle" | "broad" }`
- `baseTwQueries`（18 組）、`baseUsQueries`（18 組）靜態基礎池
- `twExcludeKeywords`、`usExcludeKeywords` RSS 層排除關鍵字
- `blacklist.json` seed 初始化（16 條 titlePatterns + TW/US excludedSources）
- `loadBlacklist()` 動態讀取接口
- `buildRssUrl()` 整合 -keyword 排除邏輯
- `validateDynamicKeyword()` AI 動態關鍵字驗收
- `mergeKeywords()` 靜態 ∪ 動態合併（上限 44 組）
- 雙層文章過濾：RSS Query 層排除 + 文章標題 blacklist regex 過濾
- Few-Shot Prompt 優化：6–8 組輸出、禁止單字縮寫、searchType 選擇原則

---

## 各文件更新狀態

| 文件 | 狀態 |
|---|---|
| `docs/plans/_update_cache.md` | ✅ 已建立（本檔案） |
| `docs/architecture.md` | ⏳ 待更新 |
| `docs/modules/ai_pipeline.md` | ⏳ 待更新 |
| `docs/modules/market_strategy.md` | ⏳ 待更新 |
| `docs/modules/core_infrastructure.md` | ⏳ 待更新 |
| `docs/modules/entry_and_notifications.md` | ⏳ 待更新 |
| `docs/agent_prompts.md` | ⏳ 待更新（語言調整） |
| `docs/plans/finish_features.md` | ⏳ 待清空 |

---

## 確認的程式碼現況（給斷點恢復用）

### Runner 層（全部 5 支）
- `src/runDailyCheck.mjs` — 每日主排程，接受 CLI 參數
- `src/runWeeklyReport.mjs` — 讀取 7 天報告，最低 3 份觸發，AI 週報
- `src/runMonthlyReport.mjs` — 讀取 30 天報告，最低 10 份觸發，AI 月報
- `src/runNewsFetch.mjs` — 獨立新聞抓取管線，含 Langfuse Yield Rate score
- `src/runOptimizer.mjs` — 獨立 Rule Optimizer 執行，手動/排程觸發

### Notifications 結構
- `notifier.mjs` — broadcastDailyReport()，Platform 分發
- `templates/telegramHtmlBuilder.mjs` — 3 段式 Telegram HTML
- `templates/periodReportBuilder.mjs` — 週報/月報 Telegram 格式
- `transports/telegramClient.mjs` — 實際 API 呼叫

### AI 模組新增
- `llmJudge.mjs` — 條件觸發（weekly/random/always），評 Actionability + Tone_and_Empathy
- `periodReportAgent.mjs` — loadRecentReports, buildPeriodStats, generatePeriodAiSummary

### 數據模組新增
- `newsPoolManager.mjs` — 新聞池 CRUD，TTL 24h，上限 200 篇，fuzzy 去重
  - 檔案：`data/news/pool_active.json`, `pool_filtered_active.json`, `archive/YYYY-MM-DD.json`
