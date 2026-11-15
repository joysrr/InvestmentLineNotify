---
title: 階段五收口簽核
stage: CARD-5.6
status: done
type: signoff
last_updated: 2026-11-15
tags:
  - signoff
  - phase-5
  - completion
wiki_links: []
---

# 階段五收口簽核

## 完成日期

2026-11-15

## 卡片狀態

| 卡號 | 標題             | 狀態    | 測試增量 |
| ---- | ---------------- | ------- | -------- |
| 5.0  | 通用精修基線     | ✅ 完成 | +11      |
| 5.1  | 總覽頁精修       | ✅ 完成 | +17      |
| 5.4  | 新聞頁精修       | ✅ 完成 | +20      |
| 5.2  | 市場洞察頁精修   | ✅ 完成 | +2       |
| 5.5  | 帳戶與設定頁精修 | ✅ 完成 | +4       |
| 5.3  | 圖表頁精修       | ✅ 完成 | +7       |
| 5.6  | 階段五收口       | ✅ 完成 | 0        |

## 量化成果

- 測試：649 → 710（+61）
- Initial gzip：155.4 → 104.2 KB（-51.2 KB，主要來自 StrategyConfigEditorView async 化）
- Total gzip：353.9 → 361.4 KB（+7.5 KB，來自 7 頁精修的累積增量）
- 360px E2E：0 → 6 個 spec（8 個測試案例，全部通過）

## 7 份 design 文件

| 文件                   | 建立於 | 狀態                          |
| ---------------------- | ------ | ----------------------------- |
| state-presentation.md  | 5.0    | ✅ 存在                       |
| freshness-semantics.md | 5.0    | ✅ 存在                       |
| dashboard-hierarchy.md | 5.6    | ✅ 存在（5.6 補建，5.1 遺漏） |
| insights-ux.md         | 5.2    | ✅ 存在                       |
| chart-ux.md            | 5.3    | ✅ 存在                       |
| news-ux.md             | 5.4    | ✅ 存在                       |
| account-ux.md          | 5.5    | ✅ 存在                       |

## 技術債跟進項（6 項）

| #   | 來源     | 技術債                                                     | 狀態          | 說明                                           |
| --- | -------- | ---------------------------------------------------------- | ------------- | ---------------------------------------------- |
| 1   | 5.1      | MacroBattleView.vue `!macro` 時顯示空白，未使用 EmptyState | ✅ 已處理     | 使用 `<EmptyState v-else-if="!macro">`，非空白 |
| 2   | 5.1 P2-1 | status-semantics.md 補「令牌家族」核實記錄                 | ✅ 已處理     | line 95 `## 令牌家族`，commit `2da70b1`        |
| 3   | 5.2      | MarketRadar 剩餘裸 rgba（gradient / box-shadow）           | ⚠️ 列入階段六 | 5 處（lines 642, 677, 678, 693, 696）未遷移    |
| 4   | 5.4      | 兩套測試目錄（src/test/ 與 src/test/views/）               | ✅ 記錄       | 並存為結構事實，無需合併                       |
| 5   | 5.5      | Path B：重設按鈕移除，設定無持久化層                       | ✅ 已處理     | 按鈕移除，account-ux.md 記錄，無持久化層       |
| 6   | 5.5      | `watch(route.query.panel)` 未加，僅 onMounted              | ⚠️ 列入階段六 | 僅 `onMounted`，建議 5.6+ 加 `watch`           |

## 教訓記錄

1. el-input-number 在 jsdom 不穩定（5.5）
2. 回報中的 +N 需與 git diff --stat 一致（5.5、5.3 各發生一次敘述反覆）
3. 移除既有功能時需檢查依賴（activePanel 移除破壞 /theory redirect，5.5）
4. 假功能應移除而非保留（Path B，5.5）
5. 測試數敘述反覆的兩次教訓（5.5、5.3）
6. 臨界值應顯式聲明（44px，5.3）
7. 技術決策的來源要誠實——「基於設計判斷，未經實測」比引用不存在的 issue 有價值（5.3）

## 階段六的入口條件

- [x] 6 項技術債有明確狀態（2 項列入階段六，4 項已處理，1 項記錄）
- [x] 全站 360px 掃描通過（6 個 spec，8/8 測試案例通過）
- [x] 7 份 design 文件齊全（dashboard-hierarchy.md 於 5.6 補建）
- [x] 母計畫階段五狀態更新（docs/webapp-refactor-plan.md 階段五表格無狀態欄位，以本筋核文件為準）

## 下一步：階段六

階段六：平台無障礙與相容性（6.1 資料新鮮度全域元件、6.2 視口與相容性）。卡片將在 5.6 核實通過後產出。
