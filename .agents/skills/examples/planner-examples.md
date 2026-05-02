---
skill_id: planner-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Planner 3 組標準 I/O 範例（User Story / Sprint 規劃 / Consultant 整合）
referenced_by:
  - rules/planner.md
---

# Skill: @Planner Few-Shot 範例（3 組）

## 範例 1：User Story Given/When/Then 撰寫

**輸入**：User 提案「新增使用者可調整通知推播時段」

**@Planner 應產出**：

```markdown
# draft_features.md（v1）

## 功能：使用者自訂推播時段

**User Story**：

> 作為 Telegram Bot 使用者，我想設定「靜音時段」，
> 以便在夜間不被通知打擾。

### 驗收標準（Given / When / Then）

**AC-1：設定靜音時段**

- Given 使用者在 Mini App 設定頁
- When 輸入 22:00~07:00 為靜音時段
- Then 系統儲存設定，且 22:00~07:00 期間不推送非緊急訊息

**AC-2：緊急訊號不受靜音影響**

- Given 靜音時段已啟用
- When 發生 🔴 維持率 < 135% 緊急事件
- Then 系統仍推送通知（覆寫靜音）
```

## 範例 2：ADVICE_RESPONSE 產出

**情境**：@Consultant 產出 `ADVICE_payload_cleaning.md`（含 🚨 領域衝突警告），@Planner 回應

**@Planner 應產出**：

```markdown
# ADVICE_RESPONSE_payload_cleaning.md

**對應顧問報告**：`ADVICE_payload_cleaning.md`
**草案版本**：v2（本次修正）

### 採納項目 ✅

| 顧問建議         | 採納方式                  | 納入草案位置 |
| ---------------- | ------------------------- | ------------ |
| 生命週期權重 0.7 | 依建議調整 strategyWeight | draft §AC-3  |

### 部分採納 🔶

| 顧問建議     | 採納範圍  | 未採納原因            |
| ------------ | --------- | --------------------- |
| 技術面僅 0.3 | 改為 0.35 | User 傾向技術訊號略強 |

### 未採納 ❌

（無）
```

## 範例 3：Sprint 狀態流轉

**情境**：User 確認「這個功能要做」

**@Planner 應執行**：

```
Step 1：讀取 ideas_features.md
Step 2：移動該條目至 preplan_features.md
Step 3：撰寫完整 User Story + AC（Given/When/Then）
Step 4：通知 @Lead「PENDING_ACTIONS 同步請求：TICKET-XXX」
Step 5：User 確認後移至 draft_features.md
```

**禁止**：未經 @Lead Gate Check 信號即移至 finishedplan_features.md

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
