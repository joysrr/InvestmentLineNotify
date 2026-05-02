---
skill_id: strategyweight-change-checklist
file_type: checklist
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  strategyWeight 異動五步驟強制流程（zero-tolerance；對齊 data-deletion-checklist）
referenced_by:
  - rules/consultant.md
  - skills/examples/reviewer-security-boundary-examples.md
  - skills/lead-context-mappings.md
  - skills/blocking-notification-schema.md
  - skills/examples/security-examples.md
  - skills/checklists/data-deletion-checklist.md
---

# Skill: strategyWeight 異動五步驟檢核表

> 本表為 **strategyWeight 任何異動前** 必查文件（`@Consultant` / `@Lead` / `@Backend` 共用）。

---

## 五步驟強制流程

### Step 1：@Consultant 提出建議

- 產出 `ADVICE_*.md`，明文建議新舊值 + 風險評估
- **絕對禁止** 在 ADVICE 中直接示範 `strategyWeight` 的具體變更（違反 `consultant.md §s07`）
- **絕對禁止** 在對話中主動替 User 代筆修改

### Step 2：@Lead 審核

- 讀取 ADVICE + 當前 strategyWeight 現值
- 確認影響範圍 + User 是否同意
- **絕對禁止** `@Lead` 單獨授權（必升級 User，對齊 `lead.md §s11` 豁免邊界條件一）

### Step 3：User 明確確認

- User 必須回應字面關鍵字「授權執行」
- 口語化（「可以」、「好」、「執行吧」）**無效**（依 `consultant.md §s07`）
- `@Lead` 依 `lead.md §s11 豁免授權與記錄機制` 寫入 EXEMPTION_LOG

### Step 4：@Backend 執行

- 讀取當前值 + 記錄於審計日誌（對齊 `domains/privacy-compliance.md §五`）
- 執行變更
- 驗證新值（數值範圍 / 加總限制）
- **絕對禁止** 資料刪除（零容忍，對齊 `backend.md §s06 HITL`）

### Step 5：@Assistant 巡邏確認

- 下次巡邏時讀取 `data/strategy_history.jsonl`
- 確認異動記錄完整（時間 / 舊值 / 新值 / 授權者 / 豁免編號）
- 不完整 → 產 🔴 通知（未來可擴充為 P-16 `STRATEGY_AUDIT_INCOMPLETE`）

---

## 違反任一步驟的處理

立即觸發 `system-prompt.md §全局緊急阻斷` 條件三（安全邊界觸碰）：

- 暫停所有 Workflow
- 向 User 輸出狀態摘要 + 恢復建議
- 等待 User 明確「系統恢復」指令

## 快速索引（跨 rule 對照）

| 步驟   | 執行者      | 規則依據                      |
| ------ | ----------- | ----------------------------- |
| Step 1 | @Consultant | `consultant.md §s07`          |
| Step 2 | @Lead       | `lead.md §s11 豁免授權邊界`   |
| Step 3 | User        | `consultant.md §s07` 授權語句 |
| Step 4 | @Backend    | `backend.md §s06 HITL`        |
| Step 5 | @Assistant  | `assistant.md P-11`（延伸）   |
| 審查   | @Security   | `security.md §s02` SC-03      |

## 中段失敗回滾流程（PROPOSAL_20260501_004 W-2 補強）

5 步流程任一中段失敗時的處理：

| 失敗階段                          | 處理                                                                   | 責任方                  |
| --------------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| Step 1（@Consultant 提建議）失敗  | 觸發 `planner.md §s06` 退件流程；ADVICE_RESPONSE 標未採納              | @Planner                |
| Step 2（@Lead 審核拒）            | @Lead 通知 @Consultant；不進 Step 3；流程終止                          | @Lead                   |
| Step 3（User 字面授權拒絕）       | 流程終止；EXEMPTION_LOG 記錄「User 拒絕授權」                          | @Lead                   |
| Step 4（@Backend 執行失敗）       | **必執行 git revert 還原**；EXEMPTION_LOG 記錄失敗詳情；通知 User 評估 | @Backend → @Lead → User |
| Step 5（@Assistant 巡邏發現異常） | 產 🔴 `STRATEGYWEIGHT_DRIFT` 通知；阻斷新派發直至釐清                  | @Assistant → @Lead      |

**git revert 標準作業**（Step 4 失敗）：

1. 確認 commit hash（@Backend 提交時的 commit）
2. 執行 `git revert <hash>` 不 force（保留歷史）
3. 觸發 schema-validator + rule-token-budget 重跑（確認系統狀態一致）
4. 通知 User：「strategyWeight 變更失敗已回滾 commit `<hash>`；EXEMPTION_LOG 記錄」
5. 若 User 要求重試 → 重跑 Step 1（不延用舊 ADVICE）

**絕對禁止**：

- Step 4 失敗後不 revert 留下半完成狀態（資料不一致）
- 跳過 EXEMPTION_LOG 記錄（災後審計失效）
- @Lead 重派 @Backend 跑 Step 4 而不重跑 Step 1（流程退化）

---

## 與既有提案的繼承關係

本 checklist 整合以下歷史提案意圖（對齊 `PROPOSAL_INDEX.md §🔗`）：

- PROPOSAL-005：禁止語氣升級
- PROPOSAL-013：系統級豁免記錄規範
- PROPOSAL-020：@Security + SC-03 SC 範疇
- PROPOSAL_20260422_011：本 checklist 建立
- PROPOSAL_20260501_004：補中段失敗回滾流程

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: strategyweight-change-checklist
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 checklist 為**通用數值敏感資料異動流程**；「strategyWeight」為 IMN 專案代稱，可對應其他專案的敏感配置（如 `trading_policy` / `risk_limits` / `pricing_config`）。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念                     | Workspace 欄位                    | Fallback 行為            |
| ---------------------------- | --------------------------------- | ------------------------ |
| 敏感資料路徑（審查強制觸發） | `CRITICAL_PATHS.敏感配置異動路徑` | 阻斷：未定義者禁止修改   |
| HITL 升級條件                | `BUSINESS_RULES.零容忍條款`       | 阻斷：零容忍清單必須明文 |

---

## Related Decisions

- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
