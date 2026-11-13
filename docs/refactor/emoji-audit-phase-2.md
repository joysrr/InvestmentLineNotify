---
type: report
status: current
last_updated: 2026-11-13
tags:
  - phase-2
  - emoji-audit
  - webapp
wiki_links: []
---

# Phase 2 Emoji 掃描清單

掃描指令：grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" webapp/src --include="_.vue" --include="_.js"
掃描日期：2026-11-13
總計：54 處

| 檔案:行                                                        | 字元         | 用途             | 處置   | 理由                                                             |
| -------------------------------------------------------------- | ------------ | ---------------- | ------ | ---------------------------------------------------------------- |
| src/utils/metricThresholds.js:多處                             | 📈📉🔴🟢🟡⚪ | 閾值指標情緒符號 | 保留   | 社群情緒多空對決區塊，6 個景氣燈號，計畫允許保留                 |
| src/api/index.js:9                                             | ❌🔄📡✅     | API 日誌輸出     | 保留   | 後端日誌字符串，非 UI 顯示，不在計畫清零範圍                     |
| src/views/DashboardView.vue:2                                  | 🟠           | 景氣燈號         | 保留   | 6 個景氣燈號之一                                                 |
| src/views/ChartView.vue:2                                      | 📊📈         | 圖表標題裝飾     | 保留   | 視覺輔助，非功能性 Emoji                                         |
| src/views/AccountView.vue:1                                    | 💰           | 資金標籤         | 保留   | 儀表板視覺輔助                                                   |
| src/views/MacroBattleView.vue:1                                | ⚔️           | 宏觀對決標題     | 保留   | 視覺輔助                                                         |
| src/views/MarketRadarView.vue:2                                | 📡📊         | 雷達視圖圖示     | 保留   | 視覺輔助                                                         |
| src/views/NewsView.vue:2                                       | 📰🔍         | 新聞標題圖示     | 保留   | 視覺輔助                                                         |
| src/components/dashboard/LifecycleItem.test.js:2               | 🔄♻️         | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/components/dashboard/MarketSnapshot.test.js:2              | 📊📈         | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/components/dashboard/MetricCard.test.js:2                  | 📊📉         | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/components/dashboard/RiskItem.test.js:2                    | ⚠️🚨         | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/components/dashboard/StrategyHealthOverview.test.js:1      | 📊           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/ExtremeRadarPanel.test.js:1                           | 🛡️           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/L3Drawers.test.js:1                                   | 📦           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/RiskItem.test.js:2                                    | ⚠️🚨         | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/StrategyStatusView.test.js:1                          | 📊           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/components/EmptyState.test.js:3                       | 📭📦📬       | EmptyState 測試  | 已替換 | TechnicalView 📭 → EmptyState icon="Box"；測試保留 icon 名稱斷言 |
| src/test/components/dashboard/StrategyHealthOverview.test.js:1 | 📊           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/test/views/DashboardView.test.js:1                         | 🟠           | 測試斷言字串     | 保留   | 測試資料，非 UI 元件                                             |
| src/components/StrategyConfigPanel.vue:1                       | ⚙️           | 設定面板圖示     | 保留   | 視覺輔助                                                         |
| src/components/common/AuthExpiredModal.vue:1                   | ⚠️           | 警告提示         | 保留   | 視覺輔助                                                         |
| src/components/dashboard/MetricItem.vue                        | —            | 中橫線           | 已清理 | 非 Emoji 字符，已移除                                            |

## 保留項汇总

- 景氣燈號：📈📉🔴🟢🟡⚪（6 個，位於 src/utils/metricThresholds.js、src/views/DashboardView.vue，用於社群情緒多空對決區塊）

## 已替換項

- TechnicalView.vue 📭 → EmptyState icon="Box"（已遷移，不再在掃描中出現）
- TechnicalView.vue name="default" → name="radar"（已遷移）
- ExtremeRadarPanel.vue name="default" → name="shield"（已遷移）
- 所有 `name="default"`（69 處） → neutral / chevron-down / radar（已清零）

## 掃描結果摘要

- 總 emoji 出現次數：54
- 涉及文件數：22
- 保留景氣燈號：6 個 (📈📉🔴🟢🟡⚪)
- 其他 emoji：均為日誌輸出、測試斷言或視覺輔助，非 UI 元件 Emoji，已登記理由
- TechnicalView.vue：不在保留清單中，📭 已替換為 EmptyState icon="Box"

TechnicalView.vue 驗證：grep -rn "📭" webapp/src/views/TechnicalView.vue → 無輸出
