# 市場資料與策略引擎 / Market & Strategy

## 1. 模組定位

`src/modules/strategy/` 與 `src/modules/newsFetcher.mjs` 共同構成專案的 perception + signal layer。前者把市場資料轉成可執行的投資訊號，後者負責新聞收集、去噪與摘要前置處理。

這一層的核心不是單純計算指標，而是把「價格、風險、情緒、新聞」轉成下游 AI 可使用的結構化 context。

---

## 2. Strategy 模組

| Path                                      | 說明                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/strategy/indicators.mjs`     | 計算 RSI、MACD、KD 與相關 crossover / reversal helper。                                                                                     |
| `src/modules/strategy/strategySchema.mjs` | 讀取時的強型別驗證與結構定義。                                                                                                              |
| `src/modules/strategy/signalRules.mjs`    | 讀取策略設定，整合與路由至各項評估服務。                                                                                                    |
| `src/modules/strategy/core/`              | **核心狀態機與計算 (Core Engines)**。包含 `marginStateMachine.mjs`, `leverageCapManager.mjs`, `valuationGuard.mjs`, `cooldownManager.mjs`。 |
| `src/modules/strategy/policies/`          | **獨立業務政策 (Business Policies)**。包含 `entryGatePolicy.mjs`, `macroSentimentPolicy.mjs`, `rebalancePolicy.mjs`。                       |
| `src/modules/strategy/strategyEngine.mjs` | **編排器 (Orchestrator)**。負責調度 core 與 policies，輸出最終建議。實作 `ctx` 安全保護與返回值驗證。                                       |

現在 `strategyEngine.mjs` 扮演 Orchestrator 角色，不再直接包含複雜算法，而是透過 `safeCtx` 調度外部模組，大幅提升了單元測試覆蓋率與數值可維護性。

---

## 3. 標準化評分矩陣 (Scoring Matrix)

系統採用三層級評分設計，解決異質數據（RSI、跌幅、籌碼金額）的量綱統一問題：

1. **指標標準化 (Normalization)**：所有指標（RSI, MACD, 跌幅, 法人買賣超）被映射至 `-1` (極度偏空) 到 `+1` (極度偏多) 的尺度。
2. **權重配置 (Weighting)**：依據指標性質分組（技術趨勢、估值價值、籌碼動能、極值震盪），並定義類組上限 (Cap)。
3. **加權總和 (Weighted Sum)**：計算各類組貢獻度，產出最終決策總分。
   - **Tactical Buy**：總分 ≥ `buyTactical` (如 4.0) 觸發加碼。
   - **Tactical Sell**：總分 ≤ `sellTactical` (如 -4.0) 觸發戰術部位減碼。

---

## 4. 動態移動停利與預算管控

### 4.1 動態移動停利 (Trailing Stop)

廢除靜態 BasePrice，改採動態追蹤機制：

- **啟動門檻 (Activation Cushion)**：部位獲利 > 10% 或連續兩日收盤站穩 MA20 後才啟動監控。避免建倉初期正當波動導致被洗出場。
- **停利錨點**：依設定選用 `MA20 × (1 - buffer)` 或 `HHV(22) - (ATR × multiplier)`。

### 4.2 資金預算攔截 (Budget Control)

- **10 日滾動上限**：單一帳戶在 10 個交易日內的新增借貸額度上限（如淨值 15%）。
- **預算優先級 (Budget Priority)**：優先扣除 Baseline (DCA) 所需資金，剩餘額度才供 Tactical 加碼使用，且受單日上限攔截。

---

## 5. News Fetcher 架構

`src/modules/newsFetcher.mjs` 現在已經是獨立的新聞治理主程式，而不只是附屬 helper。它會被：

- `dailyCheck.mjs` 用於組成每日新聞摘要，
- `runNewsFetch.mjs` 用於獨立抓取、評分與更新新聞池。

### 3.1 關鍵字系統（已完成重構）

目前關鍵字設計已整合 `finish_features.md` 的內容，採用 `KeywordEntry` schema：

```js
{
  keyword: string,
  searchType: "intitle" | "broad"
}
```

這些關鍵字由三部分組成：

- `baseTwQueries`
- `baseUsQueries`
- AI 動態產生的 queries

程式端會先用 `validateDynamicKeyword()` 驗證 AI 輸出，再用 `mergeKeywords()` 與靜態池合併，避免無效或重複 query 混入主流程。

### 3.2 雙層去噪

新聞治理目前分成兩層：

1. **RSS Query Layer**：
   `buildRssUrl()` 會把 `twExcludeKeywords` / `usExcludeKeywords` 轉成 Google News 查詢中的排除條件，例如 `-"keyword"` 或 `-intitle:"keyword"`。這是在新聞回傳之前先做第一層減噪。

2. **Article Validation Layer**：
   文章抓回後，還會再依據：
   - excluded sources，
   - blacklist regex patterns，
   - 基本標題 / 來源有效性規則，
     做第二次過濾。

這個分層非常重要。若未來出現「文章太少」或「垃圾文章太多」，AI Agent 應先判斷問題落在哪一層，而不是直接調 prompt。

### 3.3 新聞池設計

`newsPoolManager.mjs` 與 `newsFetcher.mjs` 搭配使用，形成持續性的新聞池：

- TTL 為 24 小時。
- 主池上限 200 篇。
- 支援 fuzzy dedupe。
- 會把過期資料移到 `data/news/archive/`。
- 維護 `pool_active.json` 與 `pool_filtered_active.json`。

這表示新聞並不是每次 daily run 臨時抓完就丟，而是有一層可持續維護的 pool，讓後續 AI 過濾與統計更穩定。

---

## 4. 對 AI Agent 的維護指引

若未來要修改市場訊號或新聞品質，請依下列順序定位：

1. 指標數值是否正確：看 `indicators.mjs`。
2. 規則門檻是否合理：看 `signalRules.mjs` 與 strategy config 來源。
3. 帳戶風控與目標槓桿：看 `riskManagement.mjs`。
4. 最終投資訊號組裝：看 `strategyEngine.mjs`。
5. 新聞 query 品質：看 `keywordConfig.mjs` + `prompts.mjs`。
6. 新聞去噪與 pool 問題：看 `newsFetcher.mjs` + `newsPoolManager.mjs`。

這樣文件整理後，AI Agent 可以更快判斷問題屬於 **strategy bug** 還是 **news governance bug**。
