"""@Retro node (PROPOSAL_502_053 H-2 加 autonomy gate)"""
from __future__ import annotations
from typing import Any

from ..hitl import maybe_autonomy_gate
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm


async def retro_node(state: WorkflowState) -> dict[str, Any]:
    response = await call_agent_llm(
        state, "retro", extra_system="本次任務：根因分析 / 提案產出。",
    )
    updates = {
        **append_decision(state, "@Retro", "retrospective", summary=response[:200]),
        # 模擬產提案 (Phase 3 完整實作；此標記促 proposal_adopt_gate 啟動 HITL #6)
        "proposal_id": f"PROPOSAL_AUTOGEN_{state.get('ticket_id', 'unknown')}",
    }
    # H-2: stage_9_retro → END gate (M-1 V81-X-8 修：next_stage 改 stage_8_convergence 為「end」語意)
    # retro 是最後 stage；本 gate 為 step-by-step 模式下最後確認；next 標 stage_8 表「向收斂」
    gate = maybe_autonomy_gate({**state, **updates}, "stage_8_convergence", "stage_9_retro")
    return {**updates, **gate}
