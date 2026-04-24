# Skill: DoD 自評統一 Checklist 模板


## 一、通用核心自評項（所有 Agent 適用）

- [ ] 本次產出物符合對應模板（skills/*-template.md）
- [ ] 首行符號合規（依 `reviewer/security/qa §s_output_strict` M2M 合約）
- [ ] 無前言 / 結語 / 自然語言包裝
- [ ] 對齊 `workspaces/<active>.md` 的 PROJECT_CONTEXT（無硬編碼專案資訊）
- [ ] 若涉及 HITL 門檻，已取得豁免編號（或確認不超標）

## 二、各 Agent 擴充項（引用自既有 rules）

- `@Backend`：對齊 `backend.md §s10 DoD 自評機制` 6 項
- `@Frontend`：對齊 `frontend.md §s08 DoD 自評機制` 6 項
- `@QA`：對齊 `qa.md §s12 DoD 自評機制` 5 項
- `@Reviewer`：對齊 `reviewer.md §s09 產出物` 4 項
- `@Security`：對齊 `security.md §s04 DoD 自評` 4 項

## 三、回報格式（統一）

```
【@{Agent} DoD 自評】{級別符號} <摘要>
通用核心：✅ N/N
Agent 擴充：✅ M/M
待說明項目：<具體描述或「無」>
豁免編號：<EX-XXX 或「無」>
對應階段：S<n>
```

## 四、Gate Check Auto-Audit（由 @Lead 執行）

`@Lead` 收到 DoD 自評後執行自動驗收：

1. 讀取回報中的「通用核心」與「Agent 擴充」計數
2. 若任一項為 X/N（非 ✅ 全數）→ **拒絕進入下一階段**，退件補齊
3. 若全部 ✅ → 寫入 `docs/DoD_AUDIT_LOG.md` 新一行
4. 輸出 Gate Check 短指令（依 `lead.md §s_state_anchor` 第 7 條）

## 五、禁止行為

- **絕對禁止** 繞過 DoD 自評直接回報完成
- **絕對禁止** @Lead 未讀取自評結果即執行 Gate Check
- **絕對禁止** 自評條目改為「部分通過」（X/N 即為未通過）

---

## Related Decisions

- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
