# 系統入口與通知 / Entry & Notifications

## 1. 模組定位
此文件描述系統從「被啟動」到「送出結果」的兩端邊界：
- **Entry side**：各類 runner 如何觸發並把工作分派到核心模組。
- **Notification side**：如何把 daily decision 或 period report 轉成 Telegram 可讀訊息。

本專案目前不是單一入口，而是多 runner 架構，因此文件也必須明確區分每個入口的責任。

---

## 2. Runner 一覽

### 2-A. 排程 / CLI 入口（VM crontab 觸發或直接執行）
| Path | 說明 |
|---|---|
| `src/runDailyCheck.mjs` | 每日主入口，支援 CLI flags，進入 `dailyCheck()`。 |
| `src/runNewsFetch.mjs` | 獨立新聞抓取與新聞池更新入口，並回寫 Langfuse Yield Rate / Source_Diversity score。 |
| `src/runOptimizer.mjs` | 獨立 rule optimizer 入口，執行完成後若有新規則，會靜默推播至 Log 頻道。 |
| `src/runWeeklyReport.mjs` | 週報入口，讀取近 7 天 `data/reports/`，至少 3 份才生成。 |
| `src/runMonthlyReport.mjs` | 月報入口，讀取近 50 天 `data/reports/`（前 30 天為評估期，全 50 天供報酬率計算），至少 10 份才生成。 |

**CLI 直接執行保護（`import.meta.url` 判斷）**

所有 runner 檔案底部均以以下模式保護 `main()`，確保 `import` 時不會自動執行，只有直接透過 `node` 執行時才觸發：

```js
import { fileURLToPath } from "url";

async function main() {
  // ...
}

// 只有直接執行此檔案時才呼叫 main()，import 時不執行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

> ⚠️ 若缺少此保護，`bot.mjs` 在 `import` 這些 runner 時，`main()` 會立刻執行，導致 bot 重啟時意外觸發週報、月報等排程任務。

### 2-B. Bot 長駐入口（grammY Long-Polling）
| Path | 說明 |
|---|---|
| `src/bot.mjs` | Telegram Bot 長駐入口，以 `npm run bot` 啟動。處理使用者即時指令觸發。 |
| `src/modules/bot/middleware/adminGuard.mjs` | 白名單 Middleware，檢查 `TELEGRAM_USER_ID`，靜默拒絕非授權請求。 |
| `src/modules/bot/runnerLock.mjs` | 共用 lock 機制，防止 Bot 與 crontab 重複觸發。超過 30 分鐘舊 lock 自動釋放。 |

**重啟時捨棄積壓指令（`drop_pending_updates`）**

`bot.start()` 加入 `drop_pending_updates: true`，確保 Bot 重啟後不會消化 Telegram queue 中積壓的舊指令，避免重啟時意外觸發 `/daily`、`/weekly` 等排程類指令：

```js
bot.start({
  drop_pending_updates: true,
  onStart: async (botInfo) => { /* ... */ },
});
```

#### Runner 與 Bot 指令對應
| Bot 指令 | 呼叫函數 | API 消耗 |
|---|---|---|
| `/start` | 回覆歡迎訊息（inline，無外部呼叫） | 零 |
| `/help` | 回覆指令說明（inline，無外部呼叫） | 零 |
| `/status` | 讀取 `data/market/latest.json`；有 `MINI_APP_URL` 時附加 WebApp Inline Button | 零 |
| `/status_debug` | 讀取 `data/market/latest.json` 的 `_meta.sources`，以人類可讀方式列出各 provider 的 `status` / `lastFetch` / `error`，輔助排查 market data pipeline | 零 |
| `/daily` | `dailyCheck({ isTelegramEnabled: true, isAIAdvisor: true })` | 中高 |
| `/news` | `runNewsFetch()` | 中 |
| `/weekly` | `runWeeklyReport()` | 中（AI） |
| `/monthly` | `runMonthlyReport()` | 高（AI） |
| `/optimize` | `runRuleOptimizer()` | 中（AI） |

**Lock 機制**：每個排程類指令執行前會嘗試取得 `data/.bot_lock`，舊 lock 超過 30 分鐘自動強制釋放。已有其他 runner 執行時，指令回覆提示而不即時執行。

---

## 3. Daily Entry Flow
`src/dailyCheck.mjs` 仍然是每日主流程的 orchestration center。其實際步驟如下：

1. 從 Google Sheets 繼承前一日持股狀態。
2. 檢查是否為 TWSE 開市日。
3. 抓取 VIX、基準價、macro data、即時價格與歷史股價。
4. 計算 RSI / KD / MA240 等技術指標。
5. 讀取 news summary，執行**矛盾新聞偵測**，並呼叫 AI macro analysis。
   - `src/modules/news/newsConflictGrouper.mjs` 的 `assignConflictGroups()` 在新聞池載入後介入，依事件關鍵字將互相矛盾的新聞條目分群，並標記 `conflictGroup` / `conflictRole`（`supporting` / `contradicting`）。
   - 分群結果以 `conflictSummary`（矛盾事件摘要字串）形式注入 macro analysis prompt，提示 AI 注意時序與現況相符性，避免過時資訊影響多空判定。
   - 矛盾偵測為 graceful 介入：若無矛盾事件，`conflictSummary` 為空字串，不影響後續流程。
6. 把 `macroMarketDirection` 注入 strategy input，執行 `getInvestmentSignalAsync()`。
7. 呼叫 `getAiInvestmentAdvice()` 產生最終每日建議。
8. 透過 `broadcastDailyReport()` 發送 Telegram。
9. 寫回 Google Sheets、archive daily report、條件式執行 `llmJudge`。

值得注意的是，`llmJudge` 不是額外獨立排程，而是 daily flow 中 **有條件判斷才執行** 的背景評估任務。

---

## 4. Period Report Entry Flow

### Weekly
`src/runWeeklyReport.mjs`：
- 從 `data/reports/` 載入近 **7 天**資料（`loadRecentReports(7)`）。
- 若可用報告少於 3 份，直接跳過，必要時仍發送失敗提醒。
- 呼叫 `buildSignalAccuracyStats(reports, reports, "weekly")` 計算本週買進訊號次數與冷卻封鎖次數（不計算報酬率）。
- 完成統計後由 `generatePeriodAiSummary()` 生成 AI 摘要。
- 最後由 Telegram batch 發送 **2 則**週報訊息（msg1 含訊號數量統計嵌入末尾，msg2 為 AI 分析）。

### Monthly
`src/runMonthlyReport.mjs`：
- 從 `data/reports/` 載入近 **50 天**資料（`loadRecentReports(50)`），取最後 30 天為評估期（`reports`），全部 50 天作為報酬率計算的價格序列（`allReports`）。
- 若評估期報告少於 10 份，直接跳過。
- 呼叫 `buildSignalAccuracyStats(reports, allReports, "monthly")` 計算買進訊號的 +5 / +10 / +20 日報酬率與勝率；資料不足的天數各自標記 `available: false`，暫不顯示。
- 統計內容比週報更多，包含月度 signal quality 分析。
- 最後由 Telegram batch 發送 **3 則**月報訊息（msg1 數據摘要、msg2 AI 分析、msg3 訊號準確率回顧）。

這兩條流程都依賴既有 `data/reports/`，並不重新執行整套 daily pipeline。

---

## 5. CI / Scheduler Layer

所有定時任務均由 **Oracle VM crontab** 執行，GitHub Actions 僅保留手動觸發或非主要用途（如 SSH 部署、workflow 失敗告警）。Bot daemon（`src/bot.mjs`）與 API Server（`src/api/server.mjs`）由 Oracle VM 上的 pm2 常駐執行。

### VM crontab（主排程）

| Shell Script | 對應 Runner | 時間 |
|---|---|---|
| `scripts/vm-daily-check.sh` | `src/runDailyCheck.mjs` | 每日 07:30 / 10:30 / 12:00 / 13:45 / 21:30 |
| `scripts/vm-news-fetch.sh` | `src/runNewsFetch.mjs` | 每 4 小時 |
| `scripts/vm-optimizer.sh` | `src/runOptimizer.mjs` | 每日 02:00 |
| `scripts/vm-weekly-report.sh` | `src/runWeeklyReport.mjs` | 每週一 09:30 |
| `scripts/vm-monthly-report.sh` | `src/runMonthlyReport.mjs` | 每月 1 日 09:00 |

每個 shell script 均內建 lock 檔案防重、ERR trap 錯誤通知、log 寫入機制。

### GitHub Actions（次要 / 保留用途）

| Workflow 檔案 | 用途 |
|---|---|
| `.github/workflows/notify-workflow-failure.yml` | 其他 workflow 失敗時觸發，透過 `sendSystemMessage()` 發送靜默通知至 Log 頻道 |
| `.github/workflows/deploy.yml`（若有） | SSH 連線 VM 執行 `git pull` 更新部署 |

**`data/` 同步機制**：Actions 完成後透過 SSH 通知 VM 執行 `git pull`（方案 B），確保 VM 上 Fastify 讀取的 JSON 與 GitHub 一致。

> **Bot daemon 與 API Server** 在 Oracle VM 上由 `pm2` 長駐執行（`npm run bot` / `npm run api`），詳見 [`docs/appendix/deployment-oracle-vm.md`](../appendix/deployment-oracle-vm.md)。

---

## 6. Notification 結構
目前 `src/modules/notifications/` 已拆成三層：

| Path | 說明 |
|---|---|
| `src/modules/notifications/notifier.mjs` | notification orchestration，依資料類型決定如何組訊息與送出。提供 `broadcastDailyReport()` 與 `broadcastOptimizerResult()` 兩個 export。 |
| `src/modules/notifications/templates/telegramHtmlBuilder.mjs` | 每日戰報 Telegram HTML 模板，負責訊息分段與排版。 |
| `src/modules/notifications/templates/periodReportBuilder.mjs` | 週報 / 月報訊息 builder。`buildPeriodReportMessages()` 接受第四個可選參數 `accuracyStats`，週報嵌入 msg1、月報獨立產生 msg3。**回傳 `{ text: string }[]` 物件陣列**，供 `sendTelegramBatch()` 直接使用。 |
| `src/modules/notifications/transports/telegramClient.mjs` | 實際呼叫 Telegram Bot API，提供 `sendTelegramBatch()` 與 `sendSystemMessage()`。`sendTelegramBatch()` **接受 `{ text: string }[]` 格式**（非純字串陣列）。 |

### Telegram 頻道分流
本系統使用兩個 Telegram Bot Token，對應不同用途：

| Token 環境變數 | 用途 | 函式 |
|---|---|---|
| `TELEGRAM_API_TOKEN` | 每日戰報、週報、月報等用戶可見訊息、**Bot 指令訊息回覆** | `sendTelegramBatch()` |
| `TELEGRAM_LOG_API_TOKEN` | 系統狀態通知：Optimizer 執行結果、GitHub Actions 排程異常 | `sendSystemMessage()` |

兩者的 `chat_id` 均使用 `TELEGRAM_USER_ID`（同一帳號接收），Bot 不同頻道分流。

### `sendSystemMessage()` 行為
- 固定帶 `disable_notification: true`（靜默，不震動手機）。
- 固定使用 `TELEGRAM_LOG_API_TOKEN`；若未設定，只 `console.warn` 而不拋錯。
- 支援 HTML parse mode，可用 `<b>`, `<code>` 等標籤排版。

### `broadcastOptimizerResult()` 行為
- 僅在 `tw.accepted + us.accepted > 0` 時才發送，無新規則時靜默略過。
- 訊息含：執行日期、TW/US 各區新增/拒絕規則數、pattern 清單（最多 5 條，超過顯示「…等 N 條」）、blacklist 累計總規則數。
- 由 `runOptimizer.mjs` 在 `runRuleOptimizer()` 完成後呼叫，失敗不中斷主流程。

### Daily Telegram Message Strategy
每日通知仍以分段式訊息為主，目的是兼顧可讀性與 Telegram 長度限制。實際內容可包含：
- 市場總覽與主建議（Msg 1），
- 技術指標 / 帳戶快照 / **保證金壓力測試與解耦分析**（Msg 2），
- AI 教練與總経摘要（Msg 3）。

### Period Report Message Strategy
週報 / 月報由 `periodReportBuilder.mjs` 組裝，訊息數量依週期不同：

| 週期 | 訊息數 | 各則內容 |
|---|---|---|
| 週報 | 2 則 | msg1：數據摘要 + 訊號數量統計；msg2：AI 分析 |
| 月報 | 3 則 | msg1：數據摘要；msg2：AI 分析；msg3：訊號準確率回顧（含 +5/+10/+20 日報酬率明細） |

**`buildPeriodReportMessages()` 回傳格式**：`{ text: string }[]`（物件陣列），符合 `sendTelegramBatch()` 的介面規格。呼叫方不可直接傳純字串陣列，否則會觸發 Telegram `Bad Request: message text is empty`。

訊號準確率區塊（`buildAccuracySection()`）：
- 週報：顯示買進觸發次數 + 冷卻封鎖次數，提示「報酬率於月報公佈」。
- 月報：顯示每筆訊號的 +5 日報酬（▲/▼ 標示）、槓桿比例，以及 +5/+10/+20 日的平均報酬率與勝率；資料不足的天數標記「資料不足，暫不顯示」。

---

## 7. 錯誤處理原則
本層的設計原則是 **delivery should degrade gracefully**：

- Telegram token 未設定時，可在 console preview，不讓流程直接崩潰。
- 若單次通知失敗，應盡量限制在 transport 層，而不是把整個 decision pipeline 一起中斷。
- 週報 / 月報若報告數量不足，可以發送提醒，但不應強行產生低品質報告。
- `runNewsFetch` 與 `runOptimizer` 的失敗，不應被誤認為 `dailyCheck` 本身故障。
- 訊號準確率計算（`buildSignalAccuracyStats`）若 `data/reports/` 歷史資料不足，會 graceful degradation：資料不足的天數各自標記，不影響整體報告發送。
- **`TELEGRAM_LOG_API_TOKEN` 未設定**：`sendSystemMessage()` 只會 `console.warn`，不影響任何主流程；`notify-workflow-failure.yml` 的 curl 呼叫會靜默失敗（HTTP 401）。
- **Bot lock 衝突**：若看到「系統正在執行中」訊息長達 30 分鐘，可能為 Runner 崩潰沒清除 lock。可手動刪除 `data/.bot_lock` 強制釋放。
- **`Bad Request: message text is empty`**：若 Telegram 回傳此錯誤，應先確認 `buildPeriodReportMessages()` 回傳的是 `{ text: string }[]` 而非純字串陣列；`sendTelegramBatch()` 期望的是物件格式，傳入純字串會導致 `message.text` 為 `undefined`。
- **矛盾新聞偵測失敗**：`assignConflictGroups()` 若拋出例外，應於呼叫端 `try/catch` 捕捉並降級為 `conflictSummary = ""`，確保 macro analysis 仍可正常執行。

---

## 8. Bot UI 整合（Phase 2-C）

Bot 啟動時除了開始 Long-Polling，還會非同步執行兩項 Telegram API 初始化任務。
兩者均為 UX 導向，失敗只 `console.warn`，**不中斷 Bot 主要功能**。

### 8-1. 指令選單 — `setMyCommands`

Bot 每次啟動的 `onStart` callback 中呼叫 `bot.api.setMyCommands()`，
將以下 7 項指令同步至 Telegram 左下角選單：

| 指令 | 選單說明文字 |
|---|---|
| `/status` | 查看最新市場快取狀態 |
| `/status_debug` | 查看最新市場快取（含來源狀態，供除錯用） |
| `/daily` | 手動觸發每日報告（含 AI 分析） |
| `/news` | 手動更新新聞池 |
| `/weekly` | 手動觸發週報 |
| `/monthly` | 手動觸發月報 |
| `/optimize` | 手動觸發規則優化器 |
| `/help` | 顯示指令說明 |

> `/start` 不列入選單（初次互動專用），其他指令每次啟動自動更新，無需手動維護。

### 8-2. `/status` WebApp Inline Button

`/status` 指令回覆時，會依 `MINI_APP_URL` 是否設定，條件式附加 Inline Button：

| `MINI_APP_URL` 狀態 | 回覆行為 |
|---|---|
| **未設定（空値）** | 純文字回覆，與舊版行為完全相同 |
| **已設定** | 文字回覆末尾附加「📊 開啟儀表板」 WebApp Button，點擊直接開啟 Mini App |

此設計確保在取得 HTTPS domain 之前，Bot 功能完全不受影響；填入 env 後無需修改程式碼即自動生效。

### 8-3. Chat Menu Button — `setChatMenuButton`

將 Telegram 對話左下角的 Menu Button 設為開啟 Mini App 的入口。
實作於 `syncMenuButton()` 函式，包含以下防護：

| 防護條件 | 行為 |
|---|---|
| `MINI_APP_URL` 未設定或空字串 | 直接 return，不呼叫任何 API |
| `TELEGRAM_USER_ID` 未設定或非數字 | `console.warn` 後跳過，防止傳入 `NaN` 至 Telegram API |
| API 呼叫失敗 | `try/catch` 捕捉，`console.warn` 記錄，不影響 Bot 運作 |

> `setChatMenuButton` 以 `chat_id` 指定單一使用者，僅影響白名單帳號的對話介面，不影響其他對話。

### 8-4. 相關環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `TELEGRAM_API_TOKEN` | ✅ 必填 | Bot Token，用於所有指令回覆與 API 初始化 |
| `TELEGRAM_USER_ID` | ✅ 必填 | 白名單 chat_id，adminGuard 與 setChatMenuButton 均依賴此値 |
| `MINI_APP_URL` | ⬜ 選填 | Mini App 的 HTTPS URL；未設定時 Inline Button 與 Menu Button 均自動停用 |

> `MINI_APP_URL` 取得 Oracle VM HTTPS domain 後填入，填入後重啟 Bot 即自動啟用所有 Mini App 入口，無需任何程式碼變更。
