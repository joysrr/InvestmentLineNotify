---
adr_id: ADR-0026
title: Validator 並行執行 + --fast / --validator 三模式
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_019
  - PROPOSAL_20260423_008
referenced_by:
  - tests/run-all.sh
  - tests/lib/git-diff-detector.sh
  - RULES_DESIGN_GUIDE.SCOPE §十二 Validator 執行模式
  - .claude/settings.local.json (PreToolUse hook)
---

# ADR-0026: Validator 並行執行 + --fast / --validator 三模式

## Status

**Accepted** (2026-04-23)

## Context

初版 `run-all.sh` 序列執行 7 個 validators，實測 ~35 sec；對 pre-commit hook 而言過慢，導致開發者傾向 `--no-verify` 繞過。需要速度優化。

## Decision

建立 **並行架構 + 三模式**：

### 並行架構

- 8 互不依賴 validators 並行執行（背景作業 + `wait` + `/tmp` log 暫存）
- `scripts` L3 smoke 序列執行（避免 workspace 競爭）

### 三種執行模式

| 模式             | 指令                                 | 用途                                            | 實測時長         |
| ---------------- | ------------------------------------ | ----------------------------------------------- | ---------------- |
| **full**（預設） | `bash run-all.sh`                    | 提案 Phase G 收尾；大改動                       | ~0.9 sec（並行） |
| **fast**         | `bash run-all.sh --fast`             | Pre-commit hook；依 git diff 跳過無關 validator | < 5 sec          |
| **single**       | `bash run-all.sh --validator <name>` | 開發時反覆測單一 validator                      | ~0.07 sec        |

### Fast 模式決策邏輯

`tests/lib/git-diff-detector.sh`：依 `git diff --cached` 檔案路徑映射到 validator 集合：

- `.agents/rules/*.md` → schema + drift + ref + sync
- `.agents/proposals/*.md` → intent + sync + index_drift + proposal_scope
- 無變更（罕見）→ fallback 跑全部

**保守策略**：未知檔案類型 → fallback sync（寧可多跑不漏）

### Phase E 驗收規範

- 提案執行 Phase G 收尾驗證 **強制 full 模式**（不可用 --fast；避免漏驗）
- Pre-commit hook 可用 --fast（速度優先）
- 單一 validator 失敗 → 用 --validator 反覆測

## Consequences

### 正面

- Full 模式 35 sec → 0.9 sec（-97%）
- Pre-commit hook 負擔降低（< 5 sec）→ 開發者不再繞過
- 單一 validator 反覆測開發效率提升
- 向後相容（預設 full；既有 hook 不需動）

### 負面 / Tradeoffs

- Fast 模式「保守跳過」邏輯需持續校準（漏跑 vs 誤跑）
- 並行需背景作業 + wait 同步；Bash 腳本複雜度上升
- 單一 validator 模式易導致「只測我改的」盲點（但由 full 兜底）

## Alternatives Considered

### Alternative A: 維持序列

**為何不採用**：35 sec 的 hook 過慢；繞過率高。

### Alternative B: 多進程 Node cluster

**為何不採用**：Bash 並行已夠用；避免增加 Node 依賴層。

## Related Proposals

- PROPOSAL_20260422_019（原始 pre-commit hook 配置）
- PROPOSAL_20260423_008（並行升級 + --fast + --validator 三模式）

## Referenced By

- `tests/run-all.sh`（主腳本）
- `tests/lib/git-diff-detector.sh`（fast 模式決策）
- `RULES_DESIGN_GUIDE.SCOPE §十二 Validator 執行模式`
- `.claude/settings.local.json`（PreToolUse hook 執行 run-all.sh）

## Notes

- 當前 validators 總數 11（schema / intent / workspace / drift / ref / sync / loc / scripts / index_drift / proposal_scope + scripts L3 smoke）
- 新 validator 加入時需同步更新：VALIDATOR_CMD 陣列 + git-diff-detector fallback
