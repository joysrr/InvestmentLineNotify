---
type: reference
status: current
last_updated: 2026-11-11
last_verified: 2026-09-11
related_code:
  - src/modules/providers/dataSourceConfig.mjs
  - src/modules/providers/providerRegistry.mjs
  - src/modules/providers/marketData.mjs
  - src/modules/strategy/signalGenerator.mjs
  - src/modules/strategy/decision/rules/RegimePolicyRule.mjs
  - src/modules/strategy/policies/interestCostFilter.mjs
  - src/modules/strategy/marketRegimeModel.mjs
related_docs:
  - docs/plans/completed/2026-09-12-MACRO_REGIME_ADVANCED_SPEC.md
  - docs/modules/strategy/regime_policy.md
  - docs/modules/strategy/strategy_engine.md
tags:
  - macro
  - regime
  - analysis
  - architecture
  - inventory
wiki_links:
  - "[[Macro Regime Advanced Spec]]"
  - "[[Strategy Engine]]"
  - "[[Regime Policy]]"
---

# Phase 1: 總經與市場狀態資源盤點與指標量化定義報告

> **目標**: 重複利用專案現有資料結構與 Provider 架構，盤點現有數據資源、分析因子計算方式，並確立四象限狀態轉換的精確量化門檻與遲滯邏輯。

---

## 1. 現有資料資源與 Slot 盤點 (100% 重複利用)

本專案在 `dataSourceConfig.mjs` 與 `providerRegistry.mjs` 中已具備完整的 Slot-based 架構，無須引入額外第三方庫，現有資源完全涵蓋四象限狀態辨識所需之資料流：

| 欄位名稱 (Slot)     | 現有 Provider                                 | 實體資料內容                                 | 對應四象限維度               | 重複利用狀態 |
| ------------------- | --------------------------------------------- | -------------------------------------------- | ---------------------------- | ------------ |
| `rawUsMarket`       | `usMarketFred` (`usMarketProvider.mjs`)       | 美股 VIX 指數、長短天期公債殖利率、信用利差  | **波動軸 (Volatility)**      | ✅ 現成可用  |
| `rawMargin`         | `marginKgi` / `marginFinMind`                 | 台股大盤上市融資餘額、融資增減比率、維持率   | **籌碼過熱阻尼器**           | ✅ 現成可用  |
| `rawValuation`      | `twMarketValuation` (`twseProvider.mjs`)      | 台股大盤本益比 (PE)、股價淨值比 (PB)、殖利率 | **估值位階與泡沫防護**       | ✅ 現成可用  |
| `rawMarketOverview` | `twMarketOverview` (`twseProvider.mjs`)       | 加權指數成交量、成交金額、加權指數點位       | **趨勢軸 (Trend)**           | ✅ 現成可用  |
| `rawStockMargin`    | `stockMarginTwse` (`twseProvider.mjs`)        | 00675L 個股融資融券餘額與變化                | **個股槓桿監控**             | ✅ 現成可用  |
| `rawBankRate`       | `twCentralBankRate` (`macroProvider.mjs`)     | 台灣央行重貼現率 (基準利率 2.0%)             | **持有成本 (Cost of Carry)** | ✅ 現成可用  |
| `rawInstitutional`  | `stockInstitutionalTwse` (`twseProvider.mjs`) | 0050 外資/投信/自營商三大法人買賣超          | **法人資金流向**             | ✅ 現成可用  |

---

## 2. 四象限量化切分指標定義 (Quantitative Metrics)

### 2.1 趨勢軸指標 ($T$)

趨勢判斷整合**大盤長期均線**與**動能斜率**，定義複合趨勢得分 $T_{score} \in [-1, 1]$：

1. **加權指數 vs MA60 (季線)**：
   $$\text{Bias}_{60} = \frac{\text{Close} - \text{MA}_{60}}{\text{MA}_{60}}$$
2. **MA60 60日斜率方向**：
   $$\text{Slope}_{60} = \frac{\text{MA}_{60}[t] - \text{MA}_{60}[t-5]}{5 \times \text{MA}_{60}[t-5]}$$
3. **判定標準**：
   - 多頭趨勢 ($T = \text{BULL}$)：$\text{Bias}_{60} \ge 0$ 且 $\text{Slope}_{60} \ge -0.001$（允許高檔強勢整理）。
   - 空頭趨勢 ($T = \text{BEAR}$)：$\text{Bias}_{60} < 0$ 且 $\text{Slope}_{60} < 0$。

### 2.2 波動軸指標 ($V$)

波動率判斷整合**台股大盤 20 日歷史波動率 (HV20)** 與 **VIX (台指 VIX 或美股 VIX)**：

1. **門檻定義**：
   - **低波動 (Low Vol)**：$\text{VIX} < 20$ 且 $\text{HV}_{20} \le 18\%$。
   - **高波動 (High Vol)**：$\text{VIX} \ge 20$ 或 $\text{HV}_{20} > 18\%$。
   - **極端恐慌 / 危機 (Crisis)**：$\text{VIX} \ge 35$（對齊現有 `RegimePolicyRule` P0 硬阻斷）。

---

## 3. 四象限具體規則與動態權重矩陣映射

```text
┌───────────────────────────┬───────────────────────────┐
│ 狀態 1: BULL_TREND        │ 狀態 4: BEAR_CHOPPY       │
│ • 條件: BULL + Low Vol    │ • 條件: BEAR + Low Vol    │
│ • 特徵: AI/半導體單邊牛市  │ • 特徵: 陰跌盤整、資金退潮 │
│ • 權重分配:               │ • 權重分配:               │
│   - 技術動能: 70% (主導)  │   - 戰術權重全部歸零 (0%) │
│   - 逆勢跌幅: 0%  (忽略)  │   - 實質持有成本濾網: 強制 │
│   - 法人籌碼: 30%         │ • 策略行動:               │
│ • 策略行動: 突破/回測MA20買 │   - 僅執行 0050 固定 DCA   │
│   00675L，吃滿槓桿爆發力   │   - 戰術加碼完全凍結      │
├───────────────────────────┼───────────────────────────┤
│ 狀態 2: BULL_VOLATILE     │ 狀態 3: BEAR_PANIC        │
│ • 條件: BULL + High Vol   │ • 條件: BEAR + High Vol   │
│ • 特徵: 創高震盪、洗盤劇烈│ • 特徵: 流動性恐慌、多殺多 │
│ • 權重分配:               │ • 權重分配:               │
│   - 左側超跌: 60% (主導)  │   - 觸發 P0 CRISIS 硬阻斷 │
│   - 技術動能: 15% (壓低)  │   - 維持率狀態機啟動      │
│   - 融資阻尼器: 強制生效  │ • 策略行動:               │
│ • 策略行動: 不追高，大跌  │   - 強制 Sell-only        │
│   買進，融資暴增則撥款減半│   - 保護質押維持率擔保品  │
└───────────────────────────┴───────────────────────────┘
```

---

## 4. 遲滯機制 (Hysteresis Filter) 設計

為避免大盤在多空臨界線或 VIX 20 附近每日反覆切換姿態（Whip-saw），設計狀態持續期確認機制：

1. **進入防守/降級確認期 (Confirmation Window)**：
   - 進入 `BEAR_CHOPPY` 或 `BULL_VOLATILE`：需連續 **2 個交易日** 滿足門檻始得轉換。
   - 進入 `BEAR_PANIC`：**0 延遲即刻觸發**（安全第一，風控絕不等待確認天數）。
2. **解除防守/升級確認期 (Cooldown & Exit Window)**：
   - 從 `BEAR_CHOPPY` 回到 `BULL_TREND`：需連續 **5 個交易日** 指數站上 MA60 且斜率翻揚。
   - 從 `BULL_VOLATILE` 回到 `BULL_TREND`：需連續 **5 個交易日**（所有回歸 `BULL_TREND` 的轉換皆採 5 天確認期，對照 `macroRegimeClassifier.mjs` line 96）。

---

## 5. 散戶籌碼過熱阻尼器 (Retail Margin Damper) 演算法

- **資料來源**：`rawMargin`（`kgiProvider` / `finmindProvider` 大盤融資餘額）。
- **計算指標**：
  $$\Delta \text{Margin}_{5d} = \frac{\text{MarginBalance}[t] - \text{MarginBalance}[t-5]}{\text{MarginBalance}[t-5]}$$
  $$\Delta \text{Index}_{5d} = \frac{\text{Index}[t] - \text{Index}[t-5]}{\text{Index}[t-5]}$$
- **過熱判斷**：
  若 $\Delta \text{Margin}_{5d} > 2.0\%$ 且 $\Delta \text{Margin}_{5d} > \Delta \text{Index}_{5d} \times 1.5$：
  判定為「散戶槓桿過熱，浮額浮現」。
- **阻尼懲罰**：
  在此狀態下，若觸發 `buy_tactical` 加碼訊號，強制將 `scalingRatio` 乘以 **0.5**（撥款額度減半），防止在多殺多前夕過度開槓桿。

---

## 6. 實質持有成本濾網 (Cost of Carry Filter) 演算法

- **資料來源**：`rawBankRate`（央行重貼現率）+ `Strategy.default.json` 借貸利率。
- **計算公式**：
  $$\text{TotalHoldingCost} = \text{LoanInterestRate} (2.5\%) + \text{CostOfCarrySpread} (1.0\%) = 3.5\%/\text{年}$$
  $$\text{DailyHoldingCost} \approx \frac{3.5\%}{250} \approx 0.014\%/\text{日}$$
- **濾網執行條件**：
  當市場處於 `BEAR_CHOPPY`（低波動陰跌盤整）且過去 20 日大盤年化波動率 $< 12\%$ 時，系統預期持有 00675L 之波段期望值為負。
  此時：
  1. 阻斷所有 `buy_tactical` 加碼（`scalingRatio = 0`）。
  2. 若持有戰術性部位且超過持有上限天數（如 15 日未創新高），輸出戰術結清還款建議。
