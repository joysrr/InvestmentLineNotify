---
type: reference
status: current
last_updated: 2026-11-10
last_verified: 2026-11-10
related_code:
  - src/modules/strategy/strategyEngine.mjs
  - src/modules/strategy/theoreticalEngine.mjs
  - src/scheduler/dailyCheckTheoreticalAdapter.mjs
tags:
  - strategy
  - signals
  - technical-analysis
wiki_links:
  - [[AI News]]
---

# 決策引擎 (`strategyEngine.mjs`)

`src/modules/strategy/` 是整個系統的心臟。它不會發送任何 HTTP Request，它只負責接收從 Providers 整理好的 `MarketData`，套用 `Strategy.json` 的參數，然後吐出最終行動建議 (`signals`)。

**相關架構文檔**:

- 👉 **[Theoretical Framework (投資理論框架)](../architecture/theoretical-framework.md)** - 五大理論模組完整說明與決策整合規劃

## 1. 決策優先鏈 (Decision Priority Chain)

Strategy Engine 採用 **優先級鏈式決策架構**，依序執行 11 個決策規則，第一個回傳結果的規則即終止後續執行。

### 執行邏輯

1. **Priority 排序**: 規則依 priority 升序執行 (P0 → P100，數值越小越優先)
2. **早期終止**: 第一個回傳 non-null 的規則即終止後續規則
3. **狀態共享**: 規則間透過 `engineState` 共享狀態 (如 Regime 判斷結果)
4. **Fallback 保證**: `ScoringDecisionRule` (P100) 作為最後規則，總是回傳結果

> **例外：狀態注入規則**  
> `RegimePolicyRule` (P0) 在 `crisis_accumulate` 恐慌加碼模式時，僅注入 `engineState.crisisAccumulateMode = true` 與 `engineState.debtMode = "OPPORTUNITY"` 並回傳 `null`，不終止決策鏈。後續規則（如 `EntryGateRule` P50）必須主動檢查此旗標並放行，交由後續規則與 `CashExposureAdvisor` 計算自適應批次，否則 `crisis_accumulate` 狀態會被底倉過濾器截斷。

### Decision Rules 完整清單

| Priority | Rule                    | 功能                | 觸發條件                           |
| -------- | ----------------------- | ------------------- | ---------------------------------- |
| **P0**   | `RegimePolicyRule`      | Regime 硬條件封鎖   | 熊市 + 特定條件 → 禁止進場         |
| **P10**  | `MarginLayerRule`       | 維持率 4 層狀態機   | 維持率 < 160% → 觸發保護/斷頭      |
| **P20**  | `LifecycleLeverageRule` | 生命週期槓桿封鎖    | PRE_RETIRE 階段 → 禁止槓桿         |
| **P30**  | `GrossLeverageRule`     | Gross Leverage 警戒 | 綜合槓桿 > 硬上限 → 強制降槓       |
| **P40**  | `ValuationGuardRule`    | 估值守衛            | 估值過高 → 限制加碼                |
| **P50**  | `EntryGateRule`         | EntryGate 前置過濾  | 市場條件不符 → 禁止進場            |
| **P60**  | `StopLossTrailingRule`  | 停損/移動停利       | 00675L 觸發停損條件 → 賣出         |
| **P70**  | `ValuationBubbleRule`   | 估值泡沫警戒        | PB ≥ 2.2 → 停止加碼 00675L         |
| **P80**  | `RebalanceRule`         | 再平衡              | 配置偏離目標 → 調整部位            |
| **P90**  | `ConversionGuardRule`   | 階梯式獲利轉化      | 00675L 獲利達標 → 轉化為 0050      |
| **P100** | `ScoringDecisionRule`   | 評分驅動決策 (最後) | 依 weightScore 產生決策 (Fallback) |

### 設計哲學

- **防禦優先**: 風險控制規則 (P0-P30) 優先於進攻規則
- **明確邊界**: 每個規則職責單一，避免邏輯耦合
- **可擴展**: 透過 Builder Pattern 輕鬆新增/移除規則

為確保資金安全，系統採由上而下的優先權覆寫機制（Priority Chain）。只要上層條件觸發，就會提早 `return`，絕對不給底層戰術執行的機會：

1. **[P0] 市場環境硬條件 (`determineRegime`)**：偵測 VIX 與市場情緒。DEFENSE 模式（有借款）進入 CRISIS 時強制 Sell-only；OPPORTUNITY 模式（無借款）進入 CRISIS 時轉為 crisis_accumulate，僅注入狀態不終止決策鏈。
2. **[P1] 維持率狀態機 (`evaluateMarginLayer`)**：一旦維持率低於門檻，啟動 4 層防禦姿態 (包含強制停損與禁止買進)。
3. **[P2] 總槓桿率控管 (`evaluateGrossLeverage`)**：確保總槓桿倍數不超過設定閥值 (例如 1.8x)。
4. **[P2.5] 生命週期槓桿引擎 (`computeLifecycleContext`)**：根據年齡自動判定階段，動態調整該階段的 `maxLeverage` 上限。
5. **[P3] 估值守衛 (`resolveValuationGuard`)**：偵測大盤 PB 是否過高，啟動過熱防禦機制。若身處安全區且 MACD 動能強勢，則啟動 **Valuation Momentum Synergy (共振加碼)** 來主動升級戰術階層。
6. **[P4] 跌幅前置過濾 (`resolveEntryGate`)**：依據市場跌幅與 RSI 將資金分層阻擋，未達跌幅不可買入。
7. **[P5] 停損與移動停利 (`computeTrailingStop`)**：若觸發技術面 MA20 停損或移動停利錨點，強制減碼。
8. **[P6] 泡沫阻斷 (`pbValue >= 2.2`)**：無條件停止任何買進行為。
9. **[P7] 比例再平衡**：00675L 佔比超過設定閾值時，強制減碼至目標比例。
10. **[P8] 戰術矩陣 (`generateScoringMatrix`)**：若上述風險皆未觸發，進入計分矩陣，由多項技術指標 (MACD, KD, RSI) 決定加減碼力道。

## 2. 資金協同與預算控制

即便進入了 P8 的戰術加碼，仍受制於 `resolveBudgetSynergy` 進行預算攔截。

- **10 日滾動預算**：系統會計算近 10 天的歷史總借貸增幅，超過上限時將自動按比例縮減 (`scalingRatio`) 當日的買入金額，以防止在快速下跌段過早打光子彈。

## 3. 子模組結構 (`src/modules/strategy/`)

- `core/`：包含維持率與估值守衛等絕對核心的防禦機制。
- `policies/`：包含入場邏輯、VIX 情緒短路與預算控制等營運策略。
- `indicators.mjs`：純函數計算 MA, MACD, RSI, KD, ATR 等技術指標。
- `signalGenerator.mjs`：產生計分矩陣的分數。
- `strategySchema.mjs`：定義 `Strategy.json` 的 Schema 校驗規格。

## 4. 槓桿欄位定義 (Leverage Metrics)

系統中存在不同維度的槓桿指標，其計算公式與語意分流如下：

- **`grossLeverage`（市場有效曝險槓桿）**：
  - **公式**：`(0050 市值 × 1 + 00675L 市值 × 2 + 現金等價物) / 帳戶淨資產`
  - **語意**：反映投資組合真實承受的市場波動放大倍數。
  - **呈現**：Telegram 每日卡片與 Mini App 駕駛艙主要顯示此數值。
- **`actualLeverage`（會計借貸資產槓桿）**：
  - **公式**：`總資產 (Gross Asset) / 帳戶淨資產 (Net Asset) = (Net Asset + Total Loan) / Net Asset`
  - **語意**：反映帳戶外部借貸資金放大的倍數。在無借貸（`totalLoan = 0`）時數值恆等於 `1.0`。
- **`currentLeverage`（理論對照現行槓桿）**：
  - 於 `theoreticalShadow.theory` 中使用，定義與 `grossLeverage` 一致，供理論建議槓桿對比使用。

## 5. 測試覆蓋

### theoreticalEngine (src/modules/strategy/theoreticalEngine.mjs)

- **函數覆蓋**: 9/9 (100%)
- **測試檔案**: `src/test/unit/modules/strategy/theoreticalEngine.test.mjs`
- **測試狀態**: 完整覆蓋所有計算函數 ✅

### dailyCheckTheoreticalAdapter (src/scheduler/dailyCheckTheoreticalAdapter.mjs)

- **測試檔案**: `src/test/unit/scheduler/dailyCheckTheoreticalAdapter.test.mjs`
- **測試案例**: 5 個場景
  - portfolioSnapshot UNAVAILABLE → 提前返回
  - 價格快照缺失 → UNAVAILABLE
  - 所有計算成功 → 完整 theory 物件
  - humanCapital 失敗 → 部分降級 (該欄位 null)
  - Laplace/Tobin 失敗 → 優雅降級 (對應欄位 null)
- **測試狀態**: 關鍵路徑完整覆蓋 ✅

### dailyCheck 排程器

- **測試檔案**: `src/test/unit/scheduler/dailyCheck.test.mjs`
- **測試案例**: 16 個 (含非交易日 fallback、signals 複製邏輯)
- **測試狀態**: 核心流程完整覆蓋 ✅

**最後更新**: 2026-11-01
