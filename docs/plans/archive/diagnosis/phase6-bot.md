# Phase 6: Bot 層 (adminGuard, handler 拆分) 審查與修復計畫

## 診斷結果

### P1 — 中度

- **[P1-21]** `adminGuard` 原本僅比對 `ctx.chat.id`，在群組被誤用時可能造成任何成員皆可呼叫 Bot 的授權漏洞。已追加 `ctx.from.id` 比對，確保指令的實質發送者必須也是授權的 `TELEGRAM_USER_ID`。
- **[P1-22]** `bot.mjs` 中的 `/status` 與 `/status_debug` 使用了同步方法 `readFileSync`，在 Long-Polling 模式下會阻塞 Event Loop。已將這兩個 handler 抽離並改寫為使用 `fs/promises` 的 `readFile` 與 `await` 進行非阻塞 I/O。
- **[P1-23]** `runnerLock` 的 `.bot_lock` 存在跨機器失效的問題（如 GitHub Actions）。已於檔案頂端加入環境偵測，當遇到 `GITHUB_ACTIONS="true"` 時會主動印出警告，提示架構限制，避免未來開發者除錯盲點。

### P2 — 低度

- **[P2-24]** `bot.mjs` 原本過於龐大，所有指令 handler 內嵌導致難以測試。已將狀態顯示邏輯抽出至獨立模組 `src/modules/bot/handlers/statusHandlers.mjs`。
- **[P2-25]** `withRunner` 將 runner 的回傳值丟棄，使用者只會看到「執行完成」。已修改 `withRunner` 接收並回傳 `resultMsg`，例如 `/news` 指令現在能顯示「新增 N 篇、pool 總量 N 篇」的摘要。
- **[P2-26]** `bot.catch` 原本只會 `console.error`，使用者對異常發生毫無頭緒。已追加 `ctx.reply` 防護，能在未預期例外發生時主動發送錯誤訊息給使用者。

## 實作修復

由 @Backend 針對上述 6 項缺失完成重構與強化，@Reviewer 已驗證存取控制與模組拆分的正確性，並由 @QA 確認編譯與測試正常。
