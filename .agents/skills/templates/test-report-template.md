---
skill_id: test-report-template
file_type: template
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  TEST_REPORT.md 標準格式（@QA 機讀產出物）
referenced_by:
  - rules/qa.md
  - skills/lead-context-mappings.md
---

# Skill: TEST_REPORT 標準格式模板

> 本模板由 PROPOSAL-001 從 `qa.md` 外部化而來。
> `@QA` 在 Workflow 第 7 步（驗證階段）完成測試後依本格式產出 `TEST_REPORT.md`。

---

## 標準格式

```markdown
# Test Report

**功能名稱**：<功能簡稱>
**對應 Test Spec**：`TEST_SPEC_<功能名稱>.md`
**測試日期**：<日期>
**測試環境**：Mock / Staging / Production-like

---

## 測試結論

> 🔴 未通過（有未解決 Bug）/ ✅ 通過

**結論說明**：<一句話說明通過或未通過的主要原因>

---

## 測試案例執行結果

| #     | 測試案例 | 執行者 | 結果                        | 備注 |
| ----- | -------- | ------ | --------------------------- | ---- |
| TC-01 | <描述>   | `@QA`  | ✅ 通過 / ❌ 失敗 / ⏭️ 跳過 |      |
| TC-02 | <描述>   | `@QA`  | ✅ 通過 / ❌ 失敗 / ⏭️ 跳過 |      |

---

## Bug 清單（若有）

### Bug #<N>

**嚴重程度**：🔴 Critical / 🟡 Major / 🟢 Minor
**對應測試案例**：TC-<N>
**問題描述**：<一句話說明問題>

**重現步驟**：

1. <步驟一>
2. <步驟二>
3. <步驟三>

**Error Log**：
`<貼上錯誤訊息（單行）>` 或附上完整 log 檔案路徑

**預期結果**：<應該發生什麼>
**實際結果**：<實際發生什麼>

---

## 環境確認

- [ ] 測試過程中未污染 `data/` 正式環境資料
- [ ] 所有測試使用 Mock 資料或獨立測試環境
```

---

## 撰寫守則

- 測試結論只有兩種：「✅ 通過」或「🔴 未通過」，不可使用「大致通過」等模糊結論
- 每個失敗的 TC 必須有對應的 Bug 條目，不可只標 ❌ 而無詳情
- Bug 嚴重程度依影響範圍判定：
- 🔴 Critical：系統崩潰、資料損壞、資安漏洞
- 🟡 Major：功能不可用但系統運作正常
- 🟢 Minor：小幅體驗問題或文案錯誤

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
