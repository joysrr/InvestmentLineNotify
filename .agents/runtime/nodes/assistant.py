"""@Assistant node (v8.0.x production; patrol mode；V86-B-6 標籤對齊)"""
from __future__ import annotations
from typing import Any
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm


async def assistant_node(state: WorkflowState) -> dict[str, Any]:
    response = await call_agent_llm(
        state, "assistant",
        extra_system="本次任務：巡邏 P-01~P-40 / 通知處理。",
    )
    return append_decision(state, "@Assistant", "patrol", summary=response[:200])
