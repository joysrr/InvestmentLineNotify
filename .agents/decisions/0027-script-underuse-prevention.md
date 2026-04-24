---
adr_id: ADR-0027
title: Script 漏用防護機制（四道防線）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_012
referenced_by:
  - tests/index-drift-validator.sh
  - rules/retro.md §s06 Pre/Post-Commit SOP
  - skills/rule-update-proposal-full-template.md
  - tasks/periodic-design-review.md §7.#9 SCRIPT_UNDERUSE
---

# ADR-0027: Script 漏用防護機制（四道防線）

## Status

**Accepted** (2026-04-24)

## Context

ADR-0025（AUTO-GENERATED）+ ADR-0026（並行 validator）提供了工具與機制，但 LLM 代理實務上仍**選擇性使用**：
- 2026-04-24 `ff95f38` 手動 Edit PROPOSAL_INDEX → 留下 3 處 stale 統計
- 歷史觀察：generator 採納後仍多次手動改 INDEX
- LLM 跨 session 無持久記憶 → 紀律難靠「記住」

需要**機械性強制**取代「代理需記住」。

## Decision

建立 **四道防線**：

### 第 1 道：工具低摩擦化

AUTO-GENERATED 區塊（ADR-0025）讓 `--write` 真正 idempotent；消除「手動編輯」的便利性優勢。

### 第 2 道：SOP 明文化

- `skills/rule-update-proposal-full-template.md` 加「🔧 立案/採納後必跑腳本」章節
- `rules/retro.md §s06` 加「Pre/Post-Commit 腳本執行 SOP」
- 明文哪個動作要跑哪個 generator

### 第 3 道：Pre-commit 執行兜底

- `tests/index-drift-validator.sh`（run-all.sh 第 10 validator）
  - 跑 `gen-proposal-index --check` + `gen-rules-version-index --check`
  - drift 偵測 → exit 1 → PreToolUse hook block commit
- 錯誤訊息含具體修復指令

### 第 4 道：長期監控

`tasks/periodic-design-review.md §7 警示維度 #9 SCRIPT_UNDERUSE`：
- 觸發：30 天內「stale 修正 / INDEX drift / 忘記跑 generator」commit ≥ 2 次
- WARN（≥2 次）/ ALERT（≥5 次）
- 納入 @Auditor 月度報告「Generator 使用率」指標（目標 >95%）

### 緊急豁免

`git commit --no-verify` 仍可用；但計入 §9 警示（避免濫用）

## Consequences

### 正面

- 從「代理需記住」升級為「工具機械性強制」
- 跨 session 紀律一致（不依賴 LLM 記憶）
- Dogfooding 閉環：PROPOSAL_012 本身即用 generators 關閉自身
- ff95f38 類事件機械阻斷

### 負面 / Tradeoffs

- pre-commit 多 1 個 validator（+ ~0.5 sec）
- 緊急情境可能需 `--no-verify` 豁免
- 警示維度 #9 需 @Auditor 週期觀察

## Alternatives Considered

### Alternative A: 僅靠 SOP 文件（無機械兜底）

**為何不採用**：ff95f38 證明光靠文件無用；LLM 跨 session 會忘。

### Alternative B: 完全禁止手動 Edit INDEX

**為何不採用**：某些邊界案例（§🔗 Notes 等）仍需人工；完全禁止過嚴。

## Related Proposals

- PROPOSAL_20260423_012（原始提案：Script 漏用防護機制 + 四道防線）

## Referenced By

- `tests/index-drift-validator.sh`（第 3 道防線）
- `rules/retro.md §s06 Pre/Post-Commit SOP`（第 2 道）
- `skills/rule-update-proposal-full-template.md`（第 2 道）
- `tasks/periodic-design-review.md §7.#9 SCRIPT_UNDERUSE`（第 4 道）

## Notes

- 四道防線設計：工具（ADR-0025）+ 流程（SOP）+ 執行（pre-commit）+ 監控（#9）
- 任一道失守仍有後繼防線（深度防禦）
- 本 session 後續執行均用 generators 自動化（dogfood 驗證有效）
