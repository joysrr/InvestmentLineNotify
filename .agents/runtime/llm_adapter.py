"""
llm_adapter.py — LLM 雙模 adapter (PROPOSAL_502_050 F-3)

兩種模式可切換（Q1' A）：
- Mode A (default): MCP sampling — 反向呼 harness 視窗 LLM；不另計費
- Mode B (optional): Direct API — user per-workspace 配置；多 provider

Per-node override：dim 6 audit 等可獨立用更強 model。

Workspace LLM_BACKEND block 從 .agents/workspaces/<active>.md 讀。
"""
from __future__ import annotations

import os
from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult


AGENTS_ROOT = Path(__file__).resolve().parent.parent


# ============================================================
# MCP context (sampling reverse 用)
# ============================================================

# MCP server 接到 dispatch request 時 set；node 內 sampling 透過此 contextvar 取
_mcp_session_var: ContextVar[Optional[Any]] = ContextVar("mcp_session", default=None)


def set_mcp_session(session) -> None:
    """MCP server handler 設置（sampling 反向呼用）"""
    _mcp_session_var.set(session)


def get_mcp_session():
    return _mcp_session_var.get()


# ============================================================
# LLM Backend Config (env-only; V90-A-3 / PROPOSAL_502_063)
# ============================================================
#
# 設計演進：
#   v8.0 ~ v8.0.8: 從 .agents/workspaces/<name>.md ## LLM_BACKEND yaml block 讀
#   v8.0.9+ (V90-A-3): 完全改 env-only；workspace 不再放 LLM 配置
#
# 切割原因（user feedback 2026-05-08）：
#   workspace = 專案業務語意（business / domain / rules）
#   settings.json env = machine / infra（URL / token / model 切換）
#   user 換環境（公司↔家）只動 settings.json 一個檔，不動 workspace
#
# 必填 env vars（全在 .qwen/settings.json mcpServers.langgraph.env）：
#   LLM_API_DEFAULT_MODE  # "api" | "sampling"；不設預設 "sampling"
#   LLM_API_PROVIDER      # "custom" | "openai" | "qwen" | "anthropic" | "ollama"
#   LLM_API_MODEL         # 模型字串（如 "qwen3.5"）
#   LLM_API_BASE_URL      # custom / openai 必填；其他 provider 可選
#   LLM_API_KEY_ENV       # token 對應的 env var **名字**（如 "COMPANY_LLM_TOKEN"）
#   <LLM_API_KEY_ENV 指向的那個 var>  # 真實 token 值
# Optional env：
#   LLM_API_EXTRA_BODY    # JSON 字串；passed to ChatOpenAI(extra_body=...)（V90-A-6）
#                         # e.g. {"chat_template_kwargs":{"enable_thinking":false}}
#                         # Qwen3 / DeepSeek-R1 等 thinking 模型 disable 思考用
#   LLM_SAMPLING_MAX_TOKENS  # 預設 4096
#
# Sampling-mode-only env：
#   LLM_SAMPLING_MAX_TOKENS  # 預設 4096


@dataclass
class LLMBackendConfig:
    """LLM 配置（v8.0.9+ env-only；不再讀 workspace yaml）"""
    default_mode: str = "sampling"  # "sampling" | "api"
    sampling_max_tokens: int = 4096
    api_provider: str = "anthropic"
    api_model: str = "claude-haiku-4-5"
    api_key_env: str = "ANTHROPIC_API_KEY"
    api_base_url: Optional[str] = None
    api_extra_body: Optional[dict] = None  # V90-A-6: passed to ChatOpenAI(extra_body=...)
    per_node_override: dict[str, dict] = field(default_factory=dict)


def _parse_json_env(name: str) -> Optional[dict]:
    """V90-A-6: 解析 env 內的 JSON 字串；缺 / parse 失敗 → None"""
    raw = os.environ.get(name)
    if not raw:
        return None
    try:
        import json
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, ValueError):
        return None


def load_llm_backend_config(workspace_name: Optional[str] = None) -> LLMBackendConfig:
    """全 env-only 讀取（V90-A-3 / V90-A-6 加 extra_body）；workspace_name 參數保留 API 兼容。

    所有配置從 os.environ 取；缺 → 使用 LLMBackendConfig dataclass 預設。
    """
    return LLMBackendConfig(
        default_mode=os.environ.get("LLM_API_DEFAULT_MODE", "sampling"),
        sampling_max_tokens=int(os.environ.get("LLM_SAMPLING_MAX_TOKENS", "4096")),
        api_provider=os.environ.get("LLM_API_PROVIDER", "anthropic"),
        api_model=os.environ.get("LLM_API_MODEL", "claude-haiku-4-5"),
        api_key_env=os.environ.get("LLM_API_KEY_ENV", "ANTHROPIC_API_KEY"),
        api_base_url=os.environ.get("LLM_API_BASE_URL") or None,
        api_extra_body=_parse_json_env("LLM_API_EXTRA_BODY"),  # V90-A-6
        per_node_override={},
    )


# ============================================================
# Sampling LLM (Mode A; default)
# ============================================================


class SamplingChatModel(BaseChatModel):
    """LangChain BaseChatModel 兼容；透過 MCP sampling 反向呼 harness 視窗 LLM。

    用法：
        llm = SamplingChatModel(max_tokens=4096)
        result = await llm.ainvoke([SystemMessage("..."), HumanMessage("...")])
    """

    max_tokens: int = 4096
    model_id: str = "harness-window-llm"
    temperature: float = 0.7

    @property
    def _llm_type(self) -> str:
        return "mcp-sampling"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """同步 fallback；推薦用 _agenerate"""
        import asyncio

        return asyncio.get_event_loop().run_until_complete(
            self._agenerate(messages, stop, run_manager, **kwargs)
        )

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """非同步生成；走 MCP sampling/createMessage"""
        session = get_mcp_session()
        if session is None:
            raise RuntimeError(
                "SamplingChatModel: 無 MCP session（contextvar 未設）；"
                "確認 dispatch handler 已 set_mcp_session()"
            )

        # 轉 messages 為 MCP sampling 格式
        mcp_messages = []
        system_prompt: Optional[str] = None
        for msg in messages:
            if isinstance(msg, SystemMessage):
                # MCP sampling 把 system 放 systemPrompt 欄位
                system_prompt = msg.content if isinstance(msg.content, str) else str(msg.content)
                continue
            role = "user" if isinstance(msg, HumanMessage) else "assistant"
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            mcp_messages.append(
                {
                    "role": role,
                    "content": {"type": "text", "text": content},
                }
            )

        # 呼 MCP sampling
        try:
            result = await session.create_message(
                messages=mcp_messages,
                max_tokens=self.max_tokens,
                system_prompt=system_prompt,
                temperature=self.temperature,
            )
        except Exception as e:
            raise RuntimeError(f"MCP sampling failed: {e}") from e

        # 抽 result.content
        text = ""
        if hasattr(result, "content"):
            content = result.content
            if isinstance(content, str):
                text = content
            elif isinstance(content, list) and content:
                # 取第一個 text content
                for c in content:
                    if hasattr(c, "text"):
                        text = c.text
                        break
                    elif isinstance(c, dict) and c.get("type") == "text":
                        text = c.get("text", "")
                        break
            elif isinstance(content, dict):
                text = content.get("text", "")

        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content=text))]
        )


# ============================================================
# API LLM (Mode B; optional)
# ============================================================


def build_api_llm(
    provider: str,
    model: str,
    api_key_env: str = "",
    base_url: Optional[str] = None,
    extra_body: Optional[dict] = None,
) -> BaseChatModel:
    """依 provider 建 ChatModel（lazy import；只裝實際用到的）

    V90-A-1: base_url 參數讓內部 OpenAI-compatible API gateway 可指定 endpoint。
    V90-A-6: extra_body 參數 passed to ChatOpenAI (Qwen3 disable thinking 等)。
    優先序：傳入參數 > env > provider 預設。
    """
    if provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as e:
            raise ImportError(
                f"langchain-anthropic 未安裝；pip install langchain-anthropic（或改 provider）"
            ) from e
        api_key = os.environ.get(api_key_env) if api_key_env else None
        kwargs: dict = {"model": model}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        # Anthropic 不支援 OpenAI extra_body；忽略
        return ChatAnthropic(**kwargs)

    if provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as e:
            raise ImportError(f"langchain-openai 未安裝；pip install langchain-openai") from e
        api_key = os.environ.get(api_key_env) if api_key_env else None
        kwargs = {"model": model}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        if extra_body:
            kwargs["extra_body"] = extra_body  # V90-A-6
        return ChatOpenAI(**kwargs)

    if provider == "ollama":
        try:
            from langchain_ollama import ChatOllama
        except ImportError as e:
            raise ImportError(f"langchain-ollama 未安裝；pip install langchain-ollama") from e
        kwargs = {"model": model}
        if base_url:
            kwargs["base_url"] = base_url
        return ChatOllama(**kwargs)

    if provider == "qwen":
        # qwen 用 OpenAI 相容介面
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as e:
            raise ImportError(f"langchain-openai 未安裝（qwen 用 OpenAI-compat）") from e
        api_key = os.environ.get(api_key_env or "DASHSCOPE_API_KEY")
        url = base_url or os.environ.get("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
        kwargs = {"model": model, "api_key": api_key, "base_url": url}
        if extra_body:
            kwargs["extra_body"] = extra_body  # V90-A-6
        return ChatOpenAI(**kwargs)

    if provider == "custom":
        # V90-A-1: 通用 OpenAI-compat 內部 API gateway（公司私有 LLM 服務）
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as e:
            raise ImportError(f"langchain-openai 未安裝（custom provider 用 OpenAI-compat）") from e
        if not base_url:
            raise ValueError("custom provider 需設 LLM_API_BASE_URL env")
        api_key = os.environ.get(api_key_env) if api_key_env else None
        kwargs = {"model": model, "base_url": base_url}
        if api_key:
            kwargs["api_key"] = api_key
        if extra_body:
            kwargs["extra_body"] = extra_body  # V90-A-6: Qwen3 disable thinking 等
        return ChatOpenAI(**kwargs)

    raise ValueError(f"Unknown provider: {provider}（支援 anthropic / openai / qwen / ollama / custom）")


# ============================================================
# Public API: get_llm_for_node
# ============================================================


def get_llm_for_node(node_id: str, *, workspace: Optional[str] = None) -> BaseChatModel:
    """取 node 用 LLM；依 workspace LLM_BACKEND config 決定 mode + per-node override。

    Args:
        node_id: 'lead' / 'architect' / 'auditor_dim_6' / ...
        workspace: 預設讀 .agents/CURRENT_WORKSPACE
    """
    cfg = load_llm_backend_config(workspace)

    # per-node override
    override = cfg.per_node_override.get(node_id, {})
    mode = override.get("mode", cfg.default_mode)

    if mode == "sampling":
        return SamplingChatModel(
            max_tokens=override.get("max_tokens", cfg.sampling_max_tokens),
            temperature=override.get("temperature", 0.7),
        )

    if mode == "api":
        provider = override.get("provider", cfg.api_provider)
        model = override.get("model", cfg.api_model)
        api_key_env = override.get("api_key_env", cfg.api_key_env)
        base_url = override.get("base_url", cfg.api_base_url)
        # V90-A-6: extra_body 同 cfg / per-node override 取
        extra_body = override.get("extra_body", cfg.api_extra_body)
        return build_api_llm(provider, model, api_key_env, base_url=base_url, extra_body=extra_body)

    raise ValueError(f"Unknown LLM mode: {mode}")
