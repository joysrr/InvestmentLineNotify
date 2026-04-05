# 優化建議討論區（Optimization Ideas）

> 本文件作為每次架構討論的基礎，持續更新。  
> 每個提案包含動機分析、影響範圍、難度評估，以及討論狀態。  
> 已確認納入的項目請移至 `preplan_features.md`（待實作）或直接進入開發。

---

## 優先度說明

| 標記 | 意義 |
|---|---|
| 🔴 高優先 | 影響資料品質或系統穩定性，建議優先處理 |
| 🟡 中優先 | 能明顯改善使用體驗或觀察深度 |
| 🟢 低優先 | 長期優化方向，可於空閒時評估 |
| ✅ 已完成 | 已實作並更新系統文件 |
| ⚪ 討論中 | 尚未確認方向，需要進一步討論 |

---

## 1. ✅ dailyCheck 流程過長，缺乏逐段計時與錯誤定位

> **已完成**（2026-04-05）  
> 在 `src/utils/coreUtils.mjs` 新增 `stepTimer()` 輕量計時 helper；  
> `src/dailyCheck.mjs` 所有主要步驟（共 14 處）插入 `stepTimer`，GitHub Actions log 現可直接觀察各步驟耗時；  
> 同時修正 fallback `lastState` 補上 `avgCost0050 / avgCostZ2: null`；  
> 系統文件已更新：`docs/modules/core_infrastructure.md` §6 補充 `stepTimer` 說明與使用範例，§7 新增超時排查指引。

### 原始動機

目前 `dailyCheck.mjs` 主函式按序執行 10+ 個步驟，每步驟僅有 `console.log` 標記開始，沒有記錄「每段耗時」。  
當 GitHub Actions 執行超時或中途失敗時，很難從 log 快速定位是哪個 provider / AI 呼叫造成的。

### 建議方向

在 `src/utils/coreUtils.mjs` 中加入輕量 `timer()` helper，或在 `aiClient.mjs` 的 Langfuse trace 之外，補充 console 時間戳：

```js
// coreUtils.mjs 建議新增
export function stepTimer(label) {
  const start = Date.now();
  return () => console.log(`⏱ [${label}] ${Date.now() - start}ms`);
}
```

使用方式：
```js
const done = stepTimer("fetchMacroData");
const macroData = await fetchAllMacroData();
done(); // 印出 ⏱ [fetchMacroData] 1234ms
```

### 影響範圍

- `src/utils/coreUtils.mjs`（新增 helper）
- `src/dailyCheck.mjs`（各步驟插入計時）

### 難度

⭐ 低（純工具函式新增，不影響業務邏輯）

---

## 2. ✅ 新聞池沒有「品質趨勢」可視化，Optimizer 效果難評估

> **已完成**（2026-04-05）  
> `src/modules/notifications/transports/telegramClient.mjs` 新增 `sendSystemMessage()`，使用 `TELEGRAM_LOG_API_TOKEN` 發送至系統 Log 頻道；  
> `src/modules/notifications/notifier.mjs` 新增 `broadcastOptimizerResult(result, totalRuleCount)`，有新規則時才發送靜默通知，含 TW/US 各區新增/拒絕明細與 blacklist 累計規則數；  
> `src/runOptimizer.mjs` 執行完成後讀取 blacklist 總數並呼叫通知，失敗不中斷主流程；  
> `.github/workflows/notify-workflow-failure.yml` 排程錯誤通知改用 `TELEGRAM_LOG_API_TOKEN`；  
> 系統文件已更新：`docs/modules/entry_and_notifications.md` §5 新增頻道分流說明、`sendSystemMessage` / `broadcastOptimizerResult` 行為說明。

### 動機

`ruleOptimizerAgent` 會自動新增 blacklist regex，但目前無法觀察「每日通過率變化」是否因規則新增而上升或下降。  
`runNewsFetch.mjs` 已有 `Keyword_Yield_Rate` 和 `Dedup_Rate` 寫入 Langfuse，但欠缺：
1. 每次 Optimizer 執行後新增了哪些規則的摘要通知
2. 黑名單規則數量趨勢

### 建議方向

**方案 A（輕量）**：Optimizer 執行後，在 `archiveManager.saveReport()` 中附加本次新增的規則數量與 pattern 摘要。  
**方案 B（完整）**：Optimizer 執行後，透過 Telegram 發一則靜默通知（`disable_notification: true`），告知「本次新增 N 條規則：pattern1, pattern2...」。

### 影響範圍

- `src/modules/ai/ruleOptimizerAgent.mjs`
- `src/runOptimizer.mjs`
- （方案 B）`src/modules/notifications/notifier.mjs`

### 難度

⭐⭐ 中（需串接通知，但邏輯單純）

---

## 3. 🟡 `strategyEngine` 訊號評分缺少「回測對照」

### 動機

`strategyEngine.mjs` 目前依據 RSI、KD、MACD、VIX、MA240、`macroMarketDirection` 計算買賣訊號，但系統內無法驗證：
- 歷史上當「訊號 = 買進」時，後續 N 天的實際報酬率如何？
- 哪個指標對最終決策貢獻最大？

目前 `archiveManager` 已存 `signals` 快照，資料基礎存在，缺的是分析邏輯。

### 建議方向

新增一個 `runBacktest.mjs` runner，讀取 `data/archives/` 歷史快照 + Google Sheet 歷史價格，計算每次訊號後的 5/10/20 日報酬率，輸出 CSV 或 Telegram 月報附件。

此功能可與現有 `runMonthlyReport.mjs` 整合（月報時一併輸出回測摘要）。

### 影響範圍

- 新增 `src/runBacktest.mjs`（新 runner）
- `src/modules/data/archiveManager.mjs`（新增讀取歷史快照 API）
- `src/modules/storage.mjs`（讀取 Google Sheet 歷史收盤價）
- 可能新增 `src/modules/strategy/backtestEngine.mjs`

### 難度

⭐⭐⭐ 高（需設計回測邏輯與資料對齊）

### 討論狀態

⚪ 待確認

---

## 4. ✅ AI Coach prompt 缺少「持倉成本」作為輸入

> **已完成**（2026-04-04）  
> 在 Google Sheet「資產紀錄」工作表新增 `0050均價` 與 `00675L均價` 兩個手動維護欄位；  
> `fetchLastPortfolioState()` 已透過 `parseNumberOrNull()` 讀取上述欄位並回傳 `avgCost0050` / `avgCostZ2`；  
> `formatQuantDataForCoach()` 新增【持倉成本與損益】段落，計算未實現損益率後注入 `quantTextForCoach`，Coach AI 可直接參考成本位置進行個人化建議；  
> 欄位空白時顯示「(未設均價)」，不影響主流程。

### 原始動機

閱讀 `dailyCheck.mjs` 可以看到 `lastState` 包含：
```js
{ qty0050, qtyZ2, totalLoan, cash }
```

但目前沒有「持倉平均成本（avg cost）」被傳入。AI 教練只知道持有幾股、借款多少，卻不知道目前損益率（浮盈 or 浮虧），導致：
- AI 對「加碼 vs 減碼」的建議缺少成本參考
- 無法計算當前槓桿比率（totalLoan / 持股市值）

---

## 5. ✅ `periodReportAgent` 週/月報缺少「訊號準確度」統計

> **已完成**（2026-04-04）  
> 新增 `isBuySignal()`、`isCooldownBlocked()`、`buildSignalAccuracyStats()` 至 `periodReportAgent.mjs`；  
> `periodReportBuilder.mjs` 週報嵌入訊號數量統計、月報新增第三則訊息含 +5/+10/+20 日報酬率明細；  
> 系統文件已更新：`docs/modules/ai_pipeline.md` §5、`docs/modules/entry_and_notifications.md` §4–5。

### 原始動機

週報與月報彙整持倉變化與市場觀察，但沒有「過去一週/月共觸發幾次買賣訊號、實際後續表現如何」的統計段落。  
這是評估策略有效性最直觀的指標。

---

## 6. 🟢 providers 層缺少統一的 retry 與 timeout 機制

### 動機

目前各 provider（`twseProvider`, `yahooProvider`, `cnnProvider` 等）各自處理錯誤，有些有 try/catch，有些直接拋出。  
`basePriceProvider.mjs`、`ndcProvider.mjs` 等若網路短暫不穩，會直接導致 `dailyCheck` 中斷。  
`coreUtils.mjs` 已有 `fetchWithTimeout`，但未被所有 provider 統一使用。

### 建議方向

在 `src/utils/coreUtils.mjs` 或新增 `src/utils/fetchUtils.mjs` 中實作 `fetchWithRetry(url, options, retries=2)`，並在各 provider 統一引用。

```js
export async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`[fetchWithRetry] 第 ${i+1} 次失敗，重試中... ${url}`);
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}
```

### 影響範圍

- `src/utils/coreUtils.mjs`（新增 helper）
- `src/modules/providers/*.mjs`（逐步替換 fetch 呼叫）

### 難度

⭐⭐ 中（工具本身簡單，但需逐一審查各 provider 的 fetch 呼叫）

### 討論狀態

⚪ 待確認

---

## 7. ✅ `newsPoolManager` 沒有「新聞來源分佈」統計

> **已完成**（2026-04-05）  
> `src/modules/data/newsPoolManager.mjs` 的 `updatePool()` 回傳值新增 `sourceCounts`（來源名稱 → 文章數對映）與 `sourceCount`（不同來源數整數），統計邏輯以 `reduce` 實作，不改任何去重或業務邏輯；  
> `src/runNewsFetch.mjs` 接收上述回傳值，新增 `Source_Diversity` Langfuse score（`value = sourceCount / appended`，`comment` 為完整來源分佈 JSON）；  
> appended = 0 時自動跳過，不寫入無意義的 score。

### 動機

新聞池目前以關鍵字命中率（`Keyword_Yield_Rate`）衡量品質，但不知道新聞主要來自哪些 RSS 來源。  
若某個來源品質差或停更，目前系統無法感知。

### 建議方向

在 `newsPoolManager.mjs` 的 `updatePool()` 中，統計每次入池新聞的 `source` 欄位分佈，記錄至 `data/news_logs/source_stats_{date}.json`，並在 Langfuse 補充一個 `Source_Diversity` 指標（不同來源數 / 總新聞數）。

### 影響範圍

- `src/modules/data/newsPoolManager.mjs`
- `src/runNewsFetch.mjs`（補充 Langfuse score）

### 難度

⭐ 低（純統計，不改業務邏輯）

---

## 已確認納入計劃的項目

> 以下項目討論完成後移至 `preplan_features.md`。

| 功能 | 狀態 |
|---|---|
| Gemini TTS 語音推播 | 已在 `preplan_features.md` |

---

## 已否決的項目

> 討論後確認不實作，保留原因供參考。

（目前尚無）
