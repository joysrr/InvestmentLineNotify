---
type: plan
status: phase-2-completed
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - webapp
  - refactor
  - phase-3
  - phase-4
  - phase-5
  - phase-6
  - phase-7
---

# WebApp 重構母計畫（v2）

## 概覽

本計畫定義 InvestmentLineNotify WebApp 階段三至階段七的重構路徑，建立於 Phase 2（通用卡片組件提取與 Emoji 清理）已完成之上（main @ 0c8f1d7）。目標：將現有 10 個視圖／11 條路由收斂為 5 個一級入口，並補齊資訊架構、內容去重、頁面精修、平台無障礙與驗證四大里程碑。

基線：Phase 2 最終狀態（618/618 測試全綠、lint 0/0、Initial 155.3 KB / Total 375.6 KB、Tier A UI Emoji = 0）。

---

## 決策記錄（D1–D6）

| #   | 決策項                     | 決議                                         | 說明                                                                                        |
| --- | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| D1  | TheoryView 歸屬            | 移入「帳戶與設定」的「關於」區段             | 低頻、說明性質，不佔一級入口；若 CARD-00 第 5 項核實為「承載模擬器」，則另立入口，D1 需微調 |
| D2  | TechnicalView 與 ChartView | 合併為單一「圖表」頁                         | 以 ChartView 為主體，TechnicalView 以 SubTabBar / CollapsibleSection 併入                   |
| D3  | StrategyStatusView 去留    | 廢止獨立路由，改以 drawer 呈現               | 體積 31.6 KB 且與 Dashboard 重疊最多；原路徑保留 redirect                                   |
| D4  | 一級入口清單               | 總覽／市場洞察／圖表／新聞與報告／帳戶與設定 | 共 5 項，對應 5 個一級路由                                                                  |
| D5  | 模擬器頁                   | 待 CARD-00 第 5 項核實                       | 若不存在則從計畫移除；若存在則抽出模擬器元件另立入口                                        |
| D6  | 使用資料回饋               | 僅前端 localStorage 本地統計                 | 不涉隱私、零後端改動；屬階段七，本批卡不含                                                  |

---

## 現狀基線（Phase 2 收尾）

| 項目            | 數值                      | 來源                                                        |
| --------------- | ------------------------- | ----------------------------------------------------------- |
| 測試總數        | 618 / 618                 | npx vitest run（96 test files）                             |
| Lint            | 0 errors / 0 warnings     | npm run lint（含 check-no-hex.mjs）                         |
| Initial gzip    | 155.3 KB（預算 156.0 KB） | npm run build + check-bundle-size.mjs                       |
| Total gzip      | 375.6 KB（預算 380.0 KB） | 同上                                                        |
| Tier A UI Emoji | 0 處                      | emoji-audit 掃描（203 命中，皆為 Tier B/C 或非 Emoji 符號） |
| 視圖數          | 10 個                     | webapp/src/views/                                           |
| 路由數          | 11 條                     | webapp/src/router/index.js                                  |
| 主分支          | main @ 0c8f1d7            | git log                                                     |

---

## 里程碑（M0–M4）

| 里程碑 | 卡片      | 目標                               | 前置                                       |
| ------ | --------- | ---------------------------------- | ------------------------------------------ |
| M0     | CARD-00   | 計畫落地與現狀核實                 | 無                                         |
| M1     | CARD-01   | Dashboard ↔ StrategyStatus 去重    | CARD-00                                    |
| M1     | CARD-02   | News 精選報告 ↔ 新聞池釐清         | CARD-00                                    |
| M1     | CARD-03   | 指標卡跨頁統一                     | CARD-00                                    |
| M2     | CARD-04   | 一級入口精簡與路由重構             | CARD-01 / 02 / 03 全部驗收                 |
| M2     | CARD-05   | 頁面職責矩陣                       | 可與 CARD-04 並行，須在 CARD-04 收口前完成 |
| M3     | CARD-05.x | 階段五頁面精修（5.1–5.5）          | M2                                         |
| M4     | CARD-06.x | 階段六七（a11y、資料新鮮度、驗證） | M3                                         |

---

## 階段三：資訊架構與導航重構（CARD-00 ～ CARD-05）

### CARD-00 · 計畫落地與現狀核實（M0，0.5 日）

純文件與盤點，不動 `webapp/src/` 程式碼。產出：

- `docs/webapp-refactor-plan.md` 覆寫為 v2 全文（本檔）
- 五份子計畫骨架（phase-3 至 phase-7），狀態標「未開始」
- `docs/refactor/phase-1-foundation.md` last_updated 修正為實際完成日期
- 六項現狀核實結果寫入 `docs/refactor/phase-4-content-dedup.md`「現狀盤點附錄」

六項核實：

1. FloatingPill.vue 導航項數與目標
2. StatCard 在 Radar / Technical 的覆蓋率
3. App.vue 的 `<keep-alive>` include
4. CI 是否含 bundle 體積檢查
5. TheoryView 是否承載模擬器／推演（影響 CARD-04 Theory 併入方式）
6. 全站 `window.open` 殘留

### CARD-01 · Dashboard ↔ StrategyStatus 去重（M1，1 日，決策 D3）

產出 `StrategyStatusSummary.vue`、`StrategyStatusPanel.vue`、兩份測試、更新 `router/index.js`（移除 `/strategy-status`、新增 redirect）、`phase-4-content-dedup.md` 欄位對照表。

### CARD-02 · News 精選報告 ↔ 新聞池釐清（M1，1 日，決策：兩者資料源不同）

產出 `NewsCard.vue`、`utils/newsMatch.js` + 測試、`NewsCard.test.js`、改寫後的 `NewsView.vue`、資料源關係說明。禁止合併兩個 tab、禁止修改後端行為。

### CARD-03 · 指標卡跨頁統一（M1，0.5 日）

產出遷移後的 `MarketRadarView.vue` / `TechnicalView.vue`、docs/design/status-semantics.md、`StatCard.test.js` 補充 status 斷言。兩頁指標卡 100% 使用 StatCard。

### CARD-05 · 頁面職責矩陣（M2，0.5 日，可與 CARD-04 並行）

產出 docs/design/page-responsibility-matrix.md，涵蓋全部 5 個一級入口。

### CARD-04 · 一級入口精簡與路由重構（M2，4 日，決策 D1、D2、D4）

產出 `SubTabBar.vue` + 測試、`InsightsView.vue`、合併後的 `ChartView.vue`、更新 `router/index.js`、`FloatingPill.vue`、`App.vue`、`router.test.js`、`phase-3-information-architecture.md`。5 個一級入口：總覽、市場洞察、圖表、新聞與報告、帳戶與設定。

---

## 階段四：內容去重（CARD-01 子計畫詳細細節）

階段四由 CARD-01～CARD-03 執行，聚焦「同一資訊多處呈現」的去重：

- **D0（去重原則）**：同一資訊僅有一個權威來源，其他入口透過引用、drawer 或 redirect 連接，避免複製貼上導致資訊不同步。
- **Dashboard ↔ StrategyStatus**：StrategyStatusView 31.6 KB 拆分為摘要（Dashboard 內嵌）與完整面板（drawer），原獨立路由廢止。
- **News 精選報告 vs 新聞池**：資料源不同（fetchReportNews vs fetchNews），採「標記＋說明」而非「置頂或合併」。
- **指標卡**：MarketRadar / Technical 未遷移部分統一遷移至 StatCard，四種 status（ok/warn/danger/neutral）跨頁統一映射。

子計畫模板（參照 CARD-01～CARD-05 格式）：

```
卡片：CARD-XX
標題：<...>
里程碑：M<x>
預估：<x 日>
前置：<...>
完成項目：
  - ...
實測證據：
  - 測試：<Test Files / Tests 數字>
  - lint：<errors / warnings>
  - 體積：Initial <x> KB / Total <y> KB
未決事項：
  - ...
下一步建議：
  - ...
```

---

## 階段五至七框架

### 階段五：頁面精修（5.1–5.5）

| 子卡 | 頁面         | 焦點                   | 前置    |
| ---- | ------------ | ---------------------- | ------- |
| 5.1  | 總覽頁       | 精修                   | CARD-04 |
| 5.2  | 市場洞察頁   | 精修                   | CARD-04 |
| 5.3  | 圖表頁       | 精修                   | CARD-04 |
| 5.4  | 新聞頁       | 精修                   | CARD-04 |
| 5.5  | 帳戶與設定頁 | 精修（含 Theory 併入） | CARD-04 |

### 階段六：平台無障礙與相容性

| 子卡 | 項目               | 說明                                   |
| ---- | ------------------ | -------------------------------------- |
| 6.1  | 資料新鮮度全域元件 | 統一顯示資料更新時間                   |
| 6.2  | 視口與相容性       | 360px 寬下無橫向滾動、5 個導航項不換行 |
| 6.3  | a11y 基線          | 鍵盤導航、ARIA、對比度                 |

### 階段七：驗證與持續改進

| 子卡    | 項目           | 說明                                                   |
| ------- | -------------- | ------------------------------------------------------ |
| 7.1–7.3 | 驗證與持續改進 | E2E、效能監視、使用者回饋（localStorage 本地統計，D6） |

---

## 已知落差表

| #   | 項目                                 | 現況                         | 預期                       | 計畫處理                              |
| --- | ------------------------------------ | ---------------------------- | -------------------------- | ------------------------------------- |
| L1  | TheoryView 是否承載模擬器            | 未確認（待 CARD-00 第 5 項） | 明確承載 / 不承載          | 依結果決定 Theory 併入方式（D1 微調） |
| L2  | StatCard 在 Radar / Technical 覆蓋率 | 未確認（待 CARD-00 第 2 項） | 100%                       | CARD-03 逐一遷移                      |
| L3  | CI bundle 體積檢查                   | 未確認（待 CARD-00 第 4 項） | 已含 check-bundle-size.mjs | 若無則補上 CI 步驟                    |
| L4  | 全站 `window.open` 殘留              | 未確認（待 CARD-00 第 6 項） | 0 處                       | CARD-00 盤點後清理                    |
| L5  | 一級入口數                           | 現有多個子頁面分散           | 5 個                       | CARD-04 收斂                          |
| L6  | `window.open` 殘留                   | 未確認                       | 0 處                       | CARD-00 第 6 項                       |

---

## 文件清單（本計畫相關）

| 檔案                                              | 用途               | 狀態                   |
| ------------------------------------------------- | ------------------ | ---------------------- |
| docs/webapp-refactor-plan.md                      | 母計畫（本檔）     | 已完成（v2）           |
| docs/refactor/phase-1-foundation.md               | Phase 1 基礎       | 已完成                 |
| docs/refactor/phase-2-foundation.md               | Phase 2 基礎       | 已完成                 |
| docs/refactor/phase-2-remediation.md              | Phase 2 收口       | 已完成                 |
| docs/refactor/phase-2-migration-inventory.md      | Phase 2 遷移清單   | 已完成                 |
| docs/refactor/emoji-audit-phase-2.md              | Phase 2 Emoji 掃描 | 已完成                 |
| docs/refactor/phase-3-information-architecture.md | 階段三子計畫       | 未開始（本卡建立骨架） |
| docs/refactor/phase-4-content-dedup.md            | 階段四子計畫       | 未開始（本卡建立骨架） |
| docs/refactor/phase-5-page-polish.md              | 階段五子計畫       | 未開始（本卡建立骨架） |
| docs/refactor/phase-6-platform-a11y.md            | 階段六子計畫       | 未開始（本卡建立骨架） |
| docs/refactor/phase-7-verification.md             | 階段七子計畫       | 未開始（本卡建立骨架） |

---

## 驗收（CARD-00）

- [ ] docs/ 路徑引用檢查全綠（docs-validation.yml 等價）
- [ ] 母計畫階段表完整覆蓋一至七
- [ ] 全 repo 無未來日期
- [ ] 六項現狀核實全部有結論與證據
- [ ] `npm --prefix webapp run lint` 通過
