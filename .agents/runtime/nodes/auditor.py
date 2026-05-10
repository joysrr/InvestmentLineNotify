"""@Auditor 6-dim parallel sub-flow (v8.0.6 PROPOSAL_502_058 V86-A-5/B-1 收斂)

橫切 agent；6 dim 並行（dim 1-5 既有 + dim 6 ADR-0045）；aggregate 後產 AUDIT_REPORT。
v8.0.6 V86-A-5/B-1 收斂：原 subgraphs/auditor_6dim.py 的 freeze gate + 子項評分 prompt
全合併進此處（主 graph 接此模組）；subgraphs/auditor_6dim.py 改為 compat re-export。
"""
from __future__ import annotations
from typing import Any
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


# dim 6 5 子項評分（auditor-design-audit §1）
_DIM_6_SUBSCORES = [
    "6.1_condition_implementation_consistency",  # 對齊 C-1
    "6.2_cross_module_logic_consistency",
    "6.3_design_intent_drift",
    "6.4_schema_completeness",  # 對齊 C-2
    "6.5_governance_feedback_loop_health",
]


async def auditor_dispatch_node(state: WorkflowState) -> dict[str, Any]:
    """進 auditor 子流程入口"""
    return append_decision(state, "@Auditor", "dispatch_to_6_dim_parallel")


async def auditor_dimension_node(state: WorkflowState) -> dict[str, Any]:
    """單一 dim 評分；state['audit_dimension'] 由 fan-out send 設

    V86-A-5: dim 6 走 5 子項 prompt（對齊 ADR-0045 + auditor-design-audit §1）；
    其他 dim 走通用 5-dim prompt。
    """
    dim = state.get("audit_dimension")
    if dim == 6:
        extra = (
            "## dim 6 Design Coherence 評分\n\n"
            "依 `skills/auditor-design-audit.md §1` 5 子項各 0.0-1.0 分；總 5 分。\n"
            "子項：\n"
            "- 6.1 條文-實作一致性（grep tests/condition-claim-validator.py 結果）\n"
            "- 6.2 跨 module 邏輯一致（檢 hotfix vs autonomy vs B-1 等衝突）\n"
            "- 6.3 設計意圖偏移（抽 5 ADR 對照行為）\n"
            "- 6.4 schema completeness（grep schema-completeness-validator.py 結果）\n"
            "- 6.5 governance feedback loop 健康（P-38 觸發率 / KI 累積）\n\n"
            '回 JSON: {"dim_avg": float, "subscores": {"6.1": float, ...}, "rationale": "..."}'
        )
    else:
        extra = (
            f"## dim {dim} 既有 5-dim 評分\n\n"
            "依 `.agents/docs/quality-audit-checklist.md` + `automation-manual.md` 子項評分（0.0-5.0）。\n"
            '回 JSON: {"dim_avg": float, "rationale": "..."}'
        )

    response = await call_agent_llm(state, "auditor", extra_system=extra)
    parsed = parse_llm_json(response) or {}
    avg = float(parsed.get("dim_avg", 4.0))
    key = f"dim_{dim}_avg"
    return {
        **append_decision(state, "@Auditor", f"dim_{dim}_score", avg=avg),
        key: avg,
    }


async def auditor_aggregate_node(state: WorkflowState) -> dict[str, Any]:
    """整合 6 dim 為 audit_overall + ADR-0045 凍結門檻

    V86-A-5 收斂：把 freeze gate flag 從 subgraphs 移進主 graph。
    V87-B-2 釐清：ADR-0045「dim 6 < 2.0 阻斷凍結」是阻斷 **framework version freeze**
    動作（即 FRAMEWORK_VERSION milestone bump 提案層），**不是阻斷 graph 後續 nodes**；
    audit graph 為輔助 audit，aggregate → END 是正確設計。caller（FRAMEWORK_VERSION
    提案 / .agents/scripts/framework-freeze-validator）讀 _dim6_can_freeze 決策；
    若需 graph 內阻斷，未來 v8.1 可加 conditional edge 到 assistant emit P-15 🟡。
    """
    dims = [state.get(f"dim_{i}_avg") for i in range(1, 7)]
    valid = [d for d in dims if d is not None]
    overall = sum(valid) / len(valid) if valid else 0.0

    dim_6_score = state.get("dim_6_avg")
    can_freeze = dim_6_score is None or dim_6_score >= 2.0  # ADR-0045 阻斷門檻
    needs_p15 = dim_6_score is not None and dim_6_score < 3.0

    return {
        **append_decision(
            state, "@Auditor", "aggregate",
            overall=overall, dim_6=dim_6_score,
            can_freeze_milestone=can_freeze, dim_count=len(valid),
            # V87-B-2: 強訊號讓 mcp_server result_summary 顯眼提示 caller
            milestone_freeze_blocked=not can_freeze,
        ),
        "audit_overall": overall,
        "_dim6_can_freeze": can_freeze,
        "_dim6_needs_p15": needs_p15,
    }
