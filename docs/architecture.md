# InvestmentLineNotify 總體架構 / System Architecture

## 1. 系統定位
`InvestmentLineNotify` 是一套以 Node.js 為核心的投資決策與通知系統，主要服務 0050 / 00675L 與生命週期投資策略的日常監控、新聞治理、AI 分析與週期報告生成。系統採用 **file-based persistence + external services** 的設計，不使用傳統資料庫，而是以 `data/`、Google Sheets、Telegram、Langfuse 與多個市場資料來源共同構成執行基礎。

目前專案已不只是一條 `dailyCheck` 單線流程，而是由多個 runner 組成：

1. `src/runDailyCheck.mjs`：每日主流程。
2. `src/runNewsFetch.mjs`：獨立新聞抓取、去重、更新新聞池。
3. `src/runOptimizer.mjs`：獨立執行 blacklist / rule optimizer。
4. `src/runWeeklyReport.mjs`：讀取近期報告並生成 AI 週報。
5. `src/runMonthlyReport.mjs`：讀取近期報告並生成 AI 月報。

---

## 2. 生命週期總覽
系統實際運作可拆成五個層次：

1. **Entry Layer**：由 GitHub Actions、Cron 或手動 CLI 啟動各 runner。
2. **Data Collection Layer**：從 `src/modules/providers/`、Google News RSS、Google Sheets 抓取市場資料、帳戶狀態與新聞。
3. **Decision Layer**：由 `src/modules/strategy/` 與 `src/modules/ai/` 共同完成量化計算與 AI 判讀。
4. **Delivery Layer**：由 `src/modules/notifications/` 將結果轉為 Telegram HTML 訊息或週期報告。
5. **Persistence Layer**：透過 `data/`、Google Sheets 與 Langfuse 持久化報告、快取、觀測資料與新聞池。

---

## 3. Mermaid Flow

```mermaid
flowchart TD
    A[GitHub Actions / Cron / CLI] --> B[Runner Layer]

    subgraph Runner Layer
      B1[src/runDailyCheck.mjs]
      B2[src/runNewsFetch.mjs]
      B3[src/runOptimizer.mjs]
      B4[src/runWeeklyReport.mjs]
      B5[src/runMonthlyReport.mjs]
    end

    B --> B1
    B --> B2
    B --> B3
    B --> B4
    B --> B5

    subgraph Data Sources
      S1[Google Sheets]
      S2[TWSE / Yahoo / FRED / CNN / KGI / NDC]
      S3[Google News RSS]
    end

    subgraph Core Modules
      M1[src/modules/providers]
      M2[src/modules/strategy]
      M3[src/modules/newsFetcher.mjs]
      M4[src/modules/data/newsPoolManager.mjs]
      M5[src/modules/ai]
      M6[src/modules/notifications]
      M7[src/modules/storage.mjs]
      M8[src/modules/data/archiveManager.mjs]
    end

    subgraph Persistence
      D1[data/market]
      D2[data/stock_history]
      D3[data/reports]
      D4[data/ai_logs]
      D5[data/news]
      D6[src/config or module config via keyword/blacklist files]
    end

    S1 --> M7
    S2 --> M1
    S3 --> M3

    B1 --> M1 --> M2 --> M5 --> M6
    B1 --> M7
    B1 --> M8
    B1 --> M3

    B2 --> M5
    B2 --> M3 --> M4
    B3 --> M5
    B4 --> M5 --> M6
    B5 --> M5 --> M6

    M8 --> D1
    M8 --> D2
    M8 --> D3
    M8 --> D4
    M4 --> D5
    M3 --> D6
```

---

## 4. 目錄與責任對照

### `src/` 執行與模組層
| Path | 說明 |
|---|---|
| `src/dailyCheck.mjs` | 每日主 orchestration，串接持股繼承、資料抓取、策略計算、新聞摘要、AI 建議、通知、歸檔與條件式 `llmJudge`。 |
| `src/runDailyCheck.mjs` | CLI entry，處理參數如 `--telegram=false`、`--aiAdvisor=false`。 |
| `src/runNewsFetch.mjs` | 獨立新聞抓取流程，包含動態關鍵字產生、Yield Rate score 回寫、新聞池更新。 |
| `src/runOptimizer.mjs` | 獨立執行 Rule Optimizer，優化新聞治理規則，完成後若有新規則則靜默推播至 Log 頻道。 |
| `src/runWeeklyReport.mjs` | 讀取近 7 天報告，最低 3 份才生成週報。 |
| `src/runMonthlyReport.mjs` | 讀取近 50 天報告（取最後 30 天為評估期，全 50 天供報酬率計算），最低 10 份才生成月報。 |
| `src/modules/providers/` | 市場資料 provider layer，封裝 TWSE、Yahoo、FRED、CNN、KGI、NDC 等來源。 |
| `src/modules/strategy/` | 策略與風控核心，計算 RSI / KD / MACD、過熱、冷卻期與投資建議。 |
| `src/modules/ai/` | AI decision layer，包含 search query generation、news filter、macro analysis、investment coach、period report、rule optimizer、LLM judge。 |
| `src/modules/newsFetcher.mjs` | 新聞抓取與初步去噪主程式，負責整合靜態 / 動態關鍵字與 blacklist。 |
| `src/modules/keywordConfig.mjs` | 關鍵字與 blacklist loading 的設定入口，承接已完成的 keyword system 重構。 |
| `src/modules/data/newsPoolManager.mjs` | 新聞池 CRUD、TTL 清理、archive、fuzzy dedupe。 |
| `src/modules/notifications/` | 將決策結果輸出成 Telegram 訊息與週期報告格式。 |
| `src/modules/storage.mjs` | 與 Google Sheets 同步持股狀態與每日紀錄，包含 `avgCost0050` / `avgCostZ2` 均價欄位讀取。 |
| `src/utils/coreUtils.mjs` | 通用工具：`TwDate`、`fetchWithTimeout`、`parseNumberOrNull`、`stepTimer` 等。 |
| `src/test/` | 手動測試與回測腳本，不在排程流程內。 |

### `src/test/` 測試腳本
| Path | 說明 |
|---|---|
| `src/test/backtest.mjs` | 回測腳本，用於驗證策略歷史表現。 |
| `src/test/newsTest.mjs` | 新聞抓取手動測試。 |
| `src/test/providers.test.mjs` | 各 provider 單元測試。 |
| `src/test/test-all.mjs` | 整合測試入口。 |
| `src/test/test-archiveManager.mjs` | archiveManager 模組測試。 |
| `src/test/test-keywordConfig.mjs` | keywordConfig 載入測試。 |
| `src/test/test-keywords.mjs` | 關鍵字系統測試。 |

### `data/` 檔案持久化層
| Path | 說明 |
|---|---|
| `data/market/` | 總經與市場快取資料（`latest.json` 含所有 provider 最新快取）。 |
| `data/stock_history/` | 歷史股價快取。 |
| `data/reports/` | 每日決策最終報告，亦作為週報 / 月報輸入來源。 |
| `data/ai_logs/` | AI prompt / response 與治理相關紀錄。 |
| `data/news/pool_active.json` | 主新聞池，目前有效新聞。 |
| `data/news/pool_filtered_active.json` | 已整理後的新聞池版本。 |
| `data/news/archive/YYYY-MM-DD.json` | 過期新聞歸檔。 |

### `docs/` 文件層
| Path | 說明 |
|---|---|
| `docs/architecture.md` | 本文件，總體架構總覽。 |
| `docs/agent_prompts.md` | AI Agent 使用的 prompt 結構說明。 |
| `docs/langfuse-score-configs.md` | Langfuse 評分配置說明。 |
| `docs/modules/ai_pipeline.md` | AI 決策管線詳細說明（aiCoach、periodReportAgent、ruleOptimizerAgent、llmJudge）。 |
| `docs/modules/core_infrastructure.md` | 基礎設施詳細說明（storage、archiveManager、newsPoolManager、coreUtils）。 |
| `docs/modules/entry_and_notifications.md` | 入口 Runner 與通知模組詳細說明。 |
| `docs/modules/market_strategy.md` | 市場策略引擎詳細說明（strategyEngine、signalRules、indicators、riskManagement、newsFetcher）。 |
| `docs/modules/providers.md` | 各市場資料 provider 詳細說明與 API 快取策略。 |
| `docs/plans/optimization_ideas.md` | 架構優化討論（進行中的想法，非正式計劃）。 |
| `docs/plans/preplan_features.md` | 預計功能（尚未排期）。 |

---

## 5. 已完成的架構演進

### 5.1 Keyword System 重構
新聞關鍵字系統已從單純寫死字串，演進為結構化 `KeywordEntry`：

```ts
{
  keyword: string,
  searchType: "intitle" | "broad"
}
```

此設計帶來三層好處：
- 讓 RSS query 可區分「標題必含」與「廣泛匹配」。
- 讓靜態關鍵字池與 AI 動態關鍵字能共用同一 schema。
- 讓 AI Agent 後續調整關鍵字時，更容易定位 `keywordConfig`、`newsFetcher`、`prompts` 三個修改點。

### 5.2 News Filtering 變為雙層治理
目前新聞治理已分成兩層：

1. **RSS Query Layer**：在 `buildRssUrl()` 就把 `twExcludeKeywords` / `usExcludeKeywords` 轉成 `-keyword` 或 `-intitle:keyword`，先減少雜訊來源。
2. **Article Validation Layer**：抓回文章後，再用 blacklist regex、excluded sources 與標題規則做第二次過濾。

這個分層對 AI Agent 很重要：若之後要調整誤殺或漏網問題，必須先判斷是 query 層過濾過強，還是 article validation 層規則過嚴。

### 5.3 Runner 分流後的系統邊界更清楚
專案現在不再只依賴 `dailyCheck`。新聞抓取、規則治理、週報、月報都已有獨立 runner。這代表未來 AI Agent 在修改功能時，必須先確認問題屬於：
- daily execution pipeline，
- news governance pipeline，或
- period reporting pipeline。

### 5.4 AI Coach 持倉成本與損益注入（2026-04-04）
`aiDataPreprocessor.mjs` 的 `formatQuantDataForCoach()` 已包含「持倉成本與損益」段落，將 `avgCost0050` / `avgCostZ2`（由 `storage.mjs` 從 Google Sheets 讀取）與即時價格對比計算未實現損益率後注入 Coach 上下文。

### 5.5 訊號準確率統計（Signal Accuracy Stats）
`periodReportAgent.mjs` 的 `buildSignalAccuracyStats()` 統一處理買進訊號的觸發次數、冷卻封鎖次數，以及月報的 +5 / +10 / +20 日報酬率與勝率計算。週報顯示訊號數量統計，月報完整呈現報酬率明細。

### 5.6 Rule Optimizer Telegram 通知
`runOptimizer.mjs` 完成後，若有新規則通過，會透過 `broadcastOptimizerResult()` 靜默推播至 Log 頻道（使用 `TELEGRAM_LOG_API_TOKEN`）。無新規則時靜默略過，失敗不影響主流程。

### 5.7 `stepTimer` 效能監控
`coreUtils.mjs` 的 `stepTimer()` 已插入 `dailyCheck.mjs` 所有主要步驟，在 GitHub Actions log 中可直接看到每步耗時（`⏱ [stepName] Xms`），快速定位效能瓶頸。

---

## 6. AI Agent 開發指引

本文件是 AI Agent 定位功能的起點。建議依以下順序閱讀各模組文件：

1. **本文件**（`docs/architecture.md`）：掌握整體流程、runner 分工、目錄責任。
2. **`docs/modules/entry_and_notifications.md`**：了解每個 runner 的觸發邏輯與通知邊界。
3. **`docs/modules/market_strategy.md`**：了解市場資料抓取與策略訊號生成。
4. **`docs/modules/ai_pipeline.md`**：了解 AI 決策鏈（Coach、Judge、Optimizer、Period Report）。
5. **`docs/modules/providers.md`**：了解各外部資料來源的快取策略與防呆機制。
6. **`docs/modules/core_infrastructure.md`**：了解底層工具、storage、archive、news pool。

定位問題時，請先判斷問題屬於哪條 pipeline（daily / news governance / period reporting），再對應到具體模組文件，避免直接進入 `dailyCheck.mjs` 或 `prompts.mjs` 而漏掉真正的根因。
