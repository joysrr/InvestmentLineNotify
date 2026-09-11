---
type: plan
status: archived
last_updated: 2026-09-11
tags:
  - archived
  - historical
wiki_links: []
---

# Phase 9: API 對接正確性稽核 審查與修復計畫

## 診斷結果

### `/api/status` 端點對接

- **[S-1] (已解除)**: 經查後端 `status.mjs` 送出的 `latest.json` 根層結構確實包含 `_meta` 與 `data` 包裝層，前端路徑 `status?.data?.rawUsMarket?.vix` 與之完全吻合，無報錯風險。
- **[BUG-1] (型別衝突)**: `status.data.rawUsMarket.vix` 為字串（如 `"19.31"`），原本快照卡僅用作顯示字串無礙，但 `vixLevel` 取值進行 `>= 30` 判斷時，需要精確轉換為浮點數。已在 `DashboardView` 對此來源值加上 `parseFloat()` 避免型別地雷。
- **[BUG-2] (欄位缺失)**: `DashboardView` 底部期望顯示最後更新時間，但讀取的是不存在的 `status?.updatedAt`。已修正為讀取 `status?._meta?.lastRun`，確保資料同步時間能夠正確顯示於儀表板末端。

### 其他端點對接狀態

- `/api/reports?limit=5` (DashboardView)：所有訊號、AI 建議與估值防禦等欄位全部吻合。
- `/api/reports/snapshots` 系列 (ChartView)：每日、週、月快照所有計算指標與 X 軸時間戳對接皆正確。
- `/api/news` & `/api/report/news` (NewsView)：新聞卡片顯示欄位已統一相容 `url` 與 `link`。

## 實作修復

由 @Frontend 完成 BUG-1 型別轉換與 BUG-2 欄位名稱對齊。整個 Mini App 的資料呈現現在已精準接上後端實體產出的每一個屬性，沒有錯位。
