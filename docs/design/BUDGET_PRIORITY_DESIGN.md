---
type: explanation
status: current
last_updated: 2026-11-10
last_verified: 2026-11-10
tags:
  - design
  - budget
  - priority
wiki_links: []
---

# Budget Priority 系統設計文件

> **適用對象**：投資人、策略開發者、風控人員  
> **版本**：v1.1  
> **對應程式碼**：`src/modules/strategy/policies/budgetLimitPolicy.mjs`  
> **Strategy.json 參數區塊**：`trading.budget`  
> **相關模組**：回測系統 (`src/modules/backtest/`)、模擬器 (`src/modules/simulator/`)、策略引擎 (`src/modules/strategy/`)  
> **更新日期**：2026-11-10  
> **架構說明**：實盤日常排程已於 2026-10-28 移除自動 P1 條件加碼，改為「現金驅動曝險建議」（手動參考）；本文件與 `budgetLimitPolicy.mjs` 所規範之 Tactical Drop / Tactical Panic 配額池保留於回測、前向模擬器與極端情境風控邏輯中。

---

## 1. 核心設計哲學（大眾化說明）

### 為什麼需要 Budget Priority？

> **生活化比喻**：就像家庭理財的「信封制理財法」
>
> - **Baseline DCA（固定費用）**：房租、水電、保費 → **每個月一定要付，不能動用**
> - **Tactical Drop（彈性支出）**：旅遊、大件消費 → **有餘裕才花，沒錢就不買**
> - **Tactical Panic（緊急預備金）**：醫療、突發狀況 → **留一小筆備用，平時不動**

**核心原則**：**先扣固定成本，剩下的才能靈活運用**

---

## 2. 實際執行決策條件表（規則化、可驗證）

### 2.1 參數定義（來自 Strategy.json）

| 參數                        | JSON 路徑                                  | 預設值     | 說明                              |
| --------------------------- | ------------------------------------------ | ---------- | --------------------------------- |
| `maxDailyLoanIncreasePct`   | `trading.budget.maxDailyLoanIncreasePct`   | 0.05 (5%)  | 單日借款增幅上限 = 淨值 × 5%      |
| `maxRollingLoanIncreasePct` | `trading.budget.maxRollingLoanIncreasePct` | 0.15 (15%) | 10天滾動借款增幅上限 = 淨值 × 15% |
| `rollingDays`               | `trading.budget.rollingDays`               | 10         | 滾動計算天數                      |
| `monthlyDcaAmount`          | `lifecycle.monthlyDcaAmount`               | 30000      | 每月 DCA 金額                     |

### 2.2 每日決策流程（判斷順序不可變）

```
┌─────────────────────────────────────────────────────────────┐
│ 每日回測/實盤執行前檢查                                      │
├─────────────────────────────────────────────────────────────┤
│ 步驟 1：計算每日硬上限                                        │
│   dailyCap = netAsset × maxDailyLoanIncreasePct             │
│   範例：1000萬淨值 × 5% = 50萬/日                             │
├─────────────────────────────────────────────────────────────┤
│ 步驟 2：計算滾動可用額度                                       │
│   rollingUsed = max(0, 當前totalLoan - 10天前totalLoan)      │
│   rollingCap = netAsset × maxRollingLoanIncreasePct          │
│   rollingAvailable = rollingCap - rollingUsed                │
│   若 rollingAvailable < 0 → 設為 0                            │
├─────────────────────────────────────────────────────────────┤
│ 步驟 3：每日總可用額度（取較小者）                              │
│   dailyAvailable = min(dailyCap, rollingAvailable)           │
│   若 dailyAvailable ≤ 0 → 全天禁止新增借款                    │
├─────────────────────────────────────────────────────────────┤
│ 步驟 4：Baseline DCA 預留（最高優先權）                        │
│   dailyDcaReserve = monthlyDcaAmount / 20                    │
│   ※ 固定按 20 個交易日均分，不依實際交易日數                 │
├─────────────────────────────────────────────────────────────┤
│ 步驟 5：Tactical 可用池                                        │
│   tacticalPool = max(0, dailyAvailable - dailyDcaReserve)    │
│   若 tacticalPool ≤ 0 → 僅允許 Baseline，禁止所有 Tactical   │
├─────────────────────────────────────────────────────────────┤
│ 步驟 6：依 signalType 分配額度                                  │
│   ┌─────────────────┬─────────────────────────────────────┐  │
│   │ signalType      │ 分配規則                             │  │
│   ├─────────────────┼─────────────────────────────────────┤  │
│   │ baseline        │ min(請求金額, dailyDcaReserve)       │  │
│   │ tactical_drop   │ min(請求金額, tacticalPool × 0.7)    │  │
│   │ tactical_panic  │ min(請求金額, tacticalPool × 0.3)    │  │
│   └─────────────────┴─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 決策輸出標準格式

每個訊號經過 Budget Limit 後，會產出標準化輸出：

```javascript
{
  // 原始請求
  requestedAmount: 150000,      // 策略原本想借的金額
  signalType: "tactical_drop",  // 來自 signalType

  // 額度計算結果
  dailyAvailable: 500000,       // 每日總可用
  dailyDcaReserve: 1500,        // Baseline 預留
  tacticalPool: 498500,         // Tactical 可用池

  // 分配結果
  allowedAmount: 150000,        // 實際允許金額
  isLimited: false,             // 是否受限
  limitedReason: null,          // 受限原因（若有）

  // 透明化資訊（供報表/除錯）
  budgetInfo: {
    dailyCap: 500000,
    rollingAvailable: 1500000,
    dailyDcaReserve: 1500,
    tacticalPool: 498500,
    signalTypePool: "tactical_drop",
    poolAllocationRatio: 0.7,
    poolAmount: 348950,
  }
}
```

---

## 3. 模擬 vs 實操差異對照表

| 維度                  | **回測模擬**                               | **實盤操作**                         | 差異說明                   |
| --------------------- | ------------------------------------------ | ------------------------------------ | -------------------------- |
| **淨值計算**          | 使用回測當日 `netAsset`（含未實現損益）    | 券商提供的帳戶淨值                   | 回測含浮盈虧，實盤可能不含 |
| **10天前借款**        | 直接從 `timeline` 讀取 10 天前 `totalLoan` | 需查詢券商歷史融資餘額               | 回測完整，實盤可能有延遲   |
| **每日額度重設**      | 模擬中每日 00:00 重新計算                  | 實際受限於券商融資額度更新時間       | 實盤可能有幾小時延遲       |
| **Baseline DCA 執行** | 模擬每月固定日自動買入                     | 實際需人工/程式下單，可能延後        | 時間差可能導致價格不同     |
| **融資利率**          | 固定 `loanInterestRate` (2.5%)             | 券商浮動利率，可能每日不同           | 成本試算會有誤差           |
| **額度即時性**        | 模擬中即時知道額度                         | 實際需查詢券商 API，可能有延遲       | 實盤決策可能較慢           |
| **強制平倉風險**      | 僅模擬維持率 < 135% 觸發                   | 實際券商有強制平倉機制，執行價不可控 | 實盤風險更大               |

### 關鍵風險提示

> ⚠️ **模擬永遠比實盤樂觀**
>
> - 模擬假設流動性完美、成交價 = 收盤價、無滑價
> - 實際大跌時流動性枯竭、融資額度被券商收回、強平價格無法控制
> - **建議**：實盤操作時在模擬額度基礎上再打 8 折作為安全緩衝

---

## 4. 參數設定指引（依資產規模調整）

| 資產規模            | `maxDailyLoanIncreasePct` | `maxRollingLoanIncreasePct` | `monthlyDcaAmount` | 適用階段      |
| ------------------- | ------------------------- | --------------------------- | ------------------ | ------------- |
| **< 300 萬**        | 3% (保守)                 | 10%                         | 10,000             | 新手/累積期   |
| **300萬 - 1000萬**  | 5% (標準)                 | 15%                         | 30,000             | 成長期        |
| **1000萬 - 5000萬** | 3% (收斂)                 | 10%                         | 50,000             | 成熟期        |
| **> 5000萬**        | 2% (防守)                 | 8%                          | 100,000            | 防守期/退休前 |

### 調整原則

| 情況                    | 調整方向          | 理由                      |
| ----------------------- | ----------------- | ------------------------- |
| **高波動期 (VIX > 25)** | 所有額度 × 0.5    | 降低槓桿風險              |
| **熊市 (MA60 向下)**    | Tactical 池 × 0.5 | 減少逆勢加碼              |
| **連續獲利 3 個月**     | Tactical 池 × 1.2 | 適度加碼獲利回吐          |
| **維持率 < 160%**       | Tactical 池 = 0   | 優先還款保命              |
| **生命週期 PRE_RETIRE** | Tactical 池 = 0   | 退休前保守期禁止 Tactical |

---

## 5. 實際執行流程圖解

```
每日盤前 (08:30 - 08:45)
│
├─► 1. 讀取帳戶淨值、當前借款、10天前借款
│
├─► 2. 計算三個硬上限
│   ├─ dailyCap = netAsset × 5%
│   ├─ rollingAvailable = (netAsset × 15%) - (當前借款 - 10天前借款)
│   └─ dailyAvailable = min(dailyCap, rollingAvailable)
│
├─► 3. Baseline 預留
│   └─ dailyDcaReserve = 30000 / 20 = 1,500
│
├─► 4. Tactical 池
│   └─ tacticalPool = max(0, dailyAvailable - 1,500)
│
├─► 5. 取得策略訊號
│   ├─ signalType = baseline → 額度 = min(請求, 1,500)
│   ├─ signalType = tactical_drop → 額度 = min(請求, tacticalPool × 0.7)
│   └─ signalType = tactical_panic → 額度 = min(請求, tacticalPool × 0.3)
│
├─► 6. 風控覆寫檢查
│   ├─ 維持率 < 160% → tacticalPool = 0
│   ├─ VIX > 25 → 所有額度 × 0.5
│   ├─ MA60 向下 → tacticalPool × 0.5
│   └─ 生命週期 PRE_RETIRE → tacticalPool = 0（禁止 Tactical 操作）
│
├─► 7. 產出最終決策
│   ├─ 允許金額 = min(策略請求, 分配額度)
│   ├─ 若受限 → 記錄 limitedReason 供報表
│   └─ 送單給券商 API
│
└─► 8. 盤後記錄
    ├─ 寫入 dailyLoanRecord (日期, 新增借款, 還款, 當前總借款)
    └─ 更新 10 天滾動視窗
```

---

## 6. 報表驗證清單（每月檢視）

| 檢視項目                 | 正常範圍   | 異常處理                  |
| ------------------------ | ---------- | ------------------------- |
| **每日額度使用率**       | 30% - 80%  | 長期 > 90% → 調低參數     |
| **Baseline 達成率**      | 100%       | < 90% → 檢查 DCA 執行     |
| **Tactical 觸發頻率**    | 月 3-8 次  | 過頻 → 提高門檻           |
| **Panic 觸發次數**       | 季 0-2 次  | 過多 → 檢查 panic 定義    |
| **額度不足被阻擋次數**   | 月 < 3 次  | 過多 → 調高額度或降低訊號 |
| **Rolling 額度釋放速度** | 10天內歸零 | 遲釋放 → 檢查還款邏輯     |

---

## 7. 快速驗證腳本（開發/除錯用）

```bash
# 1. 檢查參數是否正確載入
node -e "
const { fetchStrategyConfigUnified } = require('./src/modules/strategy/strategyLoader.mjs');
fetchStrategyConfigUnified().then(s => {
  console.log('budget:', JSON.stringify(s.trading?.budget, null, 2));
  console.log('lifecycle:', JSON.stringify(s.lifecycle, null, 2));
});
"

# 2. 執行單日 Budget Limit 測試
node -e "
const { resolveBudgetLimit } = require('./src/modules/strategy/policies/budgetLimitPolicy.mjs');
const ctx = { netAsset: 10000000, totalLoan: 2000000, loan10DaysAgo: 1800000 };
const strategy = require('./data/config/Strategy.default.json');
console.log('baseline:', resolveBudgetLimit(ctx, strategy, 'baseline', 1500));
console.log('tactical_drop:', resolveBudgetLimit(ctx, strategy, 'tactical_drop', 200000));
console.log('tactical_panic:', resolveBudgetLimit(ctx, strategy, 'tactical_panic', 100000));
"
```

---

## 8. 版本控管與變更記錄

| 版本 | 日期       | 變更內容                                                                                  | 影響範圍           |
| ---- | ---------- | ----------------------------------------------------------------------------------------- | ------------------ |
| v1.0 | 2026-08-09 | 初版：分層硬額度 + Baseline 優先                                                          | 全新功能           |
| v1.1 | 2026-11-10 | 新增 P1 移除架構說明；實盤日常排程改為現金驅動曝險建議，Tactical 配額池保留於回測與模擬器 | 架構說明與範圍定義 |
| v1.2 | 規劃中     | 依實盤回饋調整 Panic 比例與加入動態風控覆寫 (VIX/MA60)                                    | 規劃中功能         |

---

## 9. 常見問題 (FAQ)

**Q: 為什麼 Baseline 用 `monthlyDcaAmount / 20` 而不是實際交易日數？**

> A: 為了簡化且穩定。實際交易日數每月 18-22 天變動，會導致每日預留額度波動。固定 20 天讓預算規劃更可預測。

**Q: Tactical Drop 和 Panic 為什麼共用池但分比例？**

> A: 共用池確保總額度不超限；分比例是因為 Panic 機會較少但衝擊大，保留 30% 確保極端行情有彈藥。

**Q: 如果 rollingAvailable 變負數怎麼辦？**

> A: 直接設為 0，表示過去 10 天淨增借款已超過 15% 上限，必須先還款釋放額度才能再借。

**Q: 實盤中券商融資額度不夠怎麼辦？**

> A: 系統只管「策略層面」的額度控制。券商額度是外部硬限制，建議在下單前額外檢查 `可用融資額度 > 請求金額`。

---

## 10. 簽核確認

> **開發完成前請確認以下項目：**
>
> - [ ] Strategy.json 參數已正確設定並部署
> - [ ] `budgetLimitPolicy.mjs` 單元測試通過（含邊界值）
> - [ ] 回測驗證：Budget Limit 不會導致策略完全失效
> - [ ] 實盤模擬：連續 5 個交易日無異常
> - [ ] 文件已同步至團隊知識庫

---

## 11. 系統關聯圖（與模擬/回測/策略引擎的關係）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        InvestmentLineNotify 系統架構                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │   策略引擎核心    │    │   Budget Limit    │    │   風控覆寫層          │  │
│  │ strategyEngine   │───►│  budgetLimitPolicy │───►│  (VIX/MA60/維持率)    │  │
│  │ evaluateSignal   │    │  resolveBudgetLimit│    │  動態調整額度         │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘  │
│           │                       │                           │             │
│           ▼                       ▼                           ▼             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     決策輸出 signals                                 │  │
│  │  { signalType, signalCategory, budgetInfo: {...}, isLimited, ... }   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│           │                       │                           │             │
│           ▼                       ▼                           ▼             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │   即時執行層      │    │   回測系統        │    │   模擬器             │  │
│  │ getInvestment    │    │ runBacktest.mjs  │    │ simulate.mjs         │  │
│  │ SignalAsync      │    │ BacktestRunner   │    │ Forward/Reverse      │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘  │
│           │                       │                           │             │
│           ▼                       ▼                           ▼             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │   通知/記錄層     │    │   回測結果輸出    │    │   Mini App 顯示      │  │
│  │ telegramHtml     │    │ CSV/JSON 報表     │    │ SimulatorView.vue    │  │
│  │ budgetInfo 顯示  │    │ budgetInfo 統計   │    │ 額度使用率圖表       │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  關鍵資料流向：                                                              │
│  1. Strategy.json → strategyLoader → strategyEngine                        │
│  2. evaluateInvestmentSignal → resolveBudgetLimit → signals.budgetInfo     │
│  3. signals → 即時執行 / 回測 / 模擬器 / 通知                              │
│  4. 回測/模擬結果包含 budgetInfo → 報表/圖表/複盤                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 關鍵整合點

| 整合點           | 檔案                                                          | 說明                                                   |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| **策略引擎注入** | `src/modules/strategy/strategyEngine.mjs`                     | `evaluateInvestmentSignal` 中呼叫 `resolveBudgetLimit` |
| **回測系統**     | `src/modules/backtest/backtestRunner.mjs`                     | 每日迴圈中計算額度、記錄 `budgetInfo` 到結果           |
| **模擬器**       | `src/modules/simulator/forwardSimulator.mjs`                  | 模擬時同步套用 Budget Limit 邏輯                       |
| **通知模板**     | `src/modules/notifications/templates/telegramHtmlBuilder.mjs` | 顯示 `budgetInfo` 使用率、受限狀態                     |
| **Mini App**     | `webapp/src/views/SimulatorView.vue`                          | 顯示額度使用率圖表、Baseline/Tactical 分配             |

---

## 12. 專案總覽中的定位（docs/ARCHITECTURE.md 摘要）

> **Budget Priority 系統** 屬於 **風控層 (Risk Control Layer)** 核心組件之一
>
> - **層級**：Priority 2.5 (介於 Gross Leverage P30 與 Valuation Guard P40 之間)
> - **職責**：限制每日/滾動借款增幅，保護 Baseline DCA 不被 Tactical 擠佔
> - **輸入**：`netAsset`、`totalLoan`、`loan10DaysAgo`、`signalType`、`Strategy.json budget 參數`
> - **輸出**：`allowedAmount`、`isLimited`、`budgetInfo` (供決策、回測、模擬、通知、UI 使用)
> - **Strategy.json 熱更新**：支援 `trading.budget`、`lifecycle.monthlyDcaAmount` 即時生效

---

**文件結束** — 此文件為 **單一真實來源**，所有參數皆可在 Strategy.json 熱更新無需重新部署。未來策略微調時請優先參考此文件規劃調整。
