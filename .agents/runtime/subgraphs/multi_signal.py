"""
multi_signal.py — ADR-0043 Multi-Signal Task-Class Dispatch (PROPOSAL_502_051 B-3)

依 ADR-0043 §6.3.1.1 4 步驟：
- Step 1: 計命中 priority 數量
- Step 2: 例外升 user 仲裁（onboarding+hotfix / ≥3 priority / onboarding+其他）
- Step 3: 自動拆分（≤2 priority + 非 onboarding）→ 主 ticket + sibling queue
- Step 4: User 通知（PENDING_ACTIONS §🟢 MULTI_SIGNAL_DISPATCHED）
"""
from __future__ import annotations

from typing import Any

from langgraph.types import interrupt

from ..nodes.lead import _detect_multi_signal_priorities
from ..state import WorkflowState
from ..nodes._base import append_decision


def detect_multi_signal(state: WorkflowState) -> dict[str, Any]:
    """偵測；若 ≥2 priority 命中 → 標記；≥3 → interrupt"""
    request = state.get("original_request", "")
    priorities = _detect_multi_signal_priorities(request)

    if len(priorities) <= 1:
        return append_decision(state, "@Lead", "multi_signal_check", result="single", priorities=priorities)

    # Step 2 例外仲裁：≥3 priority OR onboarding (priority 1) 與其他組合
    needs_arbitration = len(priorities) >= 3 or (1 in priorities and len(priorities) >= 2)

    if needs_arbitration:
        # interrupt 等 user 仲裁
        choice = interrupt(
            {
                "type": "MULTI_SIGNAL_AMBIGUOUS",
                "priorities_matched": priorities,
                "options": ["合併走單一通道", "分開派", "只跑指定 task_class"],
                "message": (
                    f"User 指令同時命中 {len(priorities)} 種 priority（{priorities}）；"
                    f"請選擇處理方式（依 ADR-0043 Step 2 例外仲裁）"
                ),
            }
        )
        return {
            **append_decision(state, "@Lead", "multi_signal_arbitration", choice=choice),
            "multi_signal_secondary": [str(p) for p in priorities[1:]],
            "pending_hitl_type": None,
            "hitl_decision": str(choice),
        }

    # Step 3: 自動拆分（2 priorities → 主 + 1 sibling）
    primary = priorities[0]
    secondary = [str(p) for p in priorities[1:]]

    return {
        **append_decision(
            state, "@Lead", "multi_signal_auto_split",
            primary_priority=primary, secondary=secondary,
        ),
        "multi_signal_secondary": secondary,
    }
