---
type: reference
title: 目前投資系統理論與可擴充研究指南
description: 以程式碼、設定、測試與現行文件核對 InvestmentLineNotify 已套用的投資理論、風控方法及未來研究接入規格。
status: current
last_updated: 2026-10-23
last_verified: 2026-10-23
tags:
  - investment-theory
  - risk-control
  - leverage
  - research
wiki_links: []
---

# 目前投資系統理論與可擴充研究指南

> 本文件是研究入口，不是投資建議。所有「已套用」判定均以目前 repository 的實際程式碼與設定為準；「研究中」不代表已接入正式決策流程。

## 1. 文件目的

這份文件回答三個問題：

1. 系統現在實際用了哪些理論或風控方法？
2. 每個方法如何輔助 0050、00675L、借款與預備金決策？
3. 研究新公式時，如何判斷能否安全接入系統？

系統的核心原則不是預測每天漲跌，而是：

- 維持 P0 固定 DCA，不讓短期警報任意中斷基礎投資。
- 對 00675L 與新增借款採更嚴格的風險閘門。
- 重大風險資料不足時採保守封鎖，不能把缺失資料當成零風險。
- 優先輸出提醒與限制，不自動下單。

## 2. 快速分類

| 分類                          | 系統目前狀態              | 主要用途                                                         |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------- |
| 00675L 產品曝險模型           | 已實作                    | 把 00675L 的名目市值轉為約 2 倍方向曝險，計算 Gross Leverage     |
| Gross Leverage 雙層上限       | 已實作                    | 主動禁止新增槓桿；超過危機線時要求降槓                           |
| 維持率四層狀態機              | 已實作                    | 依帳戶維持率區分正常、預備金防禦、高危凍結、斷頭危機             |
| 00675L 佔比再平衡             | 已實作                    | 00675L 超過設定比例時，回到目標比例                              |
| 生命週期投資                  | 已實作                    | 依年齡與距離退休限制槓桿上限                                     |
| 估值百分位守衛                | 已實作                    | PB 歷史百分位過高時壓縮或阻止槓桿加碼                            |
| 估值／VIX／趨勢動能           | 已實作，但屬風控調整      | 以 PB 百分位、動能、VIX 與 ATR 輔助降低曝險                      |
| 宏觀市場 Regime               | 已實作                    | 依 MA60、斜率、VIX 與融資過熱切換交易模式與阻尼                  |
| 隔夜衝擊雷達                  | 已實作                    | 以 SOX、TSM ADR、台指夜盤與歷史 z-score 提前凍結 00675L          |
| 融資沉澱雷達                  | 已實作                    | 維持率低且融資快速下降時，偏向 0050 左側分批，凍結 00675L        |
| 極端恐慌與 Triple-Gate        | 已實作                    | 恐慌時凍結 00675L；VIX 回落、峰值回落及站回 5MA 後才考慮右側解鎖 |
| Kelly／半 Kelly／動態合理槓桿 | 研究中，未接入正式 sizing | 可作產品成本與模型不確定性的研究框架，不能直接使用固定倍數       |

## 3. 已套用理論與方法

### 3.1 產品曝險與 Gross Leverage

#### 核心概念

00675L 的系統模型使用固定 `2` 倍方向曝險係數：

```text
grossLeverage = (0050 市值 + 00675L 市值 × 2) / 帳戶淨值
```

實作位置：

- `src/modules/strategy/leverageMonitor.mjs`
- `src/modules/strategy/strategyDefaults.mjs`
- `src/modules/strategy/decision/rules/GrossLeverageRule.mjs`

#### 如何輔助使用

它回答的是「目前帳戶承擔多少名目方向曝險」，不是「未來一定會賺多少」。

- `ceiling`：超過後禁止新增借款與 00675L。
- `hardCap`：超過後進入強制降槓警示，降至 `recoveryTarget`。
- 輸入不合法或淨值小於等於零：計算錯誤，保守封鎖加碼。

#### 研究時的注意事項

這個公式把 00675L 估作 2 倍「方向曝險」，沒有宣稱長期報酬恆為 2 倍。它尚未等同納入每日重設、波動耗損、追蹤誤差與流動性衝擊；這些因素應留在產品風險層，不應偷偷當成已完成的報酬模型。

---

### 3.2 維持率狀態機與保證金風控

#### 核心概念

系統使用四層維持率狀態：

```text
維持率 < marginCallThreshold  → critical
維持率 < frozenZone           → frozen
維持率 < protectTrigger       → protect
其他                          → normal
```

預設值由 `strategy.maintenance` 提供；程式預設為：

- `marginCallThreshold = 135%`
- `frozenZone = 145%`
- `protectTrigger = 160%`
- `protectTarget = 180%`

實作位置：

- `src/modules/strategy/core/marginStateMachine.mjs`
- `src/modules/strategy/decision/rules/MarginLayerRule.mjs`

#### 如何輔助使用

- `critical`：禁止所有加碼，補保證金或降槓。
- `frozen`：禁止新進場，計算補至解凍線的資金缺口。
- `protect`：優先補足擔保品或預備金；允許基礎 0050 DCA，但暫停 00675L 加碼。
- `normal`：交由其他風控規則繼續判斷。

這是「不破產優先」的安全層，優先級高於追求報酬。

#### 重要邊界

程式中的 `frozen` 文字目前會包含「0050 DCA 凍結」；這與系統長期原則「P0 固定 DCA 不因短期警報停止」需要在產品規格與訊息文案層持續核對。研究文件不將兩者混為同一件事。

---

### 3.3 00675L 佔比再平衡

#### 核心概念

當 00675L 佔淨資產比例超過 `z2RatioHigh`，系統計算回到 `z2TargetRatio` 所需的減碼金額：

```text
targetZ2Value = netAsset × z2TargetRatio
sellAmount = max(0, currentZ2Value - targetZ2Value)
```

實作位置：

- `src/modules/strategy/decision/rules/RebalanceRule.mjs`

#### 如何輔助使用

這是固定目標比例的再平衡方法：

- 上漲使 00675L 佔比過高：減碼並還款。
- 風險上升但比例尚未超標：由其他雷達與狀態機處理。
- 它不是 Kelly，也不是市場預測器。

研究新公式時，應先確認新公式是要改「目標比例」、改「風險上限」，還是改「觸發警報」。三者不能直接混成一個數字。

---

### 3.4 生命週期投資與槓桿遞減

#### 核心概念

系統依目前年齡、退休年齡與生命週期 profile 決定階段上限：

```text
currentGrossLeverage > stageMaxLeverage
→ 封鎖並要求降低槓桿
```

若市場 Regime 為 `CAUTIOUS`，則會使用調整後上限。

實作位置：

- `src/modules/strategy/lifecycleEngine.mjs`
- `src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs`

#### 如何輔助使用

這個方法不是預測市場，而是把「可承受風險」與「距離使用資金的時間」連接：

- 距離退休較遠：可容許較高階段上限，但仍受維持率與 Gross Leverage 限制。
- 接近退休：降低可接受槓桿，避免回撤沒有時間修復。
- 0050 基礎 DCA 與 00675L 高槓桿操作必須分開處理。

---

### 3.5 估值百分位守衛與均值回歸假設

#### 核心概念

系統把目前 PB 與歷史 PB 序列比較，計算 Percentile Rank：

```text
currentPR = current PB 在歷史 PB 排序中的百分位
```

依設定的 percentile tiers 取得槓桿乘數。另有高估區動能修正：

- PR 達高估區：檢查 PB 百分位一階變化。
- 動能加速：乘上懲罰乘數。
- 動能放緩：有限度恢復。
- PR 達極度高估門檻：套用較強壓縮。
- VIX 急升或絕對值高：再降低乘數。

實作位置：

- `src/modules/strategy/core/valuationGuard.mjs`
- `src/modules/strategy/decision/rules/ValuationGuardRule.mjs`
- `src/modules/strategy/strategyDefaults.mjs`

#### 如何輔助使用

估值守衛的正確用途是「降低高估區新增槓桿」，不是精準預測崩盤日期。它可以：

- 在估值很高且仍加速時壓縮 00675L 加碼。
- 在估值資料缺失時不啟動估值守衛，交由其他安全層處理。
- 與 VIX、趨勢及維持率分開保存證據，方便事後檢查。

目前 `resolveValuationMomentum` 的註解曾指出 `previousVix` 尚待實作，但同檔後續程式已由 `ctx.vixArr` 傳入前一期 VIX；研究時應以實際呼叫鏈與測試結果為準，不只看舊註解。

---

### 3.6 宏觀 Regime、遲滯與阻尼

#### 核心概念

系統用以下資料分類：

- 價格相對 MA60。
- MA60 斜率。
- VIX。
- 5 日融資變化與大盤變化。
- 社群情緒頂背離（作為額外阻尼，不是單獨交易訊號）。

四種狀態：

- `BULL_TREND`：趨勢偏多、波動較低。
- `BULL_VOLATILE`：多頭但波動高。
- `BEAR_PANIC`：恐慌，sell-only，槓桿乘數 0。
- `BEAR_CHOPPY`：陰跌盤整，僅基礎 DCA，成本過濾器啟用。

狀態切換有遲滯：進入危機立即生效；恢復到 `BULL_TREND` 需要連續確認，避免一天資料造成反覆切換。

實作位置：

- `src/modules/strategy/macroRegimeClassifier.mjs`
- `src/modules/strategy/socialSentimentIntegration.test.mjs`

#### 如何輔助使用

遲滯的用途是降低「今天恐慌、明天樂觀」的策略抖動。社群情緒只會在融資過熱時提供額外阻尼，不應被解讀為價格預測器。

---

### 3.7 隔夜衝擊雷達：z-score、P95 與多重確認

#### 核心概念

對 SOX 與 TSM ADR 報酬計算 z-score：

```text
zSox = (rSox - meanSox) / stdSox
zTsm = (rTsm - meanTsm) / stdTsm
shockScore = 0.5 × zSox + 0.5 × zTsm
```

觸發需要同時符合：

- 夜盤資料已驗證。
- SOX 與 TSM ADR 都下跌。
- `shockScore <= -2.0`。
- SOX 絕對跌幅達歷史 P95。

觸發後凍結 00675L；P0 維持執行。

實作位置：

- `src/modules/strategy/radars/overnightShockRadar.mjs`

#### 如何輔助使用

這是「提前發現隔夜傳導風險」的方法，不是預測台股收盤。它把外部市場訊號、歷史異常程度與台指夜盤方向綁在一起，減少單一指標誤報。

資料不足時使用保守先驗門檻；夜盤資料不可信時不把缺失資料當成 0%。

---

### 3.8 融資沉澱雷達

#### 核心概念

需要同時符合：

```text
維持率 < 140% 或低於歷史 P10
且
融資單日變化 <= -1.5%
```

觸發後：

- 0050 可分批左側定錨。
- 00675L 凍結，等待右側確認。
- P0 維持執行。

實作位置：

- `src/modules/strategy/radars/marginSettlingRadar.mjs`

#### 理論定位

它是「融資壓力與被動去槓桿」的事件偵測器，不是估算市場底部的數學證明。低維持率與融資快速下降可能代表壓力釋放，也可能代表風險仍在擴大，因此系統只允許較低風險的 0050 分批行動，不直接開啟 00675L。

---

### 3.9 極端恐慌、左側定錨與 Triple-Gate

#### 極端恐慌觸發

任一條件成立即可觸發：

- VIX ≥ 35，或達歷史 P98。
- 大盤單日跌幅 ≤ -4.5%。
- 季線負乖離 ≤ -12%。

觸發後：

- 嚴格凍結 00675L。
- 允許 0050 左側分批。
- P0 正常執行。

#### 00675L 右側解鎖

三道綠燈必須同時成立：

1. VIX ≤ 28。
2. VIX 相對本波高點回落至少 20%。
3. 大盤收盤站上 5 日均線。

實作位置：

- `src/modules/strategy/radars/extremePanicRadar.mjs`

#### 理論定位

這是「先控制槓桿，再等待市場恢復證據」的狀態機，不是宣稱三個門檻能抓到最低點。它把左側長期核心資產與右側槓桿工具分離，降低在高波動中同時承擔兩種風險。

## 4. 尚未直接套用的理論

### 4.1 Kelly Criterion／半 Kelly

目前 repository 有獨立研究文件：

- `docs/research/leveraged-etf-kelly-dynamic-leverage-review.md`

Kelly 可作為研究框架：

```text
L_kelly ≈ (預期超額報酬 - 資金成本) / 波動率²
```

但不能直接把歷史輸入算出的固定倍數套給 00675L，原因包括：

- 每日重設與路徑依賴。
- 波動耗損與追蹤誤差。
- 產品費用、交易滑移與融資成本不同。
- 維持率與個人現金流限制。
- 報酬與波動率都是估計值，不是常數。

未來若研究接入，應先做只讀回測與成本拆解，初期只輸出研究值或警示，不自動改倉。

### 4.2 L_max／動態合理槓桿

`L_max` 應先定義為風險上限，而不是由 Kelly 自動產生的最適值。研究介面可暫定：

```text
L_current = 00675L 方向曝險 / 投資組合淨資產
L_recommended = min(
  protectiveScale × L_kelly,
  personalCeiling,
  maintenanceRuptureCeiling
)
```

其中 `protectiveScale` 可研究半 Kelly，但不能在未驗證前寫死成正式交易規則。

### 4.3 純技術指標單獨交易

MA、VIX、PB 或單一社群情緒都不能單獨取代現有多重閘門。若研究新指標，必須說明：

- 它是預測訊號、風險訊號，還是執行限制？
- 與現有雷達重複還是提供新資訊？
- 失效時是否會錯誤放行槓桿？

## 5. 研究新理論時的接入模板

每一套新公式先填這些欄位：

```text
理論名稱：
原始問題：預測／配置／風控／執行限制？
數學定義：
輸入資料與來源：
資料頻率：
適用資產：0050／00675L／00740B／借款／其他
輸出型態：分數／比例／倍數／狀態／警報
失效模式：
缺資料時的行為：
與既有規則的關係：新增／覆蓋／否決／僅顯示
是否影響 P0 DCA：
是否可能自動交易：
回測期間與基準：
壓力情境：
驗證測試：
```

### 建議接入順序

1. 先寫研究文件與來源。
2. 明確區分理論輸出與系統決策輸出。
3. 先建立失敗案例與單元測試。
4. 先以只讀 observation mode 執行。
5. 比較新理論與現有雷達是否重複或衝突。
6. 經歷歷史回放、成本敏感度與極端壓力測試。
7. 最後才討論是否進入警報或限制層。

## 6. 驗證邊界與證據

本文件的「已實作」判定來自：

- `src/modules/strategy/` 的實際模組。
- 決策規則與核心計算器。
- 雷達的觸發條件與輸出限制。
- 現行 leading-indicator plan。
- 既有測試與文件索引驗證。

本文件沒有宣稱：

- 任何公式能預測市場最低點或最高點。
- 00675L 長期報酬固定為 2 倍。
- 半 Kelly 能防止大幅回撤或斷頭。
- 歷史門檻在未來必然有效。
- 研究中的動態槓桿已經接入正式交易決策。

## 7. 主要程式對照表

- `src/modules/strategy/leverageMonitor.mjs`：Gross Leverage。
- `src/modules/strategy/core/marginStateMachine.mjs`：維持率狀態機。
- `src/modules/strategy/core/valuationGuard.mjs`：PB 百分位與估值動能。
- `src/modules/strategy/lifecycleEngine.mjs`：生命週期上下文。
- `src/modules/strategy/macroRegimeClassifier.mjs`：市場 Regime 與阻尼。
- `src/modules/strategy/radars/overnightShockRadar.mjs`：隔夜衝擊。
- `src/modules/strategy/radars/marginSettlingRadar.mjs`：融資沉澱。
- `src/modules/strategy/radars/extremePanicRadar.mjs`：極端恐慌與 Triple-Gate。
- `src/modules/strategy/decision/rules/RebalanceRule.mjs`：00675L 佔比再平衡。
- `src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs`：生命週期槓桿上限。
- `src/modules/strategy/decision/rules/MarginLayerRule.mjs`：維持率決策輸出。
- `src/modules/strategy/decision/rules/GrossLeverageRule.mjs`：總曝險決策輸出。
