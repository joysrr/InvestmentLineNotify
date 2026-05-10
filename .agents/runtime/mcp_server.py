"""
mcp_server.py — LangGraph MCP server (PROPOSAL_502_050 F-5 / 502_058 V86-B-7)

暴露 4 tools 給 4 harness 呼叫：
- dispatch(request: str) — 觸發 LangGraph 跑全 graph
- dispatch_resume(thread_id, response) — HITL interrupt 後續跑
- dim6_audit() — 跑 design audit (auditor subgraph)
- walkthrough(scenarios: list) — placeholder；ADR-0044 SOP 由外部 sub-agents 跑

LLM 走 sampling → 反向呼 harness 視窗 LLM (用 contextvar 把 MCP session 注入 llm_adapter)。
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from . import gitnexus_helper  # V90-A-8: GitNexus mandatory health probe
from .checkpointer import make_checkpointer
from .graph import build_graph
from .llm_adapter import set_mcp_session
from .parser import validate_v722_ground_truth
from .persistence import archive_routing_ticket, write_routing_ticket
from .state import WorkflowState, create_initial_state  # V88-B-1: serialize_to_routing_ticket 未用


# V90-A-8: GitNexus mandatory；env GITNEXUS_OPTIONAL=1 可降回 advisory（除錯 / CI 用）
_GITNEXUS_MANDATORY = os.environ.get("GITNEXUS_OPTIONAL", "").lower() not in ("1", "true", "yes")


def validate_runtime_environment() -> list[str]:
    """V90-A-8: 啟動時驗證 runtime 必備外部依賴；mandatory 失敗回 errors list。

    GitNexus 不可達 → mandatory error（除非 GITNEXUS_OPTIONAL=1）。
    """
    errors: list[str] = []

    if _GITNEXUS_MANDATORY and not gitnexus_helper.is_available():
        errors.append(
            "❌ GitNexus CLI 不可達；V90-A-8 後 framework-mandatory（state-level integration）。\n"
            "   解：\n"
            "     1. 裝 Node v22 LTS（v24 缺 ladybugdb prebuild）\n"
            "     2. <NODE_BIN_DIR>\\npm.cmd install -g gitnexus\n"
            "     3. 設 GITNEXUS_CMD env 為 gitnexus.cmd 絕對路徑（或加 NODE_BIN_DIR 進 PATH）\n"
            "     4. 確實要跳過 → 設 GITNEXUS_OPTIONAL=1 環境變數\n"
            "   詳 .agents/INSTALL.md §6"
        )

    return errors


server = Server("langgraph-runtime")


# ============================================================
# Tools schema
# ============================================================


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="dispatch",
            description=(
                "v8.0 dispatch entrypoint：觸發 LangGraph 跑 full multi-agent workflow。\n"
                "harness 偵測到 user 任何 dispatch 意圖必呼此 tool（Q5-B 鐵律）。\n"
                "LangGraph 內部走 v7.22 文件層為 ground truth；自動分類、派發、走 11-stage workflow。\n"
                "中間 HITL → 回 INTERRUPT_PENDING 結構含 thread_id + payload；harness 顯示給 user → "
                "user 回應後呼 dispatch_resume(thread_id, response) 接續。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "request": {"type": "string", "description": "user 原始指令"},
                    "thread_id": {"type": "string", "description": "可選；resume 用"},
                    "environment": {"type": "string", "enum": ["company", "home"], "default": "home"},
                },
                "required": ["request"],
            },
        ),
        Tool(
            name="dispatch_resume",
            description=(
                "v8.0.1 C-4 新加：resume HITL interrupt 後續執行。harness 收到 dispatch 回的 "
                "INTERRUPT_PENDING → 顯示 payload 給 user → user 回應 → 呼此 tool 繼續 graph。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string", "description": "原 dispatch thread_id"},
                    "response": {"type": "string", "description": "user 對 interrupt 的回應"},
                },
                "required": ["thread_id", "response"],
            },
        ),
        Tool(
            name="dim6_audit",
            description="跑 @Auditor 6-dim design audit",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="walkthrough",
            description="跑 integration walkthrough simulation",
            inputSchema={
                "type": "object",
                "properties": {"scenarios": {"type": "array", "items": {"type": "string"}}},
            },
        ),
    ]


# ============================================================
# dispatch handler
# ============================================================


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name == "dispatch":
        return await _handle_dispatch(arguments)
    if name == "dispatch_resume":
        return await _handle_resume(arguments)
    if name == "dim6_audit":
        return [TextContent(type="text", text="dim6_audit subgraph 已就緒；直接走 dispatch + target=@Auditor")]
    if name == "walkthrough":
        # V86-B-7: ADR-0044 walkthrough 為 SOP（4 並行 agent 跑 8 情境）；
        # 機械層難全 enforce，本工具回 placeholder；user 改用 sub-agents 跑外部 sim
        return [TextContent(
            type="text",
            text="walkthrough placeholder；ADR-0044 SOP 由外部 sub-agents 執行（dispatch + sim）。",
        )]
    return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def _handle_dispatch(arguments: dict[str, Any]) -> list[TextContent]:
    """dispatch tool main handler"""
    request = arguments.get("request", "")
    if not request:
        return [TextContent(type="text", text="❌ dispatch: 'request' 必填")]

    thread_id = arguments.get("thread_id") or _gen_thread_id()
    environment = arguments.get("environment", "home")

    # Set MCP session contextvar (sampling 反向呼用)
    # V88-A-1: request_context 是 property；hasattr 永遠 True 但 access 在非 handler 場景
    # 會 raise LookupError；改 try/except 增 testability
    try:
        session = server.request_context.session
    except (LookupError, AttributeError):
        session = None
    set_mcp_session(session)

    # 啟動驗證（V90-A-8: 加 runtime env probe）
    errors = validate_v722_ground_truth()
    errors.extend(validate_runtime_environment())
    if errors:
        return [TextContent(type="text", text=f"❌ runtime 啟動驗證失敗:\n" + "\n".join(errors))]

    # 跑 graph
    initial = create_initial_state(request=request, environment=environment)

    try:
        async with make_checkpointer() as cp:
            graph = build_graph(checkpointer=cp)
            config = {"configurable": {"thread_id": thread_id}}

            final_state: WorkflowState = await graph.ainvoke(initial, config=config)

            # C-4 V8-D-4 修：偵測 interrupt（LangGraph 1.x 把 interrupt payload 放 final_state["__interrupt__"]）
            interrupts = final_state.get("__interrupt__")
            if interrupts:
                # 仍未完成；harness 需顯示 payload 給 user → 再呼 dispatch_resume
                interrupt_payload = interrupts[0] if isinstance(interrupts, list) else interrupts
                payload_value = interrupt_payload.value if hasattr(interrupt_payload, "value") else interrupt_payload
                return [
                    TextContent(
                        type="text",
                        text=_build_interrupt_summary(thread_id, payload_value, final_state),
                    )
                ]

            # 完整完成；寫 ROUTING_TICKET + archive
            final_state["status"] = final_state.get("status", "completed")
            try:
                write_routing_ticket(final_state)
                if archived := archive_routing_ticket(final_state):
                    final_state["_routing_ticket_path"] = str(archived)
            except Exception as e:
                final_state["_routing_ticket_error"] = str(e)

        result_summary = _build_result_summary(final_state, thread_id)
        return [TextContent(type="text", text=result_summary)]

    except Exception as e:
        import traceback
        return [
            TextContent(
                type="text",
                text=f"❌ LangGraph runtime error:\n{type(e).__name__}: {e}\n\n{traceback.format_exc()[:500]}",
            )
        ]


async def _handle_resume(arguments: dict[str, Any]) -> list[TextContent]:
    """v8.0.1 C-4：resume interrupted dispatch
    v8.0.6 V86-A-7：resume 前重跑 v7.22 ground truth 驗證；防 user 中途改文件造成行為漂移
    """
    from langgraph.types import Command

    thread_id = arguments.get("thread_id", "")
    response_text = arguments.get("response", "")
    if not thread_id or not response_text:
        return [TextContent(type="text", text="❌ dispatch_resume: thread_id + response 必填")]

    # V86-A-7: ground truth 漂移檢查（與 dispatch 一致）
    errors = validate_v722_ground_truth()
    if errors:
        msg = "❌ v7.22 ground truth 漂移；resume 中止：\n" + "\n".join(f"- {e}" for e in errors[:10])
        return [TextContent(type="text", text=msg)]

    # V88-A-1: request_context 是 property；hasattr 永遠 True 但 access 在非 handler 場景
    # 會 raise LookupError；改 try/except 增 testability
    try:
        session = server.request_context.session
    except (LookupError, AttributeError):
        session = None
    set_mcp_session(session)

    try:
        async with make_checkpointer() as cp:
            graph = build_graph(checkpointer=cp)
            config = {"configurable": {"thread_id": thread_id}}

            # V87-B-5: 偵測 thread state 不存在（Web harness InMemorySaver 跨 process 必失敗）
            try:
                state_snapshot = await graph.aget_state(config)
                if state_snapshot is None or not getattr(state_snapshot, "values", None):
                    from .checkpointer import get_checkpoint_path
                    inmemory_mode = get_checkpoint_path() is None
                    hint = (
                        "Web harness 預設 InMemorySaver；thread state 不跨 process 存活。"
                        "請重新呼 dispatch（不要 dispatch_resume）。"
                        if inmemory_mode
                        else f"checkpoint 找不到 thread_id={thread_id}；請確認 ID 或重新 dispatch。"
                    )
                    return [TextContent(type="text", text=f"❌ dispatch_resume: thread_id state 不存在\n\n{hint}")]
            except Exception:
                pass  # aget_state 失敗時讓下方 ainvoke 自然處理

            final_state: WorkflowState = await graph.ainvoke(
                Command(resume=response_text), config=config
            )

            interrupts = final_state.get("__interrupt__")
            if interrupts:
                interrupt_payload = interrupts[0] if isinstance(interrupts, list) else interrupts
                payload_value = interrupt_payload.value if hasattr(interrupt_payload, "value") else interrupt_payload
                return [
                    TextContent(
                        type="text",
                        text=_build_interrupt_summary(thread_id, payload_value, final_state),
                    )
                ]

            final_state["status"] = final_state.get("status", "completed")
            try:
                write_routing_ticket(final_state)
                archive_routing_ticket(final_state)
            except Exception:
                pass

        return [TextContent(type="text", text=_build_result_summary(final_state, thread_id))]

    except Exception as e:
        import traceback
        return [
            TextContent(
                type="text",
                text=f"❌ Resume error:\n{type(e).__name__}: {e}\n\n{traceback.format_exc()[:500]}",
            )
        ]


def _build_interrupt_summary(thread_id: str, payload: Any, state: WorkflowState) -> str:
    """生 interrupt 顯示文字（harness 顯示給 user）"""
    payload_dict = payload if isinstance(payload, dict) else {"value": str(payload)}
    interrupt_type = payload_dict.get("type", "INTERRUPT_PENDING")
    message = payload_dict.get("message", "")
    options = payload_dict.get("options", [])

    lines = [
        f"# 🟡 INTERRUPT_PENDING — User 介入需要",
        f"",
        f"- thread_id: `{thread_id}` (resume 用)",
        f"- type: {interrupt_type}",
        f"- ticket_id: {state.get('ticket_id')}",
        f"",
        f"## 訊息",
        f"",
        f"{message}",
    ]
    if options:
        lines.append("")
        lines.append("## 選項")
        for opt in options:
            lines.append(f"- {opt}")
    lines.extend(
        [
            "",
            "## 如何 resume",
            "",
            f"User 回應後 → harness 呼 `mcp__langgraph__dispatch_resume(thread_id=\"{thread_id}\", response=\"<user 選擇>\")`",
        ]
    )
    return "\n".join(lines)


def _gen_thread_id() -> str:
    """V86-A-8: 改 UTC 避免跨 timezone harness（Antigravity remote 等）對齊偏差"""
    from datetime import datetime, timezone
    import uuid

    return f"thread-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"


def _build_result_summary(state: WorkflowState, thread_id: str) -> str:
    """組結果摘要回給 harness（user 看）"""
    lines = [
        f"# 🎯 LangGraph Dispatch 完成",
        f"",
        f"- thread_id: {thread_id}",
        f"- ticket_id: {state.get('ticket_id')}",
        f"- task_class: {state.get('task_class')} (source: {state.get('task_class_source')})",
        f"- assigned_lane: {state.get('assigned_lane')}",
        f"- complexity_tier: {state.get('complexity_tier')}",
        f"- target_agent: {state.get('target_agent')}",
        f"- status: {state.get('status')}",
        f"- review_cycles: {state.get('review_cycle_count', 0)}",
    ]

    if state.get("audit_overall"):
        lines.append(f"- audit_overall: {state.get('audit_overall'):.2f}")
        # V87-B-2: dim 6 freeze gate 訊號顯眼回 caller（ADR-0045）
        if state.get("_dim6_can_freeze") is False:
            lines.append("- ⚠️  **milestone_freeze_blocked**: dim 6 < 2.0；FRAMEWORK_VERSION bump 應暫停")
        if state.get("_dim6_needs_p15"):
            lines.append(
                "- 🟡 dim 6 < 3.0 → 觸發 P-15（需 retro 跟進；參 `.agents/skills/retro.md` §s06）"
            )

    decisions = state.get("decision_path", [])
    if decisions:
        lines.append(f"\n## 決策軌跡（{len(decisions)} 步）")
        for d in decisions[-10:]:  # 最後 10 步
            lines.append(f"- {d.get('agent')}: {d.get('action')}")

    return "\n".join(lines)


# ============================================================
# Main entry
# ============================================================


async def main() -> None:
    """stdio MCP server main"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
