# 功能設計：週/月報訊號準確率統計

> **版本**：v0.2（設計確認完成，待實作）  
> **最後更新**：2026-04-04  
> **對應優化建議**：`optimization_ideas.md` → #5  
> **狀態**：🟠 設計已確認，待開始實作

---

## 一、功能目標

在現有週報與月報中，新增「訊號準確率」統計區塊，回答：

> 「過去這段時間，系統發出買進訊號的次數、以及訊號後的市場實際表現如何？」

---

## 二、確認的設計決策

| # | 問題 | 確認結果 |
|---|---|---|
| Q1 | 「買進訊號」如何定義？ | ✅ 見下方「訊號分類表」 |
| Q2 | 後續價格資料來源？ | ✅ 方案 B：`data/reports/` 內的 `signals.currentPrice`，此欄位已穩定寫入 |
| Q3 | 週報 vs 月報分工？ | ✅ 週報呈現「訊號數量統計」，月報才展示報酬率 |
| Q4 | Telegram 呈現格式？ | ✅ 下方「呈現格式」章節確認版 |
| Q5 | 歷史資料不足時如何處理？ | ✅ 資料不足時暫不顯示或僅呈現現有範圍內結果 |

---

## 三、訊號分類表（Q1 確認版）

依據 `strategyEngine.mjs` 實際分支輸出，訊號分為四層：

| 分類 | 判斷條件 | `target` 包含關鍵字 | 訊號數分母 | 說明 |
|---|---|---|---|---|
| ✅ **觸發買進** | `suggestedLeverage` 存在，或 `targetAllocation.leverage` 存在 | `破冰加碼`、`買進`（分支 3 恐慈 + 分支 7 正常買進） | ✅ 算入分子 + 分母 |
| ⏸️ **冷卻期封鎖** | `cooldownStatus.inCooldown === true` 且 `weightScore >= minWeightScoreToBuy` | `冷卻`、`等待冷卻` | ✅ 分母包含（加碼條件達標但未進場） |
| 🛑 **風控攔截** | 隨時發生，一票否決 | `風控`、`再平衡`、`追繳`、`泡沫`、`防突` | ❌ 不計入分母 |
| ⚪ **中性觀望** | 分數/跌幅未達標、偶熱、轉弱 | `觀望`、`等待`、`過熱`、`禁止撥款` | ❌ 不計入分母 |

**實作判斷邏輯（優先度依序）**：

```js
// isBuySignal(report): boolean
function isBuySignal(signals) {
  // 方法 1：橏橄 suggestedLeverage（恐慈加碼）或 targetAllocation.leverage（正常買進）
  if (signals.suggestedLeverage > 0) return true;
  if (signals.targetAllocation?.leverage > 0) return true;
  // 方法 2：備用 target 字串匹配（防御性）
  return /破冰加碼|買進訊號/.test(signals.target ?? "");
}

// isCooldownBlocked(report): boolean  
function isCooldownBlocked(signals) {
  return (
    signals.cooldownStatus?.inCooldown === true &&
    (signals.weightScore ?? 0) >= (signals.strategy?.buy?.minWeightScoreToBuy ?? 4)
  );
}
```

> 注：恐慈加碼（分支 3）不受冷卻期限制，直接誤呈現 `suggestedLeverage`，因此此分支可跟分支 7 統一用同一判斷邏輯。

---

## 四、新增輸出欄位（strategyEngine.mjs）

為了將「訊號判斷」相關欄位集中，公正在 `strategyEngine.mjs` 的最終 `return` 袒小調整一處：

### 現有正常買進分支（分支 7）輸出空間

```js
// 現有：仅在 buildDecision() 內 spread targetAlloc
// ...
targetAllocation: targetAlloc,  // 已存在
```

現有正常買進分支已回傳 `targetAllocation`，恐慈加碼分支已回傳 `suggestedLeverage`。  
✅ **不需要修改 `strategyEngine.mjs`，現有輸出已足夠。**

---

## 五、實作規劃

### 5.1 新增函式：`buildSignalAccuracyStats()`

**位置**：`src/modules/ai/periodReportAgent.mjs`，在 `buildPeriodStats()` 後方新增為尌層專屬函式。

```
buildSignalAccuracyStats(targetReports, priceSeriesReports)
```

| 參數 | 說明 |
|---|---|
| `targetReports` | 欲評估的期間 reports（週報 = 7 天，月報 = 30 天），用於找出訊號日 |
| `priceSeriesReports` | 包含進一步未來日期的 reports（月報需少 50 天），用於查詢報酬價格 |

**輸出結構**：

```js
{
  // 訊號數量統計（週報 + 月報）
  buySignalCount: 5,          // 實際發出買進訊號次數
  cooldownBlockedCount: 3,    // 冷卻期封鎖次數（分母）
  totalEligibleDays: 8,       // buySignalCount + cooldownBlockedCount
  cooldownBlockRate: 0.375,   // 3/8，有多少达標日被封鎖

  // 報酬率計算（月報專用，週報 = null）
  signalDetails: [
    {
      date: "2026-03-10",
      weightScore: 6,
      leveragePct: 40,          // targetAllocation.leverage * 100 或 suggestedLeverage * 100
      isBuySignal: true,
      priceAtSignal: 18.5,
      returns: {
        d5:  { price: 19.2, pct: +3.78, available: true },
        d10: { price: 19.8, pct: +7.03, available: true },
        d20: { price: 20.1, pct: +8.65, available: true },
      }
    },
  ],
  avgReturn: { d5: +2.3, d10: +3.1, d20: +4.8 },  // null 就暫不顯示
  winRate:   { d5: 0.80, d10: 0.80, d20: 1.00 },   // null 就暫不顯示
  dataNote: null,   // 資料不足時填入說明，如 "+20日資料尚不充足，展示範圍：+5日"
}
```

**資料不足時處理邏輯**：

```js
function lookupReturnPrice(signalDate, dayOffset, priceSeriesMap) {
  // priceSeriesMap: { "2026-03-10": 18.5, ... } (date -> currentPrice)
  // 從後往前排找第 N 個有效交易日的 report
  // 找不到就回傳 null，不呈現此天數的報酬率
  ...
  return { price, available: price !== null };
}
```

---

### 5.2 修改範圍

| 檔案 | 異動內容 |
|---|---|
| `src/modules/ai/periodReportAgent.mjs` | **新增** `buildSignalAccuracyStats()`、`isBuySignal()`、`isCooldownBlocked()` |
| `src/modules/notifications/templates/periodReportBuilder.mjs` | **新增** `buildAccuracySection()` 格式化函式，嵌入週報/月報訊息 |
| `src/runWeeklyReport.mjs` | `loadRecentReports(7)` 保持不變，傳入 `accuracyStats` 展示訊號數量 |
| `src/runMonthlyReport.mjs` | `loadRecentReports(50)` 讀取深度資料，選取後 30 天為 targetReports，前 50 天為 priceSeriesReports |

### **不**需要異動的檔案

- `src/modules/data/archiveManager.mjs`（現有 `loadRecentReports` 已足夠）
- `src/modules/storage.mjs`（方案 B，不讀 Sheet）
- `src/modules/strategy/strategyEngine.mjs`（不改訊號邏輯）
- `src/modules/strategy/riskManagement.mjs`
- `src/modules/strategy/signalRules.mjs`

---

## 六、Telegram 呈現格式（確認版）

### 週報：新增段落（在現有第一則訊息內新增）

```
📊 訊號回顧（本週）

訊號觸發：2 次  │  冷卻期封鎖：1 次
（訊號後報酬率下週月報公佈）
```

### 月報：新增第三則訊息

```
🎯 訊號準確率回顧（本月）

觸發買進訊號：5 次 ｜ 冷卻期封鎖：3 次
達標日封鎖率：37.5%（3/8 天）

✅ 報酬率（均值）
  +5 日：+2.3%（2/5 屬於不完整資料）
  +10 日：+3.1%
  +20 日：資料不足，暫不顯示

勝率（+5 日正報酬）：4/5 ｜ 80%

詳細：
  2026-03-10 》 +3.78% ｜ 槓桿 40%
  2026-03-18 》 -1.20% ｜ 槓桿 30%
  ...
```

> 負報酬日使用 `》 −` 標記，等待進一步檢視實際格式。

---

## 七、資料流設計

```
runMonthlyReport.mjs
  └─ loadRecentReports(50)  →  allReports[0..49]
       ├─ targetReports  = allReports[最後 30 天]
       └─ priceSeriesReports = allReports[全部 50 天]

buildSignalAccuracyStats(targetReports, priceSeriesReports)
  └─ 進行訊號分類（isBuySignal / isCooldownBlocked）
  └─ 對每個買進訊號日在 priceSeriesMap 中尋找 +5/+10/+20 日價格
  └─ 計算報酬率 + 勝率，資料不足的 N 日標記 available: false
  └─ 回傳 accuracyStats

runWeeklyReport.mjs
  └─ loadRecentReports(7)  →  reports
  └─ buildSignalAccuracyStats(reports, reports)  →  僅訊號數量，報酬率 = null
  └─ 展示簡潔統計段落

buildPeriodReportMessages(stats, aiSummary, accuracyStats, period)
  └─ 週報：將 accuracyStats 計數嵌入第一則訊息
  └─ 月報：新增第三則訊息呈現報酬率
```

---

## 八、實作順序建議

1. **Step 1** — `periodReportAgent.mjs` 新增 `isBuySignal()` / `isCooldownBlocked()` / `buildSignalAccuracyStats()`，先對歷史 reports 距离测試輸出是否正確
2. **Step 2** — `periodReportBuilder.mjs` 新增 `buildAccuracySection()` HTML 格式化區塊
3. **Step 3** — `runMonthlyReport.mjs` 調整 `loadRecentReports(50)` 并傳入 `buildSignalAccuracyStats`
4. **Step 4** — `runWeeklyReport.mjs` 傳入簡潔計數版
5. **Step 5** — `buildPeriodReportMessages()` 新增 `accuracyStats` 參數，週報嵌入第一則、月報新增第三則

---

## 九、討論記錄

### 2026-04-04（v0.1 初版草稿）
- 確認現有 `data/reports/` 快照結構足以支撐此功能
- 識別四個核心設計決策點（Q1~Q5）

### 2026-04-04（v0.2 設計確認）
- **Q1**：訊號分類改用「`suggestedLeverage` 或 `targetAllocation.leverage` 存在」為主判斷依據，`target` 字串匹配為備用
- **Q2**：確認方案 B，`signals.currentPrice` 已穩定寫入
- **Q3**：週報呈現訊號數量，月報展示報酬率，分工確認
- **Q4**：呈現格式確認（週報欄內嵌入 + 月報新第三則）
- **Q5**：資料不足暫不顯示或僅呈現現有範圍內結果，新增 `available` 標記處理
- 新增實作順序計劃（Step 1~5）
