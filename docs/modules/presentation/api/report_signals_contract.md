---
type: reference
status: needs-review
last_updated: 2026-09-10
related_code:
  - src/modules/strategy/strategyEngine.mjs
  - src/modules/presentation/api/signalsApi.mjs
related_docs:
  - docs/modules/strategy/strategy_engine.md
  - docs/modules/presentation/api/_index.md
tags:
  - api
  - signals
  - contract
  - strategy
wiki_links:
  - [[Strategy Engine]]
  - [[API Index]]
---

# report.signals 欄位契約

> 來源：`src/modules/strategy/strategyEngine.mjs` + `src/modules/strategy/core/*` + `src/modules/strategy/policies/*`  
> 更新：2026-04-28  
> 說明：`report.signals` 為每日報告的策略與風控計算結果子樹，由 `strategyEngine.buildDecision()` 輸出，  
> 經 `dailyCheck` 組裝後存入 `data/reports/YYYY-MM-DD.json`，並透過 `/api/reports` 系列 endpoint 提供給前端。

---

## 一、決策優先權（Priority Hierarchy）

`buildDecision()` 採用優先中斷模式，一旦觸發高優先層，直接 return，後續層不再執行：

| Priority | 觸發條件                            | maintenanceLayer                                    | 關鍵輸出欄位 |
| -------- | ----------------------------------- | --------------------------------------------------- | ------------ |
| P0       | 維持率 < marginCallThreshold (135%) | `"critical"`                                        | 見 §2.1      |
| P1       | 維持率 < frozenZone (145%)          | `"frozen"`                                          | 見 §2.2      |
| P2       | 維持率 < protectTrigger (160%)      | `"protect"`                                         | 見 §2.3      |
| P3       | Gross Leverage > hardCap            | `"normal"` + grossLeverageStatus=`"hardcap_breach"` | 見 §3.1      |
| P4       | Gross Leverage > ceiling            | `"normal"` + grossLeverageStatus=`"ceiling_breach"` | 見 §3.2      |
| P5       | ValuationGuard latch 首次觸發       | valuationGuardStatus=`"latch_triggered"`            | 見 §4.1      |
| P6       | ValuationGuard latch 鎖定中         | valuationGuardStatus=`"latch_active"`               | 見 §4.2      |
| P7       | ValuationGuard multiplier < 0.5     | valuationGuardStatus=`"guard_active"`               | 見 §4.3      |
| P8       | EntryGate 前置過濾封鎖              | entryGateBlocked=`true`                             | 見 §5        |
| P9       | 常態運行（所有防護均通過）          | `"normal"`                                          | 見 §6        |

---

## 二、維持率 Margin Layer 狀態機欄位

所有 Margin Layer 回傳物件共享以下基礎欄位，再依層級附加額外欄位。

### 共用基礎欄位（所有 Layer 均含）

| 欄位                    | 型別                                              | 說明                             |
| ----------------------- | ------------------------------------------------- | -------------------------------- |
| `maintenanceLayer`      | `"critical" \| "frozen" \| "protect" \| "normal"` | 維持率層級                       |
| `marketStatus`          | `string`                                          | 含 emoji 的狀態文字（UI 顯示用） |
| `target`                | `string`                                          | 操作目標短標籤                   |
| `targetSuggestionShort` | `string`                                          | 單行摘要建議                     |
| `targetSuggestion`      | `string`                                          | 中長篇建議文字                   |
| `suggestion`            | `string`                                          | 詳細步驟說明（含換行符 `\n`）    |
| `maintenanceMargin`     | `number`                                          | 當前維持率（%）                  |

### 2.1 P0 — critical（斷頭危機）

| 欄位                  | 型別     | 說明                   |
| --------------------- | -------- | ---------------------- |
| `marginCallThreshold` | `number` | 斷頭門檻值（預設 135） |

### 2.2 P1 — frozen（高危凍結）

| 欄位                | 型別      | 說明                       |
| ------------------- | --------- | -------------------------- |
| `frozenZone`        | `number`  | 凍結解除線（預設 145）     |
| `needAmount`        | `number`  | 補足至解凍線所需金額（元） |
| `reserveSufficient` | `boolean` | 預備金是否足以補足         |

### 2.3 P2 — protect（預備金防禦）

| 欄位                | 型別      | 說明                                             |
| ------------------- | --------- | ------------------------------------------------ |
| `protectTrigger`    | `number`  | 保護觸發線（預設 160）                           |
| `protectTarget`     | `number`  | 補足目標維持率（預設 180）                       |
| `reserveStatus`     | `object`  | `{ currentReserve: number, ... }` 預備金狀態物件 |
| `needAmount`        | `number`  | 補足至目標維持率所需金額（元）                   |
| `reserveSufficient` | `boolean` | 預備金是否足以補足                               |

---

## 三、Gross Leverage 欄位

### 3.1 hardcap_breach（危機紅線）

| 欄位                    | 型別               | 說明                              |
| ----------------------- | ------------------ | --------------------------------- |
| `maintenanceLayer`      | `"normal"`         | 維持率已通過，此層由槓桿觸發      |
| `grossLeverageStatus`   | `"hardcap_breach"` | 槓桿狀態                          |
| `grossLeverage`         | `number`           | 當前綜合曝險倍數（x）             |
| `marketStatus`          | `string`           | `"🚨【Gross Leverage 危機紅線】"` |
| `target`                | `string`           | `"📉 強制降槓"`                   |
| `targetSuggestionShort` | `string`           | 含倍數與著陸目標的單行說明        |
| `targetSuggestion`      | `string`           | `grossLeverageResult.message`     |
| `suggestion`            | `string`           | 詳細步驟                          |

### 3.2 ceiling_breach（主動上限）

| 欄位                    | 型別               | 說明                          |
| ----------------------- | ------------------ | ----------------------------- |
| `maintenanceLayer`      | `"normal"`         | —                             |
| `grossLeverageStatus`   | `"ceiling_breach"` | 槓桿狀態                      |
| `grossLeverage`         | `number`           | 當前綜合曝險倍數（x）         |
| `panicBypassActive`     | `boolean`          | 是否同時觸發恐慌破冰          |
| `marketStatus`          | `string`           | 視 panicBypassActive 而異     |
| `target`                | `string`           | `"🚫 禁止加碼"`               |
| `targetSuggestionShort` | `string`           | 含倍數的單行說明              |
| `targetSuggestion`      | `string`           | `grossLeverageResult.message` |
| `suggestion`            | `string`           | 詳細步驟（含 bypassWarning）  |

---

## 四、ValuationGuard 估值守衛欄位

### 4.1 latch_triggered（清算觸發）

| 欄位                    | 型別                | 說明                                          |
| ----------------------- | ------------------- | --------------------------------------------- |
| `valuationGuardStatus`  | `"latch_triggered"` | 守衛狀態                                      |
| `marketStatus`          | `string`            | `"🚨【估值守衛：清算觸發】"`                  |
| `target`                | `string`            | `"📉 立即清倉"`                               |
| `targetSuggestionShort` | `string`            | `"PR{n} 首次觸發清算"`                        |
| `suggestion`            | `string`            | PB PR 分位說明                                |
| `shouldLatch`           | `boolean`           | `true`（通知 dailyCheck 需持久化 latch 狀態） |
| `latchNowActive`        | `boolean`           | `true`                                        |
| `valuationGuardResult`  | `object`            | 見 §4.4                                       |

### 4.2 latch_active（清算鎖定中）

| 欄位                    | 型別             | 說明                         |
| ----------------------- | ---------------- | ---------------------------- |
| `valuationGuardStatus`  | `"latch_active"` | 守衛狀態                     |
| `marketStatus`          | `string`         | `"🔒【估值守衛：清算鎖定】"` |
| `target`                | `string`         | `"📉 清倉降槓"`              |
| `targetSuggestionShort` | `string`         | `"PR{n} 觸發清算鎖定"`       |
| `suggestion`            | `string`         | PB PR 分位說明               |
| `latchNowActive`        | `boolean`        | `true`                       |
| `valuationGuardResult`  | `object`         | 見 §4.4                      |

### 4.3 guard_active（強勢壓縮，multiplier < 0.5）

| 欄位                    | 型別             | 說明                         |
| ----------------------- | ---------------- | ---------------------------- |
| `valuationGuardStatus`  | `"guard_active"` | 守衛狀態                     |
| `marketStatus`          | `string`         | `"🛡️【估值守衛：強勢壓縮】"` |
| `target`                | `string`         | `"🚧 槓桿限制"`              |
| `targetSuggestionShort` | `string`         | 含 PR 與乘數說明             |
| `suggestion`            | `string`         | 估值偏高說明                 |

### 4.4 valuationGuardResult 子物件（各層共用）

`resolveValuationGuard()` 輸出，附加至 `signals.valuationGuardResult`：

| 欄位           | 型別             | 說明                                                       |
| -------------- | ---------------- | ---------------------------------------------------------- |
| `guardActive`  | `boolean`        | 守衛是否啟用                                               |
| `currentPR`    | `number \| null` | 當前 PB 百分位排名（0–100，整數）                          |
| `multiplier`   | `number`         | 槓桿壓縮乘數（1.0 = 不壓縮）                               |
| `hitTier`      | `object \| null` | 命中的 tier 設定物件（來自 strategy.valuationGuard.tiers） |
| `hitTierIndex` | `number`         | 命中的 tier index（-1 = 未命中）                           |

---

## 五、EntryGate 前置過濾欄位（P8）

| 欄位                    | 型別             | 說明                                                               |
| ----------------------- | ---------------- | ------------------------------------------------------------------ |
| `maintenanceLayer`      | `"normal"`       | —                                                                  |
| `entryGateLevel`        | `number`         | Tier index（0–3）                                                  |
| `entryGateLabel`        | `string`         | `"底倉通道" \| "淺層修正通道" \| "深度回撤通道" \| "極端恐慌通道"` |
| `entryGateBlocked`      | `boolean`        | `true`                                                             |
| `valuationGuardResult`  | `object \| null` | 若估值守衛已計算則附上，否則 `null`                                |
| `marketStatus`          | `string`         | 含 emoji 的層級說明                                                |
| `target`                | `string`         | `"🚧 槓桿封鎖"`                                                    |
| `targetSuggestionShort` | `string`         | 含跌幅百分比的單行說明                                             |
| `targetSuggestion`      | `string`         | 完整通道說明                                                       |
| `suggestion`            | `string`         | 含跌幅區間、RSI 門檻、封鎖原因的詳細說明                           |

---

## 六、常態運行（P9）完整 signals 欄位

通過所有防護後，`buildDecision()` 進入常態邏輯並在 `runDailyCheck` 中組裝完整 `signals` 物件：

### 6.1 決策基礎欄位（來自 buildDecision return）

| 欄位                    | 型別       | 說明         |
| ----------------------- | ---------- | ------------ |
| `maintenanceLayer`      | `"normal"` | 維持率層級   |
| `marketStatus`          | `string`   | 當日市況標籤 |
| `target`                | `string`   | 操作目標標籤 |
| `targetSuggestionShort` | `string`   | 單行建議     |
| `targetSuggestion`      | `string`   | 完整建議說明 |
| `suggestion`            | `string`   | 詳細操作步驟 |

### 6.2 風控量化欄位

| 欄位                | 型別     | 來源                                | 說明                     |
| ------------------- | -------- | ----------------------------------- | ------------------------ |
| `maintenanceMargin` | `number` | `ctx.maintenanceMargin`             | 當前維持率（%）          |
| `grossLeverage`     | `number` | `grossLeverageResult.grossLeverage` | 綜合曝險倍數（x）        |
| `z2Ratio`           | `number` | `ctx.z2Ratio`                       | 00675L 佔總持股比例（%） |
| `netAsset`          | `number` | `ctx.netAsset`                      | 淨資產（元）             |
| `totalLoan`         | `number` | `ctx.portfolio.totalLoan`           | 融資餘額（元）           |

### 6.3 估值守衛欄位

| 欄位                       | 型別                  | 說明                                                       |
| -------------------------- | --------------------- | ---------------------------------------------------------- |
| `valuationGuardResult`     | `object \| null`      | §4.4 結構；若 vgCfg 未啟用或無 pbRecords 則為 `null`       |
| `valuationGuardMultiplier` | `number \| undefined` | 最終乘數（含 momentum 調整後）；guardActive=false 時不存在 |
| `panicBypassActive`        | `boolean`             | 是否觸發極端恐慌破冰                                       |

### 6.4 評分矩陣欄位（Scoring Matrix）

| 欄位              | 型別     | 說明                                          |
| ----------------- | -------- | --------------------------------------------- |
| `overallScore`    | `number` | 計分矩陣最終分數                              |
| `signal`          | `string` | `"BUY" \| "HOLD" \| "SELL"` 等訊號字串        |
| `scalingRatio`    | `number` | 倉位縮放比例（0.0–1.0+）                      |
| `categoryResults` | `object` | 各類別得分明細（結構依 signalGenerator 定義） |

### 6.5 預算管控欄位

| 欄位                   | 型別     | 說明                                                |
| ---------------------- | -------- | --------------------------------------------------- |
| `finalAvailableBudget` | `number` | 本日可用預算（元，daily cap 與 rolling cap 取小值） |
| `rollingNetIncrease`   | `number` | 近 N 日貸款淨增加（元）                             |
| `availableDaily`       | `number` | 日上限（元）                                        |
| `availableRolling`     | `number` | 滾動上限剩餘（元）                                  |

### 6.6 動態移動停利（Trailing Stop）

| 欄位                | 型別             | 說明                     |
| ------------------- | ---------------- | ------------------------ |
| `trailingActive`    | `boolean`        | 移動停利是否已啟用       |
| `trailingHighWater` | `number \| null` | 本次啟動以來最高淨值記錄 |
| `trailingStopPrice` | `number \| null` | 計算出的停利觸發價       |

### 6.7 宏觀情緒欄位

| 欄位             | 型別     | 說明                                                                                            |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `macroSentiment` | `object` | `{ direction: "BULLISH"\|"BEARISH"\|"NEUTRAL", bonus: number, penalty: number, label: string }` |
| `bias`           | `string` | 多空偏向標籤（`"BULL"\|"BEAR"\|"NEUTRAL"`）                                                     |

### 6.8 生存分析欄位

| 欄位             | 型別             | 說明                   |
| ---------------- | ---------------- | ---------------------- |
| `survivalMode`   | `boolean`        | 是否進入生存模式       |
| `survivalReason` | `string \| null` | 觸發生存模式的原因說明 |

### 6.9 賣出訊號欄位

| 欄位                   | 型別             | 說明                                                                  |
| ---------------------- | ---------------- | --------------------------------------------------------------------- |
| `sellSignals`          | `object`         | 賣出訊號集合（含 `triggered: boolean`、各子訊號 boolean）             |
| `sellBackToAllocation` | `object \| null` | 賣回目標配置建議（`{ targetZ2Ratio, currentZ2Ratio, actionNeeded }`） |

### 6.10 進場閘門欄位

| 欄位               | 型別      | 說明                                        |
| ------------------ | --------- | ------------------------------------------- |
| `entryGateBlocked` | `boolean` | `false`（常態運行時必為 false，已通過閘門） |
| `entryGateLevel`   | `number`  | 通過的 tier 層級（0–3）                     |
| `entryGateLabel`   | `string`  | 通道標籤                                    |

---

## 七、前端依賴欄位對照表

以下是目前 webapp 各 View 實際使用的 `signals` 欄位，refactor 時應優先保護：

| webapp View         | 使用欄位                                 | 說明                            |
| ------------------- | ---------------------------------------- | ------------------------------- |
| `AccountView.vue`   | `signals.valuationGuardResult.currentPR` | PR 分位趨勢圖                   |
| `AccountView.vue`   | `signals.grossLeverage`                  | 槓桿儀表板                      |
| `AccountView.vue`   | `signals.maintenanceMargin`              | 維持率儀表板                    |
| `AccountView.vue`   | `signals.overallScore`                   | 評分顯示（IlnState getter）     |
| `AccountView.vue`   | `signals.bias`                           | 多空偏向標籤（IlnState getter） |
| `DashboardView.vue` | `signals.marketStatus`                   | 當日市況標題                    |
| `DashboardView.vue` | `signals.targetSuggestionShort`          | 操作建議摘要                    |
| `StrategyView.vue`  | `signals.signal`                         | 評分矩陣訊號                    |
| `StrategyView.vue`  | `signals.finalScore` / `overallScore`    | 最終評分                        |
| `StrategyView.vue`  | `signals.categoryResults`                | 各分類得分明細                  |
| `MacroView.vue`     | `signals.macroSentiment`                 | 宏觀情緒方向與分數              |

---

## 八、`IlnState` getter 對應

`src/domain/ilnState.mjs` 中已為常用 signals 欄位定義 getter，避免散落的 optional chain：

| getter                    | 對應 signals 路徑                        | 型別             |
| ------------------------- | ---------------------------------------- | ---------------- |
| `state.currentPr`         | `signals.valuationGuardResult.currentPR` | `number \| null` |
| `state.grossLeverage`     | `signals.grossLeverage`                  | `number \| null` |
| `state.maintenanceMargin` | `signals.maintenanceMargin`              | `number \| null` |
| `state.overallScore`      | `signals.overallScore`                   | `number \| null` |
| `state.bias`              | `signals.bias`                           | `string \| null` |

> ⚠️ 若新增 signals 子欄位且 webapp 需要使用，建議同步在 `IlnState` 新增對應 getter，避免各 View 直接用多層 optional chain 存取。
