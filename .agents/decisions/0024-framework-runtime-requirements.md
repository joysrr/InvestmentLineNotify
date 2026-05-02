---
adr_id: ADR-0024
title: Framework Runtime 規範（Node.js 18+ / Bash / 零依賴）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_013
referenced_by:
  - FRAMEWORK_REQUIREMENTS.md
  - RULES_DESIGN_GUIDE.SCOPE §十六.G
  - scripts/**/*.mjs
  - tests/**/*.mjs
---

# ADR-0024: Framework Runtime 規範（Node.js 18+ / Bash / 零依賴）

## Status

**Accepted** (2026-04-24)

## Context

框架設計為跨專案可搬運；目標專案可能使用不同 runtime（Node.js / Python / .NET / Go）。若框架腳本依賴特定 runtime 生態（如 npm packages），搬運時需額外安裝 → 違反「純淨資產」意圖。

同時需避免 Agent 在未來自行引入異質語言腳本（如加入 Python ML），導致框架分裂。

## Decision

建立 **最低 runtime 要求** + **零外部依賴鐵律**：

### 最低 Runtime

| 項目                      | 最低版本                   | 必需                    |
| ------------------------- | -------------------------- | ----------------------- |
| **Node.js**               | 18.0+                      | 必需                    |
| **Bash**                  | 4.0+ (Git Bash on Windows) | 必需                    |
| **git**                   | 2.25+                      | 必需                    |
| Python / .NET / Go / Rust | —                          | **禁止** 於框架腳本使用 |

### 零依賴鐵律

- **絕對禁止** `.agents/scripts/` 下有 `package.json` / `node_modules`
- `.mjs` 只能 `import 'node:*'` 內建模組
- 不得引入 npm / pip / gem / cargo 依賴

### 腳本語言選擇

| 任務類型                          | 首選               | 禁止                  |
| --------------------------------- | ------------------ | --------------------- |
| 資料處理 / generator / validator  | Node.js `.mjs`     | Python / Go           |
| 跨平台 entry point / orchestrator | Bash `.sh` (POSIX) | 平台專屬 shell        |
| 測試                              | `node:test` + Bash | Jest / Mocha / pytest |

### 違規偵測

```bash
# 檢查 1：第三方 package 引入
grep -rh "^import .* from " .agents/scripts/ --include="*.mjs" \
  | grep -v "from 'node:" | grep -v 'from "node:' | grep -v "from './"
# 空輸出 = 合規

# 檢查 2：禁用語言腳本
find .agents/scripts -type f \
  \( -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" -o -name "*.rb" \)
# 空輸出 = 合規

# 檢查 3：package.json 汙染
find .agents/scripts -name package.json
```

## Consequences

### 正面

- `cp -r .agents/` 零摩擦搬運（無需 `npm install`）
- 版本衝突免疫（不與專案 node_modules 爭搶）
- 離線可用（無網路依賴）
- LLM Agent 可 grep 自檢合規

### 負面 / Tradeoffs

- 不能用成熟 npm packages（如 yaml、commander）
- `node:*` stdlib YAML 能力陽春（需自寫 parseYaml）
- CLI 介面無 Rich-like 美觀性
- Deno/Bun 未用（普及度低）

## Alternatives Considered

### Alternative A: 允許特定 npm 套件白名單

**為何不採用**：邊界難劃；白名單維護成本；仍需 `npm install`。

### Alternative B: 編譯為 Go/Rust binary

**為何不採用**：破壞 LLM 自我進化迴路（Agent 無法直接改源碼）；git repo 膨脹。

### Alternative C: Python 作為替代

**為何不採用**：Windows 預裝率低；.NET/Node 專案不一定有 Python。

## Related Proposals

- PROPOSAL_20260423_013（原始提案：Lite；明文宣告 runtime 要求）

## Referenced By

- `FRAMEWORK_REQUIREMENTS.md`（詳細規範）
- `RULES_DESIGN_GUIDE.SCOPE §十六.G`（摘要）
- `scripts/**/*.mjs`（遵守）
- `tests/**/*.mjs`（遵守；使用 `node:test` + `node:assert`）

## Notes

- 若未來真需其他 runtime（如 ML 場景用 Python）→ 提 Full Proposal 限縮於 `scripts/ml/` 子目錄 + 明文標記
- Deno / Docker / compiled binary 為長期選項；當前不採
- 自我稽核通過：當前 0 個第三方 import / 0 個 package.json / 0 個異質腳本
