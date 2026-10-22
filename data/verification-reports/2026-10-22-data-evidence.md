# Data Evidence Report

- Schema version: `1.0`
- Generated at: `2026-10-22T00:05:45.214Z`
- Verification scope: **persisted evidence only; no external API re-fetch was performed**

## Instructions for External Agent

- 確認每項指標的來源是否真實且可查證。
- 確認資料日期、抓取時間與更新頻率是否一致。
- 使用官方來源或可靠第二來源核對相同日期的數值。
- 確認單位、倍率、小數位與百分比方向沒有錯誤。
- 對衍生指標重新計算所有列出的中間步驟。
- 將結果分類為已確認、來源可信但無法重現、過期、不一致、定義不明或證據不足。

## Evidence Items

### data.rawMargin.marginBalance100M

- Value: `6381`
- Unit: `null`
- Source: provider: `marginKgi`; dataset: `rawMargin`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:df313a367018cc13633711ec7260f9a443fc4a3118b63676bf3791db1e14dfa2`
- Data date: `2026/10/20`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawMargin.maintenanceRatio

- Value: `178.9`
- Unit: `null`
- Source: provider: `marginKgi`; dataset: `rawMargin`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:df313a367018cc13633711ec7260f9a443fc4a3118b63676bf3791db1e14dfa2`
- Data date: `2026/10/20`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawCnn.score

- Value: `29.03`
- Unit: `分`
- Source: provider: `cnnFearGreed`; dataset: `rawCnn`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:a86d544ea398bfbebb7377cf1757fa2ea8e05fb2875e44b5f5dc79d4df192414`
- Data date: `2026-10-21T11:59:42.000Z`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 美股市場情緒指標，通常每日更新，需以 timestamp 判斷時效。
- Background: CNN Fear & Greed 指數，將市場情緒量化為 0 到 100；低值通常代表較恐懼。
- Calculation: 來源直接提供 score；本系統未自行計算。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 CNN 原始資料相同 timestamp 或最近更新值。
- 確認 score 在 0 到 100 且沒有被快取舊值取代。

### data.rawFx.currentRate

- Value: `32.363`
- Unit: `null`
- Source: provider: `usdTwdYahoo`; dataset: `rawFx`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:a12788e76db86b93d7c58cdfa87fff7e873fc5e73da8b686f0b3a1f242f500a6`
- Data date: `null`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawCpi.value

- Value: `2.73`
- Unit: `null`
- Source: provider: `twCpiYoY`; dataset: `rawCpi`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:a4b5a90adfc1b7ee25cad9e38efb67ca7fe9c606dfdffccf20dfacdc5a9ab5cb`
- Data date: `2026-09`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawMarketOverview.taiex

- Value: `46292.93`
- Unit: `點`
- Source: provider: `twMarketOverview`; dataset: `rawMarketOverview`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:ee3b0fbaf066f50891e53fb15d694534fc31d9c77044cc66651c09f9570534ff`
- Data date: `1151020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 台股交易日資料，非交易日可沿用最近交易日，但必須保留來源日期。
- Background: 臺灣加權股價指數（TAIEX）收盤或最新市場指數。
- Calculation: 來源直接提供指數；本系統未自行計算。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 TWSE 相同日期的 TAIEX。
- 確認 date 的民國年格式已正確轉換。

### data.rawMarketOverview.tradeValueHundredMillion

- Value: `8029`
- Unit: `null`
- Source: provider: `twMarketOverview`; dataset: `rawMarketOverview`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:ee3b0fbaf066f50891e53fb15d694534fc31d9c77044cc66651c09f9570534ff`
- Data date: `1151020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawUsMarket.soxChg

- Value: `-0.28746285359631035`
- Unit: `null`
- Source: provider: `usMarketFred`; dataset: `rawUsMarket`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:ebff14e7cc191b09b105065a0e163774aee90a3f328481b4a4d0080079460089`
- Data date: `null`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawUsMarket.tsmChg

- Value: `1.1565335627634712`
- Unit: `null`
- Source: provider: `usMarketFred`; dataset: `rawUsMarket`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:ebff14e7cc191b09b105065a0e163774aee90a3f328481b4a4d0080079460089`
- Data date: `null`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawValuation.pe

- Value: `24.79`
- Unit: `null`
- Source: provider: `twMarketValuation`; dataset: `rawValuation`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:f4457bb4ebe2729d8215f35c8c61d2dda4294195d6f62c04bbd3d5e05389ee73`
- Data date: `20261020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawValuation.pb

- Value: `4.05`
- Unit: `倍`
- Source: provider: `twMarketValuation`; dataset: `rawValuation`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:f4457bb4ebe2729d8215f35c8c61d2dda4294195d6f62c04bbd3d5e05389ee73`
- Data date: `20261020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 通常以最近一個台股交易日公布；需核對資料日期，不可只看寫入時間。
- Background: 台股市場整體淨值比（PB），代表市場價格相對於帳面價值的倍數；不是 0050 個別 ETF 的 PB。
- Calculation: 來源直接提供 PB；本系統未自行計算。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核相同資料日期的市場 PB。
- 確認來源定義為台股市場整體 PB。
- 確認沒有日期延遲、倍率或四捨五入錯誤。

### data.rawValuation.yield

- Value: `1.63`
- Unit: `null`
- Source: provider: `twMarketValuation`; dataset: `rawValuation`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:f4457bb4ebe2729d8215f35c8c61d2dda4294195d6f62c04bbd3d5e05389ee73`
- Data date: `20261020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawBankRate.value

- Value: `2`
- Unit: `null`
- Source: provider: `twCentralBankRate`; dataset: `rawBankRate`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:16c84f64c40588ba5b4ec0f27e2deb88cc9effe340bcd17fb7680aa7ea68d2a2`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawNdc.score

- Value: `41`
- Unit: `null`
- Source: provider: `ndcBusinessIndicator`; dataset: `rawNdc`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:e527c3edf4b3ce4543c726ddb2fa3234b5195b572e259c8ae46fbb8d14c3c998`
- Data date: `2026-08`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawInstitutional.foreignNetBuy

- Value: `-16220116`
- Unit: `null`
- Source: provider: `stockInstitutionalTwse`; dataset: `rawInstitutional`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:42372ef344ba8d0933b06f0c3f5b76d7b91950cadedc1168f8116c596f8be513`
- Data date: `20261021`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.rawStockMargin.marginBalance

- Value: `3238`
- Unit: `null`
- Source: provider: `stockMarginTwse`; dataset: `rawStockMargin`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:5e970043b47f1e783027e44d01e9935d9f7eef4240bfeb22c8321d013f796d7f`
- Data date: `null`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。
- Background: 由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。
- Calculation: 來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核 provider 對應的原始來源與相同資料日期。
- 確認單位、倍率、日期和數值轉換。

### data.pbHistory.latest.pb

- Value: `4.05`
- Unit: `null`
- Source: provider: `twMarketValuation`; dataset: `rawValuation`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:f4457bb4ebe2729d8215f35c8c61d2dda4294195d6f62c04bbd3d5e05389ee73`
- Data date: `20261020`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 歷史資料的最後日期應接近最近可取得的交易日。
- Background: 歷史序列的最新觀測值；外部 Agent 應核對最新日期、序列連續性及來源值。
- Calculation: 歷史序列保存的 PB 觀測值；應與 data.rawValuation.pb 及官方相同日期資料核對。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核最後一筆相同日期的原始資料。
- 檢查序列是否有缺日、重複日或不合理跳值。

### data.vixHistory.latest.value

- Value: `28.09`
- Unit: `null`
- Source: provider: `usMarketFred`; dataset: `rawUsMarket`; status: `SUCCESS`; endpoint: `null`; integrity: `verified`; rawHash: `sha256:ebff14e7cc191b09b105065a0e163774aee90a3f328481b4a4d0080079460089`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T12:19:54.469Z`
- Persisted at: `2026-10-21T12:19:54.469Z`
- Freshness basis: 歷史資料的最後日期應接近最近可取得的交易日。
- Background: 歷史序列的最新觀測值；外部 Agent 應核對最新日期、序列連續性及來源值。
- Calculation: 歷史序列保存的 VIX 觀測值；應與相同美股交易日的 FRED 或 Yahoo 原始資料核對。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 查核最後一筆相同日期的原始資料。
- 檢查序列是否有缺日、重複日或不合理跳值。

### data.sentiment.social_sentiment_daily.score

- Value: `39`
- Unit: `分`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.ma3

- Value: `33.7`
- Unit: `分`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.ma7

- Value: `34.6`
- Unit: `分`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.delta

- Value: `-0.9`
- Unit: `分`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.sampleCount

- Value: `122`
- Unit: `筆`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.pttItems

- Value: `20`
- Unit: `筆`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。

### data.sentiment.social_sentiment_daily.bskyItems

- Value: `102`
- Unit: `筆`
- Source: provider: `socialSentimentEngine`; dataset: `social_sentiment_daily`; status: `INTERNAL_DERIVED`; endpoint: `null`; integrity: `null`; rawHash: `null`
- Data date: `2026-10-21`
- Fetched at: `2026-10-21T04:00:42.402Z`
- Persisted at: `2026-10-21T04:00:42.402Z`
- Freshness basis: 每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。
- Background: PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。
- Calculation: score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。
- External verification status: **PENDING_EXTERNAL_VERIFICATION**

Checks:
- 核對 score 是否能由原始貼文與演算法重現。
- 核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。
- 核對 ma3、ma7 使用的日期範圍。
