# Skill: Patrol Notification Catalog (@Assistant 巡邏規則 + 通知目錄)

## §A 巡邏規則表（P-01 ~ P-29）

| #    | 掃描目標                                                                                       | 偵測條件                                                                                                                                                                                                                                                                                                         | 通知類型                           | 級別  | 阻斷新功能 |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----- | ---------- |
| P-01 | `REVIEW_REPORT.md`                                                                             | 複審 ≥ `REVIEW_CYCLE_LIMIT` 仍有 BLOCKER                                                                                                                                                                                                                                                                         | `REVIEW_QUALITY`                   | 🔴    | ✅         |
| P-02 | `TEST_REPORT.md`                                                                               | 重測 ≥ `QA_RETEST_LIMIT` 仍有 Bug                                                                                                                                                                                                                                                                                | `QA_QUALITY`                       | 🔴    | ✅         |
| P-03 | `proposals/*.md`                                                                               | `IN_PROGRESS` 超過任務週期未更新                                                                                                                                                                                                                                                                                 | `RETRO_TIMEOUT`                    | 🟡    | ❌         |
| P-04 | `proposals/*.md`                                                                               | `OPEN` 含 🚨 反覆問題警告                                                                                                                                                                                                                                                                                        | `RETRO_REPEAT`                     | 🔴    | ✅         |
| P-05 | `proposals/*.md`                                                                               | 任何 `OPEN` 新提案                                                                                                                                                                                                                                                                                               | `RETRO_PROPOSAL`                   | 🟡    | ❌         |
| P-06 | `ADVICE_*.md`                                                                                  | 含 🚨 領域衝突警告且 strategyWeight 未填                                                                                                                                                                                                                                                                         | `CONSULTANT_CONFLICT`              | 🔴    | ✅         |
| P-07 | `ADVICE_*.md`                                                                                  | 含 ⚠️ 未採納高風險建議                                                                                                                                                                                                                                                                                           | `CONSULTANT_RISK`                  | 🔴    | ✅         |
| P-08 | `docs/api/*.md`                                                                                | API 規格退回請求超過週期未回應                                                                                                                                                                                                                                                                                   | `FRONTEND_API_BLOCK`               | 🟡    | ❌         |
| P-09 | `REVIEW_REPORT.md`                                                                             | 標記 Hotfix 且收斂文件未更新                                                                                                                                                                                                                                                                                     | `HOTFIX_DOC_PENDING`               | 🟡    | ❌         |
| P-10 | `PENDING_ACTIONS.md §豁免記錄`                                                                 | 未歸檔豁免記錄 ≥ `EXEMPTION_AUDIT_THRESHOLD`                                                                                                                                                                                                                                                                     | `EXEMPTION_ACCUMULATED`            | 🟡    | ❌         |
| P-11 | `SECURITY_REPORT.md`                                                                           | 複審 ≥ `REVIEW_CYCLE_LIMIT` 仍有 BLOCKER（共用 P-01 計數）                                                                                                                                                                                                                                                       | `SECURITY_AUDIT_FAIL`              | 🔴    | ✅         |
| P-12 | `CURRENT_WORKSPACE` + `workspaces/`                                                            | workspace 缺失或欄位不完整                                                                                                                                                                                                                                                                                       | `WORKSPACE_MISSING`                | 🔴    | ✅         |
| P-13 | `docs/Reports/GLOBAL_STATUS_SUMMARY.md`                                                        | 摘要過期 > `SUMMARY_STALE_THRESHOLD`                                                                                                                                                                                                                                                                             | `SUMMARY_STALE`                    | 🟢    | ❌         |
| P-14 | `proposals/completed/*.md` + `PROPOSAL_INDEX.md §🔗`                                           | 意圖回退未標注繼承關係                                                                                                                                                                                                                                                                                           | `PROPOSAL_INTENT_REGRESSION`       | 🔴    | ✅         |
| P-15 | `.agents/docs/Reports/AUDIT_HISTORY.md`                                                        | 任一維度分數 < `AUDIT_DIMENSION_MIN_SCORE`                                                                                                                                                                                                                                                                       | `AUDIT_QUALITY`                    | 🟡    | ❌         |
| P-16 | `WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md`                                             | workspace-schema-validator exit 2（required 欄位缺失）                                                                                                                                                                                                                                                           | `WORKSPACE_REQUIRED_MISSING`       | 🔴    | ✅         |
| P-17 | `WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md`                                             | workspace-schema-validator exit 1（recommended 欄位缺失）                                                                                                                                                                                                                                                        | `WORKSPACE_RECOMMENDED_MISSING`    | 🟡    | ❌         |
| P-18 | `.agents/proposals/` + `workspaces/<*>/proposals/`                                             | scope 欄位與儲存位置不符 / scope 欄位缺失 / project 提案缺前綴（依 `RULES_DESIGN_GUIDE §十七.E`）                                                                                                                                                                                                                | `PROPOSAL_SCOPE_MISCLASSIFIED`     | 🟡    | ❌         |
| P-19 | `PENDING_ACTIONS.md` 派發紀錄 + `SYSTEM_THRESHOLDS.MODEL_ROUTING`                              | 派發指令未含 Model: 欄位 / 模型與 complexity 評估不符 / force_complex_scenarios 場景未使用 complex                                                                                                                                                                                                               | `MODEL_ROUTING_VIOLATION`          | 🟡    | ❌         |
| P-20 | `PENDING_ACTIONS.md §LANE_ESCALATION_*` + `SYSTEM_THRESHOLDS.LANE_ROUTING`                     | 24 小時內同一類任務升級 ≥ 3 次 / 派發指令未含 Lane: 欄位 / force_complex 場景未走 heavy                                                                                                                                                                                                                          | `LANE_ESCALATION`                  | 🟡    | ❌         |
| P-21 | `PENDING_ACTIONS.md §LIGHT_HOTFIX_*`                                                           | light 路徑後 24h 內 SC 事故                                                                                                                                                                                                                                                                                      | `HOTFIX_LIGHT_MISUSE`              | 🟡    | ❌         |
| P-22 | `proposals/active/*.md`                                                                        | Lite 提案 LOC > 50 或 phases > 2                                                                                                                                                                                                                                                                                 | `LITE_OVERUSE`                     | 🟡    | ❌         |
| P-23 | `workspaces/<CURRENT_WORKSPACE>.md` + `tech-stacks/MANIFEST.yaml`                              | `today - TECH_STACK.last_audit_date > audit_interval_days`（預設 30 天）                                                                                                                                                                                                                                         | `TECH_STACK_AUDIT_OVERDUE`         | 🟢    | ❌         |
| P-24 | `rules/*.md` token_estimate                                                                    | 任一 rule 檔 token_estimate > `rule_token_thresholds.block`（預設 4000）且連續 7 天無拆檔提案                                                                                                                                                                                                                    | `RULE_SIZE_OVERDUE`                | 🟡    | ❌         |
| P-25 | `docs/plans/prior-art/*.md` `verified_method` 欄位 + `docs/Reports/AUDIT_HISTORY.md §豁免記錄` | `verified_method: bypass` 但 `AUDIT_HISTORY.md §豁免記錄` 無對應條目（`PROPOSAL_20260430_004` 補；對齊 `lead.md §s06b` Bypass 必同步豁免記錄）                                                                                                                                                                   | `PRIOR_ART_BYPASS_UNLOGGED`        | 🟡    | ❌         |
| P-26 | `ROUTING_TICKET.md` + `mempalace status`                                                       | MCP 可達情況下 @Lead 派發產生 ROUTING_TICKET 但內容無 `mempalace.search\|mempalace.wake-up\|mempalace.read\|debug_graveyard\|architecture\|strategy_context` 任一引用（違反 `lead.md §s_memory_palace` 絕對禁止）；累計 ≥ 3 升 🔴 `MEMPALACE_SILENT_SKIP_PERSISTENT`（PROPOSAL_502_009 I-1；解 Phase D Risk #2） | `MEMPALACE_SILENT_SKIP`            | 🟡    | ❌         |
| P-27 | `ROUTING_TICKET.md status` 欄位 + 派發時間戳                                                   | sub-agent 派發後 5 min 無 `acknowledged` / `completed` 回應 → ticket 標 `status: timeout` + 計入累積；累計 ≥ 3 → 🔴 升條件 1 全局阻斷（system-prompt §條件 1）（PROPOSAL_502_015 O-1；解 Sim-E S18）                                                                                                             | `SUBAGENT_TIMEOUT`                 | 🟡    | ❌         |
| P-28 | `mempalace status` drawer count                                                                | drawer count > `COMPRESS_WARN_THRESHOLD`(1000) → 🟡 排程 compress；> `COMPRESS_ERROR_THRESHOLD`(5000) → 🔴 阻斷新派發直到 compress 完成（依 lead.md §s_memory_palace + memory-operations §6.5；PROPOSAL_502_015 O-2；解 Sim-D S14）                                                                              | `DRAWER_COUNT_THRESHOLD`           | 🟡/🔴 | ❌/✅      |
| P-29 | `PENDING_ACTIONS.md §📥 PENDING_DISPATCHES` queue 長度                                         | queue ≥ 5 → 🟡「並發任務超載」；queue ≥ 10 → 🔴 阻斷新指令直至 queue ≤ 3（解 017 Q-8 孤兒；串接 lead.md §s_complexity_lane 並發排隊；PROPOSAL_502_018 R-3）                                                                                                                                                      | `DISPATCH_QUEUE_OVERFLOW`          | 🟡/🔴 | ❌/✅      |
| P-30 | `proposals/PROPOSAL_INDEX.md` stats 區塊 total                                                 | total > `PROPOSAL_TOTAL_WARN`(50) → 🟡 「提案總量過大；考慮批次歸檔」；> 100 → 🔴 阻斷新提案直到歸檔（PROPOSAL_502_023 C-6 / B-10）                                                                                                                                                                              | `PROPOSAL_TOTAL_OVER_50`           | 🟡/🔴 | ❌/✅      |
| P-31 | Prior Art Gate `PRIOR_ART_VERIFY_PENDING` 發出時間戳                                           | 24h（或 5 工作對話）User 未回覆 → 🟡 OVERDUE；再 24h（或 5 對話）→ 🔴 阻斷新派發（PROPOSAL_502_023 A-4）                                                                                                                                                                                                         | `PRIOR_ART_VERIFY_PENDING_OVERDUE` | 🟡/🔴 | ❌/✅      |

## §B 通知類型完整定義（簡要）

每個通知類型的處理指令、條件消失定義、阻斷語意，詳見 `assistant.md §s06 + §s15 + §s08`。

## §C 巡邏執行流程

```
@Lead 呼叫 @Assistant 巡邏
 ↓
依序掃描 P-01 ~ P-29
 ↓
每條規則：條件成立 → 寫入 PENDING_ACTIONS.md（避免重複）
 ↓
主動關閉掃描：條件消失 → 移至「最近已處理」
 ↓
回報新增 / 關閉筆數給 @Lead
```

## §D P-23 `TECH_STACK_AUDIT_OVERDUE` 詳細處理

**由 PROPOSAL_20260424_018 Phase E 新增**。

**偵測邏輯**：

1. 讀 `.agents/CURRENT_WORKSPACE` 取當前 workspace 名稱
2. 讀 `.agents/workspaces/<name>.md`，解析 `TECH_STACK.last_audit_date` 與 `audit_interval_days`
3. 若兩欄位皆缺（舊 workspace） → 跳過（相容性處理）
4. 若僅 `last_audit_date` 缺 → 提示 User 執行首次 audit
5. 計算 `days_since = today - last_audit_date`
6. 若 `days_since > audit_interval_days` → 寫入 PENDING_ACTIONS.md：

```
## TECH_STACK_AUDIT_OVERDUE
- workspace: <name>
- last_audit_date: <YYYY-MM-DD>
- interval: <N> days
- overdue_by: <M> days
- suggested_command: node .agents/scripts/tech-stack-manage.mjs audit
- notification_level: 🟢 INFO（提示；不阻斷）
- user_command_to_close: "完成 audit 或 推遲 audit <新日期>"
```

**通知級別**：`🟢`（INFO 級；對齊 ADR-0030 五級體系；不阻斷新任務）

> **PROPOSAL_20260501_004 修正**：原 `💡` Hint 級為自創第 6 級違反 ADR-0030 五級體系（🔴/❌/🟡/✅/🟢）；改用 `🟢` INFO 級對齊。

**條件消失偵測**：

- 若 `last_audit_date` 更新為近期（`days_since ≤ audit_interval_days`）→ 移至「最近已處理」
- 若 User 明示「推遲 audit」並 bump `audit_interval_days` → 同上

**防呆**：

- 同一 workspace 的 OVERDUE 項目只保留一筆（重複觸發忽略）
- Audit 完成後 `tech-stack-manage audit` 會自動更新 workspace `last_audit_date`；巡邏下次即關閉

## §D 重複偵測防呆

同一 `type` + 同一 `ref` 的未關閉項目 → 跳過不重複新增。

---

## Related Decisions

- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
- [ADR-0030](../decisions/0030-notification-classification.md) — 通知分級標準
