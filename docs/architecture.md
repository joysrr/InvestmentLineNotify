# 00675L 槓桿 ETF 投資決策系統 (InvestmentLineNotify) 總體架構

## 1. 系統總覽
本系統為一套專為「生命週期投資法」與 0050 / 00675L (槓桿 ETF) 打造的 **無資料庫 (Serverless-like) Node.js 決策中樞**。
系統的完整生命週期如下：
1. **排程觸發**：系統由外部 Cron Job (或 GitHub Actions) 定時觸發 `src/runDailyCheck.mjs`。
2. **狀態繼承**：透過讀取個人的 Google Sheets 獲取昨天的持股狀態與借貸金額。
3. **並行採集與快取**：跨網抓取台股/美股報價、各項總經指標 (CNN恐懼貪婪、國發會景氣、大盤融資) 與財經新聞。為避免觸發 API Rate Limit，全面利用本地端 `data/` 資料夾進行快取與生命週期管理。
4. **量化與防護計算**：策略引擎轉換技術指標 (RSI/MACD/KD)，並加入嚴格的風控邏輯（如：維持率斷頭警告、乖離率過熱、冷卻期限制、極端恐慌破冰）。
5. **AI 大腦推演**：透過多金鑰輪詢呼叫 Google Gemini 模型，執行「新聞降噪過濾」、「總經多空對決對決」與「教練擬人化建議」。
6. **推播與歸檔**：將枯燥的 JSON 數據轉換為好讀的 Telegram 分段 HTML 戰報推播給使用者，最後將今日所有決策記錄寫回 Google Sheets，並把日誌歸檔於本地 `data/` 供日後覆盤。

---

## 2. Mermaid 架構圖

以下的資料流呈現了系統中最重要的「單向決策管線」以及「本地 File System」取代資料庫的設計。

```mermaid
flowchart TD
    Start([排程觸發 / 手動執行\nsrc/runDailyCheck.mjs]) --> Entry[src/dailyCheck.mjs\n主排程管線]

    subgraph Data [持久化與快取層 (無資料庫設計)]
        GS[(Google Sheets\n讀取昨日持股 / 寫入今日戰報)]
        LocalDB[("本地檔案系統 Cache\n(data/ 資料夾)")]
    end

    subgraph Perception [感知與量化層]
        Providers[Providers\n外部 API 抓取\n(TWSE/FRED/CNN/新聞)]
        Strategy[Strategy\n量化指標與風控引擎]
    end

    subgraph Intelligence [決策與大腦層]
        AI[AI Pipeline\nGemini 多空分析與投資教練]
    end

    subgraph Output [輸出層]
        Notify[Notifications\n格式化戰報與分塊排版]
        Telegram([Telegram\n使用者端])
    end

    %% 執行流程
    Entry -->|1. 獲取起始環境| GS
    Entry -->|2. 並行抓取市場數據| Providers
    
    Providers <-->|依賴生命週期讀寫| LocalDB
    
    Providers -->|3. 傳遞報價與宏觀數據| Strategy
    Strategy -->|4. 傳遞量化訊號與分數| AI
    
    AI -->|5. 產出決策建議| Notify
    Notify -->|6. 非同步推播| Telegram
    Notify -->|7. 寫回今日紀錄| GS
    Notify -->|8. 最終報告歸檔與清理| LocalDB
```

---

## 3. 核心資料夾對照表

本系統嚴格遵循模組化設計，將抓取、運算、AI 決策與發報切割在獨立的資料夾中：

### 程式碼邏輯 (`src/`)
| 資料夾路徑 | 模組名稱 | 核心職責與重要檔案 |
| :--- | :--- | :--- |
| `src/modules/providers/` | **數據提供者** | 封裝第三方 API 的髒邏輯（如 TWSE 的 IPv6 解析跳過、CNN 的 Cookie 偽裝）。統一由 `marketData.mjs` 負責平行調度。 |
| `src/modules/strategy/` | **量化策略引擎** | 計算 TA-Lib 技術指標的 `indicators.mjs`，以及匯總維持率風險、乖離率過熱與冷卻期限制的決策中樞 `strategyEngine.mjs`。 |
| `src/modules/ai/` | **AI 決策管線** | 處理 Gemini API 呼叫的 `aiClient.mjs`（具備 Exponential Backoff 重試與 Langfuse 追蹤）；以及負責角色扮演（新聞過濾器、總經分析師、戰報教練）的 `aiCoach.mjs` 與 `prompts.mjs`。 |
| `src/modules/notifications/` | **廣播與通知** | 將 JSON 資料格式化為具有表情符號、警告燈號與內聯按鈕的 `telegramHtmlBuilder.mjs`，並透過 `telegramClient.mjs` 分段靜默/有聲發送。 |
| `src/modules/data/` | **檔案資料庫管理** | 包含 `archiveManager.mjs`，專門提供讀寫本地 `data/` 資料夾的介面，並具備自動清理過期檔案（保留30天）的機制。 |
| `src/utils/` | **底層共用工具** | 提供全域的時間類別 `TwDate`、防呆解析器 `parseNumberOrNull` 以及處理 API 超時的防護殼 `fetchWithTimeout`。 |

### 本地持久化資料 (`data/`)
| 資料夾路徑 | 用途說明 | 讀寫頻率/特性 |
| :--- | :--- | :--- |
| `data/market/` | 總經指標與市場狀態的通用快取。 | 每日覆寫 `latest.json`，並按日期滾動備份至 `history/` 內。 |
| `data/stock_history/` | 台股個股歷史月報價的永久快取。 | 不變的歷史月份將被永久快取不再請求，僅抓取當前浮動的月份。 |
| `data/reports/` | 每日排程執行完畢後的最終綜合報告。 | 每日排程的最後一步執行寫入；系統僅保留最近 30 天用作追溯。 |
| `data/ai_logs/` | 紀錄傳送給 AI 的完整 Prompt 與原始 JSON Response。 | 作為飛行紀錄器，用於除錯 AI 是否產生幻覺或解析失敗，自動定時清理。 |
