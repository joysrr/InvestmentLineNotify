# Core Logic Findings

> **Phase**：A — 資料流與公式規格盤點
> **狀態**：In Progress
> **原則**：本文件只記錄證據與待決策事項；未經確認不修改產品邏輯。

## 發現索引

| ID       | 類型           | 嚴重度                      | 主題                                                       | 狀態 |
| -------- | -------------- | --------------------------- | ---------------------------------------------------------- | ---- |
| CORE-001 | data-risk      | High pending confirmation   | 正式報告部分 marketState 欄位為 0                          | Open |
| CORE-002 | data-risk      | High pending confirmation   | 法人資料未在抽樣報告中出現，且目前 signal context 未見傳遞 | Open |
| CORE-003 | data-risk      | Medium pending confirmation | 正式歷史資料截至 2026-08-03，但報告截至 2026-08-17         | Open |
| CORE-004 | spec-ambiguity | Medium                      | P50 前置攔截時 `finalScore` 為 null                        | Open |

## CORE-001：marketState 部分欄位為 0

- **證據**：`data/reports/2026-08-17.json`
- **觀察**：`marketState.valuation.pr = 0`、`marketState.liquidity.marginRatio = 0`、`fxRate = 0`、`institutionalNetBuy = 0`；同一份報告的 `macroData.rawValuation.pb = 4.17`、`rawMargin.maintenanceRatio = 194.15`、`rawFx.currentRate = 31.882`。
- **可能原因**：
  1. `marketState` 產生時沒有接收對應 raw 欄位。
  2. 欄位名稱映射不一致。
  3. raw provider 缺值後報告沿用 0 fallback。
  4. 這些欄位僅供展示，並未參與核心分數。
- **不可直接下結論**：需追查 `marketData.mjs` 的組裝與 `IlnState` 報告映射。
- **下一步**：確認同日 `raw*` → normalized → `marketState` 的完整路徑，並檢查是否有明確的 stale／missing 標記。
- **修正限制**：若只影響展示，不能直接當作核心計算 bug；若影響決策輸入，列為 High。

## CORE-002：法人資料是否長期缺失

- **證據**：抽樣 `2026-08-17.json` 的 `macroData` 未見 `rawInstitutional`；`marketState.liquidity.institutionalNetBuy = 0`。
- **程式證據**：`marketData.mjs` 確實配置並抓取 `rawInstitutional`；`normalizer.mjs` 只將 `rawInstitutional.totalNetBuy / 1000000` 映射至展示欄位。`signalContext.mjs` 未組裝 `institutionalNet` 或 `institutionalHistory`，`strategyEngine.mjs` 則對缺失值 fallback 為 0／空陣列。
- **風險**：Scoring Matrix 的法人因子可能長期為 0，並觸發 `signalGenerator.mjs` 的法人缺失技術組補貼邏輯。
- **目前判定**：High data-risk，尚未確認 provider 回傳 schema 與是否存在歷史序列。
- **下一步**：查核 `stockInstitutionalTwse` provider 的實際回傳欄位、cache 內容，以及是否有設計上要傳入策略的歷史資料。
- **修正限制**：先確認資料應否進入核心分數，再評估補貼合理性；不得先刪除 fallback。

## CORE-003：正式歷史資料與報告日期不一致

- **證據**：`data/stock_history/00675L_202608.json` 與 `0050_202608.json` 各只有 1 筆，最新日期為 `2026-08-03`；跨月份合併後 00675L 348 筆、0050 322 筆。正式報告已存在至 `2026-08-17`。
- **程式證據**：`historyProvider.mjs` 會從當月往前抓取最多 13 個月，過濾結束日、去重並按日期升冪排序；因此跨月合併邏輯存在。
- **風險**：8/4–8/17 的指標可能使用舊收盤資料加即時價，或正式資料匯入尚未完成；這會影響 RSI、MACD、KD、MA 與 slope 的當日正確性。
- **目前判定**：Medium data-risk；`2026-08` 單筆不是單獨 bug，真正問題是報告日期與歷史資料最新日期的落差。
- **下一步**：確認正式匯入流程的截止日、報告生成時是否應該等待最新 K 線，以及報告中的 RSI／KD 是否與 8/3 的歷史末端一致。
- **修正限制**：未確認正式資料生命週期前不修改歷史檔或 provider。

## CORE-004：前置攔截時 finalScore 為 null

- **證據**：`data/reports/2026-08-17.json`：`signals.status` 為 P50 EntryGate，`signalDirection=hold`，`finalScore=null`；程式決策鏈 P0–P100 在 P50 回傳後不執行 P100。
- **風險**：報告使用者可能把 null 理解為未計算或錯誤；但程式可能有意只在 P100 執行時產生 finalScore。
- **下一步**：確認產品需求是「前置攔截時不計分」還是「仍計算分數但不允許交易」。
- **修正限制**：這是規格問題，不先視為 bug。
