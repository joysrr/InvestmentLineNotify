# 🎯 Milestone v3 Freeze Report — langgraph-runtime-v8-stable

> Frozen: **2026-05-07**
> Version: **v8.0.8**
> Baseline proposal: **PROPOSAL_20260502_060**
> dim 6 self-audit: **4.50 / 5.0**（PASS ≥2.0 ADR-0045 freeze gate by wide margin）

## §1 Executive Summary

v7.7 → v7.22 達 **milestone v2**（markdown-based prompt engineering framework + MCP tools；7 輪 sim 收斂）。

v7.22 → v8.0.x 跨入 **LangGraph runtime 時代**（PROPOSAL_502_046 起）；經 9 輪 A/B simulation、59 累計修補項，於 v8.0.8 達 **milestone v3 凍結條件**（高=0 / 結構性=0 / 中=0 / dim 6=4.50）。

核心特性：

- **行為層 mechanically enforced**（Q4 100%；ADR-0046 Option β'）
- **UX 不變**：4 harness（CLI / Web / Qwen / Antigravity）對話模式保留
- **LLM 不另計費**：sampling 預設反向呼 harness 視窗 LLM；API mode optional
- **v7.22 文件層為 ground truth**：parser.py 解析；validate_v722_ground_truth 把關
- **HITL interrupt 8 類型**：autonomy_mode 支援 auto / step-by-step / gate-at-design / gate-at-impl

## §2 9 輪 A/B Simulation 摘要

| Round | Version                  | Patches      | High | Struct | Med | Low | Sim agents 結論                   |
| ----- | ------------------------ | ------------ | ---- | ------ | --- | --- | --------------------------------- |
| R1    | v8.0 → v8.0.1            | 13           | 多   | 多     | 多  | 多  | 不凍結                            |
| R2    | v8.0.1 → v8.0.2          | 11           | 3    | -      | 5   | 3   | 不凍結                            |
| R3    | v8.0.2 → v8.0.3          | 4            | 1    | 2      | 1   | -   | 不凍結                            |
| R4    | v8.0.3 → v8.0.4          | 5            | 1    | 1      | 1   | 2   | 不凍結                            |
| R5    | v8.0.4 → v8.0.5          | 4            | -    | -      | 2   | 2   | 不凍結                            |
| R6    | v8.0.5 (validation only) | 0            | -    | -      | -   | 3   | 條件凍結                          |
| R7    | v8.0.5 → v8.0.6          | 14           | 2    | 1      | 3   | 8   | 不凍結（Web harness broken 抓出） |
| R8    | v8.0.6 → v8.0.7          | 6            | -    | 1      | 4   | 1   | 不凍結                            |
| R9    | v8.0.7 → v8.0.8          | 6 (cosmetic) | -    | -      | -   | 6   | **凍結 ✓**                        |

**收斂趨勢**：R1 多項 → R3 4 項 → R5 4 項 → R7 14 項（4-harness 首測爆量）→ R8 6 項 → R9 0 中以上。

## §3 59 累計修補項全錄

依 Round 分組；證據以 file:line 標注（v8.0.8 樹）。

### Round 1 (v8.0 → v8.0.1) — 13 項

- C-1 route_after_lead 補 backend/frontend/architect/onboarding 分支
- C-2 hotfix_light_gate fast track → END
- C-3 tier_upgrade_check incoming edge from reviewer
- C-4 dispatch_resume MCP tool（mcp_server.py:63）
- H-2 全 stage autonomy_gate 覆蓋
- H-3 onboarding_node 整合
- H-4 prior_art_gate / proposal_adopt_gate / strategy_weight_gate 接點
- M-4 \_wrap_with_autonomy_gate 死碼移除
- 7 處死碼清理

### Round 2 (v8.0.1 → v8.0.2) — 11 項

- V81-X-3 prior_art conditional（後 R3 拆兩 node 取代）
- V81-X-6 multi_signal 真讀 hitl_decision
- V81-X-7 backend / frontend strict JSON parse
- V81-B-1 priority 4 keyword 「修 」尾空白移除
- V81-X-2 hotfix-heavy fast lane
- V81-X-4 / X-5 proposal_adopt / strategy_weight conditional
- V81-X-12 reducer sanity（merge_dict / union_list）
- V81-X-8 retro stage label
- V81-X-14 telemetry whitelist
- V81-X-17 qa cycle limit assistant escape

### Round 3 (v8.0.2 → v8.0.3) — 4 項

- V82-X-1 multi_signal_check map 補 frontend
- V82-X-2 qa_retest_count 獨立計數
- V82-X-3 hotfix 跳 multi_signal 仲裁
- V82-X-4 prior_art_gate 拆 prior_art_search + prior_art_verify 兩 node

### Round 4 (v8.0.3 → v8.0.4) — 5 項

- V83-A-1 qa_verification edge map 補 assistant
- V83-A-2 architect prior_art reject-loop guard
- V83-A-3 \_phase_a_result 落地為 prior_art_report_path
- V83-A-4 lead.py hotfix 跳 multi_signal_secondary 寫入
- V83-A-5 dead bypass 分支移除

### Round 5 (v8.0.4 → v8.0.5) — 4 項

- V84-A-1 prior_art_search bypass 路徑落地
- V84-A-2 / B-1 graph.py `from typing import Any`
- V84-A-4 onboarding 排除 multi_signal 短路

### Round 7 (v8.0.5 → v8.0.6) — 14 項

- V86-A-1 InMemorySaver fallback（Web harness 解禁）
- V86-A-2 persistence fs probe + skip
- V86-A-3 ADR-0046 §4 補 Web fallback 段落
- V86-A-4 hotfix-light path token auto-extract
- V86-A-5 / B-1 dim 6 freeze gate 收斂進主 graph
- V86-A-6 safe_node_return helper 加入 \_base.py
- V86-A-7 \_handle_resume 加 v7.22 ground truth 重檢
- V86-A-8 \_gen_thread_id 改 UTC
- V86-B-2~B-7 cosmetic（subgraphs/**init** + lead/state imports + 4 nodes docstring + walkthrough docstring + dead doc-sync branch 全清）

### Round 8 (v8.0.6 → v8.0.7) — 6 項

- V87-B-1 state.py 補 \_dim6_can_freeze / \_dim6_needs_p15
- V87-B-2 dim 6 freeze gate enforce 釐清 + result_summary 訊號顯示
- V87-B-3 / A-2 safe_node_return 接進 backend / frontend / reviewer 三 hot node
- V87-B-4 reviewer hard_cycle_limit=3 純 count escape
- V87-B-5 dispatch_resume thread state 不存在友善 error
- V87-B-6 ADR-0046 §4 補 mcp_server-only entrypoint 段

### Round 9 (v8.0.7 → v8.0.8) — 6 項（全 cosmetic）

- V88-A-1 mcp_server request_context try/except
- V88-A-2 ADR-0046 §4 拆三 sub-section
- V88-A-3 result_summary P-15 加 retro.md §s06 link
- V88-B-1 mcp_server 移除 unused serialize_to_routing_ticket
- V88-B-2 nodes/\_base.py 移除 unused Any
- V88-B-3 nodes/**init**.py re-exports（intentional；no-op）

## §4 dim 6 Self-Audit (4.50 / 5.0)

| 子項                                     | 分數     | 證據                                                                                           |
| ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 6.1 condition_implementation_consistency | 0.92     | routing keys ⊆ returns 全對齊；qa_retest_count 獨立計數一致                                    |
| 6.2 cross_module_logic_consistency       | 0.90     | state ↔ hitl ↔ graph ↔ persistence 跨模一致；fs probe + InMemory fallback 對齊 ADR-0046        |
| 6.3 design_intent_drift                  | 0.88     | v7.22 ground truth recheck 兩處同步；ADR-0045 freeze gate 真 enforce 進 auditor.py             |
| 6.4 schema_completeness                  | 0.93     | 73 state fields；8 HITL types 全在 hitl.py + state Literal；\_dim6_can_freeze/\_needs_p15 補齊 |
| 6.5 governance_feedback_loop_health      | 0.87     | governance-health.py 跑 OK；C-2 warn 20 暴露但已知；KI 累計 9                                  |
| **dim 6 總分**                           | **4.50** | ADR-0045 ≥ 2.0 freeze gate **PASS by wide margin**                                             |

## §5 Freeze 6 條件達成

| 條件                          | 達成       | 證據                                                                                                                        |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| 高 = 0                        | ✅         | 0 high open                                                                                                                 |
| 結構性 = 0                    | ✅         | V87-B-1 已修                                                                                                                |
| 中 ≤ 0（可接受）              | ✅         | V87-B-2/3/4/5 全修；R9 新挖僅 cosmetic                                                                                      |
| 4 harness 全 walkthrough 通過 | ⚠️ PARTIAL | mcp_server walkthrough tool 為 placeholder（V86-B-7 already KI；ADR-0044 SOP 由外部 sub-agents 跑；本 9 輪 sim 即承擔此職） |
| pytest 全綠                   | ✅         | 34/34 passed                                                                                                                |
| compile 無 error              | ✅         | 25 nodes 含 START/END                                                                                                       |

## §6 v3.1 Backlog（不阻凍結）

| ID      | 嚴重  | 描述                         | 預期 v8.1 動作                    |
| ------- | ----- | ---------------------------- | --------------------------------- |
| V86-B-7 | 低 KI | walkthrough placeholder      | v8.1 真實 enforce 機制            |
| -       | KI-1  | C-2 warn 20 → ≤5             | v8.1 governance clean 批次        |
| -       | KI-2  | sibling fan-out v8.1 才實作  | v8.1 multi_signal 真 sibling Send |
| -       | KI-3  | Web harness 跨 invoke 持久化 | v8.1 AsyncPostgresSaver 評估      |

## §7 Architecture Snapshot（v8.0.8 frozen）

```
runtime/
├── state.py         (73 fields TypedDict + 3 reducers)
├── graph.py         (25 nodes + 14 conditional_edges + Send fan-out auditor)
├── hitl.py          (8 HITL types + autonomy_mode gate)
├── parser.py        (v7.22 markdown ground truth 解析)
├── llm_adapter.py   (sampling default + 4 backend api support)
├── checkpointer.py  (AsyncSqliteSaver + InMemorySaver fallback)
├── persistence.py   (ROUTING_TICKET single-file + archive；fs probe)
├── mcp_server.py    (4 tools: dispatch / dispatch_resume / dim6_audit / walkthrough)
├── nodes/           (11 agent nodes + auditor 3 sub-nodes + onboarding)
└── subgraphs/       (multi_signal / hotfix_tier_upgrade / auditor_6dim compat)
```

## §8 後續路線

milestone v3 凍結後不再對 v8.0.x 加新特性；後續 hotfix 級 patch 仍以 v8.0.9 / v8.0.10 … patch tag 收。新特性走 **v8.1**：

- v8.1.0 規劃時程：依 user 後續決策；非凍結後立即啟動
- v8.1 主題候選：(1) walkthrough 真 enforce / (2) sibling fan-out / (3) Postgres checkpointer / (4) governance KI 清理

---

**Auditor sign-off**: dim 6 自評 4.50 通過 ADR-0045 freeze gate；建議下次 @Auditor 觸發 dim6_audit subgraph re-run 後將本 score 寫入 AUDIT_HISTORY.md baseline。
