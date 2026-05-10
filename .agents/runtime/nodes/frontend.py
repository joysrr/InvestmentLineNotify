"""@Frontend node (PROPOSAL_502_054 C-3 + M-2 修：telemetry 改 JSON 解析 + V90-A-8 GitNexus pre-fetch)"""
from __future__ import annotations
import logging
import os
import time
from typing import Any

from .. import gitnexus_helper
from ..hitl import maybe_autonomy_gate
from ..persistence import append_telemetry
from ..state import WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json, safe_node_return


logger = logging.getLogger(__name__)


async def frontend_node(state: WorkflowState) -> dict[str, Any]:
    start = time.time()

    # V90-A-8: pre-fetch frontend touched_files context
    gnx_extra = ""
    gnx_ctx: dict[str, Any] | None = None
    try:
        gnx_ctx = gitnexus_helper.prefetch_for_implementer(
            list(state.get("touched_files") or []),
            target_entities=None,
            repo_root=os.getcwd(),
        )
        formatted = gitnexus_helper.format_context_for_prompt(gnx_ctx)
        if formatted:
            gnx_extra = "\n\n" + formatted
    except Exception as e:
        logger.warning("frontend gitnexus prefetch failed: %s", e)

    extra = (
        "本次任務：實作 frontend 程式碼；對齊 _api.md + UI 規範。\n\n"
        "**收尾必回 JSON** (用 ```json``` block):\n"
        '{\n'
        '  "summary": "<≤200 字 implementation 摘要>",\n'
        '  "tier_upgrade": {\n'
        '    "required": "none" | "heavy",\n'
        '    "reason": "<若 heavy：跨檔/SC/LOC>200 理由>"\n'
        '  }\n'
        '}'
        f"{gnx_extra}"
    )
    response = await call_agent_llm(state, "frontend", extra_system=extra)

    elapsed_ms = int((time.time() - start) * 1000)
    parsed = parse_llm_json(response) or {}
    summary = parsed.get("summary", response[:200])
    tier_block = parsed.get("tier_upgrade", {}) if isinstance(parsed.get("tier_upgrade"), dict) else {}

    tier_upgrade = "heavy" if tier_block.get("required") == "heavy" else "none"
    tier_reason = tier_block.get("reason", "")[:200] if tier_upgrade == "heavy" else None

    updates: dict[str, Any] = {
        **append_decision(state, "@Frontend", "implement", summary=summary[:200]),
        **append_telemetry(
            state,
            elapsed_ms=elapsed_ms,
            tier_upgrade_required=tier_upgrade,
            tier_upgrade_reason=tier_reason,
        ),
    }
    if gnx_ctx:
        updates["gitnexus_context"] = gnx_ctx

    gate = maybe_autonomy_gate({**state, **updates}, "stage_5_implement", "stage_6_review")
    return safe_node_return({**updates, **gate})  # V87-B-3
