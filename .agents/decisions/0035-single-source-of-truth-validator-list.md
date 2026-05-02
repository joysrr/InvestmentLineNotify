---
adr_id: ADR-0035
title: Single Source of Truth — 跨工具共享清單統一原則
status: Accepted
date: 2026-04-30
supersedes: []
superseded_by: []
extends: [ADR-0026]
related_proposals:
  - PROPOSAL_20260430_005
  - PROPOSAL_20260423_008 # 起源：run-all.sh 並行 + fast/full 各寫一份 validator 清單
referenced_by:
  - tests/lib/git-diff-detector.sh
  - tests/run-all.sh
  - tests/README.md
---

# ADR-0035: Single Source of Truth — 跨工具共享清單統一原則

## Status

**Accepted** (2026-04-30)

## Context

PROPOSAL_20260423_008 引入 `run-all.sh` fast / full 兩模式時，validator 清單在以下三處各自硬編碼：

1. `run-all.sh` §Full mode：`RELEVANT_VALIDATORS=(schema intent workspace ...)`
2. `lib/git-diff-detector.sh` fallback：`echo "schema intent workspace ..."`
3. `tests/README.md`：表格「Validator 列表」

PROPOSAL_20260423_017 + 20260424_023 後加入 `tech_stack` / `routing_ticket` / `rule_token` 三個 validator，但僅更新 (1)；(2) 漏 `routing_ticket` + `rule_token`，(3) 標題寫 9 但實際 12。Plan Z C-5 稽核發現此漂移。

**根因**：同一語意清單散落多處編輯，缺強制同步機制。每加一個 member 須同時改 N 處，漏一處則 fast mode 與 full mode 跑出不同結果（user 期望「fast 是 full 子集」但實際被破壞）。

## Decision

**對於工具層共享的「離散具名清單」，必選一處作 SoT；其他 source（bash）/ import（Node）取用，不得獨立硬編碼。**

具體規則：

1. SoT 應放在「最低層、最常被 source / import」的位置（lib/ 下優先）
2. SoT 變數命名前綴可辨識（例：`ALL_VALIDATORS`、`ALL_GENERATORS`）
3. 文件（README）視為 SoT 的「對外渲染」，必標明「修改見 SoT」附路徑
4. 新增清單成員只改 SoT；CR / PR review 時 reviewer 拒絕接受同名清單在 ≥2 處被修改的提案

**首次套用**：`tests/lib/git-diff-detector.sh §ALL_VALIDATORS` 為 SoT；`run-all.sh` 透過 `source` 讀取；fast / full 共用變數，避免清單漂移。

## Alternatives Considered

| 替代方案                                             | 為何不採                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| **YAML 集中配置（`.agents/tests/validators.yaml`）** | 需新增 yaml 解析；當前框架零外部依賴原則（ADR-0024）；過度工程         |
| **Validator 自動發現（glob `tests/*-validator.*`）** | 無法區分 auto-run 與 on-demand；無法表達依賴順序；on-demand 4 個會誤觸 |
| **保持各自獨立 + 加 lint 規則互檢**                  | 等於把 SoT 從清單改成 lint；驗證成本反而高                             |

## Consequences

### Positive

- fast 模式必為 full 子集（核心契約恢復）
- 新增 validator 只改一處（lib/git-diff-detector.sh）
- 文件 / 程式碼 / 註解可以同步機械化驗證

### Negative / Trade-offs

- 第一次 source 引入 bash / Node 雙語言互通性考量（當前以 bash 為主，Node validator 透過 cmd map 讀字串）
- SoT 檔案位置變動會打破多個 caller；遷移成本集中

### 套用範圍

| 場景                                                   | 是否套用 SoT 原則                                      |
| ------------------------------------------------------ | ------------------------------------------------------ |
| validator 清單（fast/full）                            | ✅（本決策首次套用）                                   |
| generator 清單（--regenerate-indexes 4 自動 + 2 手動） | ☐ 後續評估（當前 run-all.sh §Regen 段內聯）            |
| Agent 名單（rules/ 13 個）                             | ❌（已有 RULES_VERSION_INDEX 作 catalog；非 SoT 模式） |
| ALL_VALIDATORS 變數內 validator 順序                   | ❌（順序可變；只規範成員集合）                         |

## Validation

- `bash .agents/tests/run-all.sh` full 模式 12 validator 全跑 → ✅
- `bash .agents/tests/run-all.sh --fast`（rules 變更時）→ 含 `rule_token` ✅（修復前漏）
- 新增 validator 範例：若加 `dependency-validator`，只改 `lib/git-diff-detector.sh §ALL_VALIDATORS` + case 分支即可

## Notes

本 ADR 不規範「業務層 SoT」（如 SYSTEM_THRESHOLDS.yaml、WORKSPACE_SCHEMA.yaml；那些已是 SoT）。本 ADR 範圍 = **工具層離散清單**；當未來框架新增類似散布性清單時援引本 ADR。
