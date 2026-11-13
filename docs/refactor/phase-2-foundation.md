---
type: plan
status: completed
last_updated: 2026-11-13
tags:
  - webapp
  - refactor
  - phase-2
  - foundation
wiki_links: []
---

# Phase 2 工程基礎與通用組件

文件位置：`docs/refactor/phase-2-foundation.md`
適用範圍：`webapp/` 前端子專案

## 一、階段總覽

| 階段 | 名稱                                    | 狀態   | 說明                                                                                         |
| ---- | --------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| 二-1 | 通用卡片組件提取 (ContentCard/StatCard) | 已完成 | 21 張卡片遷移至 ContentCard/StatCard，設計令牌全面採用 `--iln-*`                             |
| 二-2 | 圖標系統重構 (Icon.vue)                 | 已完成 | 移除 `name="default"`，新增 radar/x-circle/chevron-down/check-circle/shield，Emoji→Icon 遷移 |
| 二-3 | 可摺疊區段組件 (CollapsibleSection)     | 已完成 | 統一所有 ad-hoc collapsible pattern，支援 header slot、indicator、controlled sync、動畫      |
| 二-4 | 視圖層 Emoji 清理                       | 已完成 | TechnicalView、AccountView、ExtremeRadarPanel 等視圖 Emoji→Icon 替換                         |
| 二-5 | 測試基礎設施                            | 已完成 | Vitest + @vue/test-utils，TDD RED-GREEN-REFACTOR-VERIFY                                      |

## 二、設計令牌

所有顏色、間距、字型、圓角一律使用 `--iln-*` CSS 變數，定義於 `src/styles/tokens.css`。禁止硬編碼 hex/rgba 值。

### 間距令牌範例

| 令牌            | 值   | 用途       |
| --------------- | ---- | ---------- |
| `--iln-space-1` | 4px  | 微間距     |
| `--iln-space-2` | 8px  | 小間距     |
| `--iln-space-3` | 12px | 卡片內填充 |
| `--iln-space-4` | 16px | 中間距     |

## 三、通用組件

### ContentCard (`src/components/common/ContentCard.vue`)

卡片容器組件，支援 `variant`（outlined/filled）、`padding`（sm/md/lg）、`radius`（sm/md/lg）、`status`（ok/warn/danger/neutral）。

### StatCard (`src/components/common/StatCard.vue`)

指標顯示卡片，支援 `label`、`value`、`unit`、`format`、`status`、`trend`、`size`、`align`、`framed`。`framed` 變體使用 `var(--iln-space-3)` 作為 padding。

### CollapsibleSection (`src/components/common/CollapsibleSection.vue`)

可摺疊區段，API：

- `title` (String, required)
- `expanded` (Boolean, default false)
- `toggleText` (String, default "")
- `indicator` (String, default "chevron", 可選 "chevron"\|"plus-minus"\|"text")
- Emits: `update:expanded` (Boolean)

支援 `#header` 插槽，預設內容為匿名插槽。

## 四、圖標系統

`Icon.vue` 使用內聯 SVG，ICEN_MAP 定義所有圖標路徑。移除 `name="default"` 預設值，必須明確指定 `name`。

已遷移圖標：ok, danger, warn, neutral, chart, shield, trigger, radar, x-circle, chevron-down, check-circle。

## 五、體積基線變更

| 項目         | Phase 1 基線 | Phase 2 實測 | Phase 2 新基線 | 理由                                                                 |
| ------------ | ------------ | ------------ | -------------- | -------------------------------------------------------------------- |
| Initial gzip | 152.1 KB     | 154.7 KB     | 156.0 KB       | 新增 ContentCard / StatCard / Icon / CollapsibleSection 四個通用元件 |
| Total gzip   | 370.4 KB     | 374.9 KB     | 380.0 KB       | 同上                                                                 |

變更核准：Phase 2 補做計畫（B2）
變更日期：2026-11-13
依據：webapp/scripts/check-bundle-size.mjs 已更新為 INITIAL_BUDGET_KB=156.0, TOTAL_BUDGET_KB=380.0；實測 154.7 / 374.9 KB，均在新基線內。

## 六、測試標準

- Vitest + @vue/test-utils
- TDD 強制：RED-GREEN-REFACTOR-VERIFY，測試先於實作
- 所有新組件必須有對應 `.test.js`
- 完整測試套件必須 100% 通過，lint 0 錯誤 + 0 警告

## 七、依賴聲明

- `eslint-plugin-vue` (^10.10.0)：devDependency，用於 Vue SFC ESLint 規則，於 root `eslint.config.js` 引用
- 無額外運行時依賴新增；所有圖標採內聯 SVG，無新 npm 套件

## 八、驗收標準 (DoD)

- [ ] 所有通用組件使用設計令牌，無硬編碼 hex/rgba
- [ ] 無 ad-hoc collapsible pattern，全部遷移至 CollapsibleSection
- [ ] 無 residual emoji（6 個情緒指標除外）
- [ ] 測試 ≥596 通過
- [ ] Lint 0/0
- [ ] Bundle 大小在修訂基線內
