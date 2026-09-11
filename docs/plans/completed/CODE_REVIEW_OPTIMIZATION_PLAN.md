---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Code Review 後續追蹤優化計畫 (CODE_REVIEW_OPTIMIZATION_PLAN.md)

> **狀態**：Completed
> **建立日期**：2026-09-02
> **背景**：在完成 Dashboard 單頁 Carousel 整合與 News Tab 恢復後，經 `code-review-expert` 審查提出 P1/P2/P3 優化項目，旨在提升組件邊界容錯、動畫體驗與無障礙支援。

---

## 🎯 優化目標清單

### Phase 1: P1 邊界容錯與 API 狀態修復

- [x] **StrategyStatusView.vue**: `allocationTiers` 陣列轉換補上 `filter` 防護，防止無效或非數字 `minScore` 導致渲染異常。
- [x] **DashboardView.vue**: `loadAll()` 補上 `strategyStatusLoading` 與 `strategyStatusError` 處理，避免單一 API 失敗時靜默轉為自載重複發送請求。

### Phase 2: P2 體驗與狀態邏輯優化

- [x] **DashboardView.vue**: `.card-body` 加上 `<Transition name="card-content">`，使折疊展開 CSS 動畫正常生效。
- [x] **StrategyStatusView.vue**: `isLoading` / `loadError` computed 改為明確判定 `props.loading` / `props.error` 或 self-load 狀態。

### Phase 3: P3 細節優化與測試驗證

- [x] **DashboardView.vue**: `.config-fab` 補上 `aria-label="策略設定"`。
- [x] **單元測試與 E2E 驗證**: 執行 Vitest 360/360 測試與 Playwright 62/62 測試，確保改動無迴歸。

---

## 🏁 完成紀錄 (2026-09-02)

| 項目                       | 描述                                                                                   | 驗證                                        |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| **StrategyStatusView.vue** | `allocationTiers` 加入 null/non-object 過濾防護                                        | Unit test (`StrategyStatusView.test.js`) 綠 |
| **StrategyStatusView.vue** | `isLoading` / `loadError` 明確判定 `props.error` 傳遞                                  | Unit test 綠                                |
| **DashboardView.vue**      | `loadAll()` 增加 `strategyStatusError` 處理，避免靜默二度自載                          | Unit test 綠                                |
| **DashboardView.vue**      | `.card-body` 加上 `<Transition name="card-content">` 動畫與 `.config-fab` `aria-label` | E2E test (01-dashboard.spec.js) 綠          |

- 單元測試: 360/360 pass
- E2E 測試: 15/15 spec (62/62) pass
- ESLint: 0 errors 0 warnings
