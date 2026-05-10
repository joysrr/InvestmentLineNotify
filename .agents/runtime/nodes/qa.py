"""@QA node (PROPOSAL_502_053 H-2 加 autonomy gate 全 stage)"""
from __future__ import annotations
from typing import Any

from ..hitl import maybe_autonomy_gate
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


async def qa_test_spec_node(state: WorkflowState) -> dict[str, Any]:
    response = await call_agent_llm(
        state, "qa", extra_system="本次任務：產 TEST_SPEC（Stage 4 phase）。",
    )
    updates = append_decision(state, "@QA", "test_spec_produce", summary=response[:200])
    gate = maybe_autonomy_gate({**state, **updates}, "stage_4_test_spec", "stage_5_implement")
    return {**updates, **gate}


async def qa_verification_node(state: WorkflowState) -> dict[str, Any]:
    extra = (
        "本次任務：跑驗證測試（Stage 7 phase）。\n"
        '回 JSON: {"qa_result": "pass" | "fail", "report_summary": "..."}'
    )
    response = await call_agent_llm(state, "qa", extra_system=extra)
    parsed = parse_llm_json(response) or {}
    qa_result = parsed.get("qa_result", "pass")
    updates: dict[str, Any] = {
        **append_decision(state, "@QA", "verification", result=qa_result),
        "qa_result": qa_result,
    }
    # V82-X-2: qa fail 獨立計數；route_after_qa_verification 用此判 cycle limit
    if qa_result == "fail":
        updates["qa_retest_count"] = state.get("qa_retest_count", 0) + 1
    # H-2: stage_7_qa_verify → stage_8_convergence gate
    gate = maybe_autonomy_gate({**state, **updates}, "stage_7_qa_verify", "stage_8_convergence")
    return {**updates, **gate}
