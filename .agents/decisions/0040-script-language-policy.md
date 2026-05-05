---
adr_id: ADR-0040
title: Script Language Policy（Python primary；Node legacy；Bash deprecated）
status: Accepted
date: 2026-05-04
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260502_025
referenced_by:
  - skills/script-language-policy.md
  - docs/SCRIPT_MIGRATION_ROADMAP.md
  - INSTALL.md §0
---

# ADR-0040: Script Language Policy

## Status

**Accepted** (2026-05-04)

## Context

Framework 累積有：

- 39 個 `.mjs`（Node.js scripts；早期建立）
- 6 個 `.sh`（bash；早期建立；run-all 並行 / git diff lib / hooks 等）
- 0 個 `.py`（直到 PROPOSAL_502_025）

User 使用情境暴露 3 個問題：

1. **Windows native cmd 不認 bash** → 6 個 .sh 在 Windows 直接跑會失敗（需 WSL / Git Bash）
2. **mempalace 已用 Python**（必裝；3.3.4+）→ Python runtime 100% 可保證存在
3. **後續維護成本**：3 種語言（Node / Bash / Python）混用 → cross-platform 行為差異 + 測試成本 + 新人學習曲線

User 明確指示「後續腳本一律 Python；既有逐步遷移」。

## Decision

訂立 framework 腳本語言三層策略：

### Tier 1: Python（**primary**）

- **新建 scripts 一律 Python**（無例外）
- 利用 mempalace 已要求的 Python 3.9+ runtime
- 標準函式庫足夠（subprocess / pathlib / re / json）；少數需 pyyaml（補 README 提示）
- Cross-platform 100%（Windows native cmd 也能跑 `python script.py`）

### Tier 2: Node.js / `.mjs`（**legacy**）

- 既有 39 個 `.mjs` 不立即改寫；漸進遷移（roadmap：`docs/SCRIPT_MIGRATION_ROADMAP.md`）
- 改 `.mjs` 文件時若需大改 → 趁機改 `.py`
- 純 Node-specific 邏輯（如 `import.meta.url` / 特殊 ESM 行為）→ 評估遷移可行性後決定

### Tier 3: Bash / `.sh`（**deprecated**）

- 不新增 `.sh` 腳本（無例外）
- 既有 6 個 `.sh` 已部分 ported → `.py`（PROPOSAL_502_025 Sprint A/B）：
  - ✅ `index-drift-validator.sh` → `.py`
  - ✅ `tests/scripts/run.sh` → `.py`
  - ✅ `hooks/mempalace-auto-mine.sh` → `.py`
  - ✅ `lib/git-diff-detector.sh` → `git_diff_detector.py`
  - ✅ `run-all.sh` → `run-all.py`
  - ⏳ `tests/scripts/smoke.test.sh` → `.py`（roadmap）
- 舊 `.sh` 暫保留作 fallback（git CI / 純 shell 環境）；下一輪審計可刪

## Alternatives Considered

| 方案                                                  | 為何不採                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| **A：保留 Node 為 primary**                           | Node runtime 普及度仍輸 Python；mempalace 已強制 Python；多語言混用沒解 |
| **B：保留 Bash 並補 Windows 文件**（建議用 Git Bash） | 強制 user 裝 Git Bash 違反「user 0 額外負擔」原則                       |
| **C：本決策（Python primary + 漸進遷移）**            | ✅ 與 mempalace 共用 runtime；cross-platform；逐步降低語言多樣性        |
| D：Rust / Go 寫 framework                             | overkill；framework script 不需 perf；學習曲線高                        |

## Consequences

### Positive

- ✅ Cross-platform 100%（Windows native 也能跑）
- ✅ 共用 mempalace 的 Python runtime；無新依賴
- ✅ 與 LLM agent 環境（Claude Code / Qwen / Antigravity）的 `run_command` tool 100% 相容
- ✅ 長期降低 framework 維護面（從 3 語言降至 1-2 語言）
- ✅ Python typing / dataclasses / 標準 testing → 比 Bash 易維護

### Negative / Trade-offs

- 🟡 既有 39 個 `.mjs` 漸進遷移成本（評估 ~40-80h；分多個 follow-up proposals）
- 🟡 Python startup 比 Node 慢（`run-all.sh` 並行 ~0.9s vs Python `concurrent.futures` ~1.5s 估）；可接受（一次 commit 才跑）
- 🟡 Node `.mjs` testing 工具（`node --test`）與 Python `unittest`/`pytest` 不同；遷移時測試需重寫
- 🟡 開發者需懂 Python（Node 開發者轉換成本）

### 套用範圍

- 新 validator / generator / hook → Python
- 新 utility script → Python
- 既有 `.mjs` 改寫 ≥ 50% 範圍時 → 趁機改 Python（**機會主義式**遷移；不強制 sprint）
- 既有 `.sh` 全部要遷移（roadmap 中規劃）

## Validation

- 安裝確認：`python3 --version` ≥ 3.9
- 第一支 Python validator：`tests/user-execution-language-validator.py`（PROPOSAL_502_025 T-2）
- run-all 入口可走 Python：`python3 .agents/tests/run-all.py`（PROPOSAL_502_025 Sprint B）
- Migration roadmap：`docs/SCRIPT_MIGRATION_ROADMAP.md`

## Notes

- 與 ADR-0024 零外部依賴正交：Python 是 mempalace 已要求的 local runtime；非外部 API
- 與 ADR-0034 LangGraph + MCP 正交：MCP 整合語言無關
- 後續若 Python ecosystem 出現 framework-incompatible 問題（罕見）→ follow-up ADR amend
