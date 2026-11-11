---
type: reference
status: current
last_updated: 2026-11-11
last_verified: 2026-09-10
related_code:
  - src/modules/notifications/
  - src/modules/ai/aiCoach.mjs
related_docs:
  - docs/modules/presentation/bot.md
tags:
  - notifications
  - telegram
  - mini-app
wiki_links:
  - [[Telegram Bot]]
  - [[AI News]]
---

# 廣播與通知層 (`src/modules/notifications/`)

負責將最終的結果 (包含 AI 總結、Strategy Signals、新聞摘要) 格式化並推送到指定的通訊軟體。

## 1. 雙模式推送 (`notifier.mjs`)

根據環境變數 `TELEGRAM_WEBAPP_URL` 的存在與否，切換不同的推播邏輯：

- **Mini App 精簡模式 (有設定 WebApp URL)**：
  發送單一則精簡且高資訊密度的卡片訊息，並附上一個 Inline Button。點擊按鈕可在 Telegram 內直接開啟 Web App 查看完整的互動式報告與新聞。
  **隱私與閱讀優化**：此模式移除了絕對金額（如總資產），改以比例型的「部位健康度」（實際槓桿、維持率、可跌空間）呈現以維護隱私。排版聚焦於台股核心指標（PR 與 VIX），並首創在卡片上直接顯示「AI 總經方向與短評摘要」，讓您無須開啟 App 也能一目了然。
- **傳統完整模式 (向下相容)**：
  發送 3~4 則連續訊息，包含系統標頭、完整訊號、AI 心態教練與新聞，會洗版但適合不需要 Web App 的環境。

## 2. 靜默頻道通知

除了主要戰報，系統也會將部分非關交易的訊息，傳送至專屬的 Log 頻道：

- `broadcastOptimizerResult()`：將 AI Rule Optimizer (黑名單優化 Agent) 執行的結果（新增或刪除的關鍵字正則），傳送至 `TELEGRAM_LOG_API_TOKEN` 所配置的群組，這有助於區分雜訊。

## 3. 訊息範本 (`templates/telegramHtmlBuilder.mjs`)

將 HTML 的字串組裝邏輯從 `notifier.mjs` 獨立出來，確保發送器與樣板解耦。

## 4. 傳輸層 (`transports/telegramClient.mjs`)

實作 Telegram Bot API 的 HTTPS 通訊，包含重試機制。

### 重試策略

| 設定         | 值                                                                    |
| ------------ | --------------------------------------------------------------------- |
| 預設重試次數 | `DEFAULT_RETRIES`                                                     |
| 退避計算     | `calculateBackoffDelay(attempt, retryDelay, 10000ms max, 0.5 jitter)` |
| 可重試錯誤   | `isRetryableError(error)` 判斷（網路錯誤、超時、5xx）                 |
| 不可重試錯誤 | 4xx 客戶端錯誤（如訊息格式錯誤）→ 拋出 `ProviderError`                |
| 連線         | 強制 IPv4（`family: 4`）                                              |

### 主要匯出函式

| 函式                          | 說明                                             |
| ----------------------------- | ------------------------------------------------ |
| `sendTelegramBatch(messages)` | 批量發送多則訊息（包含 unpin → send 流程）       |
| `unpinAllChatMessages()`      | 發送前清除舊 pin（確保每日卡片置頂）             |
| `sendSystemMessage(text)`     | 發送至 Log 頻道（使用 `TELEGRAM_LOG_API_TOKEN`） |

### 失敗處理

- 超過重試次數 → 拋出 `ProviderError`，日誌記錄 `operation` / `statusCode` / `attempt`
- 由 `broadcastDailyReport()` 呼叫方使用 `Promise.allSettled` 收集結果，不因單一失敗中斷全部推送
- 失敗會由上層 `runner` 或 `runnerLock` 捕捉並記錄

## 5. 目錄結構

```
src/modules/notifications/
├── notifier.mjs               # 廣播協調器（雙模式切換）
└── transports/
    └── telegramClient.mjs     # Telegram HTTPS 傳輸層（重試、指數退避）
    └── templates/
        └── telegramHtmlBuilder.mjs  # HTML 訊息範本（與傳輸解耦）
```
