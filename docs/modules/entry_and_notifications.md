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
| `src/runWeeklyReport.mjs` | 週報入口，讀取近 7 天 `data/reports/`，至少 3 份才生成。包含訊號數量統計。 |
| `src/runMonthlyReport.mjs` | 月報入口，讀取近 50 天 `data/reports/`（前 30 天為評估期，全 50 天供報酬率計算），至少 10 份才生成。 |

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

## 5. Notification 結構
目前 `src/modules/notifications/` 已拆成三層：

| Path | 說明 |
|---|---|
| `src/modules/notifications/notifier.mjs` | notification orchestration，依資料類型決定如何組訊息與送出。 |
| `src/modules/notifications/templates/telegramHtmlBuilder.mjs` | 每日戰報 Telegram HTML 模板，負責訊息分段與排版。 |
| `src/modules/notifications/templates/periodReportBuilder.mjs` | 週報 / 月報訊息 builder。`buildPeriodReportMessages()` 接受第四個可選參數 `accuracyStats`，週報嵌入 msg1、月報獨立產生 msg3。 |
| `src/modules/notifications/transports/telegramClient.mjs` | 實際呼叫 Telegram Bot API。 |

### Daily Telegram Message Strategy
每日通知仍以分段式訊息為主，目的是兼顧可讀性與 Telegram 長度限制。實際內容可包含：
- 市場總覽與主建議，
- 技術指標 / 帳戶快照，
- AI 教練與總經摘要。

### Period Report Message Strategy
週報 / 月報由 `periodReportBuilder.mjs` 組裝，訊息數量依週期不同：

| 週期 | 訊息數 | 各則內容 |
|---|---|---|
| 週報 | 2 則 | msg1：數據摘要 + 訊號數量統計；msg2：AI 分析 |
| 月報 | 3 則 | msg1：數據摘要；msg2：AI 分析；msg3：訊號準確率回顧（含 +5/+10/+20 日報酬率明細） |

訊號準確率區塊（`buildAccuracySection()`）：
- 週報：顯示買進觸發次數 + 冷卻封鎖次數，提示「報酬率於月報公布」。
- 月報：顯示每筆訊號的 +5 日報酬（▲/▼ 標示）、槓桿比例，以及 +5/+10/+20 日的平均報酬率與勝率；資料不足的天數標記「資料不足，暫不顯示」。

---

## 6. 錯誤處理原則
本層的設計原則是 **delivery should degrade gracefully**：

- Telegram token 未設定時，可在 console preview，不讓流程直接崩潰。
- 若單次通知失敗，應盡量限制在 transport 層，而不是把整個 decision pipeline 一起中斷。
- 週報 / 月報若報告數量不足，可以發送提醒，但不應強行產生低品質報告。
- `runNewsFetch` 與 `runOptimizer` 的失敗，不應被誤認為 `dailyCheck` 本身故障。
- 訊號準確率計算（`buildSignalAccuracyStats`）若 `data/reports/` 歷史資料不足，會 graceful degradation：資料不足的天數各自標記，不影響整體報告發送。

對 AI Agent 來說，若看到「有資料但沒送出」的問題，通常從本文件描述的 entry / notification boundary 開始查最有效。
