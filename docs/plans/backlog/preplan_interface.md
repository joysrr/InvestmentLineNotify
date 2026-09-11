---
type: plan
status: backlog
last_updated: 2026-09-11
tags:
  - interface
  - backlog
  - planning
wiki_links: []
---

### 最終確認版：外部資料 API 接口對接規格書

#### 接口一：ETF 每日盤後價格與極值 API (價格與技術指標基礎)

- **對應計畫項目：**
  - 【P1 高優先/風控強化】戰略資金解耦與盤後保證金壓力測試模組建置（計算 0050 質押擔保品市值與 00675L 槓桿部位市值）
  - 【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利
- **實作對照：** `src/modules/providers/twseProvider.mjs` -> `fetchStockHistory()`
- **資料類型：** 證券交易價格數據
- **所需欄位：** 股票代號（僅需鎖定 `0050` 與 `00675L`）、收盤價、最高價、最低價（高低價為計算 ATR 必備）
- **資料時間頻率：** 每日盤後（約每日下午 14:00 後陸續更新）
- **可對接資料來源（免費）：** 台灣證券交易所 (TWSE) OpenAPI
  - 端點建議：`每日收盤行情`

#### 接口二：ETF 三大法人買賣超 API (法人籌碼動能)

- **對應計畫項目：**
  - 【策略重構】多空訊號衝突解決與評分矩陣（Scoring Matrix）重構
- **實作對照：** `src/modules/providers/twseProvider.mjs` -> `fetchStockInstitutionalData(symbol)` [NEW]
- **資料類型：** 籌碼面資金流向
- **所需欄位：** 股票代號（僅需鎖定 `0050`）、外資買賣超股數/金額、投信買賣超股數/金額、自營商買賣超股數/金額 [1]
- **資料時間頻率：** 每日盤後（約每日下午 15:00 後公布）
- **可對接資料來源（免費）：** 台灣證券交易所 (TWSE) OpenAPI
  - 端點建議：`三大法人個別證券買賣超彙總表`

#### 接口三：信用交易統計 API (散戶情緒與過熱指標)

- **對應計畫項目：**
  - 【策略重構】多空訊號衝突解決與評分矩陣（Scoring Matrix）重構
  - 【策略演化】總經與市場狀態辨識（Regime Detection）動態過濾器
- **實作對照：**
  - 個股：`src/modules/providers/twseProvider.mjs` -> `fetchStockMarginData(symbol)` [NEW]
  - 大盤：`src/modules/providers/kgiProvider.mjs` -> `fetchTwseMarginData()`
- **資料類型：** 信用交易與市場情緒數據
- **所需欄位：** 股票代號（鎖定 `00675L` 與大盤總計）、融資買進、融資賣出、融資餘額
- **資料時間頻率：** 每日盤後（約每日晚間公布）
- **可對接資料來源（免費）：** 台灣證券交易所 (TWSE) OpenAPI
  - 端點建議：`融資融券餘額`

#### 接口四：大盤估值與總體經濟 API (宏觀狀態與資金成本濾網)

- **對應計畫項目：**
  - 【策略演化】總經與市場狀態辨識（Regime Detection）動態過濾器
  - 【策略演化】生命週期風險預算與槓桿曲線
- **資料類型：** 總體經濟與市場整體估值指標
- **所需欄位：**
  1.  **大盤本益比 (P/E Ratio)：** 作為 Shiller PE 估值防禦的替代基準。
  2.  **台灣央行基準利率：** 作為系統計算 00675L 質押借款利息成本的基礎（目前維持 2.0%） [2]。
  3.  **台灣消費者物價指數年增率 (CPI YoY)：** 監控通膨是否逼近 2% 警戒線以調整市場狀態。
- **資料時間頻率：**
  - 大盤本益比：每日盤後。
  - 基準利率：每季（央行理監事會議後發布） [2]。
  - CPI 年增率：每月發布。
  - _實作備註：低頻的總經數據需在系統內實作「前向填充 (Forward-Fill)」邏輯，將最新發布的數值對齊至每日盤後的決策陣列中。_
- **實作對照：**
  - 大盤本益比：`src/modules/providers/twseProvider.mjs` -> `fetchMarketValuation()`
  - 總經利率/通膨：`src/modules/providers/macroProvider.mjs` -> `fetchCentralBankRate()`, `fetchCpiYoY()` [NEW]
- **可對接資料來源（免費）：**
  - 大盤本益比：台灣證券交易所 OpenAPI（端點：`大盤統計資訊`）。
  - 總經與利率：政府資料開放平臺 (data.gov.tw) 介接中央銀行（端點：`中央銀行理監事會決議之貼放利率`）與行政院主計總處資料庫。
