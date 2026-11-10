---
type: plan
status: completed
last_updated: 2026-11-01
tags:
  - non-trading-day
  - theoretical-shadow
  - scheduler
  - frontend
  - test-coverage
wiki_links:
  - plans/completed/2026-10-30-投資系統理論升級與資產動態整合計畫書.md
---

# 非交易日 theoreticalShadow 重新計畫

## 目標

在非交易日（休市日）也執行 `theoreticalShadow` 計算，使用**前一個交易日**的 portfolio 與市場數據作為輸入，確保每次 `dailyCheck` 執行後，前端都能拿到 `status: "AVAILABLE"` 的理論陰影數據，無需前端判斷今日是否為交易日。

## 現狀分析

### 當前行為（非交易日）

在 `src/scheduler/dailyCheck.mjs` 第 130-246 行（`if (!openToday)` 分支）：

1. 建立 `portfolioSnapshot` 使用 `lastState` + 當日 `price0050Snapshot` / `priceZ2Snapshot`
2. 呼叫 `buildTheoreticalShadowForReport` 計算 `theoreticalShadow`
3. 若回傳 `status === "UNAVAILABLE"`，則從 `archiveManager.listArchiveDates()` 尋找最近一份 `theoreticalShadow.status === "AVAILABLE"` 的歷史報告，複製其理論數據，標記 `isFromLastTradingDay: true`、`lastTradingDay`
4. 前端 `useTheoryData.js` 根據 `isFromLastTradingDay` 旗標顯示來源說明

### 問題

- 非交易日僅「複製」舊數據，不是「重新計算」，數據不夠新鮮
- 前端需維護 `isFromLastTradingDay` 邏輯來區分數據來源
- 若沒有可用的 archive 報告，前端會顯示 `--` 或 `UNAVAILABLE`

## 設計方案

### 核心變更

非交易日時，不再從 archive「複製」舊 theoreticalShadow，而是：

1. 使用 `lastState`（已是最新 portfolio 狀態，不隨交易日變化）
2. 從 archive 找最近一個有 `theoreticalShadow.status === "AVAILABLE"` 的交易日，提取其 `price0050Snapshot` 與 `priceZ2Snapshot`
3. 用這些「前一交易日價格」+「最新 portfolio」重新呼叫 `buildTheoreticalShadowForReport` 計算
4. 結果 `status: "AVAILABLE"`，前端不需交易日感知邏輯

### 資料流

```
非交易日 dailyCheck 執行
    │
    ├─ lastState (最新 portfolio, 來自 Google Sheets) ──┐
    │                                                   │
    ├─ archiveManager.listArchiveDates() ──────────────┤
    │      找最近一份 theoreticalShadow.status === "AVAILABLE" 的報告
    │      提取 price0050Snapshot / priceZ2Snapshot    │
    │                                                   │
    └─ buildTheoreticalShadowForReport(lastState, histPriceSnapshots)
            │
            ▼
    theoreticalShadow.status === "AVAILABLE" (重新計算)
            │
            ▼
    存入今日報告 (data/reports/YYYY-MM-DD.json)
            │
            ▼
    前端 /api/report/latest-theoretical 取得 AVAILABLE 數據
```

### 檔案變更

| 檔案                                             | 變更內容                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/scheduler/dailyCheck.mjs`                   | 非交易日分支：從 archive 取得前一交易日價格快照，重新計算 theoreticalShadow，移除舊的 archive fallback 複製邏輯          |
| `src/scheduler/dailyCheckTheoreticalAdapter.mjs` | 可能需接受可選的 `price0050Snapshot` / `priceZ2Snapshot` 覆寫參數（若 buildTheoreticalShadowForReport 已支援則無需改動） |
| `src/test/unit/scheduler/dailyCheck.test.mjs`    | 新增非交易日重新計算測試（TDD RED）→ 實作後 GREEN                                                                        |
| `webapp/src/composables/useTheoryData.js`        | 移除 `isFromLastTradingDay` / `lastTradingDay` 相關旗標（若不再需要）                                                    |
| `webapp/src/test/useTheoryData.test.js`          | 相應更新測試                                                                                                             |

### 夜間模式與 UI

無需變更。前端卡片與詳情頁已完成夜間模式適配，僅數據來源邏輯變更。

## 實作步驟（TDD RED-GREEN-VERIFY）

### Phase 1：RED — 撰寫測試

在 `src/test/unit/scheduler/dailyCheck.test.mjs` 新增測試案例：

1. **非交易日重新計算測試**：模擬 `openToday: false`，`price0050Snapshot.price` 為 null（無當日價格），archive 中有前一交易日 AVAILABLE 報告。斷言 `theoreticalShadow.status === "AVAILABLE"`，且理論數據來自重新計算而非簡單複製。

2. **無可用 archive 時的處理**：模擬 archive 為空，斷言 `theoreticalShadow.status === "UNAVAILABLE"`（保護性降級）。

### Phase 2：GREEN — 實作 `dailyCheck.mjs` 變更

修改非交易日分支（第 130-246 行）：

- 當 `theoreticalShadow.status === "UNAVAILABLE"` 時，不再直接從 archive 複製理論數據
- 而是：從 archive 找最近一份 `theoreticalShadow.status === "AVAILABLE"` 的報告，提取其 `price0050Snapshot` / `priceZ2Snapshot`
- 用這些價格快照 + `lastState` 重新呼叫 `buildTheoreticalShadowForReport`
- 結果寫入今日報告，`status: "AVAILABLE"`

### Phase 3：VERIFY — 執行測試

- `npx vitest run src/test/unit/scheduler/dailyCheck.test.mjs` — 所有新增與現有測試通過
- 全 backend 測試：`npx vitest run` — 無退化
- 全 frontend 測試：`cd webapp && npx vitest run` — 無退化

### Phase 4：COMMIT + DOC

- Commit 變更
- 推送到 `origin/main`
- 更新 `docs/wiki-index.json`（如需）

## 預期效果

| 項目                       | 變更前                                               | 變更後                                             |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| 非交易日 theoreticalShadow | 從 archive 複製舊數據 (`isFromLastTradingDay: true`) | 使用前一交易日價格重新計算 (`status: "AVAILABLE"`) |
| 前端邏輯                   | 需檢查 `isFromLastTradingDay` 旗標                   | 無需交易日感知，每次都取得 AVAILABLE 數據          |
| 數據新鮮度                 | 舊數據（上一交易日快照）                             | 重新計算（基於最新 portfolio + 前一交易日價格）    |
| 無 archive 時              | 顯示 `--` / `UNAVAILABLE`                            | 顯示 `UNAVAILABLE`（保護性降級，不變）             |

## 風險與回滾

- **風險**：archive 中無可用報告時，非交易日 theoreticalShadow 仍為 `UNAVAILABLE`，前端會顯示 `--`。這與行為一致，可接受。
- **回滾**：若新邏輯導致問題，可 revert 至舊的 archive fallback 複製邏輯（commit 前已備份舊版）。
- **生產環境**：需在主機端執行 `npm run build --mode production` + `pm2 restart` 才能生效。

---

## 實作進度

| Commit Hash | Phase                            | Status  | Date       | Note                                                         |
| ----------- | -------------------------------- | ------- | ---------- | ------------------------------------------------------------ |
| `a69337d`   | Phase 1-4 (v1: archive fallback) | ✅ DONE | 2026-10-31 | 非交易日從 archive 複製 theory，標記 `isFromLastTradingDay`  |
| `bd3d85c`   | Phase 1-4 (v2: recalculate)      | ✅ DONE | 2026-11-01 | 改為重新計算 theoreticalShadow，使用前一交易日價格快照       |
| `f6becbf`   | Enhanced fallback                | ✅ DONE | 2026-11-01 | 增強 fallback: `archivedReport.portfolio ?? lastState ?? {}` |
| `34514f1`   | Signals fallback                 | ✅ DONE | 2026-11-01 | 非交易日複製 signals，修正前端「分析中」問題                 |
| `d7cd558`   | Refactor duplicate loops         | ✅ DONE | 2026-11-01 | 合併重複的 archive 迴圈，優化早期退出                        |
| `2ae7f20`   | Complete test coverage           | ✅ DONE | 2026-11-01 | 補充測試覆蓋：signals fallback + adapter 單元測試 (+7 tests) |

### 測試覆蓋改進

**新增測試文件**：

- `src/test/unit/scheduler/dailyCheckTheoreticalAdapter.test.mjs` (5 測試案例)
  - portfolioSnapshot UNAVAILABLE 場景
  - 價格快照缺失場景
  - 所有計算成功完整流程
  - humanCapital 失敗部分降級
  - Laplace/Tobin 失敗優雅降級

**擴充測試文件**：

- `src/test/unit/scheduler/dailyCheck.test.mjs` (+2 測試案例)
  - 非交易日 signals fallback from archive
  - archive 無 signals 時 null 處理

**測試統計**：

- Backend: 188 → 189 files, 1913 → 1920 tests (+7)
- Frontend: 69 files, 424 tests (無變更)
- **總計**: 257 files, 2344 tests, 100% pass ✅
