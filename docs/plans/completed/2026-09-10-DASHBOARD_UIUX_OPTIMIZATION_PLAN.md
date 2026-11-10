---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# 投資儀表板 (Telegram Miniapp) 總覽頁面 UI/UX 整合優化計畫 (2026-09-10-DASHBOARD_UIUX_OPTIMIZATION_PLAN.md)

> **狀態**：Completed — 已完成全階段開發、單元測試、E2E 測試與部署驗證
> **建立日期**：2026-09-06
> **優化原則**：「資訊零刪減、視覺高收斂」

---

## 核心優化階段與分工 (Phases)

### Phase 1: 數值顯示與全域格式最佳化 (Data Formatting & Global Filters)

- **需求**：解決浮點數未格式化問題（如 `0.93955613524562`），統一四捨五入至小數點後兩位（例：`0.94x`、`40.12%`）。
- **實作**：
  - 在 `src/utils/formatters.js` 中實作/完善 `fmtDecimal(val, digits = 2)` 及 `fmtRatio`。
  - 在 `StrategyStatusView.vue`、`AnalysisPanel.vue` 及儀表板各 Card 渲染層導入 formatter。
  - **資料保留**：API 原生 response 與 Pinia/State 中的數值保留完整精確度，僅在 template 截斷。
- **測試**：單元測試驗證各式極端值（null, undefined, 0, 純數值, 浮點數）。

### Phase 2: 首屏視覺整合與 VIX 去重 (Above the Fold Refactor)

- **需求**：收斂首屏視圖，結合「市場大環境」與「帳戶健康度」，移除重複顯示之 VIX。
- **實作**：
  - 重構 `DashboardView.vue` 頂部排版，置頂 `DecisionHero` (核心指令與路由) 與 `MarketSnapshot` (VIX、PB PR、景氣燈號)。
  - `MarketSnapshot` 移除重複之 VIX 卡片，聚焦於「大勢與分位數」。
  - 下接 `HealthPanel` (帳戶健康評級 0-100)，形成極為順暢之首屏視覺流。
- **測試**：單元測試與 Playwright E2E 驗證首屏組件渲染順序與標籤。

### Phase 3: AI 教練建議卡片漸進式揭露 (Progressive Disclosure)

- **需求**：解決 AI 建議長文本佔據畫面問題。
- **實作**：
  - 重構 `CoachingAdvice.vue`：
    - **預設視圖**：僅呈現頂部「核心洞察」列與精簡數量標籤（如：⚠️ 風險 3 項 ｜ 📌 觀察 2 項）。
    - **展開視圖 (Accordion)**：點擊各標籤列平滑展開完整條目與「教練內心推演 (Thinking)」。
- **測試**：單元測試驗證預設折疊狀態與點擊展開行為。

### Phase 4: 策略與風控面板 Segmented Control 分頁卡片化 (Spatial Optimization)

- **需求**：收縮垂直長度，將「策略評分」與「風控機制」整理至單一卡片。
- **實作**：
  - 採納 **選項 A (Segmented Control)**：在 `StrategyStatusView.vue` 頂部加入 `[ 📊 評分構成 ] [ 🛡️ 風控守衛 ]` 切換頁籤。
  - 將低頻變動參數（如生命週期階段 EARLY、資金管控 Budget Priority）簡化為點擊彈出或 Badge 標籤。
- **測試**：單元測試驗證 Tab 切換顯示與 E2E 測試。

---

## 驗證標準 (Definition of Done)

1. 全套 Vitest 單元測試 (53+ files) 全數通過。
2. ESLint 零錯誤零警告。
3. Production Vite Build 打包成功。
4. Playwright E2E 測試全數通過。
