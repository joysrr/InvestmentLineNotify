---
type: reference
status: current
last_updated: 2026-10-01
last_verified: 2026-10-01
related_code:
  - src/bot.mjs
  - src/runNewsFetch.mjs
  - src/runWeeklyReport.mjs
  - src/runMonthlyReport.mjs
related_docs:
  - docs/modules/presentation/_index.md
  - docs/modules/presentation/notifications.md
  - docs/modules/ai_news/ai_pipeline.md
tags:
  - telegram
  - bot
  - notifications
  - commands
wiki_links:
  - [[AI News]]
  - [[Notification]]
  - [[Strategy Engine]]
  - [[Langfuse]]
---

# Telegram Bot 入口 (`src/modules/bot/`)

> **摘要**: 處理使用者透過 Telegram 發送的指令 (Commands)

## 概念關係

- [[AI News]] - Bot 觸發 AI 管線
- [[Notification]] - 發送結果
- [[Strategy Engine]] - 戰報生成
- [[Langfuse]] - AI 觀測

---

## 📋 最近更新

### 2026-09-10 Bot 修復 (重要)

**問題**: Bot 無法啟動 (自 2026-08-16 掛掉)

**根因**: Langfuse v3 → v5 遷移不完整

- `langfuseClient.mjs` 曾使用不相容的 Prompt API 參數格式
- `runNewsFetch.mjs` 和 `runWeeklyReport.mjs` 沒有 export 函數

**修復**:

1. `langfuseClient.mjs` 使用 `LangfuseClient.prompt.get(name, options)`、`getActiveTraceId()` 與 v5 封裝的 flush／shutdown
2. 補充 `runNewsFetch`, `runWeeklyReport` export 函數
3. 整合測試改用 `LangfuseClient` 與 v5 Prompt API

**驗證**: ✅ 真實 Langfuse production prompts 可成功取得；AI 相關測試 133/133 通過

---

## 1. 權限防護 (Middleware)

由於本系統涉及高度機密的資產與決策，所有的 Bot 指令都受到權限控管：

- 必須經過 `authMiddleware.mjs`
- 只有位於 `TELEGRAM_ALLOWED_USERS` (白名單 ID) 內的帳號才能觸發指令，其餘請求一律靜默拋棄

## 2. 原子鎖機制 (`runnerLock.mjs`)

由於生成戰報或執行排程可能耗時數十秒（抓取資料、AI 生成），為了防止使用者連點，或與 GitHub Actions 的 cron job 發生衝突，實作了基於 `proper-lockfile` 的實體檔案鎖：

- **最大並發 (Concurrency)**：預設最大並發任務數為 2
- **防止疊加**：若鎖已存在，會提示「任務正在執行中，請勿重複觸發」
- **自動超時 (Timeout)**：鎖的生命週堊預設為 30 分鐘，超過後視為卡死並強制釋放
- **優雅關機 (Graceful Shutdown)**：監聽 `SIGINT` 與 `SIGTERM`，確保 Node.js 進程被關閉時能正確釋放鎖

## 3. 主要指令

| 指令            | 功能                                          | 對應代碼                              |
| --------------- | --------------------------------------------- | ------------------------------------- |
| `/start`        | 顯示歡迎訊息                                  | src/bot.mjs                           |
| `/help`         | 顯示指令說明                                  | src/bot.mjs                           |
| `/status`       | 系統健康度                                    | src/bot.mjs                           |
| `/status_debug` | 詳細狀態 (管理員)                             | src/bot.mjs                           |
| `/daily`        | 手動觸發 dailyCheck（非交易日發送市場情報卡） | src/scheduler/dailyCheck.mjs          |
| `/news`         | 手動觸發新聞採集                              | src/runNewsFetch.mjs                  |
| `/weekly`       | 手動觸發週報                                  | src/runWeeklyReport.mjs               |
| `/monthly`      | 手動觸發月報                                  | src/runMonthlyReport.mjs              |
| `/optimize`     | 策略規則優化                                  | src/modules/ai/ruleOptimizerAgent.mjs |

### 指令說明

- `/daily`: 手動觸發 dailyCheck 流程（調用 `runDailyCheck`；非交易日發送「市場情報觀測卡」並落地當日情報報告，跳過台股買賣評分）
- `/news`: 觸發 runNewsFetch()，回傳採集結果摘要
- `/weekly`: 觸發 runWeeklyReport()
- `/monthly`: 觸發 runMonthlyReport()
- `/optimize`: 運行 ruleOptimizerAgent.mjs 並回傳結果

---

## 4. Mini App 支援

Bot 透過 `setChatMenuButton` 設置 Mini App 按鈕，用戶可開啟 WebApp 查看:

- 投資組合
- 策略績效
- 市場情緒
- 每日訊號

**配置**: `MINI_APP_URL` 環境變數

## 5. Mini App 模式 Telegram 速報卡資料契約

當 `TELEGRAM_WEBAPP_URL` 已設定時，通知層只發送一張精簡速報卡；完整事件、圖表與技術細項仍由 Mini App 提供。速報卡的閱讀優先級如下：

1. **大趨勢**：優先讀取 `result.signals.marketStatus`；若正式報告沒有此欄位，依 `signalDirection` 與 `regimeResult.state` 推導：
   - `long` + `NORMAL` → `正常偏多`
   - `long` + 其他狀態 → `偏多但需控風險`
   - `short` → `偏空防守`
   - 其他 → `中性觀望`
2. **投資方向**：讀取 `result.signals.target` 與 `result.signals.targetSuggestionShort`，呈現既定 P0/P1 策略方向，不由通知層自行改寫交易決策。
3. **市場方向**：優先讀取 `result.signals.macroMarketDirection`，其次讀取 `macroAnalysis.conclusion.market_direction`，最後使用上述正式訊號推導值。
4. **重大事件**：從已整理的 `newsStructured.tw`、`newsStructured.us`，以及執行期 `newsMessages` 依序取標題，最多顯示 2 筆；完整摘要與來源細節留在 Mini App。
5. **風控與技術摘要**：接續顯示槓桿、維持率、估值守衛、評分、乖離、近期轉弱與賣出訊號計數。

通知層不得因缺少 `macroAnalysis` 或新聞資料而產生虛構內容；缺少資料時應顯示中性或無重大事件。正式報告的 `signals` 目前是主要資料來源，欄位異常應先修正報告契約，不應在 Telegram builder 建立另一套策略邏輯。

## 6. 併發鎖機制 (`runnerLock.mjs`)

`src/modules/bot/runnerLock.mjs` 防止 Bot 指令與 GitHub Actions / 排程器重複觸發同一流程。

### 設計原則

- 使用 `proper-lockfile` 實現原子鎖操作，Lock 檔儲存 `{ runner, startedAt, pid }`
- **Bot 觸發前**：檢查 lock 是否存在，若存在則拒絕並回覆提示（防止重複執行）
- **Runner 完成後**：無論成功或失敗，必須呼叫 `releaseLock()` 釋放
- **超時釋放**：超過 30 分鐘的舊 lock 自動視為卡死並強制釋放
- **信號量 (Semaphore)**：控制最大並發數（預設 `DEFAULT_MAX_CONCURRENT = 2`）
- **優雅終止**：SIGINT / SIGTERM 信號處理器確保進程終止時 lock 被釋放

### Lock 檔路徑

```
data/.bot_lock
```

### 注意事項

- Lock 基於本機檔案系統，**跨機器時 lock 失效**（GitHub Actions 與生產機為不同主機）
- 若環境為 `GITHUB_ACTIONS=true`，日誌會發出跨機器 lock 無效警告
- Lock TTL 30 分鐘；部署 Lock TTL 另見 `src/modules/deployment/executor.mjs`（15 分鐘）
