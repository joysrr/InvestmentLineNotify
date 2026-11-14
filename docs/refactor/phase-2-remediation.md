---
type: plan
status: completed
last_updated: 2026-11-14
tags:
  - webapp
  - refactor
  - phase-2
  - remediation
wiki_links: []
---

# Phase 2 修正與收口計畫 (R1–R10)

文件位置：`docs/refactor/phase-2-remediation.md`
適用範圍：`webapp/` 前端子專案
前置閱讀：`docs/refactor/phase-2-foundation.md`、`docs/refactor/phase-2-migration-inventory.md`
執行模式：單一開發者、嚴格串行，直接於 `main` 提交
基線 commit：main @ 4ae3da3

## 0. 判定摘要

Phase 2 三個子計畫主體已落地，B1–B12 多數關閉。本次修正針對核實後仍存在的 4 項阻斷與 6 項文件不一致。

| 編號 | 項目                                                        | 性質       | 嚴重度 | 狀態 |
| ---- | ----------------------------------------------------------- | ---------- | ------ | ---- |
| R1   | phase-2-remediation.md 不存在，母計畫引用 404 文件          | 文件       | 高     | 關閉 |
| R2   | CollapsibleSection uidCounter 失效，同頁 id 重複            | 執行期 bug | 高     | 關閉 |
| R3   | AccountView.vue 仍有裸 rgba，與「rgba 全在 tokens.css」矛盾 | 令牌合規   | 高     | 關閉 |
| R4   | UI 可見 Emoji 未清除，掃描指令失效且有盲區                  | 驗收口徑   | 高     | 關閉 |
| R5   | 體積數字三處不一致                                          | 文件一致性 | 低     | 關閉 |
| R6   | phase-2-foundation.md DoD 全未勾選卻標 completed            | 文件一致性 | 中     | 關閉 |
| R7   | Icon.vue 未知名稱靜默 fallback，無守衛                      | 工程品質   | 中     | 關閉 |
| R8   | 文件錯字（ICEN_MAP→ICON_MAP、variant 描述不符）             | 文件一致性 | 低     | 關閉 |
| R9   | ExtremeRadarPanel 內層 v-if/v-show 冗餘且不一致             | 程式品質   | 低     | 關閉 |
| R10  | 測試／lint／掃描無可獨立核對的產物                          | 可驗證性   | 中     | 關閉 |

合計約 1.7 人日。

放行條件：R1–R4 全數關閉；R5–R10 收口並附產物。全部放行後，本檔 frontmatter `status` 改為 `completed`，母計畫 `docs/webapp-refactor-plan.md` 2.4 同步改回「已完成」。

---

## 1. R1：補建 phase-2-remediation.md

### 1.1 現狀（已核實）

`docs/webapp-refactor-plan.md` 2.4 寫：「已完成，詳見 `docs/refactor/phase-2-remediation.md`」。
`main` 的 `docs/refactor/` 實際無此檔，raw 與 git tree 均 404 / 不存在。

### 1.2 修改細節

採「補建」而非「移除引用」：母計畫 2.4 條目本身有資訊價值，且此檔正是本次修正計畫的載體。

1. 建立 `docs/refactor/phase-2-remediation.md`，內容即本文件。
2. frontmatter 固定為：
   - `type: plan`
   - `status: in-progress`（全部 R 關閉後改 `completed`）
   - `last_updated: 2026-11-14`
3. 修正母計畫 `docs/webapp-refactor-plan.md` 2.4，把「已完成」改為「進行中，詳見 `docs/refactor/phase-2-remediation.md`」。

### 1.3 驗收

- `https://raw.githubusercontent.com/joysrr/InvestmentLineNotify/main/docs/refactor/phase-2-remediation.md` 回傳 200
- 母計畫中所有 `docs/` 引用皆可解析（無 404）

CI 守衛：於 `.github/workflows/docs-validation.yml` 新增 `Validate doc path references` 步驟，檢查 docs/ 與 README.md 內所有反引號包住的相對 `.md` 路徑是否實體存在，避免同類 404 再犯。

---

## 2. R2：修正 CollapsibleSection.vue 的 id 產生器

### 2.1 現狀（已核實）

`<script setup>` 頂層 `let uidCounter = 0` 是實例內區域變數，每個實例重置為 0，因此每個實例都得到 `collapsible-content-1`。TechnicalView.vue 同頁兩實例出現重複 `id="collapsible-content-1"`，`aria-controls` 全部指向同一節點，螢幕閱讀器無法區分，違反 B7 自訂驗收。

### 2.2 修改細節

新增普通 `<script>` 區塊置於 `<script setup>` 之前，把計數器提到模組層級（模組載入時執行一次，所有實例共用）：

```js
<script>
// 模組層級：模組載入時執行一次，所有實例共用
let uidCounter = 0;
</script>
<script setup>
...
const contentId = `collapsible-content-${++uidCounter}`;
...
</script>
```

已提交 `f322362`；測試 `CollapsibleSection.test.js` 13/13 全綠。

---

## 3. R3：AccountView.vue 裸 rgba 令牌化

### 3.1 現狀（已核實）

`AccountView.vue` 三處 `areaStyle` 色（initial/profit/loss）直寫 `rgba(36,129,204,...) `，與「rgba 全在 tokens.css」矛盾。

### 3.2 修改細節

新增 `readToken()`（`getComputedStyle(document.documentElement).getPropertyValue(name).trim()`，含 fallback）；`colorStops` 改用 `readToken("--iln-brand-fill-strong"/"--iln-brand-fill-fade")`；4 處 `style` `rgba(36,129,204)` 改為 `var(--iln-brand-fill-*)`。新增 `tokens.css` `--iln-brand-fill-strong/fade/light/faint/border`（light + dark）。

已提交 `2787104`；測試 `AccountViewTokens.test.js` 2/2；全套 612/612；hex 掃描清。

---

## 4. R4：清除 Tier A UI Emoji，改用 Icon 元件

### 4.1 現狀（已核實）

NewsView、ChartView、MacroBattleView、MarketRadarView、AccountView、StrategyConfigPanel、AuthExpiredModal、LifecycleDetail、ExtremeRadarPanel 等 9 檔含 UI 可見 Emoji。

### 4.2 修改細節

逐一 patch 移除 ⏳📭🔐📫💳↗✓ⓘ●💾▾🔐⏰，改用 `Icon` 元件；`Icon.vue` 新增 settings/search/info/news/wallet 五個圖示（inline SVG，尺寸沿用 SIZE_MAP）；`StrategyConfigPanel.vue` `>` lint 修復；`AuthExpiredModal.vue` 補匯入 `Icon`。

已提交 `d3d63c6`（Icon 五圖示）、`fba560b`（Emoji 移除）。全套 617/617，lint 0/0，Tier A UI Emoji = 0。Tier B 測試斷言 Emoji 與 Tier C `metricThresholds.js` 景氣燈號依政策保留。

---

## 5. R5：體積數字單一真相來源

### 5.1 現狀（已核實）

三處體積數字互不一致：

- `docs/refactor/phase-2-foundation.md` §五：實測 154.7 / 374.9 KB
- `docs/refactor/phase-2-migration-inventory.md` §體積：實測 154.3 / 375.4 KB
- 基線：Initial 156.0 KB / Total 380.0 KB

### 5.2 修改細節

以 `npm run build` + `webapp/scripts/check-bundle-size.mjs` 實測為單一真相來源：

- Initial gzip：155.3 KB（預算 156.0 KB）
- Total gzip：375.6 KB（預算 380.0 KB）
- 體積閘門：✅ 通過

將上述兩文件之實測欄位統一為 155.3 / 375.6 KB，基線維持 156.0 / 380.0 KB。

---

## 6. R6：phase-2-foundation.md DoD 勾選與 status 一致性

### 6.1 現狀（已核實）

frontmatter `status: completed`，但 §八 驗收標準 (DoD) 六項皆為 `- [ ]` 未勾選，與「completed」不一致。

### 6.2 修改細節

全部 R 項關閉並經實測驗證後，將 §八 六項改為 `- [x]`：

1. 所有通用組件使用設計令牌，無硬編碼 hex/rgba ✅
2. 無 ad-hoc collapsible pattern，全部遷移至 CollapsibleSection ✅
3. 無 residual emoji（6 個情緒指標除外） ✅
4. 測試 ≥596 通過 ✅（618/618）
5. Lint 0/0 ✅
6. Bundle 大小在修訂基線內 ✅（155.3 / 375.6 KB ≤ 156.0 / 380.0 KB）

frontmatter `status` 維持 `completed`。

---

## 7. R7：Icon.vue 未知名稱靜默 fallback，加守衛

### 7.1 現狀（已核實）

`Icon.vue` 對未定義圖示名稱靜默 fallback，無開發期警告，易導致誤用不自知。

### 7.2 修改細節

1. 建立 `src/components/common/icon-registry.js`：匯出全部 path 常數（DANGER/WARN/NEUTRAL/CHART/SHIELD/TRIGGER/CHECK/RADAR/X_CIRCLE …）+`ICON_MAP` + `ICON_NAMES`。
2. `Icon.vue` 匯入 `ICON_MAP`，刪除重複的區域 `const ICON_MAP` 與未使用 path 常數；`iconData` computed 增加 `import.meta.env.DEV` 下對未定義名稱的 `console.warn([Icon] ...)`。
3. 新增 `src/components/common/IconUsage.test.js`：靜態掃描非測試 `.vue` 檔中 `<Icon name="...">` 是否皆在 `ICON_NAMES` 內；動態 `:name="..."` / `v-bind:name` 列為已知限制、不在檢查範圍。

已提交 `d3d63c6`（Icon 守衛）、`278ee88`（IconUsage 測試）。Icon.test.js 14/14、IconUsage.test.js 1/1，lint 0/0。

---

## 8. R8：文件錯字修正

### 8.1 現狀（已核實）

- `docs/refactor/phase-2-foundation.md` line 65：`ICEN_MAP`（應為 `ICON_MAP`）
- `docs/refactor/phase-2-foundation.md` line 45：`variant`（outlined/filled），實際 ContentCard variant 為 `outlined/elevated/flat`

### 8.2 修改細節

- `ICEN_MAP` → `ICON_MAP`
- `outlined/filled` → `outlined/elevated/flat`

---

## 9. R9：ExtremeRadarPanel 移除冗餘內層 v-if/v-show

### 9.1 現狀（已核實）

IDLE / ALERT 兩分支皆以 `CollapsibleSection` 控制展開，內層卻再分別寫 `v-if="isExpanded"`（IDLE）與 `v-show="isExpanded"`（ALERT），與 `CollapsibleSection` 的 `:expanded` 互相重複且不一致。

### 9.2 修改細節

- IDLE：`<div v-if="isExpanded" class="radar-detail-list">` → `<div class="radar-detail-list">`
- ALERT：`<div v-show="isExpanded" class="radar-alert-body">` → `<div class="radar-alert-body">`
- 保留 `isExpanded` + `watch` 與 `CollapsibleSection` 控制。

已提交 `5c0f1ff`；無殘留 `v-if/v-show="isExpanded"`；lint 0/0；全套 618/618。

---

## 10. R10：附上可獨立核對的驗證產物

### 10.1 驗證結果（實測，非描述）

| 項目                           | 結果      | 門檻      | 狀態 |
| ------------------------------ | --------- | --------- | ---- |
| 測試通過數                     | 618 / 618 | ≥596      | ✅   |
| Lint errors / warnings         | 0 / 0     | 0 / 0     | ✅   |
| 裸 hex 色值（tokens.css 除外） | 0         | ≤50       | ✅   |
| Tier A UI Emoji                | 0         | 0         | ✅   |
| Initial gzip                   | 155.3 KB  | ≤156.0 KB | ✅   |
| Total gzip                     | 375.6 KB  | ≤380.0 KB | ✅   |

相關 commit（皆於 `main`）：

- `f322362` R2 CollapsibleSection uidCounter 修正
- `2787104` R3 AccountView 裸 rgba 令牌化
- `d3d63c6` R4/R7 Icon 五圖示、icon-registry 抽離、開發期警告
- `fba560b` R4 Tier A Emoji 移除
- `278ee88` R7 Icon 使用守衛測試
- `5c0f1ff` R9 ExtremeRadarPanel 移除冗餘 v-if/v-show

### 10.2 執行證據

`npx vitest run`（實際輸出結尾）：

```
 Test Files  96 passed (96)
      Tests  618 passed (618)
   Start at  03:14:09
   Duration  142.11s (transform 2.09s, setup 608ms, import 39.93s, tests 13.84s, environment 73.35s)
```

`npm run lint`（實際輸出結尾）：

```
> investment-webapp@1.0.0 lint
> eslint . --ext .js,.mjs,.vue && node scripts/check-no-hex.mjs

✅ 未發現裸 hex 色值
```

`npm run build` + `node scripts/check-bundle-size.mjs`（實際輸出結尾）：

```
Initial JS gzip: 155.3 KB (預算 156 KB)
Total JS gzip:   375.6 KB (預算 380 KB)

✅ 體積閘門通過
```

---

## §附錄：放行檢核

- [x] R1–R4 全數關閉
- [x] R5 體積數字統一為實測 155.3 / 375.6 KB
- [x] R6 DoD 六項勾選，與 status 一致
- [x] R7 icon-registry 抽離 + IconUsage 守衛測試
- [x] R8 ICEN_MAP→ICON_MAP、variant 描述修正
- [x] R9 內層 v-if/v-show 移除
- [x] R10 驗證產物附上（本節）
- [x] C1 emoji-audit 改為 Tier 分層，Tier A 為 0
- [x] C2 母計畫 2.4 更新 R1–R10、基準點 1a78dcf
- [x] C3 本節勾選與 status 一致
- [x] C4 AccountView 非品牌 rgba 清零
