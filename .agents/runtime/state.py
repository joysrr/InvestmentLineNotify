"""
state.py — LangGraph WorkflowState (v8.0)

完整對齊 v7.22 ROUTING_TICKET schema（`.agents/skills/routing-ticket-protocol.md`）。
PROPOSAL_502_050 Phase 1 F-1。

設計原則：
- v7.22 schema 為 ground truth（30+ 欄位 1:1 映射）
- LangGraph reducers：append-only fields 用 add；merge fields 用 dict_merge
- assert_checkpoint_safe：fail-fast 防 RequestContext / socket / asyncio 物件污染
"""
from __future__ import annotations

from operator import add
from typing import Annotated, Literal, Optional, TypedDict  # V86-B-5: 移除未用 Any

# ============================================================
# Type aliases (v7.22 enums)
# ============================================================

TaskClass = Literal[
    "feature",
    "modify-existing",
    "doc-sync",
    "hotfix",
    "config-adjust",
    "onboarding",  # PROPOSAL_502_035
]

TaskClassSource = Literal[
    "explicit",
    "structural",  # ADR-0042 layer 1
    "keyword",  # ADR-0042 layer 2
    "llm_classifier",  # ADR-0042 layer 3
    "llm_failed_fallback",  # PROPOSAL_502_045 R4-A2
]

AutonomyMode = Literal[
    "auto",
    "step-by-step",
    "gate-at-design",
    "gate-at-impl",
]

Status = Literal[
    "dispatched",
    "acknowledged",
    "completing",  # PROPOSAL_502_043 R3-B5 中介態
    "completed",
    "cancelled",
    "paused",  # PROPOSAL_502_040 hotfix tier 升級
    "timeout",
    "retried",
    "failed",
]

GitNexusProbe = Literal["ok", "disabled", "crash", "no-index", "timeout"]

InFlightStatus = Literal["working_tree", "staged", "committed"]

# ============================================================
# Reducers
# ============================================================


def merge_dict(left: Optional[dict], right: Optional[dict]) -> dict:
    """合併 dict（用於 runtime_telemetry / sc_evaluation 等 append-style nested）"""
    if left is None:
        return right or {}
    if right is None:
        return left
    merged = dict(left)
    merged.update(right)
    return merged


def union_list(left: Optional[list], right: Optional[list]) -> list:
    """list union（用於 mempalace_writes / artifact_paths 等去重 append）"""
    if left is None:
        left = []
    if right is None:
        right = []
    seen = set()
    result = []
    for item in list(left) + list(right):
        key = item if isinstance(item, str) else repr(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


# ============================================================
# RuntimeTelemetry (nested; sub-agent 執行期 append-only)
# ============================================================


class RuntimeTelemetry(TypedDict, total=False):
    """sub-agent 執行期 telemetry（PROPOSAL_502_039 §3.6 + 502_046 補欄位）"""
    gitnexus_probe: GitNexusProbe
    gitnexus_used: bool
    gitnexus_callers_count: int
    mempalace_writes: list[str]  # drawer_id list
    elapsed_ms: int
    tier_upgrade_required: Literal["none", "heavy"]
    tier_upgrade_reason: str
    in_flight_changes: list[dict]  # [{file, status, technical_revert_safe, business_impact_revert_safe}]
    prior_ticket_telemetry_carryover: bool
    prior_ticket_id: Optional[str]
    prior_ticket_probe_history: list[GitNexusProbe]
    validator_failed_reason: Optional[str]
    failed_at: Optional[str]


# ============================================================
# GitNexusHint (PROPOSAL_502_034 + 502_036)
# ============================================================


class GitNexusHint(TypedDict, total=False):
    triggered_by: list[
        Literal[
            "cross-stack",
            "large-file",
            "refactor-keyword",
            "frontend-backend-pair",
            "onboarding-scenario",
        ]
    ]
    suggested_query: str
    fallback: str
    optional: bool


# ============================================================
# WorkflowState (LangGraph state)
# ============================================================


class WorkflowState(TypedDict, total=False):
    """完整對齊 v7.22 ROUTING_TICKET schema v1（routing-ticket-protocol.md §二）"""

    # ────── Ticket 基本資訊（必填）──────
    ticket_id: str  # TKT-YYYYMMDD-NNN
    schema_version: str  # 固定 "v1"
    created_at: str  # ISO8601 UTC
    done_at: Optional[str]  # PROPOSAL_502_046 R5-7；status: completed 時填
    created_by: Literal["@Lead"]
    status: Status

    # ────── 任務分類（PROPOSAL_502_044 + ADR-0042）──────
    task_class: TaskClass
    task_class_source: TaskClassSource  # 三層判定哪層命中
    task_class_source_evidence: Optional[str]  # structural 時填觸發訊號名
    intent_ambiguous: bool

    # ────── User 原始指令（必填；不得改寫）──────
    original_request: str

    # ────── Lane / Model / 複雜度決策（必填）──────
    assigned_lane: Literal["fast", "standard", "heavy"]
    model_tier: Literal["haiku", "sonnet", "opus"]
    complexity_tier: Literal["simple", "medium", "complex"]
    tier_reason: str

    # ────── 任務目標（必填）──────
    target_agent: str  # @Backend / @Architect 等
    sibling_agents: list[str]  # 並行派發
    touched_files: list[str]
    artifact_paths: Annotated[list[str], union_list]
    tech_stacks: list[str]

    # ────── Memory / GitNexus（PROPOSAL_502_013 + 034 + 036 + V90-A-8 state-level integration）──────
    memory_mode: Literal["mcp", "filesystem_fallback"]
    memory_hint: Optional[str]
    skip_memory_search: bool
    runtime_setup: list[dict]  # workspace pre_command_hooks
    autonomy_mode: AutonomyMode
    gitnexus_hint: Optional[GitNexusHint]
    # V90-A-8: state-level GitNexus context（nodes 累積 callers / callees / impact / module_deps）
    # reducer = merge_dict；後 stage 加新 entries 不蓋掉前 stage
    gitnexus_context: Annotated[Optional[dict], merge_dict]

    # ────── Workspace 注入摘要（精選；非全文）──────
    project_context_excerpt: str
    business_rules_excerpt: str
    critical_paths_excerpt: str

    # ────── Hotfix 擴充（PROPOSAL_502_046 R5-3 加 hotfix_tier）──────
    hotfix: Optional[dict]
    # {
    #   enabled: bool,
    #   hotfix_tier: "light" | "heavy",
    #   sc_evaluation: {triggered, sc_codes, reason},
    #   diagnostic_team_required: bool,
    # }

    # ────── Hotfix Tier 升級 carry-over（PROPOSAL_502_040）──────
    superseded: Optional[str]  # 舊 ticket_id
    pending_group: Optional[str]
    pending_group_inherited_from: Optional[str]
    context_carryover_summary: Optional[dict]
    retry_of: Optional[str]  # PROPOSAL_502_046 R5-1
    multi_signal_secondary: list[str]  # ADR-0043
    multi_signal_primary: Optional[str]

    # ────── Runtime telemetry（append-only by reducer）──────
    runtime_telemetry: Annotated[Optional[RuntimeTelemetry], merge_dict]

    # ────── 執行軌跡（LangGraph 累積；reducer add）──────
    decision_path: Annotated[list[dict], add]
    review_cycle_count: int
    qa_retest_count: int  # V82-X-2: qa fail 次數獨立計數；不再共用 review_cycle_count
    prior_art_reject_count: int  # V83-A-2: prior_art reject 次數；≥1 後 architect 強制壓 False 避無限迴圈

    # ────── HITL 中斷狀態 ──────
    pending_hitl: Optional[dict]
    hitl_decision: Optional[str]
    pending_hitl_type: Optional[
        Literal[
            "PRIOR_ART_SEARCH_PENDING",
            "PRIOR_ART_VERIFY_PENDING",
            "STAGE_VERIFY_PENDING",
            "MULTI_SIGNAL_AMBIGUOUS",
            "TIER_UPGRADE_REVERT_DECISION",
            "PROPOSAL_ADOPT_PENDING",
            "STRATEGY_WEIGHT_CHANGE_PENDING",
            "HOTFIX_LIGHT_VERIFY_PENDING",
        ]
    ]

    # ────── 各 node 解析結果（必須宣告於 schema 才能在 conditional edges 讀到）──────
    review_result: Optional[Literal["pass", "fail"]]
    review_quality_violation: Optional[bool]
    security_result: Optional[Literal["pass", "fail"]]
    qa_result: Optional[Literal["pass", "fail"]]
    consultant_risk_level: Optional[Literal["🟢", "🟡", "🔴"]]
    prior_art_scan_triggered: Optional[bool]
    prior_art_report_path: Optional[str]
    proposal_id: Optional[str]
    proposal_path: Optional[str]

    # ────── Auditor 6 dim 並行（ADR-0005 + ADR-0045）──────
    audit_id: Optional[str]
    audit_dimension: Optional[int]  # 1-6
    audit_dimension_avg: Optional[float]
    audit_overall: Optional[float]
    dim_1_avg: Optional[float]
    dim_2_avg: Optional[float]
    dim_3_avg: Optional[float]
    dim_4_avg: Optional[float]
    dim_5_avg: Optional[float]
    dim_6_avg: Optional[float]  # PROPOSAL_502_048 + ADR-0045
    # V87-B-1: aggregate node 寫入；ADR-0045 freeze gate flag
    _dim6_can_freeze: Optional[bool]
    _dim6_needs_p15: Optional[bool]

    # ────── LangGraph 內部 (POC 既有；保留)──────
    environment: Literal["company", "home"]
    llm_backend: Literal["sampling", "api"]  # v8.0 簡化（sampling default）
    llm_model: str

    # ────── 內部 artifact paths（POC 既有；保留）──────
    _routing_ticket_path: Optional[str]
    _routing_ticket_error: Optional[str]
    _hitl_notice: Optional[str]
    _phase_a_result: Optional[str]  # V82-X-4: prior_art Phase A → C 中介 carry-over


# ============================================================
# Initial state factory
# ============================================================


def create_initial_state(
    request: str,
    *,
    environment: Literal["company", "home"] = "home",
    llm_backend: Literal["sampling", "api"] = "sampling",
    lane: Literal["fast", "standard", "heavy"] = "standard",
) -> WorkflowState:
    """建立初始 WorkflowState（@Lead supervisor node 後續填詳細欄位）"""
    from datetime import datetime, timezone
    import uuid

    state: WorkflowState = {
        "ticket_id": f"TKT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}",
        "schema_version": "v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "done_at": None,
        "created_by": "@Lead",
        "status": "dispatched",
        "task_class": "feature",  # supervisor 後覆寫
        "task_class_source": "keyword",  # 同上
        "task_class_source_evidence": None,
        "intent_ambiguous": False,
        "original_request": request,
        "assigned_lane": lane,
        "model_tier": "sonnet",
        "complexity_tier": "medium",
        "tier_reason": "initial; awaiting supervisor classification",
        "target_agent": "@Lead",
        "sibling_agents": [],
        "touched_files": [],
        "artifact_paths": [],
        "tech_stacks": [],
        "memory_mode": "mcp",
        "memory_hint": None,
        "skip_memory_search": False,
        "runtime_setup": [],
        "autonomy_mode": "gate-at-design",  # feature default
        "gitnexus_hint": None,
        "gitnexus_context": None,  # V90-A-8: nodes 進入時 lazy-fill
        "project_context_excerpt": "",
        "business_rules_excerpt": "",
        "critical_paths_excerpt": "",
        "hotfix": None,
        "superseded": None,
        "pending_group": None,
        "pending_group_inherited_from": None,
        "context_carryover_summary": None,
        "retry_of": None,
        "multi_signal_secondary": [],
        "multi_signal_primary": None,
        "runtime_telemetry": None,
        "decision_path": [],
        "review_cycle_count": 0,
        "qa_retest_count": 0,
        "prior_art_reject_count": 0,
        "pending_hitl": None,
        "hitl_decision": None,
        "pending_hitl_type": None,
        "environment": environment,
        "llm_backend": llm_backend,
        "llm_model": "",  # llm_adapter 填
    }

    assert_checkpoint_safe(state)
    return state


# ============================================================
# Checkpoint safety helper (POC 既有；保留)
# ============================================================


def assert_checkpoint_safe(state: dict) -> None:
    """驗 state 內所有值能被 SqliteSaver msgpack serializer 處理。

    歷史教訓：曾把 RequestContext 塞進 state 導致 checkpoint 失敗 → 全流程死當。
    Fail-fast 防 RequestContext / socket / asyncio 物件污染 state。
    """
    try:
        import msgpack

        encoder = lambda v: msgpack.packb(v, use_bin_type=True)
        backend = "msgpack"
    except ImportError:
        import json

        encoder = lambda v: json.dumps(v)
        backend = "json"

    for k, v in state.items():
        try:
            encoder(v)
        except (TypeError, ValueError) as e:
            raise TypeError(
                f"WorkflowState 欄位 {k!r} 不可被 {backend} 序列化 "
                f"（type={type(v).__name__}）：{e}\n"
                f"  → checkpoint 寫入會失敗；不要把 socket / asyncio 物件 / "
                f"RequestContext 放入 state；改用 contextvar 傳遞"
            ) from e


# ============================================================
# Serialization helpers (state ↔ ROUTING_TICKET.md)
# ============================================================


def serialize_to_routing_ticket(state: WorkflowState) -> str:
    """把 WorkflowState 序列化為 ROUTING_TICKET.md 內容"""
    import yaml

    # 只取持久化欄位（排除 LangGraph 內部如 decision_path / pending_hitl 等）
    excluded = {"decision_path", "pending_hitl", "hitl_decision", "_routing_ticket_path", "_routing_ticket_error", "_hitl_notice"}
    ticket_fields = {k: v for k, v in state.items() if k not in excluded and v is not None}

    yaml_block = yaml.safe_dump(ticket_fields, allow_unicode=True, sort_keys=False)
    return (
        f"---\n{yaml_block}---\n\n"
        f"# ROUTING_TICKET (auto-generated by LangGraph runtime v8.0)\n\n"
        f"_由 PROPOSAL_502_050 LangGraph runtime 自動產出；對齊 routing-ticket-protocol §schema_\n"
    )


def deserialize_from_routing_ticket(content: str) -> WorkflowState:
    """從 ROUTING_TICKET.md 還原 WorkflowState（用於 retry / superseded carry-over）"""
    import yaml

    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("ROUTING_TICKET 缺 YAML frontmatter")

    end_idx = None
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        raise ValueError("ROUTING_TICKET YAML frontmatter 未閉合")

    yaml_text = "\n".join(lines[1:end_idx])
    data = yaml.safe_load(yaml_text)
    return data  # type: ignore[return-value]
