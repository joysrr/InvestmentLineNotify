# 市場雷達、多空對決與技術指標導覽整合計畫 (NAVIGATE_MACRO_BATTLE_PLAN.md)

> **狀態**：Active — 計畫已建立，進入 TDD 開發階段
> **建立日期**：2026-09-06
> **目標**：在 `MarketRadarView.vue`、`MacroBattleView.vue` 與 `TechnicalView.vue` 頂部加入統一的分頁切換導覽列 (`NavSubtabs`)，使使用者能方便地在「市場雷達 (Radar)」、「多空對決 (Macro)」與「技術指標 (Technical)」三個市場戰情視圖之間順暢切換。

## 開發階段 (Phases)

### Phase 1: 建立或在 Views 頂部加入分頁切換按鈕與單元測試

- 在 `MarketRadarView.vue` 頂部 header 下方加入子分頁選單：
  - `🌐 市場雷達` (現有 `/radar`)
  - `⚖️ 多空對決` (前往 `#/macro`)
  - `📊 技術指標` (前往 `#/technical`)
- 在 `MacroBattleView.vue` 與 `TechnicalView.vue` 頂部同步加入此子分頁選單。
- 撰寫單元測試與驗證。

### Phase 2: E2E 測試與部署驗證

- 撰寫 / 更新 Playwright E2E 測試 (驗證 `/radar` -> `#/macro` -> `#/technical` 切換自如)。
- 執行全面單元測試 `npx vitest run` 與 ESLint 檢查。
- 打包 Build 並提交 Git 錨點。
