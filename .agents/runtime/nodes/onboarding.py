"""@Onboarding 專屬 sub-flow node (PROPOSAL_502_053 H-3；解 V8-B-5)

對齊 v7.22 agent-driven-onboarding §2 Step 1-Step 4.6：
- Step 1 Detect (auto-detect tech stacks via Bash + 結構訊號)
- Step 2 Plan
- Step 3 multi-choice
- Step 4 Activate + Validate (寫 workspace.md / CURRENT_WORKSPACE)
- Step 4.5 mempalace add_drawer wing index
- Step 4.6 GitNexus optional prompt
"""
from __future__ import annotations

from typing import Any

from ..state import WorkflowState
from ._base import append_decision, call_agent_llm


async def onboarding_node(state: WorkflowState) -> dict[str, Any]:
    """v8.0.1 H-3：v7.22 agent-driven-onboarding 整合 LangGraph"""
    extra = (
        "## 任務：onboarding 新 codebase（v7.22 agent-driven-onboarding §2 Step 1-4.6）\n\n"
        "依下面 6 步驟產出 onboarding artifacts:\n"
        "1. **Step 1 Detect**: auto-detect tech stacks（gitignore / package.json / requirements.txt / Cargo.toml 等）→ 列偵測結果\n"
        "2. **Step 2 Plan**: 產 Detection Report 摘要\n"
        "3. **Step 3 Multi-choice**: 列 user 應決策的 ≤3 題（workspace 名 / domains / RUNTIME_CONTEXT）\n"
        "4. **Step 4 Activate**: 寫 workspace.md（含 GITNEXUS_INTEGRATION 占位 by PROPOSAL_502_038）+ CURRENT_WORKSPACE\n"
        "5. **Step 4.5 mempalace wing**: add_drawer wing=<project> room=index 索引（PROPOSAL_502_035 主題 5 G-D4）；polyglot 同 root 多 manifest 加 sub-room（PROPOSAL_502_041 R3-E1）\n"
        "6. **Step 4.6 GitNexus optional**: 提示 user `gitnexus analyze .`（標 optional: true；P-32 偵測 → 🟢 不阻斷）\n\n"
        '回 JSON: {"detected_stacks": [...], "workspace_name": "...", "submodules": [...], '
        '"wing_drawers_to_add": [{"wing": "...", "room": "...", "tags": [...]}], '
        '"gitnexus_optional_prompt": "..."}'
    )

    response = await call_agent_llm(state, "architect", extra_system=extra)

    return {
        **append_decision(
            state, "@Architect", "onboarding_complete",
            workspace_setup=True, summary=response[:300],
        ),
        "status": "completed",
    }
