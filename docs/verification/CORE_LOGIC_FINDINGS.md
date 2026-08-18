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

## CORE-001：marketState raw 欄位映射遺漏

- **證據**：`data/reports/2026-08-17.json` 的 `marketState` 為 `valuation.pr = 0`、`liquidity.marginRatio = 0`、`fxRate = 0`、`institutionalNetBuy = 0`；同日 `macroData` 有 `rawValuation.pb = 4.17`、`rawMargin.maintenanceRatio = 194.15`、`rawFx.currentRate = 31.882`。
- **根因**：`buildSignalContext()` 的 `signalData` 只傳遞 `rawValuation`，未傳遞 `rawMargin`、`rawFx`、`rawInstitutional`、`rawCnn` 等 raw slots。
- **下游行為**：`strategyEngine.normalizeMarketData()` 因此只能使用 fallback：`pr` 無值變 0；`marginRatio` 無 raw margin 時使用投資組合維持率；`fxRate` 無 raw FX 時變 0；法人值無 raw slot 時變 0。
- **影響**：報告中的 `marketState` 不代表同日 raw provider 資料；AI、展示與任何依賴 normalized market state 的風險判讀都可能收到錯誤或混用單位的輸入。這不是單純格式問題。
- **目前判定**：Confirmed bug，High。
- **修正限制**：Phase H 必須先建立 regression test，固定 raw slot 到 normalized marketState 的映射與資料來源；投資組合維持率與市場融資維持率必須維持不同欄位，不可用同名 fallback 混淆。
- **後續驗證**：修正後用 `2026-08-17.json` 的 raw fixture 驗證 PB、PR、market margin、FX、institutional 的輸出；再確認決策鏈是否實際使用這些欄位。

## CORE-002：法人資料未進入報告與 scoring context

- **證據**：抽樣 `2026-08-17.json` 的 `macroData` 未見 `rawInstitutional`；`marketState.liquidity.institutionalNetBuy = 0`。
- **程式證據**：`data/market/latest.json` 確實有 `rawInstitutional.totalNetBuy = 28074345`，且 `_meta.sources.stockInstitutionalTwse.status = SUCCESS`。
- **根因**：`IlnState.MACRO_REPORT_SLOTS` 只列出 `rawCnn`、`rawMargin`、`rawFx`、`rawNdc`、`rawValuation`、`rawMarketOverview`，漏列 `rawInstitutional` 與 `rawStockMargin`；`toReportObject()` 因此將已成功取得的資料排除在正式報告外。
- **第二個缺口**：`signalContext.mjs` 未將 `macroData.rawInstitutional` 組裝成 `institutionalNet`／`institutionalHistory`；因此 Scoring Matrix 目前無法使用法人資料。
- **影響**：法人因子可能為 0，並觸發 `signalGenerator.mjs` 的法人缺失技術組補貼邏輯；正式報告也無法保存法人證據。
- **目前判定**：Confirmed bug，High。
- **修正限制**：Phase H 需先以 regression test 固定「成功取得的 rawInstitutional 必須保留於報告」，再單獨決定是否把法人資料接入核心分數；不得把資料保存修正與策略權重變更綁成一個修改。

## CORE-003：正式歷史資料與報告日期不一致

- **證據**：`data/stock_history/00675L_202608.json` 與 `0050_202608.json` 最新日期為 `2026-08-03`；正式報告已存在至 `2026-08-17`。
- **程式證據**：`dailyRunContext.mjs` 每次執行會呼叫 `fetchStockHistoryWithAutoFill(symbol, HISTORY_MIN_BARS)`，而報告只保存指標結果，不保存當次使用的 K 線資料快照。
- **重算證據**：以目前本地 00675L 歷史資料重算，末筆 `2026-08-03` 得到 `KD_K=47.43005855562794`、`KD_D=29.623179570356697`，與 `2026-08-03.json` 的 `KD_K=47.430058555627824`、`KD_D=29.623179570356584` 相符；表示至少 8/3 報告使用了同一末端資料。
- **限制**：8/17 報告的 RSI/KD 已不同於 8/3，但目前沒有保存 8/17 當次歷史 K 線，無法僅靠既有檔案證明 8/17 使用的歷史資料截止日。
- **風險**：若報告日後沒有新增 K 線，技術指標可能使用過期歷史資料；若 provider 線上抓到新資料但未落盤，歷史重播又無法重現當日分數。
- **目前判定**：Medium data-risk，不先判定計算錯誤。
- **下一步**：確認正式資料生命週期：報告生成是否應等待最新交易日 K 線；是否應將使用的歷史資料截止日與末筆日期寫入報告；重播是否需要保存 K 線快照或資料版本。
- **修正限制**：先決定可重現性需求，再決定是補 metadata、保存 snapshot，或修正資料匯入；不直接修改 provider。

## CORE-004：前置攔截時 finalScore 為 null

- **證據**：`data/reports/2026-08-17.json`：`signals.status` 為 P50 EntryGate，`signalDirection=hold`，`finalScore=null`；程式決策鏈 P0–P100 在 P50 回傳後不執行 P100。
- **風險**：報告使用者可能把 null 理解為未計算或錯誤；但程式可能有意只在 P100 執行時產生 finalScore。
- **下一步**：確認產品需求是「前置攔截時不計分」還是「仍計算分數但不允許交易」。
- **修正限制**：這是規格問題，不先視為 bug。
