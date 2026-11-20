---
type: reference
status: current
last_updated: 2026-11-20
last_verified: 2026-11-20
tags:
  - webapp
  - uiux
  - testing
summary: "記錄 WebApp UI 現代化計畫需求、頁面、測試與驗收證據的追溯矩陣"
related_docs:
  - docs/plans/active/2026-11-19-WEBAPP_UI_MODERNIZATION_PLAN.md
wiki_links:
  - [[Telegram Mini App]]
  - [[前端 UI/UX]]
---

# WEBAPP UI MODERNIZATION — 需求／頁面／測試／資料矩陣

來源：`docs/plans/active/2026-11-19-WEBAPP_UI_MODERNIZATION_PLAN.md` 四階段，變更範圍 `154b817^..8e86547`。
狀態欄：已通過（Green）/ 已修正待驗證（Green-pending）/ 缺漏需補測（Red）/ 證據不足（Gap）.

## 計畫子項（需求 ID）→ 頁面／元件 → 現有測試 → 證據狀態

| 需求（計畫位置）                              | 頁面／元件                         | 現有測試                                    | 證據狀態   | 備註                                                                              |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| P1-01 防禦性設計：無效/缺值顯示「—」          | AccountView、HealthPanel           | AccountView.test.js、HealthPanel.test.js    | **已通過** | `margin`/`fmtQty` 已以 TDD 修正，35/35                                            |
| P1-02 台北時區日期格式化                      | formatDate.js                      | formatDate.test.js                          | **已通過** | 11/11 既有                                                                        |
| P1-03 資料證據卡缺值處理                      | DataEvidenceCard                   | DataEvidenceCard.test.js                    | **已通過** | 5/5，已移除冗餘 `                                                                 |     | "—"` |
| P2-04 抽屜互動：窄屏可捲動、Escape 關閉       | Dashboard drawer (Macro)           | 02-dashboard-drawer.spec.js DSH-010/DSH-011 | **Gap**    | DSH-010 僅斷言 `body.width ≤ 390`，未檢查 drawer 內容可捲動；無窄屏焦點返回       |
| P2-05 抽屜互動：關閉後焦點返回                | Dashboard drawer (Strategy Config) | 02-dashboard-drawer.spec.js DSH-013         | **Gap**    | 只驗證焦點進入 dialog，未驗證關閉後焦點返回觸發元素                               |
| P2-06 抽屜互動：MainButton 與抽屜共存不遮擋   | DashboardView                      | 無                                          | **Red**    | 390×844 未測底導/MainButton 與 drawer 遮擋                                        |
| P1-07 390×844 六頁載入與確定資料              | 六頁                               | 25-six-pages-390x844.spec.js                | **Gap**    | 僅檢查頁面可見，未測遮擋與確定資料 fixture                                        |
| P1-08 1024px 桌機版面無橫向溢位               | 各路由                             | 24-desktop-layout-boundary.spec.js          | **已通過** | 6/6，但僅斷言總寬 ≤ 1024                                                          |
| P1-09 Insights 網格雙欄（≥768px）無溢位       | MacroBattleView                    | 24-desktop-layout-boundary.spec.js Insights | **Gap**    | 僅檢查 `.macro-events-grid` 可見，未驗證 `grid-template-columns` 2 欄與項目不溢出 |
| P3-10 計畫 checklist 與 PR checklist 狀態一致 | 計畫文件                           | 無                                          | **Gap**    | 階段二至四 checklist 與已執行測試不一致                                           |

## 驗收證據摘要（本階段）

- Vitest：HealthPanel 20/20、AccountView + HealthPanel 合併 35/35；`npm run lint` 0 errors／2 既有 warnings／raw-color 0 violations。
- Playwright：固定 `waitForTimeout(3000)` 已移除；六頁 E2E 6/6 綠；desktop boundary 6/6 綠；全站 Playwright 因容器資源曾 OOM，以 `--workers=1` 分片執行，不宣稱單次全套通過。
- 已知限制（非本階段新發現，不誤稱修復）：Account 通知設定模擬、ChartView 無頁內返回、正式環境 ChartView CSS preload 錯誤、Telegram 實體 WebView 未驗證。

## 下一步建議（依序）

1. 在 `02-dashboard-drawer.spec.js` 新增 DSH-015（窄屏 drawer 內容可捲動）、DSH-016（Escape 關閉後焦點返回）、DSH-017（抽屜開啟時 MainButton 不遮擋關鍵 drawer 內容）；RED → GREEN。
2. 在 `25-six-pages-390x844.spec.js` 補遮擋斷言與確定資料 fixture；RED → GREEN。
3. 在 `24-desktop-layout-boundary.spec.js` 補 Insights 雙欄 `grid-template-columns` 與無橫向溢位斷言；RED → GREEN。
4. 以 `--workers=1` 執行受影響 spec，驗證無退化，記錄 exit code 與 precise count。
5. 更新 `docs/plans/active/2026-11-19-WEBAPP_UI_MODERNIZATION_PLAN.md` 階段二至四狀態與 checklist，記錄證據。
6. 全量 `npm run lint` + `npm run test` + `npm run build`，`git diff --check`，工作樹乾淨後統一 commit。
