# 計劃書：AI Coach 補入持倉成本 (#4)

> 狀態：待確認  
> 建立日期：2026-04-04  
> 對應 optimization_ideas.md #4

---

## 1. 目標與動機

目前 `aiDataPreprocessor.mjs` 的 `formatQuantDataForCoach()` 已能輸出槓桿倍數、維持率、持股數量，但 **缺少持倉平均成本**，導致 AI Coach 無法計算：

- 當前未實現損益率（浮盈 / 浮虧 %）
- 真實槓桿風險（`totalLoan / 持股市值` 而非估算）
- 加碼 vs 減碼的成本錨點建議

---

## 2. 影響範圍總覽

| 層次 | 檔案 | 修改性質 |
|---|---|---|
| 資料來源 | Google Sheet「資產紀錄」分頁 | 新增 2 個欄位（schema 異動）|
| 資料讀取 | `src/modules/storage.mjs` | `fetchLastPortfolioState()` 新增欄位讀取 |
| 資料格式化 | `src/modules/ai/aiDataPreprocessor.mjs` | `formatQuantDataForCoach()` 補充損益率計算與輸出 |
| Prompt | `src/modules/ai/prompts.mjs` | `INVESTMENT_COACH_SYSTEM_PROMPT` 補充成本參考說明 |
| 每日主流程 | `src/dailyCheck.mjs` | 確認 `portfolio` 物件傳遞路徑（**預計不需修改**）|

---

## 3. Google Sheet Schema 設計

### 3.1 新增欄位（資產紀錄分頁）

在「資產紀錄」第一張工作表中，新增以下兩欄：

| 欄位名稱 | 類型 | 說明 | 空值行為 |
|---|---|---|---|
| `0050均價` | 數字 | 0050 的持倉平均成本（元/股）| 空值視為 `null`，不計算損益 |
| `00675L均價` | 數字 | 00675L 的持倉平均成本（元/股）| 空值視為 `null`，不計算損益 |

**欄位放置位置**：建議緊跟在現有 `0050股數` / `00675L股數` 欄位之後，便於人工對照維護。

**手動維護原則**：每次實際買賣後，由使用者自行更新均價（加權平均），系統不自動計算均價。

---

## 4. `storage.mjs` 修改設計

### 4.1 `fetchLastPortfolioState()` 回傳值擴充

現有回傳：
```js
{
  date, lastBuyDate,
  qty0050, qtyZ2,
  totalLoan, cash
}
```

修改後新增兩欄（`parseNumberOrNull` 現有 helper 直接可用）：
```js
{
  date, lastBuyDate,
  qty0050, qtyZ2,
  totalLoan, cash,
  avgCost0050: parseNumberOrNull(lastRow.get("0050均價")),   // 可能為 null
  avgCostZ2:   parseNumberOrNull(lastRow.get("00675L均價")), // 可能為 null
}
```

**防呆設計**：`parseNumberOrNull` 本已回傳 `null`（空白或非數字時），不需額外判斷，只需在後續使用端做 null guard。

---

## 5. `aiDataPreprocessor.mjs` 修改設計

### 5.1 `formatQuantDataForCoach()` 新增計算段

`formatQuantDataForCoach(marketData, portfolio, vixData)` 函式中，`portfolio` 物件已包含 `avgCost0050` / `avgCostZ2`（由 storage 傳入）。

新增計算邏輯（插入現有「帳戶風控數據」抽取段之後）：

```js
// ===== 持倉成本與損益 =====
const avgCost0050 = n2(portfolio?.avgCost0050);
const avgCostZ2   = n2(portfolio?.avgCostZ2);
const price0050   = n2(marketData?.price0050);   // 現有欄位
const priceZ2     = n2(marketData?.currentPrice); // 現有欄位

// 計算未實現損益率（只有均價與現價都有效時才計算）
const pnl0050Pct = (avgCost0050 && price0050)
  ? ((price0050 - avgCost0050) / avgCost0050 * 100).toFixed(2)
  : null;
const pnlZ2Pct = (avgCostZ2 && priceZ2)
  ? ((priceZ2 - avgCostZ2) / avgCostZ2 * 100).toFixed(2)
  : null;

// 計算真實槓桿（以持股市值為分母）
const marketVal0050 = (qty0050 && price0050) ? qty0050 * price0050 : 0;
const marketValZ2   = (qtyZ2   && priceZ2)   ? qtyZ2   * priceZ2   : 0;
const totalMarketVal = marketVal0050 + marketValZ2;
const loanAmount = n2(portfolio?.totalLoan) || 0;
const realLeverage = totalMarketVal > 0
  ? n2(loanAmount / totalMarketVal)
  : null;
```

### 5.2 輸出段落補充

在現有 `【帳戶風控狀態】` 區塊末尾，追加新段落：

```
【持倉成本與損益】
0050：均價 ${avgCost0050 ?? '--'} 元 / 現價 ${price0050 ?? '--'} 元
  → 未實現損益：${pnl0050Pct != null ? pnl0050Pct + '%' : '（未設均價）'}
00675L：均價 ${avgCostZ2 ?? '--'} 元 / 現價 ${priceZ2 ?? '--'} 元
  → 未實現損益：${pnlZ2Pct != null ? pnlZ2Pct + '%' : '（未設均價）'}
貸款 / 持股市值：${loanAmount.toLocaleString()} / ${totalMarketVal.toLocaleString()}
  → 以市值計真實槓桿：${realLeverage != null ? realLeverage + ' 倍' : '無借貸'}
```

**null 防禦原則**：若均價未填，顯示「未設均價」而非報錯，不影響其他段落輸出。

---

## 6. `prompts.mjs` 修改設計

在 `INVESTMENT_COACH_SYSTEM_PROMPT` 的 `<Decision_Logic>` 區塊，「1. 槓桿與資金狀態」段落末尾，追加以下說明（不需要修改 Schema）：

```
5. 持倉成本參考：
   - 若 <JSON> 顯示「持倉成本與損益」段落，請將浮盈/浮虧納入決策考量。
   - 浮虧較深（如 -20% 以上）：不應以「攤平」為由盲目加碼；
     但若同時量化評分已達標且風控正常，可視為合理加碼機會。
   - 浮盈較大（如 +30% 以上）：結合過熱指標，可能是部分獲利了結的時機提示。
   - 若均價未設定（顯示「未設均價」），跳過損益分析，不要推測。
```

---

## 7. 傳遞路徑確認（不需修改 `dailyCheck.mjs`）

以下是現有 `portfolio` 物件的傳遞路徑，新欄位會自動帶入：

```
fetchLastPortfolioState()        ← storage.mjs（新增 avgCost0050 / avgCostZ2）
  └─ portfolio 物件
       └─ formatQuantDataForCoach(marketData, portfolio, vixData)
                                 ← aiDataPreprocessor.mjs（新增損益計算）
            └─ quantTextForCoach 字串
                 └─ buildCoachUserPrompt(..., quantTextForCoach, ...)
                                 ← prompts.mjs（傳入 Coach）
```

`dailyCheck.mjs` 中 `formatQuantDataForCoach()` 的呼叫簽名不變，無需修改。

---

## 8. 實作步驟順序

1. **Step 1（Sheet）**：在 Google Sheet「資產紀錄」分頁手動新增 `0050均價`、`00675L均價` 兩欄，填入現有持倉均價。
2. **Step 2（storage）**：`fetchLastPortfolioState()` 新增兩行 `parseNumberOrNull` 讀取。
3. **Step 3（preprocessor）**：`formatQuantDataForCoach()` 新增計算段與輸出段落。
4. **Step 4（prompt）**：`INVESTMENT_COACH_SYSTEM_PROMPT` 追加持倉成本決策說明。
5. **Step 5（驗證）**：本機執行 `runDailyCheck.mjs --dry-run`，確認 `quantTextForCoach` 輸出含新段落且無報錯。

---

## 9. 不在本次範圍的事項

- **自動計算均價**：每次買賣後自動更新均價屬於「交易記錄系統」範疇，遠超本次範圍，維持手動維護。
- **Telegram 通知格式**：本次只修改 Coach 的 context 輸入，不修改 `telegramHtmlBuilder.mjs` 呈現格式。
- **回寫 Google Sheet**：不新增任何回寫邏輯。
- **`logDailyToSheet()`**：通知紀錄分頁不受影響。

---

## 10. 風險評估

| 風險 | 說明 | 緩解方式 |
|---|---|---|
| Sheet 欄位空白 | 使用者忘記填均價 | `parseNumberOrNull` 回傳 null，顯示「未設均價」，不中斷流程 |
| 欄位名稱打錯 | Sheet header 與程式 key 不符 | `parseNumberOrNull` 回傳 null，同上 |
| 損益率計算錯誤 | 均價或現價為 0 | 分母判斷 `&& price > 0`，防止除以零 |
| Prompt token 增加 | 新增約 3~5 行文字 | 影響極小（< 50 tokens），不影響成本 |
