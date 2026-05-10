"""@Architect node (PROPOSAL_502_051 Phase 2 + autonomy gate + V90-A-8 GitNexus pre-fetch)"""
from __future__ import annotations
import logging
import os
from typing import Any

from .. import gitnexus_helper
from ..hitl import maybe_autonomy_gate
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


logger = logging.getLogger(__name__)


async def architect_node(state: WorkflowState) -> dict[str, Any]:
    # V90-A-8: pre-fetch GitNexus context（module deps + entity defs）；注入 LLM extra_system
    gnx_extra = ""
    gnx_ctx: dict[str, Any] | None = None
    try:
        gnx_ctx = gitnexus_helper.prefetch_for_architect(
            list(state.get("touched_files") or []),
            target_entities=None,  # architect stage 還沒抽具體 entity；只看 module deps
            repo_root=os.getcwd(),
        )
        formatted = gitnexus_helper.format_context_for_prompt(gnx_ctx)
        if formatted:
            gnx_extra = "\n\n" + formatted
    except Exception as e:
        logger.warning("architect gitnexus prefetch failed: %s", e)

    extra = (
        "本次任務：API spec / 模組設計；判斷是否觸 Prior Art Gate。\n"
        '回 JSON: {"prior_art_scan_triggered": bool, "design_summary": "...", "api_spec_path": "..."}'
        f"{gnx_extra}"
    )
    response = await call_agent_llm(state, "architect", extra_system=extra)
    parsed = parse_llm_json(response) or {}

    # V83-A-2: reject-loop guard — 已 reject 過一次 prior_art 就強制壓 False，避免無限迴圈
    prior_art_triggered_raw = parsed.get("prior_art_scan_triggered", False)
    reject_count = state.get("prior_art_reject_count", 0)
    prior_art_triggered = prior_art_triggered_raw and reject_count == 0

    updates: dict[str, Any] = {
        **append_decision(state, "@Architect", "design", summary=parsed.get("design_summary", "")[:200]),
        "prior_art_scan_triggered": prior_art_triggered,
    }
    if gnx_ctx:
        updates["gitnexus_context"] = gnx_ctx

    # autonomy gate-at-design (Stage 3 → 3.5/4 轉移前)
    gate = maybe_autonomy_gate(
        {**state, **updates}, "stage_3_design", "stage_3_5_prior_art"
    )
    return {**updates, **gate}
