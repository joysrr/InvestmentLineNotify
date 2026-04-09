# Pre-plan Features (待評估與實作功能池)

## 📌【部署層】Oracle Cloud VM 正式部署

> **前置條件**：需先完成 Telegram Mini App 應用層（Phase 2），並取得可用的 domain 或 HTTPS 入口後再執行本計劃。

### 狀態與目標摘要

**狀態：✅ 已完成**

- 前置條件已達成：Telegram Mini App Phase 2 ✅ 已完成。
- Oracle VM 部署已完成：Fastify API Server、Bot daemon、Nginx HTTPS 均已上線運作。
- 詳細实作計畫請見：[`docs/plans/oracle_vm_deployment_plan.md`](./oracle_vm_deployment_plan.md)。
- 完整安裝手冊請見：[`docs/appendix/deployment-oracle-vm.md`](../appendix/deployment-oracle-vm.md)。
- 相關程式與說明已展現於 `src/api/server.mjs`、`src/bot.mjs` 與 `docs/architecture.md`。

### 🎯 功能目標

將 Fastify API Server 與 Vite + Vue 3 前端 build 產物部署至 Oracle Cloud Free Tier VM（Ubuntu），提供 Mini App 穩定的外網 HTTPS 存取端點，同時維持現有 GitHub Actions 排程與 Telegram Bot 長駐推播架構不受影響。

**實際架構結果**：
- API Server（Fastify）與靜態前端（Vue dist）部署於同一台 VM，由 Nginx 做反向代理。
- Bot daemon（`src/bot.mjs`）由 VM pm2 常駐執行，GitHub Actions 不再觸發 bot。
- `data/` 同步由 Actions SSH 通知 VM git pull（方案 B）實現。

> 詳細步驟、HTTPS 方案、data/ 同步策略與部署後驗收 checklist 請見 [`docs/appendix/deployment-oracle-vm.md`](../appendix/deployment-oracle-vm.md)。

---

---

---

## 📌【AI 管線強化類】兩相矛盾的新聞判定或提示

### 狀態與目標摘要

**狀態：✅ 已完成**

- 矛盾分群邏輯已實作於 `src/modules/news/newsConflictGrouper.mjs`。
- AI 過濾流程（`filterAndCategorizeAllNewsWithAI`）已於送入 AI 前呼叫 `assignConflictGroups()`，對新聞標記衝突群組標籤（`_conflictGroup`）。
- AI 回傳的 `event_inventory[].has_conflict` 與 `conflict_note` 已被正確讀取，組裝為 `conflictSummary` 字串。
- `conflictSummary` 作為前置注解插入 `analyzeMacroNewsWithAI()` 的 prompt。
- Langfuse `Contradiction_Count` score 已整合。

> 功能架構說明已整合至 `docs/architecture.md`（5.5 節 AI 管線）與 `docs/modules/entry_and_notifications.md`（第 3 節 Daily Entry Flow）。

### 🎯 功能目標（原始描述）

因目前取得的新聞同一個事件可能會有兩個面向，此時新聞的時序以及與現況是否相符就很重要，例如近期的以伊戰爭，新聞常常出現兩個面向，A: 伊朗與美國傳出正在和談中、B: 伊朗拒絕和談，重申封鎖海峡；發生的順序為 A→B，但是目前新聞無法判定，在多空分析時，會不小心把過時、錯誤的資訊判定為多或空，導致指標失準。

---

---

## 📌【策略與績效】策略訊號回測與績效統計

### 狀態與目標摘要

- 目前僅有回測概念與資料來源分析，尚未實作 runner。
- 計劃新增獨立 runner（例如 `src/runBacktest.mjs`）並與週/月報的統計結果整合。

### 動機

`strategyEngine.mjs` 目前依據 RSI、KD、MACD、VIX、MA240、`macroMarketDirection` 計算買賣訊號，但系統內無法驗證：
- 歷史上當「訊號 = 買進」時，後續 N 天的實際報酬率如何？
- 哪個指標對最終决策貢獻最大？

目前 `archiveManager` 已存 `signals` 快照，資料基礎存在，缺的是分析邏輯。

### 建議方向

新增一個 `runBacktest.mjs` runner，讀取 `data/archives/` 歷史快照 + Google Sheet 歷史價格，計算每次訊號後的 5/10/20 日報酬率，輸出 CSV 或 Telegram 月報附件。

此功能可與現有 `runMonthlyReport.mjs` 整合（月報時一併輸出回測摘要）。

### 影響範圍

- 新增 `src/runBacktest.mjs`（新 runner）
- `src/modules/data/archiveManager.mjs`（新增讀取歷史快照 API）
- `src/modules/storage.mjs`（讀取 Google Sheet 歷史收盤價）
- 可能新增 `src/modules/strategy/backtestEngine.mjs`

### 難度

⭐⭐⭐ 高（需設計回測邏輯與資料對齊）

### 討論狀態

⚪ 待確認


---

## 📌【AI 管線強化類】每日摘要語音化推播（Gemini TTS × Telegram Audio）

### 狀態與目標摘要

- 已有較完整的技術草案（Gemini TTS + ffmpeg + Telegram sendAudio），尚未落實為實際模組。
- 實作時需確認 AI pipeline、Langfuse 追蹤與每日推播流程的整合方式。

### 🎯 功能目標

將每日由 LLM 產生的市場摘要文字（AI 教練洞察、總經多空分析等），透過 Gemini TTS API（`gemini-2.5-flash-preview-tts`）轉換為語音音訊檔，再經由 Telegram Bot API 的 `sendAudio` 方法推播至指定頻道。

此功能定位為現有文字報告的「語音附件」，與三則文字訊息並列發送，不取代原有推播邏輯。

---

### 📁 影響範圍

| 模組 / 職責 | 預計異動 | 路徑 |
|---|---|---|
| 語音合成服務（新增） | 新增 `ttsService.mjs`，封裝 Gemini TTS 呼叫與 PCM→MP3 轉換 | `src/modules/ai/` |
| 摘要文字組裝邏輯 | 需擷取純文字版本（去除 HTML tag）供 TTS 使用 | `src/modules/notifications/templates/telegramHtmlBuilder.mjs` |
| Telegram 推播模組 | 新增 `sendAudio` 呼叫，於三則文字訊息後附加語音 | `src/modules/notifications/transports/telegramClient.mjs` |
| 暫存音訊目錄 | 需於執行期間建立 `/tmp/tts/` 暫存目錄，流程結束後清除 | 專案根目錄下的 `/tmp/` |

### 待確認清單

- 確認 aiAdvice / macroAnalysis 的實際資料結構與來源模組。
- 確認 TTS service 檔案最佳放置路徑。
- 確認每日推播流程中負責三則訊息發送的函式名稱與插入點。
- 確認 Gemini API key 分配策略與 Langfuse span wrapper 的使用方式。

---

## 📌【穩定性強化】Providers 統一 retry / timeout 機制

### 狀態與目標摘要

- 各 Provider 目前錯誤處理策略不一，網路抖動時可能導致整條 daily pipeline 中斷。
- 計劃統一透過 helper（例如 `fetchWithRetry`）包裝 `fetchWithTimeout`，逐步於 Providers 層導入。

### 動機

目前各 provider（`twseProvider`, `yahooProvider`, `cnnProvider` 等）各自處理錯誤，有些有 try/catch，有些直接拋出。`coreUtils.mjs` 已有 `fetchWithTimeout`，但未被所有 provider 統一使用。

### 建議方向

在 `src/utils/coreUtils.mjs` 或新增 `src/utils/fetchUtils.mjs` 中實作 `fetchWithRetry(url, options, retries=2)`，並在各 provider 統一引用。

### 影響範圍

- `src/utils/coreUtils.mjs`（新增 helper）
- `src/modules/providers/*.mjs`（逐步替換 fetch 呼叫）

### 難度

⭐⭐ 中（工具本身簡單，但需逐一審查各 provider 的 fetch 呼叫）

### 討論狀態

⚪ 待確認
