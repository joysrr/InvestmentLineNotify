---
adr_id: ADR-0043
title: Multi-Signal Task-Class Dispatch Policy（user 指令含多訊號 → @Lead 拆多 ticket）
status: Accepted
date: 2026-05-07
supersedes: []
amends: []
related_proposals: [PROPOSAL_20260502_046]
referenced_by:
  - skills/lead-orchestration-guide.md §6.3.1
  - skills/routing-ticket-protocol.md
---

# ADR-0043: Multi-Signal Task-Class Dispatch Policy

## Status

**Accepted** (2026-05-07)

## Context

Round 5 simulation 發現（GR-R5-4）：user 指令常混合多 task_class 訊號（如「footer typo 急修 + 順便 rename 9 caller」混 hotfix-light + modify-existing-refactor）；單 ticket schema task_class 為單一 enum，無「mixed」值，無拆分機制 → @Lead silently collapse 為單一 priority（取最低編號）→ 走錯通道。

例：hotfix-light 走「skip mempalace + skip B-1 hint」；refactor 9 caller 嚴重需 mempalace 查歷史 + GitNexus impact — 兩者鐵律衝突。

## Decision

### 多訊號偵測

@Lead 派發前 batch 第 5 探測（layer 1 結構訊號）+ §6.3.1 7-priority list 命中後，**檢測命中數量**：

- **單 priority 命中** → 走原流程；task_class_source: keyword
- **多 priority 命中**（≥2 priority 命中）→ 進「多訊號拆分流程」

### 多訊號拆分流程（4 步驟）

**Step 1 評估嚴重度**：依 priority 編號決定主 ticket：

- priority 1 (onboarding) > 2 (hotfix) > 3 (refactor) > 4 (modify) > 5 (doc) > 6 (config) > 7 (feature)
- priority 1 + 2 同時命中（onboarding + hotfix）= 設計矛盾 → 強制升 user 仲裁

**Step 2 主 ticket 派發**：依 priority 編號取最低（最緊急）為主 ticket task_class：

- 例：hotfix-light + refactor 三命中 → 主 ticket task_class=hotfix；hotfix-light 三機制全關生效
- ROUTING_TICKET frontmatter `multi_signal_secondary: [refactor]`（記錄次要訊號）

**Step 3 sibling ticket queue**：次要訊號寫入 `PENDING_DISPATCHES` queue：

- 主 ticket 完成 → 自動 pop 次 ticket：task_class=modify-existing（或 priority list 對應）；繼承 `pending_group_inherited_from`
- 次 ticket frontmatter `multi_signal_primary: <主 ticket_id>`

**Step 4 user 通知**：派發時 PENDING_ACTIONS §🟢 寫 `MULTI_SIGNAL_DISPATCHED`：

- 「user 指令含 N 訊號；本 ticket 走 hotfix（緊急通道）；refactor 部分 queue 中（主 ticket 完成後派發）」
- user 可明示「合併走單一通道」or「分開派」or「只跑某一」

### 例外：強制升 user 仲裁

下列組合 → 不自動拆；發 PENDING `MULTI_SIGNAL_AMBIGUOUS` 🔴 等 user 仲裁：

- onboarding + hotfix（語意矛盾；新 codebase 不應有生產事故）
- onboarding + 其他（onboarding 是專屬流程；不混派）
- ≥3 不同 priority 命中（複雜度過高）

### User 仲裁後鏈接語意（PROPOSAL_502_047 T-4 R6-1 補）

User 回 `MULTI_SIGNAL_AMBIGUOUS` 時可選：

- **「合併走單一通道」**：取最低 priority；其他訊號丟棄；單 ticket；無 multi_signal 鏈接
- **「分開派」**（≥3 priority case）：依 priority 編號低先序派發 N ticket；**所有次 ticket 的 `multi_signal_primary` 統一指向最低 priority（首）ticket**（非鏈式 N→N-1→...→1）；audit 統計時 root cause = 首 ticket
- **「只跑 X」**：派 X 對應 priority 的單 ticket；其他訊號丟棄

## Schema 變更

`routing-ticket-protocol.md §schema` 加：

```yaml
multi_signal_secondary: [] # PROPOSAL_502_046 + ADR-0043；list of task_class enum；本 ticket 為主時填次要訊號清單
multi_signal_primary: <ticket_id> # PROPOSAL_502_046；本 ticket 為次時填主 ticket id
```

## Consequences

### 正向

- 解 GR-R5-4 多衝突 silently mis-route 風險
- user 看得到拆分過程（透明度）
- 既有單 task_class 仍 dominant case；多訊號為例外

### 負向

- @Lead 需新一層偵測邏輯（priority 命中數計算）
- ROUTING_TICKET schema +2 欄位
- PENDING_DISPATCHES queue 多 entries

### 中性

- 拆分時點：派發前；不影響 sub-agent 執行期
- 次 ticket 走原流程；無特殊邏輯

## References

- PROPOSAL_502_046（本 ADR 建立）
- ADR-0042（Hybrid LLM Classifier；本 ADR 為其 layer 2 keyword priority 多命中後續流程）
- skills/lead-orchestration-guide §6.3.1
