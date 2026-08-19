# 核心邏輯與分數系統驗證計畫

> **狀態**：Active — 依階段執行，尚未開始修改產品邏輯
> **建立日期**：2026-08-17
> **適用分支**：`main`
> **目的**：確認每日資料取得、技術指標、分數計算、決策鏈與歷史重播結果是否符合預期；先找出計算錯誤，再評估策略合理性。

## 1. 目標

回答以下問題：

1. 每日實際使用了哪些輸入數值？
2. 每個數值的來源、單位、時間與 fallback 是否正確？
3. RSI、MACD、KD、MA、ATR、跌幅、動能、法人與情緒分數是否正確計算？
4. `entry.weightScore` 與 Scoring Matrix `finalScore` 的角色是否清楚且未重複計分？
5. 前置風險規則是否依正確優先級攔截交易？
6. 歷史報告是否能由相同輸入重現？
7. 輸入小幅變化時，分數與行動是否呈現合理方向與穩定性？

## 2. 已知架構

每日流程：

```text
buildDailyRunContext()
  → 取得行情、歷史 K 線、VIX、總經、估值、持倉
buildSignalContext()
  → 計算技術指標與組裝 signalData
getInvestmentSignalAsync()
  → 載入策略、建立上下文、執行決策鏈
Decision Chain P0–P100
  → 風險規則先攔截，ScoringDecisionRule 最後計算 finalScore
通知／試算表／報告
```

目前有兩套分數：

- `entry.weightScore`：跌幅、RSI、MACD、KD、總體情緒；主要供輸出與部分預算協同。
- `finalScore`：Scoring Matrix；由技術趨勢、估值價值、籌碼動能、極值震盪四組組成，控制 P100 買進、賣出與中性決策。

## 3. 全域限制

- 不先修改產品邏輯；先以現有行為建立證據。
- 所有新增或修改測試遵守 RED → GREEN → VERIFY。
- 不以 coverage 百分比作為唯一成功標準。
- 不用歷史回測績效反推公式正確；先確認資料與公式。
- 不把 fallback 的「沒有 throw」視為資料正確。
- 不為了讓測試通過而修改產品行為。
- 每一階段完成後，保存輸出、差異或決策紀錄，再進入下一階段。

## 4. 驗證範圍與主要檔案

### 4.1 資料取得與組裝

- `src/domain/dailyRunContext.mjs`
- `src/domain/signalContext.mjs`
- `src/modules/providers/marketData.mjs`
- `src/modules/providers/dataSourceConfig.mjs`
- `src/utils/normalizer.mjs`
- 各行情、VIX、估值、法人與融資 provider

### 4.2 指標與分數

- `src/modules/strategy/indicators.mjs`
- `src/modules/strategy/policies/entryScoringPolicy.mjs`
- `src/modules/strategy/signalGenerator.mjs`
- `src/modules/strategy/policies/sellScoringPolicy.mjs`
- `data/config/Strategy.default.json`

### 4.3 決策鏈

- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/strategy/decision/chain.mjs`
- `src/modules/strategy/decision/rules/*.mjs`
- `src/modules/strategy/policies/*.mjs`

### 4.4 現有測試與歷史證據

- `src/modules/strategy/**/*.test.mjs`
- `src/test/unit/strategyEngine.test.mjs`
- `src/test/unit/decisionRules.test.mjs`
- `src/test/integration/decisionChain.test.mjs`
- `data/reports/*.json`
- `docs/performance/PHASE_6_BASELINE.md`

## 5. 執行階段

### Phase A：資料流與公式規格盤點

**目標**：建立「輸入 → 來源 → 單位 → 清洗 → 指標 → 因子 → 權重 → cap → 門檻 → 行動」對照表。

**工作項目**：

- [ ] 列出每日所有直接輸入欄位。
- [ ] 對每個欄位標註 provider、檔案或歷史報告來源。
- [ ] 確認價格、法人、PB、PR、VIX、維持率的單位。
- [ ] 確認交易日、時區、即時價與前一收盤價的時間關係。
- [ ] 列出每個 fallback，分類為安全降級、危險降級或應中止。
- [ ] 將 `entry.weightScore` 與 `finalScore` 分開畫出完整資料流。
- [ ] 將目前規格與程式碼不一致處列為問題，不直接修正。

**產出**：

- `docs/verification/CORE_LOGIC_DATA_FLOW_MATRIX.md`
- 問題清單：`confirmed bug`、`spec ambiguity`、`data risk`、`no issue`

**完成條件**：每個進入分數或決策的數值都有可追溯來源、單位與計算位置；未知項目明確標記，不用推測補齊。

### Phase B：純數學公式驗證

**目標**：使用人工可計算的固定資料驗證指標與分數函式。

**優先順序**：

1. `calcSMA()`、`calcATR()`、`calcSlopeN()`
2. RSI、MACD、Slow KD 的週期與索引對齊
3. `computeEntryScore()`
4. `generateScoringMatrix()`
5. `computeSellSignals()`、反轉與過熱判斷

**TDD 流程**：

- [ ] 每次只新增一個最小行為測試。
- [ ] 執行指定測試，確認因缺少預期行為而 RED。
- [ ] 若是既有行為但沒有證據，先建立 characterization test，不視為新功能。
- [ ] 只有發現明確錯誤時才新增修正；修正前先保留失敗測試。
- [ ] 執行指定測試與相關既有測試。
- [ ] 記錄輸入、預期值、實際值與差異。

**必測案例**：

- 資料不足。
- 前導 `NaN`。
- 常數序列與標準差為 0。
- 正常上漲、下跌與橫盤序列。
- 門檻剛好相等、剛低於、剛高於。
- RSI/KD/MACD 交叉的前一天與當天。
- `priceDropPercent` 為 0、5、10、20、30、40 及負值。
- 法人歷史資料不足 5 筆與正常資料。
- 情緒為 BULL、BEAR、NEUTRAL、缺失。

**完成條件**：每個公式都有可重算的證據；若發現錯誤，已用失敗測試重現，尚未在沒有批准前擴大修正範圍。

### Phase C：資料來源、單位與 fallback 驗證

**目標**：確認程式拿到的值就是公式預期的值。

**工作項目**：

- [ ] 以 provider 測試與實際輸出確認欄位名稱。
- [ ] 確認法人淨買超是否在 normalizer 中正確轉換為百萬單位。
- [ ] 確認 PB、PR 的基準期間與歷史筆數。
- [ ] 確認 VIX 的來源、更新時間與歷史序列順序。
- [ ] 確認即時價失敗時使用收盤價是否會改變當日交易語意。
- [ ] 確認 MA240 資料不足時 fallback 是否應允許進入估值判斷。
- [ ] 確認 stale data 是否有警告、阻止或靜默採用。
- [ ] 確認週末與無開市日是否仍使用合理的最後交易日資料。

**完成條件**：每個外部輸入都有欄位、單位、時間戳與缺值策略；危險 fallback 必須列入後續決策，不直接視為正確。

### Phase D：決策鏈與優先級驗證

**目標**：確認相同輸入在不同風險條件下，最後行動符合規則優先級。

**決策矩陣**：

- [ ] 正常市場、無持倉戰術部位。
- [ ] 多頭市場且 `finalScore >= 1.5`。
- [ ] 一般市場且 `finalScore >= 4`。
- [ ] `finalScore <= -4` 的賣出。
- [ ] 已有戰術部位且分數低於 hysteresis。
- [ ] Entry Gate 阻擋加碼。
- [ ] 高估值與 latch。
- [ ] 維持率危險與 frozen zone。
- [ ] Gross leverage 超過 ceiling 或 hard cap。
- [ ] Stop loss／trailing stop 觸發。
- [ ] 再平衡、轉換防護、生命週期槓桿限制。
- [ ] 冷卻期與每日／滾動預算限制。

**完成條件**：每個案例都記錄「觸發規則、被跳過規則、最後決策、分數、配置比例」；確認前置規則不會被 P100 分數意外覆蓋。

### Phase E：歷史重播驗證

**目標**：使用已儲存的歷史資料重算，區分程式、資料、設定版本與報告差異。

**工作項目**：

- [ ] 先選擇資料完整且有 `strategySnapshot` 的報告日期。
- [ ] 保存原始報告與當時策略設定。
- [ ] 使用相同策略版本重算 `entry.weightScore` 與 `finalScore`。
- [ ] 比對 RSI、KD、MACD、跌幅、分類分數、總分與最終行動。
- [ ] 將差異分類為程式錯誤、資料更新差異、設定版本差異、預期 fallback 或歷史報告錯誤。
- [ ] 只對可重現的程式差異建立 regression test。

**完成條件**：至少完成一個正常日、一個大幅波動日、一個高估值或風險攔截日的重播；每個差異都有原因或明確待確認事項。

### Phase F：敏感度與反事實驗證

**目標**：確認輸入變化的方向、幅度與門檻行為合理。

**單變量測試**：

- [ ] RSI 增加 1。
- [ ] KD 增加 1。
- [ ] VIX 增加 1。
- [ ] 跌幅增加 1 個百分點。
- [ ] PB 增加 0.1。
- [ ] 法人淨買超增加一個固定單位。
- [ ] 情緒由 BULL 切換為 BEAR。
- [ ] MA60 slope 正負切換。

**檢查項目**：

- [ ] 負面因素不會意外提高買進分數。
- [ ] 正面因素不會意外降低買進分數。
- [ ] cap 與 threshold 附近沒有非預期跳變。
- [ ] 同一市場資訊沒有在兩個欄位被重複計分。
- [ ] 法人缺失補貼不會比完整法人資料更有利，除非規格明確允許。

**完成條件**：所有單變量變化都有預期方向；反例必須回到 Phase A 判斷是規格問題或程式錯誤。

### Phase G：查核發現分類與修正決策

**目標**：將 Phase A–F 發現的問題與改善機會分開分類，避免在尚未確認規格前直接修改產品邏輯。

**每個發現至少記錄**：

- ID：例如 `CORE-001`
- 發現階段：A–F
- 類型：`bug`、`data-risk`、`spec-ambiguity`、`optimization` 或 `strategy-change`
- 影響範圍：指標、分數、決策或資料來源
- 證據：測試、重播結果或實際輸入
- 嚴重度：Critical／High／Medium／Low
- 可行方案與採用方案
- 是否改變投資策略意圖
- 回滾方式

**分類原則**：

- `confirmed bug`：公式或程式實作與既定規格不符。
- `data-risk`：來源、單位、時效或 fallback 有風險。
- `spec-ambiguity`：程式行為明確，但策略意圖不明確。
- `optimization`：行為目前正確，但可降低複雜度、重複計分或異常波動。
- `strategy-change`：改變投資策略意圖，必須另行決策，不直接併入技術修正。

**產出**：

- `docs/verification/CORE_LOGIC_FINDINGS.md`
- 每個發現的證據、方案、取捨與批准狀態

**完成條件**：所有 Phase A–F 發現都有分類、證據、嚴重度與下一步；未確認項目不得直接修改產品邏輯。

### Phase H：修正與優化執行

**目標**：只處理 Phase G 已確認且批准的項目。

**執行順序**：

1. Critical／High 的 confirmed bug。
2. 會影響分數可信度的 data risk。
3. 計算重複、fallback 不一致等 optimization。
4. 低風險可讀性或維護性改善。
5. 涉及策略意圖的項目另建決策文件，不與一般 bug fix 混合。

**每個修正項目遵守**：

```text
regression test → RED → 最小修正 → GREEN → 相關測試
→ 完整驗證 → 歷史重播 → 記錄前後差異
```

**完成條件**：每個修正都有 regression test、最小變更、測試證據、回滾方式與前後差異紀錄。

### Phase I：修正後完整回歸驗證

**目標**：確認修正與優化沒有破壞原本正確的行為或引入新的資料風險。

**必查項目**：

- 原本通過的公式測試仍通過。
- 決策鏈優先級與最終行動沒有非預期改變。
- 歷史重播差異符合已批准的修正內容。
- 敏感度方向仍符合預期。
- 資料來源、單位與 fallback 沒有新增問題。
- 完整相關測試與必要的完整測試套件通過。

**產出**：

- `docs/verification/CORE_LOGIC_REPLAY_RESULTS.md`
- `docs/verification/CORE_LOGIC_SENSITIVITY_RESULTS.md`
- 修正前後差異與最終驗證結論

**完成條件**：所有已批准修正均有回歸證據；未解決項目保留在 findings，不得標記為完成。

## 6. 驗證指令

```bash
# 公式與策略相關測試
npx vitest run src/modules/strategy src/test/unit/strategyEngine.test.mjs src/test/unit/decisionRules.test.mjs src/test/integration/decisionChain.test.mjs

# 後端完整測試
npm test

# 若進行歷史重播，先使用既有腳本確認輸入介面
node scripts/run-backtest.mjs --help
```

每次修正前後，至少執行對應的指定測試；階段完成前再執行完整相關測試。不得把未執行的結果填入文件。

## 7. 風險與決策原則

- 技術指標數學正確，不代表投資策略具有預測能力；兩者分開報告。
- 歷史重播相符，不代表未來資料來源永遠可靠。
- AI 新聞方向屬外部模型輸出，需驗證輸入格式與 fallback，不把模型判斷當作數學真值。
- 一旦發現公式與既有報告不一致，先保留證據並暫停擴大修正。
- 任何產品邏輯修正都要先建立 regression test，完成 RED → GREEN → VERIFY，再提交與推送。
- 若發現需要更改投資策略意圖，另開決策文件，不在技術驗證計畫內直接修改。

## 8. 目前執行順序

```text
Phase A → Phase B → Phase C → Phase D → Phase E → Phase F
→ Phase G → Phase H → Phase I
```

目前只啟動 Phase A。每完成一個 Phase，先回報證據與未決問題，取得確認後再進入下一 Phase。Phase H 只執行 Phase G 已批准的項目。

## 9. 驗證結果紀錄

| Phase | 狀態    | 證據               | 未決問題                        |
| ----- | ------- | ------------------ | ------------------------------- |
| A     | Pending | 尚未建立資料流矩陣 | 待盤點 provider、單位、fallback |
| B     | Pending | 尚未開始           | 待建立人工可算公式案例          |
| C     | Pending | 尚未開始           | 待確認資料來源與時間語意        |
| D     | Pending | 尚未開始           | 待建立決策優先級矩陣            |
| E     | Pending | 尚未開始           | 待選擇可重播報告日期            |
| F     | Pending | 尚未開始           | 待完成單變量敏感度測試          |
| G     | Pending | 尚未建立發現分類表 | 待分類查核結果與確認修正方案    |
| H     | Pending | 尚未開始           | 待 Phase G 批准項目             |
| I     | Pending | 尚未開始           | 待 Phase H 修正完成             |

## 10. 相關文件

- `docs/plans/active/ACTIVE_PLANS_CONSOLIDATED.md`
- `docs/performance/PHASE_6_BASELINE.md`
- `data/config/Strategy.default.json`
- `src/domain/dailyRunContext.mjs`
- `src/domain/signalContext.mjs`
- `src/modules/strategy/indicators.mjs`
- `src/modules/strategy/signalGenerator.mjs`
- `src/modules/strategy/policies/entryScoringPolicy.mjs`
- `src/modules/strategy/decision/chain.mjs`

## 11. 驗證證據文件

- `docs/verification/CORE_LOGIC_DATA_FLOW_MATRIX.md`
- `docs/verification/CORE_LOGIC_FINDINGS.md`
- `docs/verification/CORE_LOGIC_REPLAY_RESULTS.md`
- `docs/verification/CORE_LOGIC_SENSITIVITY_RESULTS.md`

## 12. 已確認實作契約：Replay 與 Data Freshness

### Replay

- 目標：完整 replay，但第一階段先保存 metadata 與 Scoring 所需欄位，不重複保存大型 OHLCV、新聞全文或 AI prompt／response。
- 位置：`report.replay`。
- 建立方式：純函式 `src/domain/replaySnapshot.mjs` 的 `buildReplaySnapshot()`。
- schema：`schemaVersion: "1.0"`。
- 保存 `signalData` 中驅動 Scoring 的欄位、category results、`finalScore`、`rawDecision`、`finalDecision`、`scoringMatrixExecuted`、完整 `institutionalHistory` 與 `dataAsOf`。
- strategy 保存 version、snapshot 與 canonical JSON SHA-256 hash。
- data source 保存 provider、dataset、workspace-relative path、raw file hash、normalized data hash；hash 不能計算時標記 `integrity: "unverified"`。
- canonical JSON 使用 recursive object-key sorting，不新增 dependency。
- 舊報告不回填；loader 統一補 `replay.status = "unavailable"` 與 `reason = "legacy_report_without_replay_inputs"`。

### Data freshness

- `dataFreshness.mode` 預設 `shadow`，可由 `DATA_FRESHNESS_MODE=shadow|enforcement` override。
- `staleAfterTradingDays: 3` 定義為交易日差距 `>= 3` 即 stale；無資料為 unavailable。
- 交易日差距使用實際 K 線日期序列，不自行建立週一至週五假日曆。
- shadow 只保存 `shadowGuardDecision.wouldBlock`，不修改 action；enforcement 才套用封鎖。
- P0–P90 風控優先於 freshness guard；P95 只處理 P100 tactical signals。
- category dependency 放入 `Strategy.default.json`，第一階段定義 technical、institutional、valuation、risk。
- tactical signal 初始集合：`buy_tactical`、`sell_tactical`、`exit_buffer`。
- category blocking 採依賴矩陣，不以任何單一缺失欄位無條件封鎖全部 tactical signals。
- shadow 累積統計達 10 次後封存；切換 enforcement 的門檻為 false positive rate `<= 5%` 且所有 wouldBlock 案例可追溯。
- rollback 使用 `DATA_FRESHNESS_MODE=shadow`。

### 實作順序

```text
replay schema → legacy compatibility → data-as-of metadata
→ freshness evaluator → P95 guard → shadow statistics
→ enforcement switch → integration tests
```

## 13. 計畫版本紀錄

- v1.0：建立六階段核心邏輯與分數系統驗證計畫。
- v1.1：新增 Phase G（發現分類）、Phase H（修正與優化）、Phase I（修正後回歸驗證），並定義驗證證據文件。
- v1.2：完成 Replay／Data Freshness 決策樹；開始依 TDD 實作。
- 目前狀態：Phase H 已完成 replay snapshot、legacy compatibility、freshness evaluator、P95 guard 與 daily scheduler wiring；Phase I 驗證進行中。
- 已完成：shadow statistics 累積／10 次封存、`DATA_FRESHNESS_MODE=enforcement` 在 AI 與通知前套用 guard。
- 已驗證：7 個相關 test files、57 tests passed；包含 provider、scheduler、freshness、replay、strategy、state 回歸。
- 已新增證據：`docs/verification/CORE_LOGIC_REPLAY_RESULTS.md`，確認 replay availability classification 與 provenance adapter 已完成。
- 已完成：daily runtime source metadata wiring；報告 replay 可保存 provider／dataset／status／lastFetch provenance；`dataAsOf` 可從 `replaySignalData.historyMetadata` fallback。
- 已驗證：受影響的 replay、scheduler、provider、simulator、freshness、strategy、state 測試 8 files／90 tests passed。
- 已完成：simulator raw bridge contract；`rawMargin` 僅作 live baseline，維持率由模擬 portfolio／價格重算；`rawFx` 僅保存 baseline，不納入 simulator 或 scoring。Golden tests 與 `/api/v1/simulate` API evidence 已通過。
- 已查核：`data/reports/*.json` 目前只有一份且無 `replay` 欄位，不能作為 production replay fixture。
- 已完成：新增 `data/replay-fixtures/core-logic-v1.json` 三日 synthetic、版本化 fixture；contract test 驗證 schema、日期排序、replay availability 與 strategy hash。真實多日 production report 仍待資料累積。
- 已完成：子計畫 `.hermes/plans/2026-08-19_003000-scoring-replay-runner.md` 的 loader、可注入 evaluator 逐日 replay、provenance metadata 與 deterministic result hash；相關測試 `4 passed`。
- 已完成：daily replay source providers 的 raw/normalized hash contract、provider hash 計算與 replay provenance 保留；legacy/fallback response 仍正確標記 `unverified`。已驗證全量 `104 test files / 1591 tests passed / 6 todo`。`basePriceProvider` 與 `historyProvider` 不屬於 daily `macroDataSlots`，本階段未改動。
- 尚未完成：使用真實多日 production reports 的逐日 replay 驗證。
