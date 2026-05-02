---
skill_id: advice-response-template
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Planner ADVICE_RESPONSE_<功能名稱>.md 標準格式（採納/部分/未採納 三層分類）。
  自 rules/planner.md §s07 搬入。
referenced_by:
  - rules/planner.md §s07
related_skill: skills/templates/advice-template.md
---

# Skill: ADVICE_RESPONSE 標準格式

當 `@Consultant` 產出 `ADVICE_<功能名稱>.md` 後，`@Planner` 修改草案時**必須同步產出** `ADVICE_RESPONSE_<功能名稱>.md`。

## 標準格式

```markdown
# Consultant 建議採納回覆

**對應顧問報告**：`ADVICE_<功能名稱>.md`
**草案版本**：v<N>
**回覆日期**：<日期>

### 採納項目 ✅

| 顧問建議   | 採納方式   | 納入草案位置        |
| ---------- | ---------- | ------------------- |
| <建議內容> | <如何調整> | <draft 的哪一個 AC> |

### 部分採納項目 🔶

| 顧問建議   | 採納範圍     | 未採納原因       |
| ---------- | ------------ | ---------------- |
| <建議內容> | <採納哪部分> | <為何不完全採納> |

### 未採納項目 ❌

| 顧問建議   | 未採納原因           |
| ---------- | -------------------- |
| <建議內容> | <原因，須 User 知情> |
```

## 未採納項目處理

若有任何建議「未採納」，`@Planner` **必須**向 User 明確說明原因，**不可自行決定忽略**。User 確認未採納理由後，才可繼續進入設計階段。

<!-- END: advice-response-template -->
