"""
hitl.py — HITL interrupt helpers (PROPOSAL_502_051 B-2 + B-5)

8 HITL interrupt 類型：
1. PRIOR_ART_SEARCH_PENDING (architect Phase A)
2. PRIOR_ART_VERIFY_PENDING (architect Phase C)
3. STAGE_VERIFY_PENDING (autonomy mode != auto 命中 stage)
4. MULTI_SIGNAL_AMBIGUOUS (subgraphs/multi_signal.py)
5. TIER_UPGRADE_REVERT_DECISION (subgraphs/hotfix_tier_upgrade.py)
6. PROPOSAL_ADOPT_PENDING (retro 完成)
7. STRATEGY_WEIGHT_CHANGE_PENDING (force_complex)
8. HOTFIX_LIGHT_VERIFY_PENDING (hotfix-light review 後)

autonomy_mode 對應 stage：
- auto: 0 gate
- step-by-step: 每階段轉移皆 gate (最多 8-9 次)
- gate-at-design: Stage 3 → 3.5/4 轉移前 1 次
- gate-at-impl: Stage 4 → 5 轉移前 1 次
"""
from __future__ import annotations

from typing import Any, Literal

from langgraph.types import interrupt

from .state import AutonomyMode, WorkflowState


# Stage IDs (對齊 v7.22 lead-orchestration-guide §六)
StageId = Literal[
    "stage_1_requirement",
    "stage_2_consultant",
    "stage_3_design",
    "stage_3_5_prior_art",
    "stage_4_test_spec",
    "stage_5_implement",
    "stage_5_5_self_audit",
    "stage_6_review",
    "stage_6_5_security",
    "stage_7_qa_verify",
    "stage_8_convergence",
    "stage_9_retro",
]


def _autonomy_should_gate(mode: AutonomyMode, stage: StageId) -> bool:
    """依 autonomy_mode 決定本 stage 轉移前是否 gate"""
    if mode == "auto":
        return False
    if mode == "step-by-step":
        return True
    if mode == "gate-at-design":
        return stage == "stage_3_design"
    if mode == "gate-at-impl":
        return stage == "stage_4_test_spec"  # Stage 4 → 5 轉移前
    return False


def maybe_autonomy_gate(state: WorkflowState, current_stage: StageId, next_stage: StageId) -> dict[str, Any]:
    """若 autonomy_mode 命中本 stage 轉移 → interrupt 等 user；否則直通"""
    mode = state.get("autonomy_mode", "auto")
    if not _autonomy_should_gate(mode, current_stage):
        return {}

    response = interrupt(
        {
            "type": "STAGE_VERIFY_PENDING",
            "current_stage": current_stage,
            "next_stage": next_stage,
            "autonomy_mode": mode,
            "ticket_id": state.get("ticket_id"),
            "options": ["OK / 繼續", "改 X", "停止本 ticket"],
            "pending_group": state.get("pending_group", state.get("ticket_id")),
        }
    )

    return {
        "hitl_decision": str(response),
        "pending_hitl_type": None,
    }


def prior_art_search_pending(state: WorkflowState) -> Any:
    """PROPOSAL_502_030 Prior Art HITL Phase A → 等 user 跑 search 回填 §B"""
    return interrupt(
        {
            "type": "PRIOR_ART_SEARCH_PENDING",
            "message": (
                "@Architect 已產 Search Package；請依 §A 跑外部 search（Chat/瀏覽器）"
                "並回填 PRIOR_ART_REPORT §B 結構化結果表"
            ),
            "ticket_id": state.get("ticket_id"),
            "options": ["完成 §B 回填", "bypass + 理由"],
        }
    )


def prior_art_verify_pending(state: WorkflowState) -> Any:
    """既有 final HITL gate；user 確認 agent 評估"""
    return interrupt(
        {
            "type": "PRIOR_ART_VERIFY_PENDING",
            "message": "@Architect 完成 Phase C 評估；請於 §D 填結論前確認",
            "ticket_id": state.get("ticket_id"),
            "options": ["accept", "reject", "bypass + 理由"],
        }
    )


def proposal_adopt_pending(state: WorkflowState) -> Any:
    """retro 完成提案 → user 採納確認"""
    return interrupt(
        {
            "type": "PROPOSAL_ADOPT_PENDING",
            "message": f"@Retro 產提案；請審閱並確認採納",
            "ticket_id": state.get("ticket_id"),
            "proposal_id": state.get("proposal_id"),
            "options": ["adopt", "reject", "amend"],
        }
    )


def strategy_weight_change_pending(state: WorkflowState) -> Any:
    """force_complex 觸發 strategyWeight 變更 → user 仲裁"""
    return interrupt(
        {
            "type": "STRATEGY_WEIGHT_CHANGE_PENDING",
            "message": "偵測 strategyWeight 異動；資料刪除豁免邊界 5 條件之一觸發",
            "ticket_id": state.get("ticket_id"),
            "options": ["approve", "deny"],
        }
    )


def hotfix_light_verify_pending(state: WorkflowState) -> Any:
    """hotfix-light 完成 review 後 user 確認上線"""
    return interrupt(
        {
            "type": "HOTFIX_LIGHT_VERIFY_PENDING",
            "message": "@Reviewer 通過；hotfix-light 確認上線前最後一道 user 確認",
            "ticket_id": state.get("ticket_id"),
            "options": ["confirm", "abort"],
        }
    )
