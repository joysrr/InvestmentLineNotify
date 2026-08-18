# Core Logic Findings

> **Phase**：A / G / H — 資料流盤點、修正決策與第一批修正
> **狀態**：CORE-001/002/003 completed；CORE-004 pending product decision
> **原則**：本文件只記錄證據與待決策事項；未經確認不修改產品邏輯。

## 發現索引

| ID       | 類型           | 嚴重度 | 主題                                                                              | 狀態                                |
| -------- | -------------- | ------ | --------------------------------------------------------------------------------- | ----------------------------------- |
| CORE-001 | confirmed-bug  | High   | signalContext 遺漏 raw market slots，造成 marketState 欄位錯誤為 0／錯用 fallback | Confirmed; remediation in Phase G/H |
| CORE-002 | confirmed-bug  | High   | 法人資料存在 cache，但報告白名單排除，且未傳入 scoring context                    | Confirmed; remediation in Phase G/H |
| CORE-003 | data-risk      | Medium | 正式歷史資料截至 2026-08-03，報告截至 2026-08-17，且報告未保存 K 線快照           | Open; needs data lifecycle decision |
| CORE-004 | spec-ambiguity | Medium | P50 前置攔截時 `finalScore` 為 null                                               | Open                                |

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

## Phase A 系統性統計證據

- **資料範圍**：137 份正式報告，`2026-03-31` 至 `2026-08-17`。
- **`finalScore`**：137/137 為 `null`，沒有任何報告保存 P100 Scoring Matrix 結果。
- **`marketState`**：`marginRatio` 135/137 為 0；`fxRate` 135/137 為 0；`institutionalNetBuy` 135/137 為 0；`pr` 133/137 為 0。
- **raw slot**：137/137 報告沒有 `rawInstitutional`；126/137 有 `rawMargin` 與 `rawFx`，但 normalized 欄位仍幾乎全為 0。
- **結論**：CORE-001 與 CORE-002 是系統性資料管線問題；CORE-004 是系統性報告契約／決策可觀測性缺口，不是單日資料異常。
- **方法限制**：這是靜態報告統計，不等同於每一日執行時的完整 runtime trace；修正前仍需用 fixture 建立可重現測試。

## CORE-004：前置攔截時 finalScore 為 null

- **證據**：`data/reports/2026-08-17.json`：`signals.status` 為 P50 EntryGate，`signalDirection=hold`，`finalScore=null`；程式決策鏈 P0–P100 在 P50 回傳後不執行 P100。
- **風險**：報告使用者可能把 null 理解為未計算或錯誤；但程式可能有意只在 P100 執行時產生 finalScore。
- **決策**：採方案 A。前置規則攔截時不執行 P100，`finalScore` 維持 `null`。
- **實作**：`formatSignalOutput` 新增 `scoringMatrixExecuted` 欄位，值為 `finalDecision.finalScore != null`。前置攔截時此欄位為 `false`，可明確區分「P100 未執行」與「P100 已執行但分數為 0」。
- **修正限制**：不改變前置規則優先級，不計算額外分數，不把 `null` 轉成 0。
- **驗證**：`strategyEngine` targeted 23/23 通過；完整回歸 98 files passed、1520 tests passed。
- **修正 commit**：`935d89a`。

## Phase B：純數學與 Scoring Matrix 驗證結果

### 已驗證

- RSI(14)：13 漲 1 跌的 golden case 通過；輸出精度為 `technicalindicators` 的兩位小數（`92.86`）。
- SMA：前置不足資料為 `NaN`，足量資料平均值正確。
- ATR：True Range 與第一個 ATR、Wilder smoothing 起點通過 golden case。
- Slow KD(9,3,3)：Fast K → SMA3 → SMA3 的最新值與輸出長度通過；NaN 過濾不影響最新值對齊。
- MACD(12,26,9)：`MACD`、`signal`、`histogram` 欄位與 EMA 參數通過 golden case。
- MA slope：五期斜率與端點 `NaN` 行為通過。
- Scoring Matrix：權重、分類 cap、缺值 normalization、sentiment clamp、bull momentum cap 通過。

### 風險觀察

- 法人歷史不足時，`institutional=0` 並啟用技術組補貼；測試已鎖定現行行為。這不是公式錯誤，但會放大 CORE-002 資料管線缺失對最終分數的影響。

### 已補充驗證

- institutional normalization 原先把當日值納入 baseline，已確認為 look-ahead leakage。
- 修正為與 MACD／MA slope 相同的規則：baseline 使用 `slice(-lookback - 1, -1)`，排除當日值。
- scaling tier 1／2／3 的低於邊界與精確邊界均通過 golden tests。
- Scoring Matrix targeted tests：9/9 通過。

### 尚未驗證

- bullish buy threshold 與完整 decision table 的所有交叉邊界。

- **驗證提交**：`04ae098`、`d4339f6`、`107d61e`。
- **修正提交**：`1361a9d`。
- **完整回歸**：100 test files passed、1536 tests passed、2 skipped、6 todo。
- **補充說明**：第一次完整回歸曾出現 `strategyStatus` 的非重現失敗；隔離測試與第二次完整回歸均通過，未修改該無關測試。

## Phase G：修正與優化決策草案

> 本節只定義修正邊界與驗證要求，不在 Phase G 修改產品程式碼。

### CORE-001：marketState raw 映射

**方案 A — 最小映射修正（推薦）**

- 在 `buildSignalContext()` 傳遞需要的 raw slots。
- 在 `normalizeMarketData()` 明確區分市場融資維持率、投組維持率、匯率、法人淨買超。
- 缺值保留 `null`，不以 0 假裝真實數值。
- **優點**：最小 diff、保留現有架構、能直接驗證資料是否正確流動。
- **缺點**：仍需後續決定哪些 normalized 欄位真正進入決策。

**方案 B — 由 `marketState` 直接讀取完整 raw data**

- 統一在報告組裝層完成 raw → normalized。
- **不推薦**：會把計算責任移出純計算層，增加 daily run 與報告組裝耦合。

**Phase H DoD**：

- raw fixture 的 PB、PR、market margin、FX、法人值能正確映射。
- 缺值輸出為 `null` 或明確 unavailable，不輸出 0 假值。
- 投組維持率與市場融資維持率欄位不混用。
- 現有決策行為未被未授權改變。

**回滾**：單一 commit revert；不改策略設定檔。

### CORE-002：法人資料保存與 scoring 接入

**方案 A — 分兩個垂直切片（推薦）**

1. 先將 `rawInstitutional` 與 `rawStockMargin` 加入報告白名單，保留原始證據。
2. 另建立法人歷史序列的資料來源與 schema，再決定是否接入 `institutionalNet`／`institutionalHistory`。

- **優點**：先修資料遺失，再評估策略意義；避免把保存 bug 與權重變更混在一起。
- **缺點**：需要兩個 TDD cycle。

**方案 B — 立即把單日法人值接入 Scoring Matrix**

- **不推薦**：目前只有單日資料，無法正確建立 z-score 歷史基準；會讓分數看似有法人因子但統計意義不足。

**Phase H DoD（第一切片）**：

- `rawInstitutional`、`rawStockMargin` 成功取得時保留在正式報告。
- provider failure、null 與 stale 狀態可區分。
- 不改變 `institutional` 權重與缺值補貼規則。

**後續 DoD（第二切片）**：

- 定義法人歷史資料格式、單位與交易日對齊。
- 用固定歷史 fixture 驗證 z-score、tanh 與缺值分支。
- 取得策略意圖確認後才接入正式分數。

**回滾**：先回滾報告白名單變更；scoring 接入若另立 commit，獨立回滾。

### CORE-003：歷史 K 線新鮮度與重現性

**方案 A — 先加入 metadata（推薦）**

- 報告保存 `historyAsOf`、兩檔資料筆數、最新 K 線日期與資料來源狀態。
- **優點**：最小變更，先讓每日分數可被追溯。
- **缺點**：不能完整重建當日指標。

**方案 B — 保存當次 K 線 snapshot**

- 報告或 market history 保存實際使用的 K 線序列／版本 ID。
- **優點**：可完整重播。
- **缺點**：檔案較大，需設計保存與清理策略。

**方案 C — 報告前強制檢查最新交易日**

- K 線未更新時阻止報告或標記 degraded。
- **不推薦作為第一步**：可能因假日、API 延遲或盤中時間造成不必要中止。

**Phase H DoD（第一切片）**：

- 報告明確記錄兩檔歷史最新日期與筆數。
- 過期資料不再靜默通過，至少輸出 degraded/stale 狀態。
- 歷史重播能辨認資料截止日。

**回滾**：metadata 欄位為附加欄位，可單一 commit revert，不影響既有報告讀取。

### CORE-004：前置攔截時 `finalScore=null`

此項需要產品意圖確認後才執行。技術上有兩個方案：

- **方案 A**：維持 `null`，報告明確標示「未執行 P100」。（最小變更）
- **方案 B**：即使前置規則攔截，仍計算並保存 `finalScore`，但不允許交易。（可觀測性較佳，但可能讓使用者誤以為分數具有決策效力）

目前不自行採用 A 或 B；Phase G 保留待確認。

### Phase G 結論

- CORE-001：採方案 A。
- CORE-002：採方案 A，分保存與 scoring 接入兩個切片。
- CORE-003：採方案 A，先補 metadata，再評估 snapshot。
- CORE-004：等待產品意圖確認。

## Phase H 已完成項目與驗證證據

### CORE-001

- `normalizeMarketData` 缺值不再默認為 0，改為 `null`。
- `buildSignalContext` 已傳遞 `rawMargin`、`rawFx`、`rawInstitutional`、`rawCnn`。
- Targeted：4 個相關測試通過；完整回歸最新結果：98 test files passed、1519 tests passed、2 skipped、6 todo。
- 修正 commit：`638c136`、`9b6aad2`。

### CORE-002 第一切片

- `IlnState.MACRO_REPORT_SLOTS` 已加入 `rawInstitutional`、`rawStockMargin`。
- 報告保存修正與 scoring 接入分離；目前未改法人權重、z-score 或缺值補貼。
- Targeted：`ilnState`、`signalContext`、`normalizer` 4/4 通過。
- 修正 commit：`20bfbff`。

### CORE-003 第一切片

- `signalData.historyMetadata` 已記錄 0050／00675L 的筆數與最新日期。
- 未保存完整 K 線、不阻止報告生成，符合最小方案。
- Targeted：27/27 通過；完整回歸最新結果同上。
- 修正 commit：`d89b01c`。

### 尚未完成

- CORE-002 第二切片：法人歷史 schema、交易日對齊、z-score 與正式 scoring 接入。
- CORE-003 第二切片：完整 K 線 snapshot 或資料版本，需先評估保存成本。
- CORE-004：前置攔截時 `finalScore` 的產品契約待確認。

## Phase H 執行順序草案

1. CORE-001 regression test → raw mapping 最小修正。
2. CORE-002 report preservation regression test → 報告白名單修正。
3. CORE-003 metadata regression test → 記錄歷史資料新鮮度。
4. CORE-002 scoring 接入另立決策與測試，不與前三項合併。
5. CORE-004 取得產品決策後，再建立對應 regression test。

每一項均遵守：

```text
RED → GREEN → 相關測試 → 完整驗證 → 歷史重播 → commit
```
