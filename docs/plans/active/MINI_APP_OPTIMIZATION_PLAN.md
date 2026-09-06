# Mini App 用戶體驗與版面優化計畫 (MINI_APP_OPTIMIZATION_PLAN.md)

> **狀態**：Active — 計劃已完善，等待用戶確認後啟動開發
> **建立日期**：2026-09-06
> **背景**：根據 Han 對 Mini App 的實測反饋，進行第二階段用戶體驗優化：消除資訊重複、手機端 RWD 溢出修復、恢復日/週/月報專區，並清理無用靜態資訊。

---

## 🎯 四大優化任務詳細分析與計畫

### 1. 總覽資訊盤點與重複整併 (Overview Deduplication)

- **現狀盤點與問題**：
  - `DecisionHero`（AI 動作建議）與 `CoachingAdvice`（AI 教練建議）各自獨立佔據大量版面，且「策略定調」與「動作建議」重複。
  - `MarketSnapshot`（VIX, PR, GL, 燈號）與 `HealthPanel` / `StrategyStatusView` 中的指標高度重疊。
- **整併方案**：
  - **Hero 卡片融合**：將 `DecisionHero` 與 `CoachingAdvice` 融合成單一 **「🤖 AI 決策與教練戰術」** 卡片。上方顯眼展示 AI 動作與評分，下方提供折疊式的「核心洞察」與「下一步觀察清單」。
  - **市場快照緊湊化**：縮減 `MarketSnapshot` 的邊距，將重複率高的欄位交由 `HealthPanel`（健康度）與 `StrategyStatusView`（策略狀態）折疊卡片呈現。

### 2. 手機端 (Mobile RWD) 排版與溢出最佳化

- **能力評估與承諾**：完全具備處理能力。
- **問題分析與修復重點**：
  - 窄螢幕 (375px Viewport) 下，`ThresholdItem`, `BudgetItem`, `RiskItem`, `MetricItem` 的 Grid/Flex 欄位會擠壓溢出或出現橫向滾動條。
  - **修復措施**：
    - 全面調整數字與標籤字級（13px/12px），`padding` 從 16px 精簡至 10-12px。
    - 替金額與長字串加上 `overflow: hidden; text-overflow: ellipsis;` 及 `word-break: break-all`。
    - ECharts 雷達圖改用自適應容器與 `autoresize`，避免超出卡片邊界。
  - **自動化驗證**：新增 Playwright 375px Viewport 測試 (`01-mobile-rwd.spec.js`) 檢查 `scrollWidth <= clientWidth`。

### 3. 日報、週報、月報 (Reports) 區塊恢復

- **現狀分析**：`ReportsView.vue` 頁面與 API (`/api/reports`) 功能完整，且已支援 daily/weekly/monthly 三分頁，但因 Bottom Nav 與頁面無入口導致功能隱形。
- **最佳呈現方案**：
  - **新聞與簡報整合 (News & Reports Hub)**：
    將 `NewsView.vue` (新聞頁面) 擴充為 **新聞與簡報中心**：
    - Subtab 1: 📰 今日新聞集錦 (News Pool)
    - Subtab 2: 📅 日報 / 週報 / 月報歷史簡報 (整合 `ReportsView.vue` 的完整功能)
  - 此方案讓所有資訊性內容集中在「新聞與簡報」主分頁，保持儀表板純粹專注於當前決策與帳戶狀態。

### 4. 移除 17 年大循環歷史數據橫幅 (.discipline-banner)

- **清理內容**：
  - 移除 `DashboardView.vue` 中的 `<div class="discipline-banner">` 靜態 HTML 區塊。
  - 移除 `.discipline-banner`, `.banner-icon`, `.banner-body`, `.banner-title`, `.banner-desc` 等 CSS 樣式。
  - 刪除 `goToDiscipline()` 事件處置函式。
  - 同步修復 Unit/E2E 測試中的橫幅點擊斷言。

---

## 📅 開發階段劃分 (Phases)

| Phase       | 任務                                | 預計產出                                                |
| ----------- | ----------------------------------- | ------------------------------------------------------- |
| **Phase 1** | 移除 `.discipline-banner` 靜態橫幅  | 刪除無用程式碼 + 更新單元測試 (Commit)                  |
| **Phase 2** | 新聞與簡報中心整合 (日/週/月報恢復) | 擴充 `NewsView.vue` 選項 + E2E 測試 (Commit)            |
| **Phase 3** | 手機端 RWD 排版溢出修復             | CSS 自適應優化 + Playwright 375px Viewport E2E (Commit) |
| **Phase 4** | 總覽 (Overview) 重複資訊整併        | 融合 DecisionHero & CoachingAdvice (Commit)             |
| **Phase 5** | 全套單元與 E2E 驗證歸檔             | 360+ Unit + 62+ E2E 綠燈 + 歸檔 active 計畫             |

---

## 🧪 驗證與品質門檻

- **TDD Enforcement**：修復/變更前先調整單元測試與 E2E 測試。
- **Mobile Viewport Check**：Playwright 在 375px (iPhone SE) 寬度無橫向滾動溢出。
- **Lint & Build**：0 ESLint errors，`npm run build` 成功。
