---
skill_id: prior-art-report-template
file_type: template
version: v2.0
last_modified: 2026-05-04
last_proposal: PROPOSAL_20260502_030
purpose: |
  PRIOR_ART_REPORT.md HITL-first 模板（Phase A search package + Phase B user 結果填寫 + Phase C agent 評估）
referenced_by:
  - rules/architect.md
  - skills/checklists/prior-art-scan-checklist.md
  - decisions/0014-prior-art-scan.md
  - docs/agents-overview.md
---

# Skill: Prior Art Report Template v2（HITL-first PRIOR_ART_REPORT.md 模板）

> v2.0 重要變更（PROPOSAL_502_030）：拆三段 Phase A/B/C；agent 寫 §A + §C；user 填 §B。

## 標準模板

````markdown
# PRIOR_ART_REPORT — <功能名稱>

> 建立者：`@Architect`
> 建立日期：<YYYY-MM-DD>
> 觸發條件：<C1 / C2 / C3 其中之一；引 User Story AC / LOC 估計 / User 指令>
> 相關 User Story：`draft_features.md §<功能名稱>`
> Status：[ ] Phase A done [ ] Phase B done [ ] Phase C done [ ] User verified

---

## §A — Search Package（@Architect 寫；user 用此跑 search）

### A.1 問題陳述

<2-3 句描述此功能要解決的核心問題；不描述實作手段>

### A.2 檢索 keyword 組（≥ 3 組）

依 `prior-art-scan-checklist.md §A.1` 抽取：

- 關鍵字組 1：`<keyword1> <keyword2>`（適用：<NPM / PyPI / GitHub>）
- 關鍵字組 2：`<keyword>`
- 關鍵字組 3：`<keyword>`

### A.3 建議檢索管道

請 user 用以下任一管道執行 search：

| 管道            | URL pattern                                                                         | 說明         |
| --------------- | ----------------------------------------------------------------------------------- | ------------ |
| NPM             | `https://www.npmjs.com/search?q=<keyword>`                                          | Node 套件    |
| PyPI            | `https://pypi.org/search/?q=<keyword>`                                              | Python 套件  |
| GitHub Search   | `https://github.com/search?q=<keyword>&type=repositories`                           | 跨語言       |
| GitHub Trending | `https://github.com/trending/<language>?since=monthly`                              | 月度熱門     |
| Awesome List    | google `awesome-<topic>`                                                            | 社群精選     |
| ChatGPT/Claude  | 「列出 [language] 內可實作 [feature] 的前 5 個套件，含 stars / 最近更新 / license」 | LLM 輔助列舉 |

### A.4 候選收集要求

User 在 §B 至少回填 **3 個候選**（≥ 2 外部 + 1 自建）；每個候選提供以下資訊：

- 套件名 + 連結（GitHub / NPM / PyPI URL）
- 最新版本 + 發布日期
- License（MIT / Apache-2.0 / BSD / GPL / 專有）
- GitHub stars
- 最近 commit 日期
- 1 句簡介
- 主要 dep 數量（粗估）

---

## §B — User 結果填寫（user 跑 search 後填；agent 等此完成）

> **Status**：[ ] 未開始 [ ] 進行中 [x] User 已完成
>
> User 完成後告知 agent「§B 已填好；請繼續 Phase C 分析」。

### B.1 候選 A：<套件名 或「自建」>

- 連結：<URL>
- 最新版本：<version>（<release date>）
- License：<MIT / Apache 2.0 / ...>
- GitHub stars：<count>
- 最近 commit：<YYYY-MM-DD>
- 簡介：<1 句>
- 主要依賴數：<N>
- User 找到該方案的管道：<NPM / GitHub / Awesome / Chat 提問>

### B.2 候選 B：<...>

（同 B.1 結構）

### B.3 候選 C：自建（強制列入）

- 估計工時：<hr>
- 需維護的 LOC：<LOC>
- 自建優勢（為何不用既有套件）：<...>

### B.4 User 額外備註

<例：「我自己 prefer 候選 A 因為熟悉；但 license 不確定」；agent 在 Phase C 會考慮>

---

## §C — Agent 評估（@Architect 讀 §B 後寫；user 不填）

### C.1 問題陳述（既有 §一）

<延用 A.1>

### C.2 候選方案彙整

> agent 從 §B 讀 user 填的資料；本節為彙整 + agent 補強欄位

### C.3 評估矩陣

（依 `.agents/skills/checklists/prior-art-scan-checklist.md §C.1` 5 維度評分）

| 候選 | 活躍度 | 社群 | License | 依賴 | 客製 | **總評**    |
| ---- | ------ | ---- | ------- | ---- | ---- | ----------- |
| A    | 5      | 4    | 5       | 3    | 4    | **4.25** 🟢 |
| B    | 3      | 3    | 5       | 5    | 3    | **3.70** 🟡 |
| 自建 | N/A    | N/A  | 5       | 5    | 1    | **3.40** 🟡 |

### C.4 推薦決策

**推薦採納**：候選 <X>

**理由**（結構化）：

1. <核心論點 1>
2. <核心論點 2>
3. <核心論點 3>

**次要選項**：<若 X 不可行，退而求其次 Y>

---

## §D — User 驗證（HITL final Gate；依 `RULES_DESIGN_GUIDE §十八.D`）

> 本章節由 User 填寫。未填寫前 `@Lead` 不得派發 `@Backend` / `@Frontend` / `@QA`。

```yaml
user_verification:
  verified_date: <YYYY-MM-DD>
  verified_method: [webSearch|npm|pypi|bypass|other]
  decision: [adopt_recommendation|change_to_other|self_build_approved]
  package_final: <name>
  notes: <自由文字>
```

## 六、決策依據（Audit Trail）

- 檢索關鍵字：<list>
- 檢索日期：<YYYY-MM-DD>
- 參考來源：<links>
- 與 `EVALUATED_PACKAGES` 快取交叉比對：<命中 / 未命中 + 差異說明>
- 與過去相關提案 / 決策：<references>

---

<!-- MACHINE_READABLE
report_type: prior-art-report
schema_version: v1.0
feature_name: <name>
created_date: <YYYY-MM-DD>
architect_version: <architect.md version>
-->
````

## 使用規範

- **每個觸發條件滿足的功能 = 1 份 PRIOR_ART_REPORT.md**
- 儲存路徑：`docs/plans/prior-art/<功能名稱>.md`
- 命名：功能名稱採 kebab-case（對齊 `draft_features.md` 標記）
- 生命週期：永久保留（提供未來相同類型功能的歷史參考）

## 使用範例

以下為一份完整的 PRIOR_ART_REPORT.md 範例（對應假想的「前端日期選擇器」功能）：

````markdown
# PRIOR_ART_REPORT — date-picker-enhancement

> 建立者：`@Architect`
> 建立日期：2026-04-23
> 觸發條件：C1（feature + 跨 webapp / backend domain）
> 相關 User Story：`draft_features.md §date-picker-enhancement`

## 一、問題陳述

Telegram Mini App 需提供投資計劃的日期區間選擇（開始日期 / 結束日期 / 週期）。

## 二、候選方案

### 候選 A：`vue-datepicker-next`

- NPM：https://www.npmjs.com/package/vue-datepicker-next
- 最新版本：v1.0.3（2025-10-15）
- License：MIT
- 簡介：Vue3 原生支援，含範圍選擇、i18n

### 候選 B：`v-calendar`

- NPM：https://www.npmjs.com/package/v-calendar
- 最新版本：v3.1.2（2026-01-08）
- License：MIT
- 簡介：完整日曆 UI 含事件標記（功能可能超出需求）

### 候選 C：自建

- 估計工時：16 hr
- 需維護的程式碼行數：~350 LOC

## 三、評估矩陣

| 候選 | 活躍度 | 社群 | License | 依賴 | 客製 | **總評**    |
| ---- | ------ | ---- | ------- | ---- | ---- | ----------- |
| A    | 4      | 3    | 5       | 5    | 5    | **4.35** 🟢 |
| B    | 5      | 4    | 5       | 4    | 3    | **4.15** 🟢 |
| 自建 | N/A    | N/A  | 5       | 5    | 1    | **3.40** 🟡 |

## 四、推薦決策

**推薦採納**：候選 A（vue-datepicker-next）

**理由**：

1. 功能剛好對應需求，無多餘元件
2. 依賴最少（客製成本最低）
3. License 商業友善

**次要選項**：候選 B（若 A 後續停止維護）

## 五、User 驗證

```yaml
user_verification:
  verified_date: <待 User 填>
  verified_method: <待 User 填>
  decision: <待 User 填>
  package_final: <待 User 填>
  notes: <待 User 填>
```

## 六、決策依據

- 檢索關鍵字：`vue3 date picker range`、`telegram miniapp date picker`
- 檢索日期：2026-04-23
- 參考來源：
- https://www.npmjs.com/package/vue-datepicker-next
- https://www.npmjs.com/package/v-calendar
- 與 `EVALUATED_PACKAGES` 快取交叉比對：未命中（首次評估）
- 與過去相關提案：無
````

## 溯源

- 建立提案：PROPOSAL_20260423_002
- 格式對齊：`RULES_DESIGN_GUIDE §三` 模板外部化 + `§十八.C` 產出物契約
- 搭配方法論：`.agents/skills/checklists/prior-art-scan-checklist.md`
- 類別：**F1**（純模板；不引用 workspace 欄位；對齊 `RULES_DESIGN_GUIDE §十六.F` F1 規範）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
