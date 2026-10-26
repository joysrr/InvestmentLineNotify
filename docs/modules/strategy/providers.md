---
type: reference
status: current
last_updated: 2026-09-11
last_verified: 2026-09-11
related_code:
  - src/modules/newsFetcher.mjs
  - src/runNewsFetch.mjs
  - src/modules/providers/yahooProvider.mjs
tags:
  - providers
  - data-source
  - market-data
wiki_links:
  - [[Strategy Engine]]
  - [[News Fetcher]]
---

# 資料來源提供者 (Providers Layer)

`src/modules/providers/` 的職責是將外部的骯髒資料，轉換為系統內部可信任的規格。
所有對外 API 請求都必須實作 `withRetry` 與超時機制。

## 1. Provider Registry (`providerRegistry.mjs`)

採用 Registry 模式，將所有外部呼叫封裝成統一介面。這讓未來抽換資料源（例如從 KGI 換成 FinMind）時，完全不需要動到業務邏輯。

目前註冊的 Providers：

- **`ndcBusinessIndicator`**：國發會景氣燈號。
- **`marginFinMind`** / **`marginKgi`**：大盤融資餘額與維持率（可於 `dataSourceConfig.mjs` 熱切換）。
- **`cnnFearGreed`**：CNN 恐懼與貪婪指數。
- **`usMarketFred`**：透過 FRED 抓取美股相關風險數據。
- **`twMarketValuation`**：TWSE 大盤本益比 (PE) 與股價淨值比 (PB)。
- **`twMarketOverview`**：TWSE 大盤量價資料。
- **`usdTwdYahoo`**：Yahoo Finance 匯率。
- **`twCentralBankRate`**：台灣央行基準利率。

## 2. 錯誤隔離設計

- 任何 Provider 呼叫失敗拋出 `ProviderError`，會被外層捕獲。
- 若部分不重要的 Provider（如匯率、景氣燈號）取值失敗，回傳 `null`，策略引擎內部需對 `null` 進行降級容錯（例如忽略該計分項目），確保主線流程 (股價、維持率) 仍能運行。
