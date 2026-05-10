"""@Consultant node (v8.0.x production；V86-B-6 標籤對齊)"""
from __future__ import annotations
from typing import Any
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


async def consultant_node(state: WorkflowState) -> dict[str, Any]:
    extra = (
        "本次任務：戰略審查；評估跨領域風險。\n"
        '回 JSON: {"risk_level": "🟢" | "🟡" | "🔴", "advice": "..."}'
    )
    response = await call_agent_llm(state, "consultant", extra_system=extra)
    parsed = parse_llm_json(response) or {}
    return {
        **append_decision(state, "@Consultant", "strategic_review", advice=parsed.get("advice", "")),
        "consultant_risk_level": parsed.get("risk_level", "🟢"),
    }
