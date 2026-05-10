# Skill: Artifact Path Conventions（產出物路徑規範）

> 由 PROPOSAL_502_031 T-2 建立。framework 內所有 agent 產出物的歸檔位置 SoT；
> 違反 → root 散落 → `tests/root-artifact-pollution-validator.py` 偵測。

## §1 核心原則

1. **Root 唯一允許運行 artifact**：`ROUTING_TICKET.md` + `PENDING_ACTIONS.md`
2. **Per-dispatch reports → `.agents/archive/reports/<category>/`**（PROPOSAL_502_031 v2 修正；30 天滾動）
3. **Plans → `docs/plans/<category>/`**：PRIOR_ART / TEST_SPEC / DIAGNOSIS / draft_features（business value；保留）
4. **System architecture → `docs/`**：architecture.md / api/\*\_api.md（永久；唯一允許 docs/ 直接放的類型）
5. **Framework-internal → `.agents/docs/Reports/`**：AUDIT_HISTORY / 框架自評（append-only）
6. **Workspace-specific → `.agents/workspaces/<active>/`**：workspace-only artifacts
7. **完成後即時 archive**：ticket / 暫存檔 / snapshot

> **設計理由**（v2）：per-dispatch process reports（Review / Security / Test_Report）是過程產物；
> 完成 retro 後沒人讀；累積在 `docs/` 會稀釋「系統架構文件」純度。改 `.agents/archive/reports/`
> 短期保留（30 天）+ @Retro 批次清。

## §2 完整對照表

| Artifact                                                           | 路徑                                                               | 產出者                 | Lifecycle                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------- |
| **Root（運行中；單一）**                                           |                                                                    |                        |                                                                                     |
| `ROUTING_TICKET.md`                                                | project root                                                       | @Lead                  | 派發時寫；completed → auto-archive；reset idle                                      |
| `PENDING_ACTIONS.md`                                               | project root                                                       | @Assistant             | 持續維護；append-only                                                               |
| **Plans（規劃；docs/plans/）**                                     |                                                                    |                        |                                                                                     |
| draft_features                                                     | `docs/plans/draft_features.md`                                     | @Planner               | append-only                                                                         |
| Prior Art Report                                                   | `docs/plans/prior-art/<功能>.md`                                   | @Architect             | per 功能；HITL 兩 gate                                                              |
| Test Spec                                                          | `docs/plans/test-spec/<功能>.md`                                   | @QA (S4)               | per 功能                                                                            |
| Diagnosis                                                          | `docs/plans/diagnosis/<事故名>.md`                                 | @Backend / @Frontend   | per 事故                                                                            |
| API Spec                                                           | `docs/api/<模組>_api.md`                                           | @Architect             | per 模組                                                                            |
| Architecture                                                       | `docs/architecture.md`                                             | @Architect             | 收斂階段更新                                                                        |
| **Code Graph Impact**（PROPOSAL_502_037 解 G9）                    | `docs/code-graph/<symbol>-impact.md`                               | @Architect / @Reviewer | refactor / cross-file impact 分析；regenerate via `gitnexus impact <symbol>` 動態查 |
| **Reports（per-dispatch；`.agents/archive/reports/`；30 天滾動）** |                                                                    |                        |                                                                                     |
| Review Report                                                      | `.agents/archive/reports/review/<功能>-<YYYYMMDD>.md`              | @Reviewer              | per dispatch；@Retro 30 天清                                                        |
| Security Report                                                    | `.agents/archive/reports/security/<功能>-<YYYYMMDD>.md`            | @Security              | per SC trigger；同                                                                  |
| Test Report                                                        | `.agents/archive/reports/test/<功能>-<YYYYMMDD>.md`                | @QA (S7)               | per 驗證；同                                                                        |
| **Framework-internal（`.agents/docs/Reports/`）**                  |                                                                    |                        |                                                                                     |
| AUDIT_HISTORY                                                      | `.agents/docs/Reports/AUDIT_HISTORY.md`                            | @Auditor               | append-only                                                                         |
| AUDIT_DECISION_LOG                                                 | `.agents/docs/Reports/AUDIT_DECISION_LOG.md`                       | @Auditor               | append-only                                                                         |
| Cross-Harness Report                                               | `.agents/docs/Reports/CROSS_HARNESS_REPORT.md`                     | platform-detect        | per harness 重測                                                                    |
| Token Cost Analysis                                                | `.agents/docs/Reports/TOKEN_COST_ANALYSIS_REPORT.md`               | @Architect 評估時      | snapshot                                                                            |
| **Archive（已完成）**                                              |                                                                    |                        |                                                                                     |
| ROUTING_TICKET archive                                             | `.agents/archive/routing-tickets/TKT-YYYYMMDD-NNN.md`              | @Lead auto             | 30 天滾動                                                                           |
| Proposals archived                                                 | `.agents/proposals/archived/`                                      | @Retro                 | 2 audit 週期後                                                                      |
| Memory cold export                                                 | `.agents/memory/.export/<wing>/<room>/`                            | mempalace-export.py    | per drawer                                                                          |
| **Workspace-specific（`.agents/workspaces/<active>/`）**           |                                                                    |                        |                                                                                     |
| Workspace meta                                                     | `.agents/workspaces/<name>.md`                                     | init-workspace         | 持續更新                                                                            |
| Workspace proposals                                                | `.agents/workspaces/<name>/proposals/{active,completed,archived}/` | @Retro                 | per project scope                                                                   |
| Workspace memory                                                   | `.agents/workspaces/<name>/memory/`                                | mempalace mine         | per session                                                                         |

## §3 命名規範

### 3.1 Reports 加日期戳

避免覆寫；每次 dispatch 產獨立檔：

```
✅ .agents/archive/reports/review/strategy-engine-20260504.md
✅ .agents/archive/reports/security/auth-flow-20260503.md
❌ REVIEW_REPORT.md                            # 散落 root
❌ docs/reports/review.md                      # 已淘汰位置（v2）
❌ .agents/archive/reports/review/review.md    # 沒日期會覆寫
```

### 3.2 Plans 不加日期（per 功能單檔）

```
✅ docs/plans/diagnosis/order-service-race.md
✅ docs/plans/prior-art/auth-rewrite.md
❌ docs/plans/diagnosis-2026-05-04.md
```

理由：Plans 是 living document（per 功能持續更新）；Reports 是 snapshot（per dispatch）。

### 3.3 ROUTING_TICKET archive 命名

```
.agents/archive/routing-tickets/TKT-20260504-001.md
                                 ^^^ ticket sequence per day
```

## §4 Lifecycle 規範

### 4.1 ROUTING_TICKET.md（active ↔ idle）

```
[idle] → @Lead 派發 → status: dispatched
       → sub-agent acknowledged → status: acknowledged
       → sub-agent done → status: completed
       → @Lead auto-archive → 移至 .agents/archive/routing-tickets/
       → ROUTING_TICKET.md reset 為「status: idle」單行
[idle]
```

### 4.2 暫存檔 cleanup

| 暫存檔               | 命名                                      | Cleanup 時機 |
| -------------------- | ----------------------------------------- | ------------ |
| ROUTING_TICKET 草稿  | `ROUTING_TICKET.md.snapshot.<timestamp>`  | commit 前    |
| PENDING_ACTIONS 草稿 | `PENDING_ACTIONS.md.snapshot.<timestamp>` | commit 前    |
| Generator 暫存       | `*.tmp` / `*.bak`                         | 寫成功後     |

`.gitignore` 已含；commit 前 git pre-commit hook 應 cleanup。

## §5 違規偵測

`tests/root-artifact-pollution-validator.py`（PROPOSAL_502_031 T-4；19th validator）偵測：

| Pattern                                                                                                               |     嚴重度     |
| --------------------------------------------------------------------------------------------------------------------- | :------------: |
| Root 出現 `ROUTING_TICKET_*.md`（變體）                                                                               |       🔴       |
| Root 出現 `DIAGNOSIS_NOTE*.md` / `REVIEW_REPORT*.md` / `SECURITY_REPORT*.md` / `TEST_REPORT*.md` / `AUDIT_REPORT*.md` |       🔴       |
| Root 出現 `*.snapshot.*` 殘留（commit 後）                                                                            |       🟡       |
| `.agents/archive/reports/<category>/` 內檔 mtime > 30 天                                                              | 🟡 @Retro 應清 |
| `docs/reports/`（已 deprecated；v2 後該不存在）                                                                       |       🟡       |

## §6 對 5 高頻 rules 的引用

| Rule                                     | 產出 artifact                    | 引用本檔 §X                       |
| ---------------------------------------- | -------------------------------- | --------------------------------- |
| `rules/architect.md`                     | API spec / Diagnosis / Prior Art | §2 plans 區                       |
| `rules/backend.md` / `rules/frontend.md` | DIAGNOSIS_NOTE                   | §2 plans/diagnosis                |
| `rules/reviewer.md`                      | REVIEW_REPORT                    | §2 reports/review                 |
| `rules/security.md`                      | SECURITY_REPORT                  | §2 reports/security               |
| `rules/qa.md`                            | TEST_SPEC + TEST_REPORT          | §2 plans/test-spec + reports/test |
| `rules/auditor.md`                       | AUDIT_HISTORY append             | §2 framework-internal             |
| `rules/lead.md`                          | ROUTING_TICKET lifecycle         | §4.1                              |

## Related

- `.agents/skills/routing-ticket-protocol.md`（lifecycle 細則）
- `.agents/tests/root-artifact-pollution-validator.py`（違規偵測）
- `.agents/tasks/session-start-checklist.md`（fresh init 自修復）

## Related Decisions

- ADR-0001（Stateless Routing；ROUTING_TICKET 為 state anchor）
- ADR-0017（文件分層三原則；docs/ vs .agents/docs/ 邊界）
- ADR-0021（Proposal Lifecycle；archive 慣例）
