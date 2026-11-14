---
type: reference
status: current
last_updated: 2026-11-14
tags:
  - auto-generated
wiki_links: []
---

# 設計令牌審計報告 (Token Audit Phase 5)

> 階段五 CARD-5.0 產出。本報告只做**審計與計畫**，不進行令牌遷移（遷移由 5.1–5.5 各頁自行執行，見「遷移計畫」）。

## 1. 審計指令

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" webapp/src/views/ webapp/src/components/ \
  --include='*.vue' | grep -v "var(--iln" | grep -v "currentColor"
```

## 2. 摘要

| 項目                                           | 結果                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| 匹配行數                                       | 152 行                                                |
| 涉及檔案                                       | `views/*.vue` (6)、`components/*.vue` (12)            |
| 可直接遷移（現有令牌可覆蓋）                   | 大量 `rgba(0,0,0,0.x)`、`rgba(255,255,255,0.x)`       |
| 需新增令牌（品牌色 alpha / 浮水印 / SVG fill） | 見「分類結果」                                        |
| 例外保留（不遷移）                             | `readToken(...)` fallback、SVG `fill`、第三方元件覆寫 |

## 3. 分類結果

### 3.1 可遷移：已有對應令牌

| 裸值                                                                           | 建議對應令牌                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `rgba(52, 199, 89, 0.x)` / `rgba(255, 59, 48, 0.x)` / `rgba(255, 204, 0, 0.x)` | `--iln-ok-*` / `--iln-danger-*` / `--iln-warn-*`                  |
| `rgba(36, 129, 204, 0.x)`（品牌色）                                            | `--iln-brand-*`（AccountView 已用 `readToken("--iln-brand-...)`） |
| `rgba(0, 0, 0, 0.02–0.1)`（邊框/陰影/背景）                                    | `--iln-border-muted` / `--iln-shadow-*` / `--iln-bg-surface`      |
| `rgba(255, 255, 255, 0.x)`（浮水印/漸層）                                      | `--iln-bg-overlay-*`（新增）                                      |
| `rgba(244, 67, 54, 0.x)`（錯誤）                                               | `--iln-danger-*`                                                  |

### 3.2 需新增令牌（現有 `--iln-*` 無對應）

| 裸值                                          | 用途                                    | 建議令牌名稱                   | 備註                               |
| --------------------------------------------- | --------------------------------------- | ------------------------------ | ---------------------------------- |
| `rgba(232, 72, 85, 0.x)`（紅系統）            | MarketRadar/Technical/StatCard 狀態底色 | `--iln-status-danger-bg-*`     | 與 `--iln-danger` 不同色系，需新增 |
| `rgba(212, 172, 13, 0.x)`（黃/橘系統）        | MacroBattle 狀態底色                    | `--iln-status-warn-bg-*`       | 新增                               |
| `rgba(38, 161, 123, 0.x)`（綠系統）           | MacroBattle 狀態底色                    | `--iln-status-ok-bg-*`         | 新增                               |
| `rgba(198, 40, 40, 0.x)`（深紅系）            | box-shadow focus                        | `--iln-status-danger-shadow-*` | 新增                               |
| `rgba(255, 255, 255, 0.35) 50%`（浮水印漸層） | 騎乘漸層                                | `--iln-bg-watermark-*`         | 新增                               |

### 3.3 例外保留（不遷移）

| 類型                                           | 檔案範例                         | 原因                                    |
| ---------------------------------------------- | -------------------------------- | --------------------------------------- |
| `readToken("--iln-...", "rgba(...)")` fallback | `AccountView.vue:377,381`        | 已透過設計令牌系統讀取，fallback 為容錯 |
| SVG `fill="currentColor"` / `fill="#..."`      | icon-registry、theory 組件       | SVG 圖示色彩，非 UI 背景/邊框           |
| 第三方元件覆寫                                 | `theory/*.vue` 某些 inline style | 與設計令牌系統脫離，5.1–5.5 視情況處理  |

## 4. 檔案分佈（按涉及行數）

| 檔案                                                   | 概略                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `views/MarketRadarView.vue`                            | 紅/黃/綠狀態底色、浮水印漸層、danger 邊框/陰影             |
| `views/AccountView.vue`                                | 品牌色 alpha bg/border、黑色邊框/陰影、ok/danger/warn 狀態 |
| `views/DashboardView.vue`                              | box-shadow                                                 |
| `views/MacroBattleView.vue`                            | 綠/紅系統狀態底色                                          |
| `views/TheoryView.vue`                                 | 灰系統底色                                                 |
| `components/StrategyConfigPanel.vue`                   | 黑色邊框/陰影、品牌色 box-shadow、danger bg                |
| `components/MetricItem.vue`                            | 黑色邊框                                                   |
| `components/common/AuthExpiredModal.vue`               | 黑色背景遮罩/陰影                                          |
| `components/FloatingPill.vue`                          | 白色邊框/陰影                                              |
| `components/theory/*.vue`                              | 各種系統色 alpha 背景/邊框                                 |
| `components/dashboard/*.vue`、`components/chart/*.vue` | 零星裸值                                                   |

## 5. 遷移計畫（5.1–5.5 執行）

原則：不改路由、不改資料來源、不改決策鏈；只改樣式令牌。

1. **優先複用現有令牌**：`--iln-ok/warn/danger-*`、`--iln-brand-*`、`--iln-border-muted`、`--iln-shadow-*`、`--iln-bg-surface`
2. **缺失者**：在 `webapp/src/styles/tokens.css` 新增 `--iln-status-*` / `--iln-bg-*` 窄頻令牌，不得新增裸 hex/rgba
3. **各頁負責**：5.1 DashboardView、5.2 InsightsView (MarketRadar+MacroBattle)、5.3 ChartView (TechnicalPanel)、5.4 NewsView、5.5 AccountView
4. **驗收**：遷移後 `grep` 匹配行數應為 0（例外保留除外），lint 0/0，bundle 在預算內，360px 驗證通過

## 6. 不變約束

- 路由結構、D1–D6、`webapp/src/api/`、`src/ai/`：不變
- bundle 預算：Initial ≤ 156.0 KB，Total ≤ 380.0 KB
- 360px：每個新增元素須通過 360px 驗證

## 7. 首屏包體策略（CARD-5.1 A-2 順帶修正）

- **改動**：`StrategyConfigEditorView` 改為 `defineAsyncComponent`（僅在開啟設定抽屜時載入）
- **理由**：低頻頁面級組件（14 KB 原始，gzip 約 54 KB），高頻小元件（EmptyState / FreshnessBadge）保持同步，避免 UX 跳變
- **影響**：Initial 從 155.5 KB → 103.8 KB；Total 從 354.0 KB → 約 355.7 KB（+1.7 KB 為 defineAsyncComponent chunk wrapper 開銷）
- **流程**：經規劃者於 CARD-5.1 A-2 核實時同意；已拆為獨立 commit
- **未採納的方案**：`EmptyState` / `FreshnessBadge` async 化 — 高頻小元件，UX 代價（空白跳變、footer 高度跳動）＞ 包體收益，revert 回 sync
