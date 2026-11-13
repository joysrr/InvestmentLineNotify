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
相關 commit：4e69005（ContentCard/StatCard 元件建立與首批遷移）

## 一、ContentCard/StatCard 遷移 (21/21)

Phase 2.1 完成所有 dashboard/radar/macro 卡片組件之 ContentCard/StatCard 遷移。

| #   | 檔案                                 | 使用 ContentCard | 使用 StatCard | 外框硬編碼已移除 | 字級已令牌化 | Commit  |
| --- | ------------------------------------ | ---------------- | ------------- | ---------------- | ------------ | ------- |
| 1   | dashboard/AllocationTier.vue         | 是               | 否            | 是               | 是           | 41a7bef |
| 2   | dashboard/CoachingAdvice.vue         | 是               | 否            | 是               | 是           | e828f34 |
| 3   | dashboard/DataEvidenceCard.vue       | 是               | 否            | 是               | 是           | dd3b6b3 |
| 4   | dashboard/DecisionHero.vue           | 是               | 否            | 是               | 是           | e828f34 |
| 5   | dashboard/HealthPanel.vue            | 是               | 否            | 是               | 是           | e828f34 |
| 6   | dashboard/LifecycleItem.vue          | 是               | 否            | 是               | 是           | 41a7bef |
| 7   | dashboard/MacroCockpitCard.vue       | 是               | 是            | 是               | 是           | a1e4f9c |
| 8   | dashboard/MarketDetailDrawer.vue     | 是               | 否            | 是               | 是           | 451b6ef |
| 9   | dashboard/MarketSnapshot.vue         | 是               | 否            | 是               | 是           | e828f34 |
| 10  | dashboard/MetricCard.vue             | 是               | 否            | 是               | 是           | 12b62d4 |
| 11  | dashboard/MetricItem.vue             | 否               | 否            | —                | —            | 41a7bef |
| 12  | dashboard/PortfolioShieldCard.vue    | 是               | 否            | 是               | 是           | a1e4f9c |
| 13  | dashboard/RiskDetailDrawer.vue       | 是               | 否            | 是               | 是           | 451b6ef |
| 14  | dashboard/RiskItem.vue               | 是               | 否            | 是               | 是           | 41a7bef |
| 15  | dashboard/ScoreBar.vue               | 是               | 否            | 是               | 是           | 41a7bef |
| 16  | dashboard/StrategyHealthOverview.vue | 是               | 否            | 是               | 是           | 8c6b763 |
| 17  | dashboard/ThresholdItem.vue          | 是               | 否            | 是               | 是           | 41a7bef |
| 18  | macro/SocialSentimentCard.vue        | 是               | 否            | 是               | 是           | 5ff99ae |
| 19  | radar/CashExposureWidget.vue         | 是               | 是            | 是               | 是           | 04b0c8b |
| 20  | radar/ExtremeRadarPanel.vue          | 是               | 是            | 是               | 是           | 77401d0 |
| 21  | radar/RadarSubtabs.vue               | 否               | 否            | —                | —            | 857812e |

未遷移項說明：

- #11 MetricItem.vue：僅為指標行項，未使用卡片容器，保留原結構。
- #21 RadarSubtabs.vue：僅為標籤列導航組件，未使用卡片容器，保留原結構。

## 二、CollapsibleSection 遷移

| 視圖/組件             | 原 collapsible pattern | 新實作                               | 狀態   |
| --------------------- | ---------------------- | ------------------------------------ | ------ |
| TechnicalView.vue     | ad-hoc div + v-if      | CollapsibleSection (#header slot) ×2 | 已遷移 |
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

| 指標         | Phase 1 基線 | Phase 2 現狀 | 狀態                 |
| ------------ | ------------ | ------------ | -------------------- |
| Initial gzip | 152.1 KB     | 154.3 KB     | ✅ 修訂基線 156.0 KB |
| Total gzip   | 370.4 KB     | 375.4 KB     | ✅ 修訂基線 380.0 KB |

基線變更詳見 `docs/refactor/phase-2-foundation.md` §體積基線變更（路徑 B：正式修訂）。
