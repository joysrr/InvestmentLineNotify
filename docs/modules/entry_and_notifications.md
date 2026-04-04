# 系統入口與通知 / Entry & Notifications

## 1. 模組定位
此文件描述系統從「被啟動」到「送出結果」的兩端邊界：
- **Entry side**：各類 runner 如何觸發並把工作分派到核心模組。
- **Notification side**：如何把 daily decision 或 period report 轉成 Telegram 可讀訊息。

本專案目前不是單一入口，而是多 runner 架構，因此文件也必須明確區分每個入口的責任。

---

## 2. Runner 一覽
| Path | 說明 |
|---|---|
| `src/runDailyCheck.mjs` | 每日主入口，支援 CLI flags，進入 `dailyCheck()`。 |
| `src/runNewsFetch.mjs` | 獨立新聞抓取與新聞池更新入口，並回寫 Langfuse Yield Rate score。 |
| `src/runOptimizer.mjs` | 獨立 rule optimizer 入口，供排程或手動治理使用。 |
| `src/runWeeklyReport.mjs` | 週報入口，讀取近 7 天 `data/reports/`，至少 3 份才生成。 |
| `src/runMonthlyReport.mjs` | 月報入口，讀取近 30 天 `data/reports/`，至少 10 份才生成。 |

---

## 3. Daily Entry Flow
`src/dailyCheck.mjs` 仍然是每日主流程的 orchestration center。其實際步驟如下：

1. 從 Google Sheets 繼承前一日持股狀態。
2. 檢查是否為 TWSE 開市日。
3. 抓取 VIX、基準價、macro data、即時價格與歷史股價。
4. 計算 RSI / KD / MA240 等技術指標。
5. 讀取 news summary，並呼叫 AI macro analysis。
6. 把 `macroMarketDirection` 注入 strategy input，執行 `getInvestmentSignalAsync()`。
7. 呼叫 `getAiInvestmentAdvice()` 產生最終每日建議。
8. 透過 `broadcastDailyReport()` 發送 Telegram。
9. 寫回 Google Sheets、archive daily report、條件式執行 `llmJudge`。

值得注意的是，`llmJudge` 不是額外獨立排程，而是 daily flow 中 **有條件判斷才執行** 的背景評估任務。

---

## 4. Period Report Entry Flow

### Weekly
`src/runWeeklyReport.mjs`：
- 從 `data/reports/` 載入近 7 天資料。
- 若可用報告少於 3 份，直接跳過，必要時仍發送失敗提醒。
- 完成統計後由 `generatePeriodAiSummary()` 生成 AI 摘要。
- 最後由 Telegram batch 發送週報訊息。

### Monthly
`src/runMonthlyReport.mjs`：
- 從 `data/reports/` 載入近 30 天資料。
- 若可用報告少於 10 份，直接跳過。
- 統計內容比週報更多，包含月度 signal quality 分析。
- 最後由 Telegram batch 發送月報訊息。

這兩條流程都依賴既有 `data/reports/`，並不重新執行整套 daily pipeline。

---

## 5. Notification 結構
目前 `src/modules/notifications/` 已拆成三層：

| Path | 說明 |
|---|---|
| `src/modules/notifications/notifier.mjs` | notification orchestration，依資料類型決定如何組訊息與送出。 |
| `src/modules/notifications/templates/telegramHtmlBuilder.mjs` | 每日戰報 Telegram HTML 模板，負責訊息分段與排版。 |
| `src/modules/notifications/templates/periodReportBuilder.mjs` | 週報 / 月報訊息 builder。 |
| `src/modules/notifications/transports/telegramClient.mjs` | 實際呼叫 Telegram Bot API。 |

### Daily Telegram Message Strategy
每日通知仍以分段式訊息為主，目的是兼顧可讀性與 Telegram 長度限制。實際內容可包含：
- 市場總覽與主建議，
- 技術指標 / 帳戶快照，
- AI 教練與總經摘要。

### Period Report Message Strategy
週報 / 月報由 `periodReportBuilder.mjs` 組裝，內容核心不是即時訊號，而是：
- 區間統計，
- 風險事件摘要，
- 一致性評論，
- 下週 / 下月 outlook。

---

## 6. 錯誤處理原則
本層的設計原則是 **delivery should degrade gracefully**：

- Telegram token 未設定時，可在 console preview，不讓流程直接崩潰。
- 若單次通知失敗，應盡量限制在 transport 層，而不是把整個 decision pipeline 一起中斷。
- 週報 / 月報若報告數量不足，可以發送提醒，但不應強行產生低品質報告。
- `runNewsFetch` 與 `runOptimizer` 的失敗，不應被誤認為 `dailyCheck` 本身故障。

對 AI Agent 來說，若看到「有資料但沒送出」的問題，通常從本文件描述的 entry / notification boundary 開始查最有效。
