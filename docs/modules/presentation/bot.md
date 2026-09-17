---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
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

| 指令            | 功能                | 對應代碼                              |
| --------------- | ------------------- | ------------------------------------- |
| `/start`        | 顯示歡迎訊息        | src/bot.mjs                           |
| `/help`         | 顯示指令說明        | src/bot.mjs                           |
| `/status`       | 系統健康度          | src/bot.mjs                           |
| `/status_debug` | 詳細狀態 (管理員)   | src/bot.mjs                           |
| `/daily`        | 手動觸發 dailyCheck | src/dailyCheck.mjs                    |
| `/news`         | 手動觸發新聞採集    | src/runNewsFetch.mjs                  |
| `/weekly`       | 手動觸發週報        | src/runWeeklyReport.mjs               |
| `/monthly`      | 手動觸發月報        | src/runMonthlyReport.mjs              |
| `/optimize`     | 策略規則優化        | src/modules/ai/ruleOptimizerAgent.mjs |

### 指令說明

- `/daily`: 手動觸發 dailyCheck 流程
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
