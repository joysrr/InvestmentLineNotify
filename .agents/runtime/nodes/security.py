"""@Security node (v8.0.x production；V86-B-6 標籤對齊)"""
from __future__ import annotations
from typing import Any
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


async def security_node(state: WorkflowState) -> dict[str, Any]:
    extra = (
        "本次任務：SC-01~10 平行資安審查（Stage 6.5）。\n"
        '回 JSON: {"security_result": "pass" | "fail", "sc_codes_triggered": [...]}'
    )
    response = await call_agent_llm(state, "security", extra_system=extra)
    parsed = parse_llm_json(response) or {}
    return {
        **append_decision(state, "@Security", "security_audit", result=parsed.get("security_result")),
        "security_result": parsed.get("security_result", "pass"),
    }
