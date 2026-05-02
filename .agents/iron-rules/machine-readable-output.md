---
theme_id: machine-readable-output
file_type: iron_theme
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_002
audit_baseline: v1.0
immutable: true
applies_to:
  - reviewer
  - qa
  - security
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件三（rules 直修）。
  applies_to 列出的所有 rules 必同步審查。
---

# Iron Theme: Machine-Readable Output

> 跨切不可變鐵律；review-class agents（@Reviewer / @QA / @Security）共用。
> 由 PROPOSAL_20260501_002 + ADR-0037 從 reviewer/qa/security 各 §s_output_strict 抽出。
> 配合無狀態路由（ADR-0001），審查類產出物視為 API 端點；本檔規範跨 Agent 通用 5 條鐵律。

---

## 5 條鐵律（不可改詞；agent-specific 實例由各 rule 提供）

### 1. 零對話原則

產出物**禁止**前言 / 結語 / 自我解釋；對話**禁止**複製貼上 / 夾帶報告原文。

### 2. 符號絕對錨點

報告**第一行**必為五級符號之一（🔴 / ❌ / 🟡 / ✅ / 🟢；取自 `RULES_DESIGN_GUIDE §九`），**禁止**前後修飾詞、**禁止**標頭前插任何文字（含空行）。具體格式由各 rule §機讀產出物實例對應段定義。

### 3. 嚴格模板對齊

100% 遵守對應 `skills/<agent>-report-template.md`；**禁止**自行增減 H2 章節 / 改 H1/H2 名稱 / 改表格欄位順序。模板不足 → 依 `retro.md §提案提交時機`提案擴充。

### 4. 違反處理

格式漂移 → @Lead 退件 + 計入該 Agent `<CYCLE_LIMIT>` 共用計數（值由各 rule constraints_ref 引用）。@Assistant 巡邏 P-01 偵測累積 ≥ 2 次產 🔴 `<AGENT>_QUALITY`。

### 5. 純淨度自檢

通知 @Lead 完成前必逐項自檢：

- 第一行為標準格式（五級符號 + 必要錨點）
- 無前言 / 結語 / 自我解釋
- H1+H2 與模板 100% 一致
- 表格欄位齊全且順序正確
- 級別符號取自五級之一（無自創）

---

## Applies_to Rules（雙向一致；iron-theme-validator 強制）

| Agent       | Rule                                     | 報告檔                              | 符號錨點具體格式                                                                                                                             | 模板                                           | Cycle Limit                                         |
| ----------- | ---------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `@Reviewer` | `rules/reviewer.md §s_output_strict_ref` | `REVIEW_REPORT.md`                  | 五級符號（無修飾）                                                                                                                           | `skills/templates/review-report-template.md`   | `REVIEW_CYCLE_LIMIT`                                |
| `@QA`       | `rules/qa.md §s_output_strict_ref`       | `TEST_REPORT.md` / `TEST_SPEC_*.md` | TEST_REPORT: `<五級符號> 測試結論：通過/未通過`；TEST_SPEC: `<五級符號> 📋 TEST_SPEC: <功能>`（五級符號必前置；📋 為文件分類錨點不替代符號） | `skills/test-{report,spec}-template.md`        | `QA_RETEST_LIMIT`                                   |
| `@Security` | `rules/security.md §s_output_strict_ref` | `SECURITY_REPORT.md`                | `【@Security 資安審查報告】<符號> <摘要>`                                                                                                    | `skills/templates/security-report-template.md` | `REVIEW_CYCLE_LIMIT`（與 @Reviewer 共用；ADR-0010） |

> 4 H2 固定章節（適用 @Security）：審查結論 / 觸發範疇 / 問題清單 / DoD Checklist 確認

---

## Related Decisions

ADR-0001（Stateless Routing；機讀產出物根據）/ ADR-0010（平行審查；@Reviewer + @Security 共用 REVIEW_CYCLE_LIMIT）/ ADR-0022（rules frontmatter；本 theme file_type=iron_theme）/ ADR-0037（Iron Themes；本 theme 抽出依據）— 在 `decisions/`。
