# .agents/tests/ — Agent 行為自動化驗收框架

> 由 PROPOSAL_20260422_009 建立；經 PROPOSAL_20260423_006 / 008 / 012 / 015 / 017 / 20260424_020 / 023 / 20260430_005 擴充。
> 共 16 個 validator/test 檔案；12 個自動納入 `run-all.sh`，4 個 on-demand，2 個 lib unit test 由 `scripts/run.sh` 帶起。

---

## 目錄

- [run-all.sh — 統一入口](#run-allsh--統一入口)
- [自動 validator（12 個）](#自動-validator12-個)
- [On-demand validator（4 個）](#on-demand-validator4-個)
- [Lib unit tests（2 個）](#lib-unit-tests2-個)
- [Scripts smoke / unit tests](#scripts-smoke--unit-tests)
- [模式選擇建議](#模式選擇建議)
- [退出碼契約](#退出碼契約)
- [SoT — Validator 清單來源](#sot--validator-清單來源)
- [檔案結構](#檔案結構)

---

## run-all.sh — 統一入口

```bash
# Full（預設；12 並行 + scripts 序列；< 30 sec）
python3 .agents/tests/run-all.py

# Fast（依 git diff 跳過無關 validators；通常 < 5 sec）
python3 .agents/tests/run-all.py --fast

# Single validator（極速反覆測試）
python3 .agents/tests/run-all.py --validator <name>

# Regenerate auto-generated indexes（4 自動 + 2 手動提示）
python3 .agents/tests/run-all.py --regenerate-indexes

# 顯示完整說明
python3 .agents/tests/run-all.py --help
```

---

## 自動 validator（12 個）

> 全部納入 `run-all.sh` 並行執行；觸發來源 = git diff 命中 `lib/git-diff-detector.sh` 對應 case。

| #   | Name             | 用途                                                                     | 退出碼語意            | 平均時長 |
| --- | ---------------- | ------------------------------------------------------------------------ | --------------------- | -------- |
| 1   | `schema`         | rules/\*.md frontmatter + token budget                                   | 0=ok 1=warn 2=err     | < 1 sec  |
| 2   | `intent`         | proposal intent 繼承關係表                                               | 0/1/2                 | < 1 sec  |
| 3   | `workspace`      | WORKSPACE_SCHEMA + skills/tasks F2                                       | 0/1/2                 | < 1 sec  |
| 4   | `drift`          | agent drift simulator (Mode A static)                                    | 0=≥0.85 / 1=≥0.70 / 2 | < 1 sec  |
| 5   | `ref`            | !ref anchor 完整性 + cycle 偵測                                          | 0/2                   | < 1 sec  |
| 6   | `sync`           | agents-overview.md 5 cross-ref 對齊                                      | 0/2                   | < 1 sec  |
| 7   | `loc`            | docs 位置（framework vs project）                                        | 0/2                   | < 1 sec  |
| 8   | `index_drift`    | INDEX 區塊 auto-generated drift（PROPOSAL_20260423_012）                 | 0/1/2                 | < 1 sec  |
| 9   | `proposal_scope` | proposal 位置 ↔ scope 一致性（PROPOSAL_20260423_015）                    | 0/1                   | < 1 sec  |
| 10  | `tech_stack`     | tech-stacks/ MANIFEST 註冊驗證（PROPOSAL_20260423_017）                  | 0/1/2                 | < 1 sec  |
| 11  | `rule_token`     | rules/\*.md token budget（warn=3000, block=4000；PROPOSAL_20260424_020） | 0/1/2                 | < 1 sec  |
| 12  | `routing_ticket` | ROUTING_TICKET.md schema + Lane↔Model（PROPOSAL_20260424_023）           | 0/1/2                 | < 1 sec  |
| 13  | `iron_theme`     | iron-rules/ 跨切不可變鐵律雙向一致性（PROPOSAL_20260501_002 + ADR-0037） | 0/1/2                 | < 1 sec  |

---

## On-demand validator（4 個）

> 不在 `run-all.sh` 批次內；由特定 Agent 或人工於需要時呼叫。

| Name                            | 用途                                              | 觸發時機                             | 呼叫                                                        |
| ------------------------------- | ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `adr-validator.mjs`             | ADR 引用清理進度（Type A/B/C 統計；warning mode） | PROPOSAL_20260423_016 Batch 2-5 期間 | `python3 .agents/tests/adr-validator.py`                    |
| `artifact-format-validator.mjs` | REVIEW/SECURITY/TEST_REPORT M2M 合約              | @QA / @Reviewer / @Security 收尾     | `python3 .agents/tests/artifact-format-validator.py <file>` |
| `lead-stateless-audit.mjs`      | @Lead 三鐵律（PENDING_ACTIONS + 對話歷史）        | @Auditor 定期評分時                  | `python3 .agents/tests/lead-stateless-audit.py`             |
| `validate-auditor-dispatch.mjs` | @Auditor 派發頻率合規（避免過頻）                 | @Lead 派發 @Auditor 前 self-check    | `python3 .agents/tests/validate-auditor-dispatch.py`        |

---

## Lib unit tests（2 個）

> 純 lib 函式單元測試；由 `scripts/run.sh` L1 段帶起，不直接列入 `run-all.sh`。

| 檔案                            | 測試對象                                                                    | 框架             |
| ------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| `auto-generated-block.test.mjs` | `scripts/generators/lib/auto-generated-block.mjs`（10 cases）               | 自訂 mini-runner |
| `gen-proposal-index.test.mjs`   | `scripts/generators/gen-proposal-index.mjs::parseProposalStatus`（7 cases） | 自訂 mini-runner |

呼叫：包含於 `python3 .agents/tests/scripts/run.py`（L1 段 3 套件並列）。

---

## Scripts smoke / unit tests

`tests/scripts/` 子目錄，PROPOSAL_20260423_006 建立：

| 層  | 檔案                                    | 用途                                                 |
| --- | --------------------------------------- | ---------------------------------------------------- |
| L1  | `unit.test.mjs`                         | scripts/ 純函式單元測試（node:test 風格）            |
| L1  | `auto-generated-block.test.mjs`（root） | lib unit（PROPOSAL_20260423_012）                    |
| L1  | `gen-proposal-index.test.mjs`（root）   | parseProposalStatus（PROPOSAL_20260423_012）         |
| L3  | `smoke.test.sh`                         | init-workspace / framework-diff / run-all bash smoke |

呼叫：`python3 .agents/tests/scripts/run.py`（會被 `run-all.sh` 序列段自動帶起，避免 workspace 競爭）。

---

## 模式選擇建議

| 情境               | 推薦模式                        | 理由                                     |
| ------------------ | ------------------------------- | ---------------------------------------- |
| 提案 Phase E 收尾  | `full`                          | 兜底覆蓋；禁用 fast 漏跑                 |
| Pre-commit hook    | `--fast`                        | 速度優先；保守跳過                       |
| 開發特定 validator | `--validator <name>`            | 反覆迭代                                 |
| CI / nightly       | `full` + `--regenerate-indexes` | 完整稽核 + 索引重生                      |
| 提案完成後重生索引 | `--regenerate-indexes`          | rvi/pi/adr 自動 + changelog/version 手動 |

詳見 `RULES_DESIGN_GUIDE §十二 Validator 執行模式`。

---

## 退出碼契約

| Code | 語意    | 預設行為                       |
| ---- | ------- | ------------------------------ |
| `0`  | 通過    | commit allowed                 |
| `1`  | warning | commit allowed（提示但不阻斷） |
| `2`  | error   | commit blocked                 |

註：`scripts` 段 fail 視為 warning（工具層 vs 規範層，不阻斷 commit）。
詳見 `run-all.sh` §Policy 判斷段。

---

## SoT — Validator 清單來源

**單一來源**：`lib/git-diff-detector.sh §ALL_VALIDATORS`（PROPOSAL_20260430_005 統一）。

`run-all.sh` 在 full / fast 兩模式皆透過 `source` 讀取此變數，避免雙源頭漂移。

```bash
# lib/git-diff-detector.sh
ALL_VALIDATORS="schema intent workspace drift ref sync loc index_drift proposal_scope tech_stack rule_token routing_ticket iron_theme"
```

新增 validator 須同步更新：

1. `lib/git-diff-detector.sh §ALL_VALIDATORS` + 對應 case 分支
2. `run-all.sh §VALIDATOR_CMD` + `§VALIDATOR_TITLE` 字典
3. 本 README §自動 validator 表
4. `run-all.sh --help` 字串

---

## 檔案結構

```
.agents/tests/
├── README.md                          ← 本檔
├── run-all.sh                         ← 統一入口（full/fast/validator/regen）
├── lib/
│   ├── frontmatter.mjs                ← 集中 YAML frontmatter 解析（PROPOSAL_20260430_005）
│   └── git-diff-detector.sh           ← fast mode 偵測 + ALL_VALIDATORS SoT
├── scripts/
│   ├── run.sh                         ← scripts/ 測試入口（L1 + L3）
│   ├── unit.test.mjs                  ← scripts/ 純函式單元（node:test）
│   └── smoke.test.sh                  ← bash smoke
│
├── 自動 12（納入 run-all.sh）
│   ├── schema-validator.mjs
│   ├── proposal-intent-consistency.mjs
│   ├── workspace-schema-validator.mjs
│   ├── agent-drift-simulator.mjs
│   ├── ref-validator.mjs
│   ├── agents-overview-sync-validator.mjs
│   ├── docs-location-validator.mjs
│   ├── index-drift-validator.sh
│   ├── proposal-scope-validator.mjs
│   ├── tech-stack-validator.mjs
│   ├── rule-token-budget-validator.mjs
│   └── routing-ticket-validator.mjs
│
├── on-demand 4（不納入 run-all.sh）
│   ├── adr-validator.mjs
│   ├── artifact-format-validator.mjs
│   ├── lead-stateless-audit.mjs
│   └── validate-auditor-dispatch.mjs
│
└── lib unit 2（由 scripts/run.sh 帶起）
    ├── auto-generated-block.test.mjs
    └── gen-proposal-index.test.mjs
```

---

## 觸發時機（規範層）

- **手動**：開發者直接執行 `node .agents/tests/<script>.mjs`
- **提案採納後**：`@Lead` 執行 Gate Check 前呼叫（依 `RULES_DESIGN_GUIDE §十一`）
- **pre-commit hook**：配置於 `.claude/settings.local.json`（選用，建議 `--fast`）
  - 啟用：`cp .claude/settings.local.json.example .claude/settings.local.json`
  - 範本已支援 fast / full / regen 三模式（見 `_modes` 註解）

## 與既有提案的關係

- 支撐 PROPOSAL_20260422_008（`@Auditor` 可呼叫本目錄腳本作為評審工具）
- 完成 PROPOSAL-021 §六 未來工具路徑前 12 項實作
- 補齊 PROPOSAL_20260422_007 P-14 機械化偵測（`proposal-intent-consistency.mjs`）
- PROPOSAL_20260430_005 整合：lib 抽出 + SoT 統一 + 文件補完
