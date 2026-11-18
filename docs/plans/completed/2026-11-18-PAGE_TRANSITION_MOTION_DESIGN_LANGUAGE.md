---
type: plan
status: active
last_updated: 2026-11-18
last_verified: 2026-11-18
progress: "P0 已完成 / P1 已完成 / P2 已完成 / P3 已完成 / P4 進行中"
tags:
  - uiux
  - motion-design
  - page-transition
  - micro-interaction
  - design-language
summary: "固定頁面過場動畫與微交互為 InvestmentLineNotify 專案 UI/UX 設計語言，確保跨頁面一致性與品質。範圍：webapp/ (Vue 3 + Vite，Telegram Mini App)。"
related_code:
  - webapp/src/App.vue
  - webapp/src/components/common/RouteLoading.vue
  - webapp/src/components/common/Icon.vue
  - webapp/src/components/common/icon-registry.js
  - webapp/src/styles/tokens.css
  - webapp/src/shared-styles.css
related_docs:
  - docs/plans/active/2026-11-17-UIUX_OPTIMIZATION_PLAN.md
  - docs/design/DESIGN_PRINCIPLES.md
wiki_links:
  - [[動畫設計語言]]
  - [[頁面過場]]
---

# 頁面過場動畫與微交互設計語言固化計畫

> **版本**：v1.0
> **狀態**：📋 規劃中
> **範圍**：`webapp/`（Vue 3 + Vite，Telegram Mini App，單開發者模式）
> **不改動**：API 契約、資料模型、後端邏輯、路由 `redirect` 語義、既有 E2E 測試選擇器（除非配合本計畫調整）
> **設計語言固化**：本計畫通過後，成為本專案固定開發設計語言，所有新頁面與新互動必須遵守，嚴禁新增未經審核的動畫樣式。

---

## 1. 背景與目標

### 1.1 問題

- 路由切換時，報表尚未載入會短暫顯示空白或異常（用戶回報「箱子」），網路較慢或無暫存時等待焦慮明顯。
- 現有 `<Transition name="route-fade">` 僅為基礎淡入淡出，缺乏載入狀態與微互動回饋。
- 專案尚無固定的動畫設計語言，各頁面互動品質不一致。

### 1.2 目標

1. 固定「頁面過場動畫與微交互」為本專案 UI/UX 設計語言，確保跨頁面一致性。
2. 降低等待焦慮：報表/數據載入期間提供骨架屏或明確載入指示。
3. 控制動畫時間：微互動 150–300ms，頁面轉場不超過 500ms。
4. 僅對 `transform` 與 `opacity` 做動畫，啟用 GPU 硬體加速。
5. 零新增依賴：僅使用 CSS Transitions / Keyframes 與 Vue 內建 `<Transition>`，不引入 GSAP、Barba.js、Lottie 等外部庫。
6. TDD 強制：所有新互動先寫測試（RED → GREEN → REFACTOR → VERIFY）。

---

## 2. 設計語言原則（固定為專案規範）

| 原則       | 具體規定                                     | 理由                       |
| ---------- | -------------------------------------------- | -------------------------- |
| 動畫時間   | 微互動 150–300ms；頁面轉場 ≤ 500ms           | 避免操作延遲感             |
| 緩動函數   | 進場用 `ease-out`（先快後慢），禁用 `linear` | 模擬真實物理慣性           |
| 錯開進場   | 多卡片/列表項目間隔 50–100ms 依序進場        | 提升畫面韻律感             |
| 高效能屬性 | 僅對 `transform` 與 `opacity` 做動畫         | 啟用 GPU 加速，避免卡頓    |
| 克制       | 動畫為輔助，不搶奪視覺焦點，不炫技           | 投資 App 專注數據誠信感    |
| 無新增依賴 | 純 CSS + Vue 內建 Transition                 | 維持 Bundle 預算與維護簡單 |

---

## 3. 過場動畫類型與導入評估

| 類別     | 方案                            | 評估                                                   | 決定                        | 階段    |
| -------- | ------------------------------- | ------------------------------------------------------ | --------------------------- | ------- |
| 頁面切換 | Cross-fade（淡入淡出）          | ✅ 適合，App.vue 已有 `<Transition name="route-fade">` | 立即導入，優化時機與 easing | P0      |
| 頁面切換 | Mask/Wipe（遮罩展開）           | ❌ 不適合，SPA 內切換不需遮罩，增加複雜度              | 不導入                      | —       |
| 頁面切換 | Skeleton Screen（骨架屏）       | ✅ 適合，報表/數據載入等待，降低焦慮                   | Phase 2 導入                | P1      |
| 滾動觸發 | Fade-up（由下而上浮現）         | ✅ 適合，卡片列表進場，純 CSS，GPU 加速                | Phase 3 導入                | P2      |
| 滾動觸發 | Parallax（視差滾動）            | ❌ 不適合，分散投資數據注意力，360px 無意義            | 不導入                      | —       |
| 滾動觸發 | Text Reveal                     | ⚠️ 延後，非核心路徑                                    | 視需求後續加入              | P4 候選 |
| 元素狀態 | Hover & Active（按鈕/卡片回饋） | ✅ 適合，純 CSS，150–300ms                             | Phase 3 導入                | P2      |
| 元素狀態 | Shared Element（共享元素轉場）  | ❌ 不適合，Vue 路由實現複雜，單開發者維護成本高        | 不導入                      | —       |
| 資料動態 | Number Counter（數字計數）      | ⚠️ Phase 4，儀表板總資產等數字可加                     | 非優先                      | P4 候選 |
| 資料動態 | SVG Line Drawing                | ⚠️ 延後，圖表已有現成庫                                | 視需求後續加入              | P4 候選 |

---

## 4. 階段規劃

### P0 — 基礎頁面過場（立即，已部分完成）

**目標**：修正 RouteLoading 與 route-fade 過場，確保載入時不顯示異常（箱子/空白）。

Todo：

- [ ] 檢查 App.vue `<Transition name="route-fade">` 與 RouteLoading.vue 狀態，確認 CSS 變數 `--iln-border-default`、`--iln-brand` 已定義，避免 spinner 透明。
- [ ] 在 RouteLoading.vue 新增 `v-if="isLoading"` 控制，避免無暫存時閃爍異常。
- [ ] 統一頁面進入/離開的 `route-fade` easing 與 duration（≤ 500ms，`ease-out`）。
- [ ] 撰寫 Playwright E2E 測試：路由切換時 loading 狀態可見，不出現空白/箱子（TDD：先紅後綠）。
- [ ] 驗收：60 passed，1 skipped，0 failed；Lint 0；Build 預算內。

### P1 — 骨架屏（Skeleton Screen）

**目標**：報表/數據載入期間顯示灰色版面輪廓（Shimmer），降低等待焦慮。

Todo：

- [ ] 新增 `SkeletonLoading.vue` 組件，使用 `--iln-surface`、`--iln-border-default` 等設計 token。
- [ ] 在數據依賴頁面（儀表板指標卡、新聞報告區、策略設定模組）插入骨架屏。
- [ ] 撰寫 Vitest 測試驗證骨架屏在 loading 狀態可見、資料就緒後消失（TDD）。
- [ ] 撰寫 Playwright E2E 測試驗證載入過場無空白閃爍。
- [ ] 驗收：單元測試通過，E2E 0 失敗。

### P2 — 滾動觸發與微互動

**目標**：卡片列表 Fade-up 進場，按鈕/卡片 Hover/Active 回饋。

Todo：

- [ ] 新增 CSS 動畫類 `.fade-up`（`transform: translateY(20px)` → `0`，`opacity: 0` → `1`，`ease-out` 300ms）。
- [ ] 在儀表板指標卡、新聞列表、策略模組面板套用 `.fade-up`，搭配 50–100ms stagger。
- [ ] 新增按鈕 `:active` 與卡片 `:hover` 的微回饋（陰影加深、上浮 ≤ 4px，150–300ms）。
- [ ] 撰寫 Vitest 測試驗證類名與動畫屬性。
- [ ] 撰寫 Playwright 360px RWD 測試確認無溢出。
- [ ] 驗收：E2E 360px 測試通過，Lint 0。

### P3 — 數據動態（選擇性，視 P0–P2 完成度）

**目標**：儀表板總資產等數字進入畫面時 Number Counter 計數。

Todo：

- [ ] 新增 `NumberCounter.vue` 組件，從 0 快速跳動至目標數字，≤ 500ms。
- [ ] 僅在區塊進入視窗時觸發一次（Intersection Observer）。
- [ ] 撰寫 Vitest 測試驗證計數邏輯。
- [ ] 驗收：單元測試通過。

### P4 — 全盤驗收與設計語言固化

**目標**：確認所有階段品質，將設計語言寫入專案規範，禁止偏離。

Todo：

- [ ] 完整運行 E2E（`--workers=1`），確認 0 失敗。
- [ ] 運行 Vitest 全套，確認 ≥ 基準測試數（現行 701）。
- [ ] 運行 Lint、Build 預算檢查（Initial ≤ 156.0 KB / Total ≤ 380.0 KB）。
- [ ] 更新 `docs/design/DESIGN_PRINCIPLES.md`，將本計畫動畫原則寫入固定設計語言。
- [ ] 將本計畫移至 `docs/plans/completed/`，標記為固定設計語言。

---

## 5. Todo 清單（總覽，避開發偏離）

| ID   | 待辦事項                                              | 階段 | 優先 | 狀態   | 驗收方式           |
| ---- | ----------------------------------------------------- | ---- | ---- | ------ | ------------------ |
| T-01 | 檢查並修正 RouteLoading 與 route-fade，確保載入無異常 | P0   | 高   | 已完成 | Playwright E2E     |
| T-02 | 撰寫路由切換 loading E2E 測試（TDD 先紅）             | P0   | 高   | 已完成 | Playwright         |
| T-03 | 新增 SkeletonLoading.vue 組件                         | P1   | 中   | 已完成 | Vitest + E2E       |
| T-04 | 在數據頁面插入骨架屏                                  | P1   | 中   | 已完成 | E2E                |
| T-05 | 新增 `.fade-up` CSS 動畫與 stagger                    | P2   | 中   | 已完成 | Vitest + E2E 360px |
| T-06 | 新增按鈕/卡片 Hover/Active 微回饋                     | P2   | 中   | 已完成 | Vitest + E2E       |
| T-07 | 新增 NumberCounter.vue（選擇性）                      | P3   | 低   | 已完成 | Vitest             |
| T-08 | 全盤驗收：E2E、Vitest、Lint、Build 預算               | P4   | 高   | 進行中 | 終端驗證           |
| T-09 | 寫入 `docs/design/DESIGN_PRINCIPLES.md` 固定設計語言  | P4   | 高   | 已完成 | 文件 commit        |
| T-10 | 歸檔本計畫至 completed/                               | P4   | 中   | 進行中 | git mv             |

---

## 6. 各階段重點與交付物

### P0 交付物

- 修正後的 `RouteLoading.vue` 與 `App.vue` route-fade 過場。
- 新增路由切換 loading E2E 測試檔。
- E2E：60 passed，1 skipped（模擬器頁已移除），0 failed。

### P1 交付物

- `src/components/common/LoadingSkeleton.vue`（已修正，使用 `--iln-surface`、`--iln-border-default`）。
- `src/test/e2e/22-skeleton-screen.spec.js`（SK-001/002/003，3/3 通過）。
- 註：完整 E2E 套件中 `13-bottom-nav-safe-area.spec.js` 技術指標頁底部導覽安全區 1 失敗，**非 P1 計畫內**，已記錄，計畫全部完成後統一處理。

### P2 交付物

- CSS 動畫類 `.fade-up` 與 stagger 變數（定義在 `tokens.css` 或 `shared-styles.css`）。
- 按鈕/卡片 `:hover`/`:active` 微回饋樣式。
- 360px RWD E2E 測試通過。

### P3 交付物（選擇性）

- `src/components/common/NumberCounter.vue`。
- Vitest 測試檔。

### P4 交付物

- 全套測試通過（E2E `--workers=1`，Vitest ≥ 701，Lint 0，Build 預算內）。
- `docs/design/DESIGN_PRINCIPLES.md` 更新，動畫原則固化為專案設計語言。
- 本計畫移至 `docs/plans/completed/`。

---

## 7. 進度跟踪與品質門禁

### 7.1 進度更新規則

- 每個階段（P0–P4）完成後，**必須**更新本檔案 `progress` 欄位與各 Todo 狀態。
- 每個階段完成後，必須 commit 並推送至 `origin/main`，作為階段錨點。
- 下一階段開始前，必須確認上一階段所有驗收標準通過。

### 7.2 品質門禁（每個階段必須通過）

| 項目           | 標準                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| TDD            | 新功能必須先寫測試（RED），再實作（GREEN），最後重構（REFACTOR），再驗證（VERIFY）。 |
| Vitest         | 全套單元測試 ≥ 701，0 失敗。                                                         |
| Playwright E2E | `--workers=1` 執行，0 失敗；模擬器頁保持 `test.skip`（已移除不可復原）。             |
| Lint           | 0 違規。                                                                             |
| Build 預算     | Initial ≤ 156.0 KB / Total ≤ 380.0 KB。                                              |
| 設計 token     | 所有樣式必須使用 `--iln-*` 設計 token，禁止硬編碼顏色。                              |
| 圖示           | 後端回傳 emoji 不進入 ICON_MAP；前端 computed 映射為語義鍵再傳入 `<Icon>`。          |

### 7.3 偏離管制

- 任何新動畫樣式若不在本計畫評估表中，必須先更新本計畫並取得確認後才能實作。
- 嚴禁新增外部動畫依賴（GSAP、Barba.js、Lottie、Framer Motion 等）。
- 嚴禁硬編碼顏色，必須使用 `--iln-*` 設計 token。

---

## 8. 驗收標準（Definition of Done）

1. 路由切換時，報表尚未載入不再出現異常（箱子/空白），RouteLoading 正常顯示。
2. P0–P2 所有 Todo 勾選完成，且每個階段皆有對應測試通過。
3. E2E 全套（`--workers=1`）：0 失敗，1 skipped（模擬器頁已移除）。
4. Vitest 全套：≥ 701，0 失敗。
5. Lint：0 違規；Build：預算內。
6. `docs/design/DESIGN_PRINCIPLES.md` 已寫入動畫設計語言原則。
7. 本計畫狀態更新為 `completed`，並移至 `docs/plans/completed/`。

---

> **特別聲明**：模擬器頁面已從當前版本整體移除，**不可復原此頁面**。相關 E2E 測試 DSH-003 維持 `test.skip`，不得重新啟用。
