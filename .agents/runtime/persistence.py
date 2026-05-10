"""
persistence.py — ROUTING_TICKET sync + telemetry helpers (PROPOSAL_502_051 B-6 + B-8)

state ↔ ROUTING_TICKET.md 雙向 sync：
- write_routing_ticket: graph end → 寫到 root ROUTING_TICKET.md
- archive_routing_ticket: completed/cancelled/failed → 移 .agents/archive/routing-tickets/
- runtime_telemetry append helper: sub-agent task close 前
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .state import RuntimeTelemetry, WorkflowState, serialize_to_routing_ticket


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ROUTING_TICKET_PATH = PROJECT_ROOT / "ROUTING_TICKET.md"
ARCHIVE_DIR = PROJECT_ROOT / ".agents" / "archive" / "routing-tickets"


def _project_writable() -> bool:
    """V86-A-2: 偵測 PROJECT_ROOT 可寫；Web harness 退化用"""
    try:
        probe = PROJECT_ROOT / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except (OSError, PermissionError):
        return False


def write_routing_ticket(state: WorkflowState) -> Path | None:
    """寫當前 state 為 root ROUTING_TICKET.md（覆寫；單檔運行中）

    V86-A-2: fs 不可寫（Web harness）→ 回 None；mcp_server 改由 result_summary 帶 ticket payload
    """
    if not _project_writable():
        return None
    content = serialize_to_routing_ticket(state)
    ROUTING_TICKET_PATH.write_text(content, encoding="utf-8")
    return ROUTING_TICKET_PATH


def archive_routing_ticket(state: WorkflowState) -> Path | None:
    """status: completed/cancelled/failed → 移 archive；reset root 為 idle

    V86-A-2: fs 不可寫 → 跳過（state 持久化由 checkpointer 負責）
    """
    archivable_status = {"completed", "cancelled", "failed"}
    if state.get("status") not in archivable_status:
        return None

    if not _project_writable():
        return None

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    ticket_id = state.get("ticket_id", "TKT-unknown")
    target = ARCHIVE_DIR / f"{ticket_id}.md"

    target.write_text(serialize_to_routing_ticket(state), encoding="utf-8")

    # reset root（M-3 V8-I-9 修：寫合法 frontmatter 避免 deserialize 拋 ValueError）
    if ROUTING_TICKET_PATH.exists():
        ROUTING_TICKET_PATH.write_text(
            "---\nstatus: idle\n---\n\n# ROUTING_TICKET (idle; archived)\n",
            encoding="utf-8",
        )

    return target


def append_telemetry(
    state: WorkflowState,
    *,
    gitnexus_probe: str | None = None,
    gitnexus_used: bool | None = None,
    gitnexus_callers_count: int | None = None,
    mempalace_writes: list[str] | None = None,
    elapsed_ms: int | None = None,
    tier_upgrade_required: str = "none",
    tier_upgrade_reason: str | None = None,
) -> dict[str, Any]:
    """sub-agent 收尾前產 telemetry update（reducer merge 進 state）"""
    rt: RuntimeTelemetry = {}
    if gitnexus_probe is not None:
        rt["gitnexus_probe"] = gitnexus_probe  # type: ignore
    if gitnexus_used is not None:
        rt["gitnexus_used"] = gitnexus_used
    if gitnexus_callers_count is not None:
        rt["gitnexus_callers_count"] = gitnexus_callers_count
    if mempalace_writes is not None:
        rt["mempalace_writes"] = mempalace_writes
    if elapsed_ms is not None:
        rt["elapsed_ms"] = elapsed_ms
    if tier_upgrade_required != "none":
        rt["tier_upgrade_required"] = tier_upgrade_required  # type: ignore
        if tier_upgrade_reason:
            rt["tier_upgrade_reason"] = tier_upgrade_reason

    return {
        "runtime_telemetry": rt,
        "done_at": datetime.now(timezone.utc).isoformat(),
    }
