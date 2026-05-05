# Script Migration Roadmap — `.mjs` / `.sh` → Python

> **文件分層**：framework（跨專案通用 framework 規劃文件；對齊 ADR-0017 文件分層三原則）
>
> 由 PROPOSAL_502_025 Sprint C T-5 建立。對齊 ADR-0040「Script Language Policy」。
> 本文件不執行；只規劃。實際遷移由 follow-up proposals（502_026 / 027 / ...）執行。

---

## 一、現況統計（2026-05-04）

| 語言         |               數量               | 範例                                                                                                          |
| ------------ | :------------------------------: | ------------------------------------------------------------------------------------------------------------- |
| Python `.py` |                5                 | run-all / index-drift-validator / user-execution-language-validator / git_diff_detector / mempalace_auto_mine |
| Node `.mjs`  |                39                | validators 16 / generators 6 / scripts 17                                                                     |
| Bash `.sh`   | 1 (active) + 5 (legacy fallback) | smoke.test.sh 待遷移；其他已 ported                                                                           |

## 二、優先順序（依「執行頻率」+「使用者影響」）

### 🔴 Phase 1（高優先；建議下個 sprint）

| Script                        | 行數 | 工時 | 理由                              |
| ----------------------------- | :--: | :--: | --------------------------------- |
| `tests/scripts/smoke.test.sh` | 351  | 2-3h | L3 smoke test runner；CI 流程要跑 |

### 🟡 Phase 2（中優先；Q3）

| Script                                   | 行數 | 工時 | 理由                                                        |
| ---------------------------------------- | :--: | :--: | ----------------------------------------------------------- |
| `tests/agent-drift-simulator.mjs`        | ~400 | 4-6h | 跨 harness 補實測；改 Python 後 Qwen / Antigravity 直接相容 |
| `tests/iron-theme-validator.mjs`         | ~200 | 2-3h | 高頻；每次修 rule 都跑                                      |
| `tests/memory-palace-validator.mjs`      | ~250 |  3h  | 與 mempalace（Python）直接通訊；Python 更天然               |
| `tests/sub-agent-dispatch-validator.mjs` | ~120 |  2h  | Pattern matching；輕鬆 port                                 |
| `tests/workflow-stage-validator.mjs`     | ~100 | 1-2h | 同上                                                        |
| `scripts/cross-harness-validator.mjs`    | ~150 |  2h  | 直接被 user 環境呼叫；cross-platform 必要                   |
| `scripts/platform-detect.mjs`            | ~300 | 3-4h | 同上                                                        |

### 🟢 Phase 3（低優先；當需大改時）

| Script                                            |    行數     |  工時  | 理由                                          |
| ------------------------------------------------- | :---------: | :----: | --------------------------------------------- |
| `tests/schema-validator.mjs`                      |     ~?      |   ?    | 純文字檢查；改寫獲益小                        |
| `tests/proposal-intent-consistency.mjs`           |     ~?      |   ?    | 同上                                          |
| `tests/ref-validator.mjs`                         |     ~?      |   ?    | 同上                                          |
| `tests/agents-overview-sync-validator.mjs`        |     ~?      |   ?    | 同上                                          |
| `tests/docs-location-validator.mjs`               |     ~?      |   ?    | 純路徑檢查                                    |
| `tests/proposal-scope-validator.mjs`              |     ~?      |   ?    | 同上                                          |
| `tests/tech-stack-validator.mjs`                  |     ~?      |   ?    | YAML parsing；Python 略佳                     |
| `tests/rule-token-budget-validator.mjs`           |     ~?      |   ?    | tiktoken-style 估算                           |
| `tests/routing-ticket-validator.mjs`              |     ~?      |   ?    | YAML parsing                                  |
| `tests/validate-auditor-dispatch.mjs`             |     ~?      |   ?    | 文字檢查                                      |
| `tests/auto-generated-block.test.mjs`             |     ~?      |   ?    | unit test framework                           |
| `tests/gen-proposal-index.test.mjs`               |     ~?      |   ?    | unit test framework                           |
| `tests/scripts/unit.test.mjs`                     |     ~?      |   ?    | unit test framework                           |
| `scripts/init-workspace.mjs`                      |    ~600+    | 8-10h  | 互動 CLI；agent-driven 後使用率低             |
| `scripts/framework-diff.mjs`                      |     ~?      |   ?    | git diff 邏輯                                 |
| `scripts/mempalace-export.mjs`                    |    ~250     |   3h   | 與 mempalace（Python）直接通訊；Python 更天然 |
| `scripts/tool-name-neutralizer.mjs`               |    ~150     |   2h   | 文字替換                                      |
| `scripts/generators/gen-*.mjs` × 6                | ~total 1500 | 10-15h | 主要為 markdown templating                    |
| `scripts/generators/lib/auto-generated-block.mjs` |     ~?      |   ?    | shared lib                                    |

### ⚪ Phase 4（不遷移；保留 .mjs）

| Script                                | 理由                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| `tests/auto-generated-block.test.mjs` | node:test 風格 unit test；改 Python 失去既有測試框架 |
| 其他純 unit test runner               | 同上                                                 |

## 三、遷移原則

1. **機會主義式遷移**：當 .mjs 需大改（≥ 50% LOC 動）→ 趁機改 Python；不為改而改
2. **CI 驗證**：每個遷移完成後跑舊 .sh / .mjs vs 新 .py 對比輸出
3. **舊檔保留 1 sprint**：作 fallback；確認穩定後刪
4. **文件更新**：`run-all.py` / `git-diff-detector.py` 內 cmd 表必同步更新
5. **依賴控管**：盡量用 stdlib；新增第三方依賴需經 ADR

## 四、估算總工時

| Phase    | 工時                         |
| -------- | ---------------------------- |
| Phase 1  | 2-3h                         |
| Phase 2  | 16-21h                       |
| Phase 3  | 30-50h（視 .mjs 行數 audit） |
| Phase 4  | 0h（保留）                   |
| **總計** | **48-74h**（分 4-6 sprints） |

## 五、follow-up proposals

| Proposal                            | 範圍                             |
| ----------------------------------- | -------------------------------- |
| PROPOSAL_502_026（建議下次 sprint） | Phase 1（smoke.test.sh）         |
| PROPOSAL_502_027                    | Phase 2（高頻 validators × 7）   |
| PROPOSAL_502_028 + 後續             | Phase 3（依需求 / 修檔頻率分批） |

User 不必一次決定全做；本 roadmap 提供優先順序，每次 sprint 開頭挑批次。

## Related

- `decisions/0040-script-language-policy.md`
- `proposals/completed/PROPOSAL_20260502_025.md`
- `INSTALL.md §0`
