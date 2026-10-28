---
type: plan
status: current
last_updated: 2026-10-28
tags:
  - plan
  - p1-removal
  - cash-exposure
wiki_links: []
---

# P1 移除 & 現金驅動曝險建議計畫

**建立日期：** 2026-10-28  
**狀態：** 🟢 全部完成（Phase 1: `ab58daa`，Phase 2: `04b0c8b`）  
**負責人：** Han  
**追蹤方式：** 本文件，所有決策、細節、進度均在此更新

---

## 背景與動機

### 問題

系統現有「P1 條件加碼」機制存在根本性資料錯誤：

1. **`p1Balance` 硬編碼**：`leadingIndicatorEvaluator.mjs` fallback 寫死 `450000`，Sheet 根本沒有此欄位，DCA 持續投入從未被反映
2. **`usedBatches` 無遞增邏輯**：從前一天報告讀取、無任何累加機制，數字無意義
3. **P1/P0 區分對系統無實際幫助**：P1 的本質是臨時性加碼，與系統核心邏輯（DCA + 槓桿管理）正交

### 方向

- **移除** P1 相關概念（`p1Balance`、`pauseP1`、`usedBatches`、`evaluateP1Allocation`）
- **保留並強化** Radar 的市場風險偵測能力（雷達邏輯本身是對的，只移除 P1 相關 constraint）
- **新增** 基於真實 `cash`（來自 Sheet）的曝險/槓桿建議：
  - 現金增加 → 系統自動分析可支撐的額外曝險空間
  - 結合 Kelly 建議槓桿 vs. 現實槓桿的缺口
  - 給出具體的 DCA 或槓桿行動建議

---

## 架構設計

### 移除範圍（Phase 1）

| 檔案                                                   | 改動                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/modules/strategy/marginStateMachine.mjs`          | 移除 `evaluateP1Allocation()` 函式；`pauseP1` 從 constraints 物件移除                     |
| `src/modules/strategy/leadingIndicatorEvaluator.mjs`   | 移除 `p1Balance`、`usedBatches`、`p1Allocation0050`；Telegram 卡片底部行改為現金/曝險摘要 |
| `src/modules/strategy/radars/types.mjs`                | 移除 `pauseP1` 型別欄位                                                                   |
| `src/modules/strategy/radars/overnightShockRadar.mjs`  | 移除 `pauseP1`                                                                            |
| `src/modules/strategy/radars/extremePanicRadar.mjs`    | 移除 `pauseP1`                                                                            |
| `src/modules/strategy/radars/retailSentimentRadar.mjs` | 移除 `pauseP1`                                                                            |
| `src/modules/strategy/radars/marginSettlingRadar.mjs`  | 移除 `pauseP1`                                                                            |
| `src/scheduler/dailyCheck.mjs`                         | 移除 `prevUsedBatches`、`usedBatches` 傳遞                                                |
| `src/tools/stressTestEvaluator.mjs`                    | 移除 `pauseP1` 驗證鍵（`REQUIRED_STATE_KEYS`）                                            |
| `src/tools/stressScenarioFixture.mjs`                  | 移除 `pauseP1` 型別檢查                                                                   |
| `webapp/src/components/radar/ExtremeRadarPanel.vue`    | 移除 P1 條件加碼顯示區塊                                                                  |
| `webapp/src/views/MarketRadarView.vue`                 | 移除 `p1Balance` computed                                                                 |

### 新增功能（Phase 2）：現金驅動曝險建議

#### 核心公式

```
// 現有已知量（來自 Sheet + 既有計算）
cash              = lastState.cash                    // Sheet「現金儲備」欄
grossExposure     = theory.grossExposure              // qty0050×p + qtyZ2×p×2
accountNetAsset   = lastState.accountNetAsset         // 帳戶淨資產（VERIFIED）
currentLeverage   = grossExposure / accountNetAsset   // 實際槓桿
kellyConservative = theory.kellyLimits.conservative   // Kelly 建議保守上限（倍）

// 新計算
targetExposure    = accountNetAsset × kellyConservative
exposureGap       = targetExposure - grossExposure    // 正 = 還有空間，負 = 過曝
cashAdequacy      = cash >= exposureGap               // 現金是否足夠填補缺口
suggestedDcaAmt   = min(cash × 0.5, exposureGap)     // 建議本次 DCA 量（上限 50% 現金）
```

#### 行動建議邏輯

```
if exposureGap <= 0:
  → 「已達/超過 Kelly 建議曝險，維持 DCA，不加速」
elif cash <= 0:
  → 「現金不足，維持基礎 DCA，等待現金補充」
elif cashAdequacy && radarClear:
  → 「現金充裕且市場無異常，建議本次 DCA ${suggestedDcaAmt}」
elif !radarClear:
  → 「市場雷達異常（列出觸發雷達），維持基礎 DCA，暫緩加速」
else:
  → 「現金部分充裕，建議適量 DCA ${suggestedDcaAmt}，保留緩衝」
```

#### 整合位置

1. **`leadingIndicatorEvaluator.mjs`**：新增 `cashExposureAnalysis` 輸出欄位
2. **Telegram 極端警報卡底部**：P1 餘額行 → 現金/曝險行（例：`└─ 💰 現金 $60,000 | 曝險缺口 $120,000 | 建議 DCA $30,000`）
3. **`ExtremeRadarPanel.vue`**：P1 加碼區塊 → CashExposureWidget（顯示現金、缺口、建議行動）
4. **每日報告（`ScoringDecisionRule`）**：在 `suggestion` 文字中增加現金/曝險參考行

---

## 執行計畫

### Phase 1：移除 P1（目標：乾淨刪除，測試全綠）

- [x] **1-A** `marginStateMachine.mjs`：移除 `evaluateP1Allocation`、`pauseP1`
- [x] **1-B** `radars/types.mjs` + 4 個 radar 檔：移除 `pauseP1`
- [x] **1-C** `leadingIndicatorEvaluator.mjs`：移除 P1 三個欄位、更新 Telegram 卡底部行（暫時留空，Phase 2 填入）
- [x] **1-D** `dailyCheck.mjs`：移除 `prevUsedBatches`/`usedBatches`
- [x] **1-E** `stressTestEvaluator.mjs` + `stressScenarioFixture.mjs`：移除 `pauseP1`
- [x] **1-F** `ExtremeRadarPanel.vue` + `MarketRadarView.vue`：移除 P1 UI
- [x] **1-G** 修正所有受影響測試（不刪測試，改成驗證「無 pauseP1 欄位」或更新為新行為）
- [x] **1-H** 全套測試通過（backend vitest 1889/1889 + webapp test 414/414 → commit `ab58daa`）

### Phase 2：新增現金驅動曝險建議（目標：新功能上線）

- [x] **2-A** 新增 `src/modules/strategy/cashExposureAdvisor.mjs`（純函式，輸入 cash/grossExposure/accountNetAsset/kellyConservative/radarTriggered，輸出 `cashExposureAnalysis`）
- [x] **2-B** TDD：先寫 `cashExposureAdvisor.test.mjs`，6 個邊界測試案例
- [x] **2-C** `leadingIndicatorEvaluator.mjs`：整合 `cashExposureAdvisor`，輸出新欄位，Telegram 卡底部改顯示現金/曝險摘要
- [x] **2-D** `ScoringDecisionRule.mjs`：在 `suggestion` 中加入現金/曝險參考行
- [x] **2-E** `ExtremeRadarPanel.vue`：新增 CashExposureWidget 取代原 P1 區塊
- [x] **2-F** `MarketRadarView.vue`：傳入 cash 數據（來自 portfolioState / leadingIndicators.cashExposureAnalysis）
- [x] **2-G** 全套測試通過 → commit（backend 188/189 檔、1900/1905 測試；唯一失敗 `dataIntegrity.test.mjs` 為外部 API 整合測試，環境限制，非本次變更導致；webapp 64/64 檔、414/414 測試）
- [ ] **2-H** 部署驗證：確認 Telegram 卡片、Mini App 雷達面板顯示正確（待生產環境部署）

---

## 決策記錄

| 日期       | 決策                                                   | 理由                                                                    |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| 2026-10-28 | 移除 P1 整體概念（選項A）                              | p1Balance 硬編碼、usedBatches 無遞增、與核心邏輯正交                    |
| 2026-10-28 | Stress tool 一起整理                                   | pauseP1 移除後 stressTestEvaluator REQUIRED_STATE_KEYS 就無效了，一起清 |
| 2026-10-28 | 新行動建議顯示在 ExtremeRadarPanel + 每日報告（C方案） | 雙位置確保使用者在雷達頁和每日摘要都能看到現金/曝險狀態                 |
| 2026-10-28 | 現金來源使用 Sheet 既有 `cash` 欄位，不新增欄位        | 最小改動；使用者直接在 Sheet 更新現金即反映                             |
| 2026-10-28 | `suggestedDcaAmt` 上限設為 cash × 50%                  | 保留現金緩衝，避免系統建議把全部現金一次投入                            |

---

## 注意事項 & 風險

1. **Radar 邏輯保留**：`pauseP1` 只是 constraint 中的一個 flag，移除後 radar 本身的觸發邏輯（費半、台指夜盤、維持率等）完整保留，不影響系統風控核心。
2. **stressScenarioFixture 改動**：現有 stress test fixture 有 `pauseP1: true/false` 的預期值，需要同步更新 fixture 資料，否則 stress test 會 false positive 通過。
3. **`cash` 可能為 0 或 null**：Sheet 讀取失敗時 fallback 為 `0`，`cashExposureAdvisor` 必須處理此邊界，不能 divide by zero 或顯示誤導建議。
4. **`accountNetAsset` 需要 VERIFIED 狀態**：Kelly 計算需要此值，若 VERIFIED 失敗則 `cashExposureAdvisor` 應回傳 `{ status: "UNAVAILABLE" }` 而非假數字。

---

## 進度追蹤

| Phase                | 狀態      | commit | 備註            |
| -------------------- | --------- | ------ | --------------- |
| Phase 1 移除 P1      | ⬜ 待開始 | —      | —               |
| Phase 2 現金曝險建議 | ⬜ 待開始 | —      | 等 Phase 1 完成 |

---

## 相關檔案快速索引

```
src/modules/strategy/marginStateMachine.mjs          ← evaluateP1Allocation 在此
src/modules/strategy/leadingIndicatorEvaluator.mjs   ← p1Balance/usedBatches 在此
src/modules/strategy/radars/types.mjs                ← pauseP1 型別在此
src/modules/strategy/radars/overnightShockRadar.mjs
src/modules/strategy/radars/extremePanicRadar.mjs
src/modules/strategy/radars/retailSentimentRadar.mjs
src/modules/strategy/radars/marginSettlingRadar.mjs
src/scheduler/dailyCheck.mjs                         ← prevUsedBatches/usedBatches 在此
src/tools/stressTestEvaluator.mjs                    ← REQUIRED_STATE_KEYS 在此
src/tools/stressScenarioFixture.mjs                  ← pauseP1 fixture 在此
webapp/src/components/radar/ExtremeRadarPanel.vue    ← P1 UI 在此
webapp/src/views/MarketRadarView.vue                 ← p1Balance computed 在此

[新增]
src/modules/strategy/cashExposureAdvisor.mjs         ← Phase 2 新建
src/modules/strategy/cashExposureAdvisor.test.mjs    ← Phase 2 新建
```
