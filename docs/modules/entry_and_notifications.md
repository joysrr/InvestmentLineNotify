# 系統排程入口與通知模組 (Entry & Notifications) 架構說明

## 1. 模組職責
本模組涵蓋系統的「生命週期起點」與「生命週期終點」。
- **執行起點**：由 `src/runDailyCheck.mjs` 與 `src/dailyCheck.mjs` 作為整個無頭 (Headless) 系統的進入點，負責依序調度基礎設施抓取資料、策動量化策略運算，最終呼叫 AI 進行決策。
- **通知終點**：`src/modules/notifications/` 負責將龐大的 JSON 數據與 AI 推演結果，轉換為人類易讀、視覺層次豐富且支援多裝置的通訊軟體 (Telegram) 戰報格式，並執行非同步發送。

## 2. 執行流程 (Entry Flow)
系統採用單線程且具備明確先後順序的 Pipeline 設計，每日排程觸發時的執行流程如下：

1. **參數解析 (`runDailyCheck.mjs`)**
   - 接受命令列參數（如 `--telegram=false` 或 `--aiAdvisor=false`）來決定是否要發送實體通知或花費 Token 呼叫 AI，便於本機開發與測試。
   - 將參數向下傳遞給核心邏輯 `dailyCheck.mjs`。
2. **狀態繼承與防呆 (`dailyCheck.mjs`)**
   - 優先從 Google Sheets 讀取昨日的持股與資金狀態。若讀取失敗，則預設全部為 0，避免崩潰。
   - 檢查台股是否開市（透過 TWSE API），若未開市則紀錄日誌但仍可繼續執行（用以觀察國際盤）。
3. **資料並行採集 (Data Gathering)**
   - 抓取即時 / 收盤價（0050、00675L）、台股 VIX、基準價。
   - 呼叫 `fetchAllMacroData()` 大量抓取美股風險、CNN 恐懼貪婪、匯率與台股融資餘額。
4. **量化特徵運算 (Quant Evaluation)**
   - 傳入近一年的歷史 K 線，計算 RSI、MACD、KD。
   - 呼叫 `getInvestmentSignalAsync()` 將指標與帳戶資料輸入策略引擎，計算過熱、轉弱、加碼評分等量化風控訊號。
5. **AI 大腦分析 (AI Pipeline)**
   - 抓取新聞 RSS 並進行過濾摘要。
   - 呼叫總經分析師 (`analyzeMacroNewsWithAI`) 產生多空對決報告。
   - 將所有指標文字化後，呼叫教練大腦 (`getAiInvestmentAdvice`) 產出最終行動指引。
6. **通知與持久化 (Broadcast & Archiving)**
   - 將上述所有結果打包交給 `notifier.mjs` 進行廣播。
   - 將當日狀態寫回 Google Sheets（作為歷史 Log 與隔日起始狀態）。
   - 將全量結果與 AI 對話紀錄寫入本地 `archiveManager` 作備份，並清理 30 天前的舊檔案。

## 3. 通知格式與管道
系統目前的發送出口位於 `src/modules/notifications/transports/telegramClient.mjs`。為了符合現代通訊軟體的閱讀體驗，戰報被精心設計為「分段推送機制」：

**Telegram 分塊推播 (HTML 渲染)**：
`telegramHtmlBuilder.mjs` 負責將資料格式化，並拆解為 3 則獨立訊息：
1. **第一則 (市場概況與進場評分)**：包含當下最核心的行動建議 (`targetSuggestionShort`)、大盤維持率與 00675L 槓桿健康度指標，以及資產目標進度。**（這則是唯一會觸發使用者手機震動/響鈴的訊息）**。
2. **第二則 (技術指標與帳戶快照)**：包含各項轉弱/賣出技術指標的觸發狀態，以及帳戶內的絕對持倉金額。由於涉及隱私，利用了 Telegram 的 `<tg-spoiler>` 語法將敏感數字遮蔽。**（此訊息設定為 `disable_notification: true` 靜默發送）**。
3. **第三則 (AI 策略與總經報告)**：包含 AI 總經多空分數對決、教練的行動指引，以及一個可折疊展示的「AI 教練隱藏思考區 (`coach_internal_thinking`)」。同時會加上 `Inline Keyboard`（內聯按鈕）方便使用者點擊跳轉至 Google Sheets 或策略 JSON 檔。**（同樣為靜默發送）**。

## 4. 錯誤處理與重試機制
整個排程被設計為「防脆弱 (Anti-Fragile)」架構。除了最核心的網路崩潰外，單一元件的失敗不應阻斷最終的戰報發送。
- **降級機制 (Graceful Degradation)**：
  - 如果 MIS 即時報價 API 掛掉，會自動降級改用 TWSE 盤後收盤價 API。
  - 如果抓取新聞或 AI API 憑證失效，會回傳預設的空字串或固定提示，主程式仍會正確算出技術指標並推播量化戰報。
- **非阻塞持久化**：
  - 即使 Google Sheets 寫入失敗 (`logDailyToSheet`)，系統僅會 `console.error` 捕捉例外，確保使用者依然能從 LINE/Telegram 第一時間收到本日戰報。
- **資源安全釋放**：
  - 整個流程以 `try...catch...finally` 包覆。無論中間遭遇多嚴重的中斷，`finally` 區塊皆會強制呼叫 `langfuse.shutdownAsync()` 以安全關閉 AI 追蹤器的連線，避免 Node.js 產生 Memory Leak 且 Process zombie 殘留。
- **通知模組本身的防呆**：
  - `telegramClient.mjs` 會透過 `Promise.allSettled` 來批次發送，若其中一則訊息（例如因為 HTML 標籤未閉合）發送失敗，不會導致排程崩潰，而是在日誌中印出由 Telegram API 回傳的具體錯誤描述 (`description`)。
