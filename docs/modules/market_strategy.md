# 市場資料與策略引擎 / Market & Strategy

## 1. 模組定位
`src/modules/strategy/` 與 `src/modules/newsFetcher.mjs` 共同構成專案的 perception + signal layer。前者把市場資料轉成可執行的投資訊號，後者負責新聞收集、去噪與摘要前置處理。

這一層的核心不是單純計算指標，而是把「價格、風險、情緒、新聞」轉成下游 AI 可使用的結構化 context。

---

## 2. Strategy 模組
| Path | 說明 |
|---|---|
| `src/modules/strategy/indicators.mjs` | 計算 RSI、MACD、KD 與相關 crossover / reversal helper。 |
| `src/modules/strategy/signalRules.mjs` | 讀取與驗證策略設定，計算 entry score、overheat、sell signals 等子規則。 |
| `src/modules/strategy/riskManagement.mjs` | 管理目標槓桿、現金保留與資產健康度規則。 |
| `src/modules/strategy/strategyEngine.mjs` | 匯總全部因子，輸出 `marketStatus`、`targetSuggestion`、`weightScore` 等主決策結果。 |

### Strategy Engine 的主要判斷維度
- 技術指標：RSI / KD / MACD。
- 價格相對位置：如 240MA、bias / overheat 狀態。
- 帳戶風控：持股、借款、維持率、現金保留。
- 冷卻期：避免短時間內過度加碼。
- 總經方向：由 AI macro result 回注的 `macroMarketDirection`。

也就是說，`strategyEngine` 不再只是純技術分析，而是融合 portfolio state 與 macro sentiment 的 hybrid engine。

---

## 3. News Fetcher 架構
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
