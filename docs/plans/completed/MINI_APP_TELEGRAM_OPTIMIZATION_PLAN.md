---
type: plan
status: completed
last_updated: 2026-11-06
tags:
  - mini-app
  - telegram
  - optimization
wiki_links: []
---

# Mini App 與 Telegram 優化計畫

## 進度追蹤

| 階段    | 項目                                                                               | 狀態    | commit  |
| ------- | ---------------------------------------------------------------------------------- | ------- | ------- |
| Phase 1 | CashExposureWidget.vue：槓桿儀表板 (targetLeverage/currentLeverage) + 批次計算推導 | ✅ 完成 | e6f75b6 |
| Phase 2 | Telegram 訊息精簡：僅保留「警報標題 + 行動紀律 + 建議批次」，細節移至 Mini App     | ✅ 完成 | e6f75b6 |
| Phase 3 | KellyLeverageSummary.vue：加入 Kelly vs 槓桿對比欄，風格參考現有設計               | ✅ 完成 | e593351 |
| Phase 4 | MarketRadarView.vue：加入長期防禦模式狀態欄                                        | ✅ 完成 | 4da9a15 |
| Phase 5 | E2E 測試驗證 + 最終提交                                                            | ✅ 完成 | -       |

## 設計原則

- 介面風格必須參考 MetricCard.vue、BudgetItem.vue、HealthPanel.vue、KellyLeverageSummary.vue 等現有組件
- 精簡不重複 UI，手機 RWD 良好不溢出
- 細節在 Mini App 取得，Telegram 僅顯示摘要

最後更新：2026-11-06 06:41
