"""
nodes/_base.py — 共用 node helper (PROPOSAL_502_050 F-4 / 502_061 V89-A-1)

所有 agent node 共用：
- 從 v7.22 文件層讀 system prompt
- 跑 LLM call (sampling default / API optional)；含 fail-fast timeout（V89-A-1）
- decision_path append
- runtime_telemetry 累積
"""
from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm_adapter import get_llm_for_node
from ..parser import load_agent_behavior
from ..state import WorkflowState


# V89-A-1: LLM call 超時保護；env LLM_CALL_TIMEOUT override（秒）
DEFAULT_LLM_TIMEOUT_S = float(os.environ.get("LLM_CALL_TIMEOUT", "120"))


async def call_agent_llm(
    state: WorkflowState,
    agent_id: str,
    *,
    user_message: Optional[str] = None,
    extra_system: Optional[str] = None,
) -> str:
    """所有 node 共用：讀 v7.22 rule 為 system prompt，跑 LLM，回 text。

    V89-A-1: 加 asyncio.wait_for 包覆；防 sampling 不支援 / API 卡死無 timeout
    Qwen Code 等不支援 MCP sampling 的 harness 會永久卡；本 timeout
    讓 dispatch 在 LLM_CALL_TIMEOUT_S（預設 120s）後 raise + 進 caller fail-fast
    """
    behavior = load_agent_behavior(agent_id)

    system = behavior.system_prompt
    if extra_system:
        system = f"{system}\n\n## 本次 dispatch 額外指令\n\n{extra_system}"

    if user_message is None:
        user_message = _build_default_user_message(state)

    llm = get_llm_for_node(agent_id)
    backend = state.get("llm_backend", "?")

    try:
        response = await asyncio.wait_for(
            llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user_message)]),
            timeout=DEFAULT_LLM_TIMEOUT_S,
        )
    except asyncio.TimeoutError as e:
        raise RuntimeError(
            f"LLM call timeout ({DEFAULT_LLM_TIMEOUT_S}s) for agent={agent_id}; "
            f"backend={backend}. 可能原因：\n"
            f"  - sampling backend 但 harness 不支援 MCP sampling/createMessage（如 Qwen Code）"
            f"     → 切 API mode + 設 LLM_BACKEND.default_mode=api + 對應 api_key_env\n"
            f"  - api backend 但 network / proxy / API key 配置錯\n"
            f"  - 提高 timeout: env LLM_CALL_TIMEOUT=<秒數>"
        ) from e

    return response.content if isinstance(response.content, str) else str(response.content)


def _build_default_user_message(state: WorkflowState) -> str:
    """預設 user message：含 user 原始指令 + ROUTING_TICKET 摘要"""
    parts = [
        f"# User 原始指令\n\n{state.get('original_request', '')}",
        f"\n# ROUTING_TICKET 摘要",
        f"- ticket_id: {state.get('ticket_id')}",
        f"- task_class: {state.get('task_class')}",
        f"- target_agent: {state.get('target_agent')}",
        f"- touched_files: {state.get('touched_files', [])}",
        f"- autonomy_mode: {state.get('autonomy_mode')}",
    ]
    if state.get("memory_hint"):
        parts.append(f"- memory_hint: {state.get('memory_hint')}")
    if state.get("gitnexus_hint"):
        parts.append(f"- gitnexus_hint: {state.get('gitnexus_hint')}")
    return "\n".join(parts)


def append_decision(state: WorkflowState, agent_id: str, action: str, **extra) -> dict:
    """產生 decision_path append（reducer 自動合併到 state['decision_path']）

    Returns:
        dict 給 LangGraph node 回傳；reducer 'add' 會 append 到 list
    """
    entry = {
        "agent": agent_id,
        "action": action,
        "ts": datetime.now(timezone.utc).isoformat(),
        **extra,
    }
    return {"decision_path": [entry]}


def safe_node_return(updates: dict) -> dict:
    """V86-A-6: 對 node return updates 跑 assert_checkpoint_safe；阻 RequestContext / asyncio
    污染 state 在中間 node。create_initial_state 已驗一次，本 wrapper 補每 node 出口。

    Usage: `return safe_node_return({"foo": ..., "bar": ...})`
    """
    from ..state import assert_checkpoint_safe
    assert_checkpoint_safe(updates)
    return updates


def parse_llm_json(text: str) -> Optional[dict]:
    """嘗試 parse LLM 回覆中的 JSON block；容錯回 None"""
    # 抓 ```json ... ``` block
    m = re.search(r"```(?:json)?\s*\n(.*?)\n\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 嘗試整段 parse
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    return None
