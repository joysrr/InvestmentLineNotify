"""
graph.py — LangGraph StateGraph 組裝 (PROPOSAL_502_050~053)

v8.0.1 修補（PROPOSAL_502_053）：
- C-1 route_after_lead 補 backend/architect/frontend 分支
- C-2 hotfix-light fast track（reviewer pass → HITL #8 → END）
- C-3 tier_upgrade incoming edge from reviewer
- H-2 autonomy gate 全 stage 覆蓋（透過 nodes 內 maybe_autonomy_gate 已在 phase 2 起做；本檔加缺漏者）
- H-3 onboarding_node 整合
- H-4 prior_art_gate / proposal_adopt_gate / strategy_weight_gate 接點
- M-4 刪除 _wrap_with_autonomy_gate 死碼
"""
from __future__ import annotations

from typing import Any  # V84-A-2/B-1: dict[str, Any] annotation 真正使用 Any；明示 import

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from .nodes import (
    architect_node,
    assistant_node,
    auditor_aggregate_node,
    auditor_dimension_node,
    auditor_dispatch_node,
    backend_node,
    consultant_node,
    frontend_node,
    lead_node,
    planner_node,
    qa_test_spec_node,
    qa_verification_node,
    retro_node,
    reviewer_node,
    security_node,
)
from .nodes.onboarding import onboarding_node  # H-3
from .state import WorkflowState
from .subgraphs.hotfix_tier_upgrade import detect_tier_upgrade, handle_tier_upgrade
from .subgraphs.multi_signal import detect_multi_signal

# M-4 V8-I-2 修：刪除 _wrap_with_autonomy_gate 死碼；autonomy gate 全在 nodes 內 inline 呼叫


# ============================================================
# Helpers
# ============================================================


def _target(state: WorkflowState) -> str:
    return (state.get("target_agent") or "").lower().lstrip("@").strip()


def _impl_node_for(state: WorkflowState) -> str:
    return "frontend" if _target(state) == "frontend" else "backend"


def _is_hotfix_light(state: WorkflowState) -> bool:
    hf = state.get("hotfix") or {}
    return hf.get("hotfix_tier") == "light" and hf.get("enabled", False)


# ============================================================
# Conditional edge functions (v8.0.1 補完整分支；C-1)
# ============================================================


def route_after_lead(state: WorkflowState) -> str:
    """@Lead 派發後依 target_agent / multi-signal / task_class route

    v8.0.1 C-1 修：補 backend/architect/frontend/onboarding 分支
    v8.0.3 V82-X-3 修：hotfix（含 light/heavy）跳過 multi_signal 仲裁；hotfix 派發
    路徑已由 hotfix_tier 唯一決定（light→backend / heavy→architect fast lane），
    再讓 multi_signal_check 仲裁會誤把 secondary signal 當主路徑。
    v8.0.5 V84-A-4：onboarding 也加入排除集；走獨立 sub-flow 不仲裁。
    """
    target = _target(state)
    task_class = state.get("task_class", "feature")

    # multi-signal: ≥2 priority 命中 → 進 multi_signal_check
    # hotfix（V82-X-3）+ onboarding（V84-A-4）皆例外不仲裁
    secondary = state.get("multi_signal_secondary", []) or []
    if secondary and len(secondary) >= 1 and task_class not in {"hotfix", "onboarding"}:
        return "multi_signal_check"

    # onboarding 專屬流程
    if task_class == "onboarding":
        return "onboarding"

    # 直接派發（hotfix-light → backend；hotfix-heavy 仍走完整 review；doc-sync → architect 直入收斂）
    if target == "auditor":
        return "auditor_dispatch"
    if target == "assistant":
        return "assistant"
    if target == "retro":
        return "retro"
    if target == "backend":
        return "backend"
    if target == "frontend":
        return "frontend"
    if target == "architect":
        # V86-B-3: doc-sync / modify-existing / hotfix-heavy 全 share 同 architect 入口
        return "architect"

    # default
    return "planner"


def route_after_consultant(state: WorkflowState) -> str:
    risk = state.get("consultant_risk_level")
    if risk == "🔴":
        return "planner"
    return "architect"


def route_after_architect(state: WorkflowState) -> str:
    """@Architect 後檢查 Prior Art Gate

    v8.0.3 V82-X-4：改進 prior_art_search（拆分後第一階段）。
    """
    if state.get("prior_art_scan_triggered"):
        return "prior_art_search"
    return "qa_test_spec"


def route_after_qa_test_spec(state: WorkflowState) -> str:
    return _impl_node_for(state)


def route_after_reviewer(state: WorkflowState) -> str:
    """@Reviewer 後依 result + cycle limit + hotfix-light fast track

    v8.0.1 C-2 修：hotfix-light pass → hotfix_light_gate → END
    v8.0.1 C-3 修：sub-agent telemetry tier_upgrade_required → tier_upgrade_check
    """
    review_cycle_limit = 2
    hard_cycle_limit = 3  # V87-B-4: 純 cycle 上限；防 quality_violation=False 時無限迴圈
    cycle = state.get("review_cycle_count", 0)

    if cycle >= review_cycle_limit and state.get("review_quality_violation"):
        return "assistant"
    if cycle >= hard_cycle_limit:  # V87-B-4: 不論 violation 旗值，3 次後強制 escape
        return "assistant"

    if state.get("review_result") == "fail":
        return _impl_node_for(state)

    # tier upgrade detect (V8-D-2/V8-B-6)
    if detect_tier_upgrade(state):
        return "tier_upgrade_check"

    # hotfix-light fast track (C-2)
    if _is_hotfix_light(state):
        return "hotfix_light_gate"

    # SC 評估
    sc_triggered = bool(state.get("hotfix") and state["hotfix"].get("sc_evaluation", {}).get("triggered"))
    if sc_triggered:
        return "security"

    return "qa_verification"


def route_after_security(state: WorkflowState) -> str:
    if state.get("security_result") == "fail":
        return _impl_node_for(state)
    return "qa_verification"


def route_after_qa_verification(state: WorkflowState) -> str:
    """v8.0.3 V82-X-2 修：qa fail 改讀獨立 qa_retest_count；不再 reuse review_cycle_count"""
    if state.get("qa_result") == "fail":
        if state.get("qa_retest_count", 0) >= 3:
            return "assistant"
        return _impl_node_for(state)
    return "retro"


def route_after_tier_upgrade(state: WorkflowState) -> str:
    """v8.0.1 C-3：tier_upgrade 結果分流"""
    if state.get("status") == "cancelled":
        return END
    return "qa_verification"


def route_after_prior_art_search(state: WorkflowState) -> str:
    """v8.0.3 V82-X-4 修：Phase A search 後依 user 選擇分流。

    LangGraph 1.x 限制：同一 node 內連續呼 interrupt 會在 resume 時從頭重跑導致無限迴圈。
    必須拆兩 node，user 提供 §B 後再進 verify node。
    """
    decision = (state.get("hitl_decision") or "").lower()
    if "bypass" in decision:
        return "qa_test_spec"  # bypass 直接進 test spec
    return "prior_art_verify"  # 完成 §B 回填 → 進 Phase C 評估 + verify


def route_after_prior_art_verify(state: WorkflowState) -> str:
    """v8.0.3 V82-X-4 修：Phase C verify 後依 user verify 結果分流

    v8.0.4 V83-A-5：移除 dead bypass 分支（與 default 同回 qa_test_spec）；
    bypass 豁免細節由 architect 自行寫 AUDIT_HISTORY，不需 routing 區分。
    """
    decision = (state.get("hitl_decision") or "").lower()
    if "reject" in decision:
        return "architect"  # 重新設計
    return "qa_test_spec"  # accept / bypass / default 同流


def route_after_proposal_adopt(state: WorkflowState) -> str:
    """v8.0.2 H-3 (V81-X-4) 修：依 user 採納選擇分流"""
    decision = (state.get("hitl_decision") or "").lower()
    if "reject" in decision:
        return "retro"  # 重新分析
    if "amend" in decision:
        return "architect"  # 修案
    return END  # adopt default


def route_after_strategy_weight(state: WorkflowState) -> str:
    """v8.0.2 H-4 (V81-X-5) 修：依 user approve/deny 分流"""
    decision = (state.get("hitl_decision") or "").lower()
    if "deny" in decision:
        return END
    return "planner"  # approve → 重派


def route_after_multi_signal(state: WorkflowState) -> str:
    """v8.0.2 C-2 (V81-X-6) 修：真讀 hitl_decision；不再依 target_agent

    User 仲裁結果（hitl_decision）的 3 種選項映射：
    - 「合併走單一通道」/「合併」→ 走 task_class 對應主流程
    - 「分開派」/「sibling」→ 標 multi_signal_secondary 持續但走主路徑（v8.1 加 sibling fan-out）
    - 「只跑指定」/「only X」→ 走 X 對應 path
    - default → 走主 task_class 路徑
    """
    decision = (state.get("hitl_decision") or "").lower()
    target = _target(state)
    task_class = state.get("task_class", "feature")

    # 「只跑」明示某 agent
    if "只跑 backend" in decision or "only backend" in decision:
        return "backend"
    if "只跑 frontend" in decision or "only frontend" in decision:
        return "frontend"
    if "只跑 architect" in decision or "only architect" in decision:
        return "architect"

    # default：依主 task_class 路徑
    if task_class == "onboarding":
        return "architect"  # onboarding 已在 lead 走 onboarding_node；此處 fallback
    if task_class == "hotfix":
        return "backend"
    if target == "backend":
        return "backend"
    if target == "architect":
        return "architect"

    return "planner"


# ============================================================
# Auditor 6-dim parallel fan-out
# ============================================================


def fan_out_auditor_dims(state: WorkflowState) -> list[Send]:
    return [
        Send("auditor_dimension", {**state, "audit_dimension": dim})
        for dim in range(1, 7)  # ADR-0045 dim 6
    ]


# ============================================================
# Build StateGraph
# ============================================================


def build_graph(checkpointer=None):
    """組裝 StateGraph 並 compile

    v8.0.1 (PROPOSAL_502_053) 完整接線：
    - C-1 route_after_lead 補分支
    - C-2 hotfix_light_gate
    - C-3 tier_upgrade_check incoming + outgoing conditional
    - H-3 onboarding 專屬 sub-flow
    - H-4 prior_art_gate / proposal_adopt_gate / strategy_weight_gate
    """
    g = StateGraph(WorkflowState)

    # v8.0.1 新建 HITL gate nodes
    from .hitl import (
        hotfix_light_verify_pending,
        prior_art_search_pending,
        prior_art_verify_pending,
        proposal_adopt_pending,
        strategy_weight_change_pending,
    )

    async def hotfix_light_gate_node(state: WorkflowState):
        """C-2 + H-4：hotfix-light 通過 review 後最後 user 確認"""
        decision = hotfix_light_verify_pending(state)
        return {"hitl_decision": str(decision), "status": "completed"}

    async def prior_art_search_node(state: WorkflowState):
        """v8.0.3 V82-X-4：Prior Art Phase A — user 跑 search 回填 §B（單一 interrupt）

        v8.0.5 V84-A-1: bypass 路徑跳 verify_node，§B 內容落地必須在這裡也補一份，
        否則 audit trail 殘缺。
        """
        result = prior_art_search_pending(state)
        result_str = str(result)
        updates: dict[str, Any] = {
            "hitl_decision": result_str,
            "_phase_a_result": result_str,
        }
        # V84-A-1: bypass 路徑直跳 qa_test_spec → 必須在此落地 audit artifact
        if "bypass" in result_str.lower() and not state.get("prior_art_report_path"):
            updates["prior_art_report_path"] = (
                f"PRIOR_ART_REPORT_{state.get('ticket_id', 'unknown')}_BYPASS.md"
            )
            updates["prior_art_scan_triggered"] = False
        return updates

    async def prior_art_verify_node(state: WorkflowState):
        """v8.0.3 V82-X-4：Prior Art Phase C — user verify agent 評估結論（單一 interrupt）

        v8.0.4 V83-A-2: reject 時 prior_art_reject_count +1 → architect 下次強制壓
        v8.0.4 V83-A-3: 把 _phase_a_result（§B 結構化結果）落地至 prior_art_report_path
        """
        result = prior_art_verify_pending(state)
        decision = str(result).lower()
        updates: dict[str, Any] = {
            "hitl_decision": str(result),
            "prior_art_scan_triggered": False,
        }
        if "reject" in decision:
            updates["prior_art_reject_count"] = state.get("prior_art_reject_count", 0) + 1
        # V83-A-3: §B 內容存於 _phase_a_result；落地為 report path artifact 引用
        phase_a = state.get("_phase_a_result")
        if phase_a and not state.get("prior_art_report_path"):
            updates["prior_art_report_path"] = f"PRIOR_ART_REPORT_{state.get('ticket_id', 'unknown')}.md"
        return updates

    async def proposal_adopt_gate_node(state: WorkflowState):
        """H-4：retro 完成後 user 採納確認"""
        decision = proposal_adopt_pending(state)
        return {"hitl_decision": str(decision)}

    async def strategy_weight_gate_node(state: WorkflowState):
        """H-4：force_complex strategyWeight 異動 user 仲裁"""
        decision = strategy_weight_change_pending(state)
        return {"hitl_decision": str(decision)}

    # subgraph wrapper nodes
    async def multi_signal_check_node(state: WorkflowState):
        return detect_multi_signal(state)

    async def tier_upgrade_check_node(state: WorkflowState):
        if detect_tier_upgrade(state):
            return handle_tier_upgrade(state)
        return {}

    # ────── Add nodes ──────
    g.add_node("lead", lead_node)
    g.add_node("multi_signal_check", multi_signal_check_node)
    g.add_node("tier_upgrade_check", tier_upgrade_check_node)
    g.add_node("onboarding", onboarding_node)  # H-3
    g.add_node("planner", planner_node)
    g.add_node("consultant", consultant_node)
    g.add_node("architect", architect_node)
    # v8.0.3 V82-X-4: prior_art 拆兩 node 避 LangGraph 1.x dual-interrupt 重跑
    g.add_node("prior_art_search", prior_art_search_node)
    g.add_node("prior_art_verify", prior_art_verify_node)
    g.add_node("qa_test_spec", qa_test_spec_node)
    g.add_node("qa_verification", qa_verification_node)
    g.add_node("backend", backend_node)
    g.add_node("frontend", frontend_node)
    g.add_node("reviewer", reviewer_node)
    g.add_node("security", security_node)
    g.add_node("retro", retro_node)
    g.add_node("proposal_adopt_gate", proposal_adopt_gate_node)  # H-4
    g.add_node("strategy_weight_gate", strategy_weight_gate_node)  # H-4
    g.add_node("hotfix_light_gate", hotfix_light_gate_node)  # C-2 + H-4
    g.add_node("assistant", assistant_node)
    g.add_node("auditor_dispatch", auditor_dispatch_node)
    g.add_node("auditor_dimension", auditor_dimension_node)
    g.add_node("auditor_aggregate", auditor_aggregate_node)

    # ────── Static edges ──────
    g.add_edge(START, "lead")
    g.add_edge("planner", "consultant")
    g.add_edge("backend", "reviewer")
    g.add_edge("frontend", "reviewer")
    g.add_edge("retro", "proposal_adopt_gate")  # H-4
    g.add_edge("hotfix_light_gate", END)  # C-2 hotfix-light fast track
    g.add_edge("assistant", END)
    g.add_edge("onboarding", END)  # H-3 onboarding 為獨立 sub-flow

    # ────── Conditional edges ──────
    g.add_conditional_edges(
        "lead",
        route_after_lead,
        {
            "planner": "planner",
            "auditor_dispatch": "auditor_dispatch",
            "assistant": "assistant",
            "retro": "retro",
            "multi_signal_check": "multi_signal_check",
            "onboarding": "onboarding",
            "backend": "backend",
            "frontend": "frontend",
            "architect": "architect",
        },
    )
    g.add_conditional_edges(
        "multi_signal_check",
        route_after_multi_signal,
        {
            "planner": "planner",
            "backend": "backend",
            "frontend": "frontend",  # V82-X-1: route_after_multi_signal 可回 frontend；缺 key 會 KeyError
            "architect": "architect",
        },
    )
    g.add_conditional_edges(
        "consultant", route_after_consultant, {"architect": "architect", "planner": "planner"}
    )
    g.add_conditional_edges(
        "architect", route_after_architect,
        {"qa_test_spec": "qa_test_spec", "prior_art_search": "prior_art_search"},
    )
    g.add_conditional_edges(
        "qa_test_spec", route_after_qa_test_spec, {"backend": "backend", "frontend": "frontend"}
    )
    g.add_conditional_edges(
        "reviewer", route_after_reviewer,
        {
            "backend": "backend",
            "frontend": "frontend",
            "security": "security",
            "qa_verification": "qa_verification",
            "assistant": "assistant",
            "tier_upgrade_check": "tier_upgrade_check",  # C-3
            "hotfix_light_gate": "hotfix_light_gate",  # C-2
        },
    )
    g.add_conditional_edges(
        "security", route_after_security,
        {"backend": "backend", "frontend": "frontend", "qa_verification": "qa_verification"},
    )
    g.add_conditional_edges(
        "qa_verification", route_after_qa_verification,
        {
            "backend": "backend",
            "frontend": "frontend",
            "retro": "retro",
            "assistant": "assistant",  # V83-A-1: route 在 qa_retest_count>=3 時 escape 到 assistant
        },
    )
    g.add_conditional_edges(
        "tier_upgrade_check", route_after_tier_upgrade,
        {"qa_verification": "qa_verification", END: END},
    )

    # v8.0.3 V82-X-4: prior_art 拆兩 node + 兩條 conditional edges
    g.add_conditional_edges(
        "prior_art_search",
        route_after_prior_art_search,
        {"prior_art_verify": "prior_art_verify", "qa_test_spec": "qa_test_spec"},
    )
    g.add_conditional_edges(
        "prior_art_verify",
        route_after_prior_art_verify,
        {"qa_test_spec": "qa_test_spec", "architect": "architect"},
    )
    g.add_conditional_edges(
        "proposal_adopt_gate",
        route_after_proposal_adopt,
        {"retro": "retro", "architect": "architect", END: END},
    )
    g.add_conditional_edges(
        "strategy_weight_gate",
        route_after_strategy_weight,
        {"planner": "planner", END: END},
    )

    # Auditor 子流程
    g.add_conditional_edges("auditor_dispatch", fan_out_auditor_dims, ["auditor_dimension"])
    g.add_edge("auditor_dimension", "auditor_aggregate")
    g.add_edge("auditor_aggregate", END)

    return g.compile(checkpointer=checkpointer)
