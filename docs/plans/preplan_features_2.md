# 功能設計：週/月報訊號準確率統計

> **版本**：v0.1 草稿（討論中）  
> **最後更新**：2026-04-04  
> **對應優化建議**：`optimization_ideas.md` → #5  
> **狀態**：🟡 設計討論中，尚未實作

---

## 一、功能目標

在現有週報與月報中，新增一個「訊號準確率」統計區塊，回答以下問題：

> 「過去這段時間，系統發出買進訊號的次數、以及訊號後的市場實際表現如何？」

此功能讓使用者能客觀評估策略的有效性，而不只是看 AI 的主觀總結。

---

## 二、現有資料基礎分析

### 已有的資料

| 資料 | 來源 | 內容 |
|---|---|---|
| 每日 report 快照 | `data/reports/YYYY-MM-DD.json` | `signals.target`、`signals.weightScore`、`signals.cooldownStatus`、`signals.overheat`、`signals.macroMarketDirection` 等 |
| 每日持倉與市值 | Google Sheet「通知紀錄」 | `00675L市值`、`0050市值`、`總淨資產`（可推算每日收盤後資產變動） |
| `buildPeriodStats()` | `periodReportAgent.mjs` | 已統計 `consistency`、`signalQuality`（月報）、`cooldown.blockedDays` 等 |

### 目前缺少的

| 缺少項目 | 說明 |
|---|---|
| **訊號後 N 日價格** | `signals` 快照不含「訊號當日之後」的價格，無法在同一份 report 裡計算後續報酬 |
| **「觸發買進」的明確定義** | `target` 欄位有多種值（`⚡ 破冰加碼`、`📈 買進訊號` 等），需統一定義哪些算「買進訊號」 |
| **每日收盤價序列** | 需要對照訊號日的 +5/+10/+20 日收盤價，計算報酬率 |

---

## 三、核心設計問題（待討論）

### ❓ 問題 1：「買進訊號」如何定義？

目前 `target` 的值依策略引擎分支不同，有多種字串（含 emoji）。**請確認以下分類是否正確**：

| 分類 | `target` 包含的關鍵字 | 說明 |
|---|---|---|
| ✅ **觸發買進** | `破冰加碼`、`買進訊號`（`weightScore >= minWeightScoreToBuy`） | 實際發出買進建議 |
| ⏸️ **冷卻期封鎖** | `冷卻`，或 `cooldownStatus.inCooldown === true` | 分數達標但被冷卻期擋下 |
| 🛑 **風控攔截** | `再平衡`、`維持率`、`追繳`、`估值泡沫` | 風控優先，不考慮進場 |
| ⚪ **中性觀望** | 其餘（`觀望`、`持倉監控` 等） | 無明確進場建議 |

> **討論點**：「冷卻期封鎖」是否應算進「訊號準確率」分母？（它的意思是：分數達標但沒進場）

---

### ❓ 問題 2：後續表現的資料來源？

計算「訊號後 +5/+10/+20 日報酬率」需要每日 00675L 收盤價序列。現有兩個方案：

**方案 A：從 Google Sheet「通知紀錄」讀取**
- ✅ 已有每日 `00675L市值` 欄位（但這是「市值」不是「收盤價」，需搭配「股數」反推）
- ⚠️ 股數可能在期間內異動（買賣），反推收盤價不可靠
- ⚠️ 需要新增讀取歷史多筆的 `storage.mjs` API

**方案 B：從 `archiveManager` 的 `data/reports/` 讀取**
- ✅ 每份 report 已有 `signals.currentPrice`（00675L 即時/收盤價）
- ✅ 無需新增資料來源，直接讀現有快照
- ✅ `loadRecentReports()` 已支援讀取指定天數範圍

> **建議採用方案 B**，邏輯最乾淨。確認：`data/reports/` 每日 report 中是否穩定包含 `signals.currentPrice`（00675L 價格）？

---

### ❓ 問題 3：要計算哪些「後續天數」的報酬率？

初步建議：**+5 日、+10 日、+20 日**（對應一週、兩週、一個月後）。

- 週報：只計算 +5 日（因為資料範圍只有 7 天，+10/+20 需要往回看更長歷史）
- 月報：計算 +5 / +10 / +20 日三種

> **討論點**：週報是否要往回讀超出 7 天的歷史來計算 +10/+20 日報酬？  
> 還是週報只呈現「訊號數量統計」，月報才做報酬率計算？

---

### ❓ 問題 4：統計結果如何呈現在 Telegram？

初步構想（月報新增第三則訊息，週報在現有第一則後方新增段落）：

```
📊 訊號準確率回顧（過去 30 日）

觸發買進訊號：5 次
冷卻期封鎖：3 次（分數達標但未進場）

✅ 訊號後平均報酬率
  +5 日：+2.3%（5 次均值）
  +10 日：+3.1%
  +20 日：+4.8%

勝率（+5 日正報酬）：4/5（80%）
```

> **討論點**：訊號後「負報酬」是否需要特別標示或警告？避免誤以為系統完美。

---

## 四、初步規劃的實作範圍

> 以下待討論確認後更新。

### 新增函式（`periodReportAgent.mjs`）

```
buildSignalAccuracyStats(reports, allHistoricalReports)
```

- 輸入：近期 reports（定義訊號區間） + 包含未來日期的 reports（計算後續報酬）
- 輸出：

```js
{
  buySignalCount: 5,          // 觸發買進訊號天數
  cooldownBlockedCount: 3,    // 冷卻期封鎖天數
  signalDetails: [
    {
      date: "2026-03-10",
      weightScore: 6,
      priceAtSignal: 18.5,
      returns: {
        d5:  { price: 19.2, pct: +3.78 },
        d10: { price: 19.8, pct: +7.03 },
        d20: { price: 20.1, pct: +8.65 },
      }
    },
    ...
  ],
  avgReturn: { d5: +2.3, d10: +3.1, d20: +4.8 },
  winRate:   { d5: 0.80, d10: 0.80, d20: 1.00 },
}
```

### 修改範圍

| 檔案 | 異動 |
|---|---|
| `src/modules/ai/periodReportAgent.mjs` | 新增 `buildSignalAccuracyStats()` 函式 |
| `src/modules/notifications/templates/periodReportBuilder.mjs` | 新增訊號統計段落的 Telegram HTML 格式化 |
| `src/runWeeklyReport.mjs` | 傳入較長的歷史 reports（若週報需 +10/+20 日計算） |
| `src/runMonthlyReport.mjs` | 傳入較長的歷史 reports 給準確率計算 |

### **不**需要異動的檔案

- `src/modules/data/archiveManager.mjs`（現有 `loadRecentReports` 已足夠，僅需調整呼叫天數）
- `src/modules/storage.mjs`（方案 B 不讀 Sheet）
- `src/modules/strategy/strategyEngine.mjs`（不改訊號邏輯）

---

## 五、待確認清單

| # | 問題 | 狀態 |
|---|---|---|
| Q1 | 「買進訊號」的 `target` 關鍵字分類是否正確？ | ⬜ 待確認 |
| Q2 | 採用方案 B（`data/reports/` 內 `signals.currentPrice`）？ | ⬜ 待確認 |
| Q3 | 週報只做訊號數量統計，月報才做報酬率計算？ | ⬜ 待確認 |
| Q4 | Telegram 呈現格式確認 | ⬜ 待確認 |
| Q5 | 計算報酬率時，需要往回讀幾天的歷史 reports？（月報 +20 日需讀 50 天） | ⬜ 待確認 |

---

## 六、討論記錄

### 2026-04-04（初版草稿）
- 確認現有 `data/reports/` 快照結構足以支撐此功能
- 識別四個核心設計決策點（Q1~Q4）
- 待與開發者逐一確認後更新本文件
