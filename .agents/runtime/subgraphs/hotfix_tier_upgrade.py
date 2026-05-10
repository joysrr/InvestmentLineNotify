"""
hotfix_tier_upgrade.py — Hotfix Tier 升級 SOP (PROPOSAL_502_051 B-4)

依 PROPOSAL_502_040 + tasks/hotfix-tier-upgrade-sop.md 5 步驟：
- Step 1: sub-agent 立即停 + telemetry append (tier_upgrade_required: heavy)
- Step 2: @Lead 評估 + 派新 heavy ticket（revert_safe 雙條件）
- Step 3: autonomy_mode 變更 (light auto → heavy gate-at-impl)
- Step 4: pending_group carry-over
- Step 5: telemetry 跨 ticket 累計

兩種 revert_safe 場景：
- 雙 true → 自動 cancel + 派新 (P-37 HOTFIX_TIER_UPGRADED 通知)
- 任一 false → interrupt TIER_UPGRADE_REVERT_DECISION (孤兒 PENDING)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.types import interrupt

from ..state import WorkflowState
from ..nodes._base import append_decision


def detect_tier_upgrade(state: WorkflowState) -> bool:
    """sub-agent 完成後檢查；telemetry.tier_upgrade_required == 'heavy' 即觸發"""
    rt = state.get("runtime_telemetry") or {}
    return rt.get("tier_upgrade_required") == "heavy"


def handle_tier_upgrade(state: WorkflowState) -> dict[str, Any]:
    """處理升級流程；走 interrupt 等 user 仲裁（若 revert 需要）或自動派新"""
    rt = state.get("runtime_telemetry") or {}
    in_flight = rt.get("in_flight_changes", []) or []

    # 檢查 dual revert_safe
    needs_arbitration = False
    unsafe_files = []
    for change in in_flight:
        tech_safe = change.get("technical_revert_safe", False)
        biz_safe = change.get("business_impact_revert_safe", False)
        if not tech_safe or not biz_safe:
            needs_arbitration = True
            unsafe_files.append({
                "file": change.get("file"),
                "tech_safe": tech_safe,
                "biz_safe": biz_safe,
            })

    if needs_arbitration:
        # interrupt user
        choice = interrupt(
            {
                "type": "TIER_UPGRADE_REVERT_DECISION",
                "old_ticket_id": state.get("ticket_id"),
                "tier_upgrade_reason": rt.get("tier_upgrade_reason", ""),
                "unsafe_files": unsafe_files,
                "options": [
                    "強行 cancel 舊 ticket（接受影響面）",
                    "保留 staged；user 跑 git reset 後再 retry hotfix-light",
                ],
                "pending_group": f"GRP-orphan-{state.get('ticket_id')}-tier-upgrade",
                "anchor_ts": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {
            **append_decision(state, "@Lead", "tier_upgrade_user_arbitrated", choice=str(choice)),
            "hitl_decision": str(choice),
        }

    # 全 revert_safe → 自動 cancel + 派新 heavy
    new_ticket_id = f"TKT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    old_pg = state.get("pending_group")

    return {
        **append_decision(
            state, "@Lead", "tier_upgrade_auto_cancel",
            old_ticket=state.get("ticket_id"),
            new_ticket=new_ticket_id,
            reason=rt.get("tier_upgrade_reason", ""),
        ),
        "status": "cancelled",
        "superseded": state.get("ticket_id"),
        # 新 heavy ticket 由 @Lead 重派下一輪；本 graph 的 state 標 cancelled
        "pending_group_inherited_from": old_pg,
        "context_carryover_summary": {
            "prior_changes": str(in_flight),
            "prior_business_impact": "all revert_safe",
            "prior_revert_status": "auto_cancel",
        },
    }
