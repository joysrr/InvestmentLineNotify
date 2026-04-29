# Telegram Bot 入口 (`src/modules/bot/`)

負責處理使用者主動透過 Telegram 發送的指令 (Commands)。

## 1. 權限防護 (Middleware)

由於本系統涉及高度機密的資產與決策，所有的 Bot 指令都受到權限控管：

- 必須經過 `authMiddleware.mjs`。
- 只有位於 `TELEGRAM_ALLOWED_USERS` (白名單 ID) 內的帳號才能觸發指令，其餘請求一律靜默拋棄。

## 2. 原子鎖機制 (`runnerLock.mjs`)

由於生成戰報或執行排程可能耗時數十秒（抓取資料、AI 生成），為了防止使用者連點，或與 GitHub Actions 的 cron job 發生衝突，實作了基於 `proper-lockfile` 的實體檔案鎖：

- **最大並發 (Concurrency)**：預設最大並發任務數為 2。
- **防止疊加**：若鎖已存在，會提示「任務正在執行中，請勿重複觸發」。
- **自動超時 (Timeout)**：鎖的生命週期預設為 30 分鐘，超過後視為卡死並強制釋放。
- **優雅關機 (Graceful Shutdown)**：監聽 `SIGINT` 與 `SIGTERM`，確保 Node.js 進程被關閉時能正確釋放鎖，避免重啟後卡死。

## 3. 主要指令

- `/report`：主動觸發一次完整的 `dailyCheck.mjs` 流程。
- `/status`：查看系統各項排程與模組的健康度。
