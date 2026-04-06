# Agent Task Cache — 項目一實作進度

**Task Started**: 2026-04-06  
**Status**: IN PROGRESS  
**Current Phase**: Phase 1-A

---

## 決策記錄
- Bot 框架：grammY
- 連線模式：Polling（Long-Polling），未來可換 Webhook
- 白名單 env var：沿用 `TELEGRAM_USER_ID`（不新增 ADMIN_CHAT_ID）

---

## Phase 清單

- [ ] Phase 1-A：安裝 grammY + 建立 src/bot.mjs 骨架（白名單 middleware + /start + /help）
- [ ] Phase 1-B：實作核心指令（/status, /daily, /weekly, /monthly, /news, /optimize）+ lock 機制
- [ ] Phase 1-C：Inline Keyboard 整合 + 更新 docs

---

## Phase 1-A 工作項目

- [ ] package.json 加入 grammy
- [ ] 建立 src/bot.mjs（骨架 + 白名單 + /start + /help）
- [ ] 建立 src/modules/bot/middleware/adminGuard.mjs（白名單 middleware）

---

## 現有架構關鍵資訊

### 已有 exports
- `src/dailyCheck.mjs` → `export async function dailyCheck({ isTelegramEnabled, isAIAdvisor })`
- `src/modules/ai/ruleOptimizerAgent.mjs` → `export async function runRuleOptimizer()`
- `src/modules/notifications/notifier.mjs` → `export async function broadcastOptimizerResult()`
- `src/modules/notifications/transports/telegramClient.mjs` → `sendTelegramBatch()`, `sendSystemMessage()`

### 需確認是否有 export（Phase 1-B 前確認）
- `src/runNewsFetch.mjs` → 目前是 `main()` 直接執行，需封裝
- `src/runWeeklyReport.mjs` → 同上
- `src/runMonthlyReport.mjs` → 同上

### ENV 變數
- `TELEGRAM_API_TOKEN` — 主頻道 Bot Token
- `TELEGRAM_LOG_API_TOKEN` — Log 頻道 Bot Token
- `TELEGRAM_USER_ID` — Chat ID，Bot 沿用作為白名單

### Lock 機制設計（Phase 1-B）
- 檔案路徑：`data/.bot_lock`
- 寫入時機：runner 開始前
- 清除時機：runner 完成或失敗後（finally 清除）
- 檢查時機：Bot 指令觸發時，若存在則回覆「⏳ 系統正在執行中，請稍後再試」

---

## Commits
- 待填入
