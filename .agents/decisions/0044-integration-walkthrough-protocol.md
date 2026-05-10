---
adr_id: ADR-0044
title: Integration Walkthrough Protocol（每 N proposals 跨提案交互回歸驗證 SOP）
status: Accepted
date: 2026-05-07
related_proposals: [PROPOSAL_20260502_048]
referenced_by:
  - tasks/integration-walkthrough-protocol.md
  - skills/patrol-notification-catalog.md (P-40)
  - rules/lead.md
---

# ADR-0044: Integration Walkthrough Protocol

## Status

**Accepted** (2026-05-07)

## Context

v7.7 → v7.20 共 8 stabilization proposals 連續執行；六輪 Round 1-6 simulation 揭露：

- 每 3-5 個提案累積後 → 跨提案交互浮現新盲點（如 Round 2 17 新引入 GR / Round 3 主題 R3-A 結構性 SPOF）
- 單提案 review 階段只看自身完整性；無「N 提案疊加交互」回歸機制
- 反覆走 simulation → 修補 → simulation 循環是有效手段，但 **目前依 user 手動觸發**

→ 需把「整合 walkthrough」從 ad-hoc 升為 framework SOP（governance；C-3）。

## Decision

### 觸發條件

| 觸發          | 條件                                                   | 通知級別          |
| ------------- | ------------------------------------------------------ | ----------------- |
| Proposal 累積 | proposal index total 每達 5 倍數（如 130/135/140 ...） | P-40 🟡 提醒 user |
| ADR 重大變更  | 任 ADR `amends` 既有 ADR 且涉鐵律                      | P-40 🔴 強制      |
| Schema 變更   | routing-ticket-protocol §schema 加新欄位               | P-40 🟡           |
| User 明示     | user 講「跑 walkthrough / 整合驗證 / regression」      | 立即              |

### 執行 SOP（4 步驟）

依 `tasks/integration-walkthrough-protocol.md`：

1. **準備情境**：選 8 個典型 dispatch 情境（A-H；含 cross-stack feature / refactor / hotfix typo / onboarding / debug / 共寫 / fallback / 三機制交互）；參數可調整以避免 closed-list 寫死判斷
2. **派 4 並行 agents**：每 agent 跑 2 情境的設計層 walkthrough（不真執行 workflow；只追蹤每階段機制是否生效）
3. **產出 GR 報告**：結構化 markdown 至 `docs/Reports/SIMULATION_<topic>_<date>.md`；含 (a) 修補有效性表 (b) 新發現 GR 主題分類 (c) 凍結門檻評估 (d) 推薦行動
4. **後續**：依 GR 起 stabilization PROPOSAL\_\*；循環直到 GR < 5 + 高 < 2 → 凍結為 milestone

### 凍結門檻 v2（PROPOSAL_502_049 軟化機械門檻；保結構硬指標）

| 門檻            | 類別   | 標準                                                                                  |
| --------------- | ------ | ------------------------------------------------------------------------------------- |
| 高嚴重度        | **硬** | = 0                                                                                   |
| 結構性 SPOF     | **硬** | = 0                                                                                   |
| 總 GR           | 軟     | ≤ 5（含中/低）                                                                        |
| 條文-實作 drift | 軟     | C-1 真信號 ≤ 3（noise 不計；判定 SOP 見 `tasks/integration-walkthrough-protocol §3`） |
| Schema gap      | 軟     | C-2 真信號 ≤ 3（noise 不計）                                                          |

達門檻 → 凍結為 stabilization milestone vN（CHANGELOG 標記 🏁；寫 `docs/Reports/STABILIZATION_MILESTONE_V<N>_<date>.md` 凍結報告）。

### 與既有機制協同

- **C-1 condition-claim validator**：每次 commit 跑；本 protocol 補語意層
- **C-2 schema-completeness validator**：同上；本 protocol 補跨提案交互
- **@Auditor design audit (C-4 ADR-0045)**：定期跑；本 protocol 為 audit 觸發點之一

## Consequences

### 正向

- 跨提案交互盲點不再靠 user 直覺發現
- 凍結為 milestone 有客觀門檻
- N 提案累積債可被機械 detect

### 負向 / 風險

- 每 5 proposals 跑一次 walkthrough = LLM call 成本（4 agents × 200-500 tokens output）
- Walkthrough 結果可能持續產 GR 不收斂（如 Round 1-3 趨勢）→ 需配 ADR-0042 + ADR-0045 才完整

### 中性

- 觸發頻率 5 是經驗值；可依實際 GR 趨勢調整

## References

- PROPOSAL_502_048（本 ADR 建立）
- ADR-0042（Hybrid LLM Classifier；本 ADR 為其 governance 配套）
- ADR-0045（Design Audit；協同）
- Round 1-6 報告（`docs/Reports/SIMULATION_*.md`）
- `tasks/integration-walkthrough-protocol.md`（執行 SOP）
