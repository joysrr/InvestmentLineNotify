---
skill_id: review-cycle-protocol
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Reviewer / @Security 退件後重提流程 + REVIEW_CYCLE_LIMIT 共用機制 +
  達上限後處理流程 + 重置條件。
  自 rules/reviewer.md §s08 搬入；與 skills/parallel-review-arbitration.md 互補。
referenced_by:
  - rules/reviewer.md §s08
  - rules/security.md
related_decision: decisions/0010-parallel-review.md
---

# Skill: 退件後重提流程 + REVIEW_CYCLE_LIMIT 共用機制

## 退件後開發者處理步驟

1. 閱讀 `REVIEW_REPORT.md` / `SECURITY_REPORT.md` 所有 `[BLOCKER]`
2. 逐一修正，每個 BLOCKER 旁標注「已修正：<一句話說明修正方式>」
3. `[WARNING]` 若決定豁免 → 說明理由
4. 完成後通知 `@Lead`，由 `@Lead` 重新呼叫 `@Reviewer`（與 `@Security`，若 SC 觸發）

## 複審觸發條件

- `@Reviewer` 收到重提通知後，**只針對上次退件的 BLOCKER 項目複審**
- 不重新審查已通過部分（除非開發者修正涉及其他區域）
- 通過後 `@Reviewer` 更新 `REVIEW_REPORT.md` 結論為「✅ 通過」

## REVIEW_CYCLE_LIMIT 共用機制

### 上限設定

同一任務最多複審 **`REVIEW_CYCLE_LIMIT` 次**（依 `RULES_DESIGN_GUIDE.QUALITY.md`，預設 **2**）。

**共用計數**：`@Reviewer` 與 `@Security` **共用**此上限（ADR-0010 防線 4）。任一方於同一任務的複審 +1；達上限時哪一方未通過就產對應通知（`REVIEW_QUALITY` / `SECURITY_AUDIT_FAIL`）。

### 設計意圖（重要，禁止誤解）

**目的**：防止審查流程陷入無限迴圈，保護系統執行效率。

**上限【不代表】**：

- ❌ 第 N 次複審可以降低審查標準
- ❌ 達到上限即視為品質通過
- ❌ 因「次數已到」而接受不符 DoD 的任務

**上限【代表】**：

- ✅ 同一任務反覆複審達 `REVIEW_CYCLE_LIMIT` 次是**異常信號**
- ✅ 問題根因可能**超出 `@Backend` / `@Frontend` 執行層**，需更高層級（`@Lead` / `@Planner` / `@Architect` / User）介入

## 達到上限後的 3 步驟流程

### Step 1：輸出複審上限報告

第 N 次複審完成後（無論結果如何），向 `@Lead` 輸出結構化報告（對齊 ADR-0030 通知分級）：

```
【@Reviewer 複審上限報告】<級別符號> <一句話摘要>
─────────────────────────────
任務：<任務描述>
複審次數：<n> / <REVIEW_CYCLE_LIMIT>（已達上限）
當前狀態：✅ 通過 / ❌ 仍有 <n> 項未解決
未解決項目：<具體描述或「無」>
根因推測：<執行問題 / 需求不明確 / 設計問題 / 其他>
建議處理：<具體建議>
─────────────────────────────
```

### Step 2：`@Lead` 依報告決策

- **仍有未解決項目** → 評估根因 →：
  - 升級 User 重新評估需求範圍 / 技術選型
  - 或重新拆分任務後重啟流程
- **已通過**（歷經 N 次才通過）→ 記錄於 `PENDING_ACTIONS.md`，標注為需 `@Retro` 關注的品質信號（可能代表 Rules 設計問題）

### Step 3：`@Assistant` 巡邏自動偵測

`@Assistant` 下次巡邏依 P-01 偵測 `REVIEW_REPORT.md`；複審達上限仍有 BLOCKER 時產 🔴 `REVIEW_QUALITY`，阻斷新功能派發直到 User 確認（共用 P-11 計數）。

## 禁止行為（保留於 rule）

- **絕對禁止** `@Lead` 或 `@Reviewer` 以「已達上限」為由強制標**未通過**為**通過**。品質**絕對不因次數降低**。
- **絕對禁止** 第 N 次複審因「次數壓力」而降低嚴格度或略過 DoD Checklist
- **絕對禁止** 在未輸出複審上限報告的情況下跳過上限機制

## 複審次數重置條件

以下情況視為**新任務**，計數重置為 0：

1. `@Lead` 決定重新拆分任務後重啟
2. 任務需求描述有**實質性變更**（非小幅修正）
3. `@Architect` 重新輸出技術規格（設計層變動）

<!-- END: review-cycle-protocol -->
