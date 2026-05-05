---
skill_id: auditor-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Auditor 3 組標準 I/O 範例（5 維度評估 mode-aware / dimension JSON / P-15 觸發）
referenced_by:
  - rules/auditor.md
---

# Skill: @Auditor Few-Shot 範例（3 組）

## 範例 1：5 子 Agent 派遣

**觸發**：定期審計 / User 手動觸發 / P-15 觸發

**@Auditor 應執行**：

```
派遣 5 個並行 Explore 子 Agent：
- Auditor-1 維度一（載入 skills/auditor-rubric-prompts.md §維度一 4 Fragment）
- Auditor-2 維度二（載入 §維度二 3 Fragment）
- Auditor-3 維度三（載入 §維度三 3 Fragment）
- Auditor-4 維度四（載入 §維度四 3 Fragment）
- Auditor-5 維度五（載入 §維度五 3 Fragment）

每個子 Agent 的 prompt 必須：
1. 完整貼入對應 Prompt Fragment（不得以「依手冊」模糊語句替代）
2. 要求與 `.agents/docs/Reports/AUDIT_HISTORY.md` 最新記錄比對（**絕對路徑必填**；PROPOSAL_022）
3. 輸出固定 JSON + ≥100 字 rationale
4. 所有檔案引用使用 repo-root 前綴絕對路徑（`.agents/skills/patrol-notification-catalog.md` / `.agents/SYSTEM_THRESHOLDS.yaml` 等）；禁止裸檔名
```

## 範例 2：AUDIT_HISTORY 寫入

**彙整後 append 一行**：

```markdown
| 日期       | 觸發 | 維度1 | 維度2 | 維度3 | 維度4 | 維度5 | 整體     | 關鍵風險 | 備註                             |
| ---------- | ---- | ----- | ----- | ----- | ----- | ----- | -------- | -------- | -------------------------------- |
| 2026-05-02 | 定期 | 4.90  | 4.78  | 4.15  | 4.85  | 4.75  | **4.69** | R16~R18  | 015~019 執行後驗證；全維度 > 3.0 |
```

**禁止**：修改歷史行（append-only）

## 範例 3：P-15 觸發判斷

**情境**：某次評審 5.2 分數 = 2.8

**@Auditor 應執行**：

```
@Auditor 判定：維度五 5.2 = 2.8 < AUDIT_DIMENSION_MIN_SCORE (3.0)
→ 觸發 🟡 P-15 AUDIT_QUALITY 通知

回報 @Lead：
【@Auditor 評審完成】🟡 WARNING：維度 5.2 低於門檻
整體分數：4.35
觸發項：5.2 自動化評測 = 2.8（門檻 3.0）
建議：@Retro 接手起草改善提案
```

@Assistant 巡邏將自動寫入 `PENDING_ACTIONS.md 🟡 區塊`。

---

## Related Decisions

- [ADR-0005](../decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
