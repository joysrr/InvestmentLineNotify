# Core Logic Data Flow Matrix

> **Phase**：A — 資料流與公式規格盤點
> **狀態**：In Progress
> **資料範圍**：正式 `data/`、`data/reports/2026-08-17.json`、目前 `main` 程式碼
> **原則**：本文件記錄目前實作與證據；不把目前實作直接視為正確規格。

## 1. 每日主流程

| 順序 | 輸入／處理                                                       | 程式位置                                                                  | 輸出／下游用途                         | 狀態   |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- | ------ |
| 1    | 讀取持倉、VIX、基準價、總經、兩檔歷史 K 線、PB 歷史與 latch 狀態 | `src/domain/dailyRunContext.mjs`                                          | `DailyRunContext`                      | 已定位 |
| 2    | 取得 0050／00675L 即時價格                                       | `src/domain/dailyRunContext.mjs`                                          | `price0050`、`currentPriceZ2`          | 已定位 |
| 3    | 清洗歷史 K 線並計算指標                                          | `src/domain/signalContext.mjs`、`src/modules/strategy/indicators.mjs`     | RSI、MACD、KD、MA、ATR、slope          | 已定位 |
| 4    | 計算資產、槓桿、維持率、跌幅與估值衍生值                         | `src/domain/signalContext.mjs`、`src/modules/strategy/strategyEngine.mjs` | signal context                         | 已定位 |
| 5    | 執行 P0–P100 決策鏈                                              | `src/modules/strategy/decision/chain.mjs`                                 | 最終 target、direction、ratio          | 已定位 |
| 6    | 儲存報告與通知                                                   | `src/scheduler/dailyCheck.mjs`                                            | `data/reports/*.json`、Telegram、Sheet | 已定位 |

## 2. 原始輸入矩陣

| 欄位             | 來源／實際位置                                                    | 單位或格式                | 主要用途                      | 缺值／fallback               | 查核狀態                       |
| ---------------- | ----------------------------------------------------------------- | ------------------------- | ----------------------------- | ---------------------------- | ------------------------------ |
| 00675L OHLCV     | `data/stock_history/00675L_YYYYMM.json`，由 history provider 組合 | 價格、股數、日期          | RSI/MACD/KD/MA/ATR/跌幅       | 歷史不足 60 筆時中止         | 已確認來源；待確認排序與完整性 |
| 0050 OHLCV       | `data/stock_history/0050_YYYYMM.json`                             | 價格、股數、日期          | 0050 顯示、資產與部分風險分析 | provider fallback            | 已確認來源；待確認排序與完整性 |
| 00675L 即時價    | MIS／quote provider                                               | 價格                      | 市值、跌幅、槓桿與決策        | 失敗時 fallback 至最新 close | 已定位；需判定語意風險         |
| 0050 即時價      | MIS／quote provider                                               | 價格                      | 0050 市值與報告               | provider fallback            | 已定位                         |
| 基準價           | `basePriceProvider`                                               | 價格＋日期                | `priceChangePercent`          | provider 內 cache／錯誤處理  | 已定位；待確認日期與價格基準   |
| VIX 當值         | TW VIX provider，報告 `vixData.value`                             | 指數點數                  | VIX override、風險模式、報告  | fallback／空值               | 已確認正式報告有值             |
| VIX 歷史         | `data/vixHistory.json`                                            | 日期＋指數點數            | VIX trend override            | 空陣列或單值                 | 已確認 91 筆；待確認排序       |
| PB 當值          | `macroData.rawValuation.pb`                                       | 倍數                      | PR／valuation guard           | fallback 至 PB 歷史最新值    | 正式報告有 4.17                |
| PB 歷史          | `data/pbHistory.json`                                             | 月份＋倍數                | PR、估值 guard、momentum      | 無資料時跳過 guard           | 已確認 407 筆                  |
| 法人淨買超       | `rawInstitutional` provider                                       | 程式註記為百萬單位        | Scoring Matrix institutional  | 缺資料時 0、歷史不足時補貼   | 需確認 provider 欄位與單位     |
| AI 市場方向      | 新聞分析結果 `market_direction`                                   | `BULL`／`BEAR`／`NEUTRAL` | sentiment score、cooldown     | 無方向時不套用               | 已定位；非數學真值             |
| 融資維持率       | `macroData.rawMargin.maintenanceRatio`                            | 百分比                    | 市場狀態／風險顯示            | fallback 0 或 999 依路徑     | 需確認是否進入決策與單位一致性 |
| 匯率             | `macroData.rawFx.currentRate`                                     | USD/TWD                   | 市場狀態／AI 輸入             | provider fallback            | 非目前 Scoring Matrix 直接因子 |
| CNN Fear & Greed | `macroData.rawCnn.score`                                          | 指數分數                  | market state／AI              | fallback 0                   | 非目前 Scoring Matrix 直接因子 |
| NDC／CPI／利率   | `rawNdc`、`rawCpi`、`rawBankRate`                                 | 各 provider 單位          | market state／AI              | fallback 0／未知             | 非目前 Scoring Matrix 直接因子 |
| 持倉             | Sheet／本地 archive                                               | 股數、現金、貸款、日期    | 淨資產、槓桿、預算、冷卻      | 預設持倉／lastBuyDate cache  | 已定位；待確認正式值時效       |

## 3. 指標與衍生值矩陣

| 值                   | 公式／規則                                     | 程式位置              | 下游用途                          | 狀態                   |
| -------------------- | ---------------------------------------------- | --------------------- | --------------------------------- | ---------------------- |
| RSI                  | `technicalindicators`，period 14               | `indicators.mjs`      | entry、reversal、overheat、matrix | 待 Phase B golden test |
| MACD                 | fast 12、slow 26、signal 9，EMA                | `indicators.mjs`      | entry、reversal、matrix           | 待 Phase B golden test |
| Fast KD              | stochastic period 9、signal 3                  | `indicators.mjs`      | Slow KD 輸入                      | 待 Phase B 對齊驗證    |
| Slow K/D             | Fast K → SMA3 → 再 SMA3                        | `indicators.mjs`      | entry、reversal、overheat、sell   | 待 Phase B 對齊驗證    |
| MA20/60/240          | SMA 20/60/240                                  | `indicators.mjs`      | stop、slope、BIAS240              | 待 Phase B golden test |
| ATR14                | TR + 初始 SMA + Wilder smoothing               | `indicators.mjs`      | trailing stop                     | 待 Phase B golden test |
| MA60 slope           | `(MA60[t] - MA60[t-5]) / 5`                    | `indicators.mjs`      | matrix、latch                     | 待 Phase B golden test |
| priceChangePercent   | `(currentPrice - basePrice) / basePrice * 100` | `strategyEngine.mjs`  | price up/drop、entry、matrix      | 待確認 basePrice 語意  |
| priceDropPercent     | `max(0, -priceChangePercent)`                  | `strategyEngine.mjs`  | entry、matrix、category           | 已定位                 |
| bias240              | `(currentPrice - MA240) / MA240 * 100`         | `strategyEngine.mjs`  | overheat                          | 待確認 MA240 fallback  |
| netAsset             | 0050 value + Z2 value + cash - loan            | `strategyEngine.mjs`  | 槓桿／預算／比例                  | 待 Phase D 驗證        |
| actualLeverage       | gross asset / net asset                        | `strategyEngine.mjs`  | 報告／風險                        | 待 Phase D 驗證        |
| z2Ratio              | Z2 value / net asset * 100                     | `strategyEngine.mjs`  | tactical position、風險           | 待 Phase D 驗證        |
| institutional factor | z-score → `tanh`                               | `signalGenerator.mjs` | flowOfFunds                       | 待確認單位與缺值       |
| sentiment factor     | `[-1, 1]` clamp                                | `signalGenerator.mjs` | flowOfFunds                       | 已定位                 |
| bullMomentum         | 20 日報酬，10% 封頂為 1                        | `signalGenerator.mjs` | valuationValue                    | 待 Phase B golden test |

## 4. 分數資料流

### 4.1 `entry.weightScore`

```text
priceDropPercent
  → dropScoreRules
RSI cross / MACD cross / KD low cross
  → signal scores
BULL／BEAR／NEUTRAL
  → sentiment score
  → max(RSI score, KD score)
  → entry.weightScore
```

預設分數：

- 跌幅：2.5／4／6／8／10
- RSI：3
- MACD：2
- KD：2
- 情緒：BULL +3、BEAR -5、NEUTRAL 0

### 4.2 `finalScore`

```text
technicalTrend: MACD × 2 + MA60 slope × 1.5，cap 4
valuationValue: priceDrop × 6 + bullMomentum × 2，cap 8
flowOfFunds: institutional × 5 + sentiment × 3，cap 4
extremeOscillation: RSI × 2 + KD × 2，cap 2
→ finalScore
→ buy/sell/exit/hold
```

預設門檻：

- 多頭買進：`>= 1.5`
- 一般買進：`>= 4`
- 賣出：`<= -4`
- 已有 tactical position 且低於 `0`：`exit_buffer`

## 5. 初步查核結果

1. 正式資料可讀，Git 工作區乾淨。
2. 00675L 歷史 348 筆，範圍 `2025-03-03` 至 `2026-08-03`。
3. 0050 歷史 322 筆，範圍 `2025-04-01` 至 `2026-08-03`。
4. 2026-08 月檔目前各只有 1 筆，但跨月 provider 會合併所有月份；真正待查核的是歷史資料最新日 `2026-08-03` 與報告日 `2026-08-17` 的落差。
5. `data/reports/2026-08-17.json` 的 `signals.finalScore` 為 `null`，而 `status` 是 P50 EntryGate 前置過濾；這與決策鏈「前置規則可在 P100 前終止」一致，需 Phase D 建立明確驗證案例。
6. 正式報告 `marketState` 中 `pr`、`institutionalNetBuy`、`marginRatio`、`fxRate` 等欄位出現 0；目前不能判定是 provider 缺值、normalizer fallback 或報告組裝問題，列為 `CORE-001` 待查。
7. `data/market/latest.json` 的 `rawInstitutional` 與 provider metadata 均成功，但 `IlnState.MACRO_REPORT_SLOTS` 白名單排除它；這已確認為 CORE-002 的報告資料遺失根因。
8. `signalContext.mjs` 也未將法人資料傳入 scoring context；保存資料與接入分數是兩個獨立修正問題。
9. 以本地歷史末端重算 00675L，`2026-08-03` 的 KD 與同日報告相符；但 8/17 報告未保存當次 K 線，無法驗證其資料截止日。
10. `historyProvider.mjs` 已確認具備跨月合併、去重與日期排序；因此目前主要風險是資料新鮮度，而非月份檔單筆本身。
