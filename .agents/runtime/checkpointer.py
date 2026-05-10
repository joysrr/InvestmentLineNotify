"""
checkpointer.py — checkpointer wrapper (PROPOSAL_502_050 F-5 + 502_058 V86-A-1)

LangGraph 1.x 持久化；本機 SQLite (~/.langgraph/checkpoints.db)。
v8.0.6 (V86-A-1)：偵測 fs 不可用（Web harness）自動退化 InMemorySaver。
未來 Phase 3 評估 AsyncPostgresSaver 雲端部署 (KI-008/009 解)。
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncContextManager

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver


def _fs_writable(path: Path) -> bool:
    """偵測 path 父目錄可寫；用於判斷是否退化 InMemorySaver"""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # touch test file
        probe = path.parent / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except (OSError, PermissionError):
        return False


def get_checkpoint_path() -> Path | None:
    """checkpoint DB 路徑；env LANGGRAPH_CHECKPOINT_PATH override；
    fs 不可寫或 LANGGRAPH_INMEMORY=1 → 回 None 觸發 InMemorySaver fallback
    """
    if os.environ.get("LANGGRAPH_INMEMORY") == "1":
        return None

    env = os.environ.get("LANGGRAPH_CHECKPOINT_PATH")
    target = Path(env) if env else Path.home() / ".langgraph" / "checkpoints.db"

    if not _fs_writable(target):
        return None  # Web harness fallback
    return target


def make_checkpointer() -> AsyncContextManager:
    """建立 checkpointer context manager（V86-A-1：fs 不可用退化 InMemorySaver）

    用法：
        async with make_checkpointer() as cp:
            graph = build_graph(checkpointer=cp)
            ...

    trade-off：InMemorySaver 不跨 invoke 持久化 thread_id；
    Web harness 因無 home fs 預設用此 mode。
    """
    db_path = get_checkpoint_path()
    if db_path is None:
        @asynccontextmanager
        async def _memory_cm():
            yield InMemorySaver()
        return _memory_cm()
    return AsyncSqliteSaver.from_conn_string(str(db_path))
