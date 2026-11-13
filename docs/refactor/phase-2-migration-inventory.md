---
type: inventory
status: completed
last_updated: 2026-11-13
tags:
  - webapp
  - refactor
  - phase-2
  - migration
wiki_links: []
---

# Phase 2 遷移盤點清單

文件位置：`docs/refactor/phase-2-migration-inventory.md`
適用範圍：`webapp/` 前端子專案

## 一、ContentCard/StatCard 遷移 (21/21)

Phase 2.1 完成所有 dashboard/radar/macro 卡片組件之 ContentCard/StatCard 遷移。

| 區域      | 組件                | 卡片類型             | 狀態   |
| --------- | ------------------- | -------------------- | ------ |
| dashboard | AssetAllocationCard | ContentCard          | 已遷移 |
| dashboard | PositionSummaryCard | ContentCard          | 已遷移 |
| dashboard | PerformanceCard     | ContentCard          | 已遷移 |
| dashboard | CashExposureCard    | ContentCard          | 已遷移 |
| radar     | RadarStatusCard     | StatCard             | 已遷移 |
| radar     | RadarAlertCard      | StatCard             | 已遷移 |
| macro     | MacroRegimeCard     | ContentCard          | 已遷移 |
| macro     | MacroIndicatorCard  | StatCard             | 已遷移 |
| ...       | (共 21 張卡片)      | ContentCard/StatCard | 已遷移 |

## 二、CollapsibleSection 遷移

| 視圖/組件             | 原 collapsible pattern | 新實作                               | 狀態   |
| --------------------- | ---------------------- | ------------------------------------ | ------ |
| TechnicalView.vue     | ad-hoc div + v-if      | CollapsibleSection (#header slot)    | 已遷移 |
| AccountView.vue       | ad-hoc div + v-if      | CollapsibleSection (#header slot)    | 已遷移 |
| ExtremeRadarPanel.vue | ad-hoc div + v-if      | CollapsibleSection (#header slot) ×2 | 已遷移 |

## 三、Emoji → Icon 遷移

| 視圖/組件             | 原 Emoji       | 新 Icon               | 狀態   |
| --------------------- | -------------- | --------------------- | ------ |
| TechnicalView.vue     | 📭             | EmptyState icon="Box" | 已遷移 |
| TechnicalView.vue     | name="default" | name="radar"          | 已遷移 |
| AccountView.vue       | —              | —                     | 已清理 |
| ExtremeRadarPanel.vue | name="default" | name="shield"         | 已遷移 |
| 理論/視圖 (10+7)      | 各類 Emoji     | Icon 組件             | 已遷移 |

剩餘 6 個情緒指標 Emoji（📈📉🔴🟢🟡⚪）保留，用於社群情緒多空對決區塊。

## 四、設計令牌合規性

| 檢查項目                | 基線 | 現狀                | 狀態    |
| ----------------------- | ---- | ------------------- | ------- |
| 硬編碼 hex/rgba         | 0    | 0                   | ✅ 通過 |
| `--iln-space-3` padding | —    | StatCard.vue 已修正 | ✅ 通過 |
| `name="default"`        | 50+  | 0                   | ✅ 通過 |
| ad-hoc collapsible      | 多處 | 0                   | ✅ 通過 |

## 五、Bundle 大小基線

| 指標          | Phase 1 基線    | Phase 2 現狀 | 狀態                                  |
| ------------- | --------------- | ------------ | ------------------------------------- |
| Initial chunk | 152.1 KB (參考) | 154.3 KB     | ✅ 閘門通過 (預算 300 KB)，基線已修訂 |
| Total bundle  | 370.4 KB (參考) | 375.4 KB     | ✅ 閘門通過 (預算 500 KB)，基線已修訂 |

詳見 `docs/refactor/phase-2-remediation.md` B2 處理方案。
