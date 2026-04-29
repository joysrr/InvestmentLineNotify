# TEST_REPORT

> ⚠️ **時間點快照**（依 PROPOSAL_20260422_021 T-2）：
> 本文件為 **2026-04-19 Epic 1 Remediation 快照**，非 ongoing 產出。
> 未來新 PR 的測試產出由 `@QA` 於根目錄或指定路徑產出新檔案；本快照保留為歷史參考。
> 模板參照：`.agents/skills/test-report-template.md`

## 測試標的

**版本**: 2026-04 Remediation (Epic 1: 策略邏輯強化)
**測試者**: `@QA`

## 測試結果摘要

**結論：✅ 通過**

### 測試案例與執行明細

#### 1. [Reliability] `marginManager.mjs` 極端與錯誤市價防呆

- **Test Case 1.1**: 傳入 `currentPrice0050` 為 `0` 或 `null` 的數據。
  - **預期**: 系統不得代入 `0` 計算出 `currentMargin = 0%`，必須直接提早拋出 `Error('[MarginRisk] Invalid currentPrice...')` 阻斷。
  - **結果**: Pass。有效保護不被錯誤的 TWSE API 資料觸發假斷頭。

#### 2. [Logic] `entryScoringPolicy.mjs` 因子去相關化驗證

- **Test Case 2.1**: 左側大跌段下，模擬 RSI 與 KD 同步穿越超賣線。
  - **預期**: 動能分數 `momentumScore` 不疊加，由 `Math.max(rsiScore, kdScore)` 取代。
  - **結果**: Pass。成功削減多餘權重，防止因系統性恐慌而無腦建倉。

#### 3. [Logic] `sellScoringPolicy.mjs` 追蹤停利與指標替換

- **Test Case 3.1**: 在牛市盤整向上的環境中，RSI > 75 達標。
  - **預期**: `sellScoringPolicy.mjs` 僅將 RSI 視為 `stateFlags` 登記，不將其判定為 `sellSignal` (強制售出旗標)。
  - **結果**: Pass。
- **Test Case 3.2**: 模擬股價重挫跌破 MA20 且持續跌幅大於 1 倍 ATR。
  - **預期**: 系統判定 `trailingStop` 為 `true` 並將其列入 `sellSignals` 觸發清倉降槓桿。
  - **結果**: Pass。動態追蹤停利運作正常。

---

**附註**: QA 驗證已涵蓋所有邊界數值，且未發現在分離模組過程中對核心引擎造成退化。請 `@Architect` 備齊相關文件更新。
