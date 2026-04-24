# Skill: SECURITY_REPORT 標準格式模板

> 本模板由 PROPOSAL_20260422_003 建立，對應 `security.md §產出物`。
> `@Security` 每次產出 `SECURITY_REPORT.md` 時依本模板執行。

<!-- 機讀合約（PROPOSAL_20260422_003）：
 本模板為 @Security 產出 SECURITY_REPORT.md 之唯一結構依據。
 第一行必須為標頭格式 + 五級符號之一（🔴 / ❌ / 🟡 / ✅ / 🟢）。
 禁止任何前言 / 結語 / 自行增減章節。 -->

---

## 標準格式

<!-- TEMPLATE_START: SECURITY_REPORT -->
【@Security 資安審查報告】<級別符號> <一句話摘要>

## 審查結論

> 🔴 退件 / ❌ 阻斷 / 🟡 條件通過 / ✅ 通過

## 觸發範疇

依 `.agents/skills/security-audit.md §1`：SC-XX、SC-YY

## 問題清單

### 🔴 [BLOCKER] 資安阻斷項目
| # | 檔案 | 行號 | 風險類型 | SC 代碼 | 建議修正方式 |
|---|------|------|---------|--------|------------|

### 🟡 [WARNING] 資安建議項目
| # | 檔案 | 行號 | 風險類型 | SC 代碼 | 建議修正方式 |
|---|------|------|---------|--------|------------|

## DoD Checklist 確認

依 `.agents/skills/security-audit.md §2 資安審查 Checklist` 逐項填寫
<!-- TEMPLATE_END -->

---

## 機讀合約鐵律（對齊 `security.md §s_output_strict`）

1. **零對話原則**：禁止任何前言 / 結語 / 自我解釋
2. **符號絕對錨點**：第一行必須為 `【@Security 資安審查報告】<🔴 / ❌ / 🟡 / ✅ / 🟢> <摘要>`
3. **嚴格模板對齊**：4 個固定 H2 章節（審查結論 / 觸發範疇 / 問題清單 / DoD Checklist 確認）不可增減

## 使用規範

- 本模板變更需透過 `RULE_UPDATE_PROPOSAL` 提案
- 違反模板結構的報告由 `@Lead` 退件，計入 `REVIEW_CYCLE_LIMIT`（與 `@Reviewer` 共用）

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
