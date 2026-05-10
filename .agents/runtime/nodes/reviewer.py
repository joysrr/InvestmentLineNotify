"""@Reviewer node (PROPOSAL_502_053 H-2 加 autonomy gate + V90-A-8 GitNexus cross-file impact)"""
from __future__ import annotations
import logging
import os
from typing import Any

from .. import gitnexus_helper
from ..hitl import maybe_autonomy_gate
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json, safe_node_return


logger = logging.getLogger(__name__)


async def reviewer_node(state: WorkflowState) -> dict[str, Any]:
    # V90-A-8: pre-fetch cross-file impact；補強 caller scan（B-5 千行檔 / cross-stack）
    gnx_extra = ""
    gnx_ctx: dict[str, Any] | None = None
    try:
        gnx_ctx = gitnexus_helper.prefetch_for_reviewer(
            list(state.get("touched_files") or []),
            repo_root=os.getcwd(),
        )
        formatted = gitnexus_helper.format_context_for_prompt(gnx_ctx)
        if formatted:
            gnx_extra = "\n\n" + formatted
    except Exception as e:
        logger.warning("reviewer gitnexus prefetch failed: %s", e)

    extra = (
        "本次任務：審查 + B-5 caller scan（千行檔 / cross-stack 強制）。\n"
        '回 JSON: {"review_result": "pass" | "fail", "blocker_count": int, "review_quality_violation": bool}'
        f"{gnx_extra}"
    )
    response = await call_agent_llm(state, "reviewer", extra_system=extra)
    parsed = parse_llm_json(response) or {}
    updates: dict[str, Any] = {
        **append_decision(state, "@Reviewer", "review", result=parsed.get("review_result")),
        "review_result": parsed.get("review_result", "pass"),
        "review_quality_violation": parsed.get("review_quality_violation", False),
        "review_cycle_count": state.get("review_cycle_count", 0) + 1,
    }
    if gnx_ctx:
        updates["gitnexus_context"] = gnx_ctx
    # H-2: stage_6_review → stage_7 gate
    gate = maybe_autonomy_gate({**state, **updates}, "stage_6_review", "stage_7_qa_verify")
    return safe_node_return({**updates, **gate})  # V87-B-3
