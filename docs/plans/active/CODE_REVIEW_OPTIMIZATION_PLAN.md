# Code Review 後續追蹤優化計畫 (CODE_REVIEW_OPTIMIZATION_PLAN.md)

> **狀態**：Active
> **建立日期**：2026-09-02
> **背景**：在完成 Dashboard 單頁 Carousel 整合與 News Tab 恢復後，經 `code-review-expert` 審查提出 P1/P2/P3 優化項目，旨在提升組件邊界容錯、動畫體驗與無障礙支援。

---

## 🎯 優化目標清單

### Phase 1: P1 邊界容錯與 API 狀態修復

- [ ] **StrategyStatusView.vue**: `allocationTiers` 陣列轉換補上 `filter` 防護，防止無效或非數字 `minScore` 導致渲染異常。
- [ ] **DashboardView.vue**: `loadAll()` 補上 `strategyStatusLoading` 與 `strategyStatusError` 處理，避免單一 API 失敗時靜默轉為自載重複發送請求。

### Phase 2: P2 體驗與狀態邏輯優化

- [ ] **DashboardView.vue**: `.card-body` 加上 `<Transition name="card-content">`，使折疊展開 CSS 動畫正常生效。
- [ ] **StrategyStatusView.vue**: `isLoading` / `loadError` computed 改為明確判定 `props.loading` / `props.error` 或 self-load 狀態。

### Phase 3: P3 細節優化與測試驗證

- [ ] **DashboardView.vue**: `.config-fab` 補上 `aria-label="策略設定"`。
- [ ] **單元測試與 E2E 驗證**: 執行 Vitest 359+ 測試與 Playwright 62/62 測試，確保改動無迴歸。

---

## 執行紀錄與 Commit 規範

- 採用 TDD (Red -> Green -> Refactor)
- 每階段完成後進行單元測試與 Commit
  EOF
