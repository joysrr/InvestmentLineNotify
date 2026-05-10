"""@Planner node (v8.0.x production；V86-B-6 標籤對齊)"""
from __future__ import annotations
from typing import Any
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm


async def planner_node(state: WorkflowState) -> dict[str, Any]:
    response = await call_agent_llm(
        state,
        "planner",
        extra_system="本次任務：解析 user 需求 → 產 draft features 摘要。",
    )
    return append_decision(state, "@Planner", "requirement_parse", summary=response[:300])
