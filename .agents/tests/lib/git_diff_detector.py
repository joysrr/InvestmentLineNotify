#!/usr/bin/env python3
"""
git_diff_detector.py — 依 git diff 偵測相關 validators
Python port of git-diff-detector.sh (PROPOSAL_502_025 Sprint B)。

使用方式（CLI）：
    python3 .agents/tests/lib/git_diff_detector.py
    輸出：空格分隔的 validator names

使用方式（import）：
    from git_diff_detector import detect_relevant_validators, ALL_VALIDATORS
"""
import fnmatch
import subprocess
import sys

# 標準 validator 清單（必須與 run-all.py / run-all.sh §Full mode 對齊）
ALL_VALIDATORS = [
    "schema", "intent", "workspace", "drift", "ref", "sync", "loc",
    "index_drift", "proposal_scope", "tech_stack", "rule_token",
    "routing_ticket", "iron_theme", "memory_palace", "sub_agent_dispatch",
    "workflow_stage", "user_execution_language", "root_artifact_pollution",
    "condition_claim", "schema_completeness",  # PROPOSAL_502_047 C-1/C-2 governance meta-validators
]

# 檔案類型 → 觸發 validators 對應規則
# 設計：保守（漏報優於誤報）；未匹配的 .agents/* → 至少跑 sync
_RULES = [
    # (glob pattern, validator names)
    (".agents/rules/*.md", ["schema", "drift", "ref", "sync", "rule_token", "iron_theme"]),
    (".agents/iron-rules/*.md", ["iron_theme", "ref", "sync", "rule_token"]),
    ("ROUTING_TICKET.md", ["routing_ticket"]),
    (".agents/ROUTING_TICKET.md", ["routing_ticket"]),
    (".agents/memory/*", ["memory_palace", "ref", "sync"]),
    (".agents/memory/**", ["memory_palace", "ref", "sync"]),
    (".mcp.json", ["memory_palace", "ref", "sync"]),
    (".agents/skills/memory-*.md", ["memory_palace", "ref", "sync"]),
    (".agents/decisions/0039-*.md", ["memory_palace", "ref", "sync"]),
    (".agents/skills/*.md", ["schema", "ref", "sync", "workspace"]),
    (".agents/skills/**/*.md", ["schema", "ref", "sync", "workspace"]),
    (".agents/tasks/*.md", ["schema", "ref", "sync", "workspace"]),
    (".agents/tech-stacks/MANIFEST.yaml", ["tech_stack", "ref"]),
    (".agents/tech-stacks/*.md", ["schema", "workspace", "tech_stack"]),
    (".agents/tech-stacks/**/*.md", ["schema", "workspace", "tech_stack"]),
    (".agents/proposals/PROPOSAL_INDEX.md", ["intent", "index_drift"]),
    (".agents/proposals/*.md", ["intent", "sync", "index_drift", "proposal_scope"]),
    (".agents/proposals/**/*.md", ["intent", "sync", "index_drift", "proposal_scope"]),
    (".agents/workspaces/*/proposals/**/*.md", ["workspace", "proposal_scope"]),
    (".agents/WORKSPACE_SCHEMA.yaml", ["workspace", "scripts"]),
    (".agents/SYSTEM_THRESHOLDS.yaml", ["sync"]),
    (".agents/scripts/*.mjs", ["scripts"]),
    (".agents/scripts/**/*.py", ["scripts"]),
    (".agents/tests/scripts/*.mjs", ["scripts"]),
    (".agents/tests/scripts/*.sh", ["scripts"]),
    (".agents/tests/scripts/*.py", ["scripts"]),
    (".agents/tests/lib/*.sh", ["scripts"]),
    (".agents/tests/lib/*.py", ["scripts"]),
    (".agents/tests/*.mjs", ["sync"]),
    (".agents/tests/*.sh", ["sync"]),
    (".agents/tests/*.py", ["sync"]),
    (".agents/docs/*.md", ["loc", "sync"]),
    ("docs/*.md", ["loc"]),
    (".agents/RULES_DESIGN_GUIDE.md", ["drift", "sync", "ref"]),
    (".agents/CHANGELOG.md", ["sync", "index_drift"]),
    (".agents/FRAMEWORK_VERSION", ["sync", "index_drift"]),
    (".agents/RULES_VERSION_INDEX.md", ["sync", "index_drift"]),
    (".agents/RULES_METADATA_SCHEMA.md", ["schema", "ref"]),
    (".agents/CURRENT_WORKSPACE", ["workspace"]),
    (".agents/workspaces/*.md", ["workspace"]),
    (".agents/workspaces/**/*.md", ["workspace"]),
    (".agents/domains/*.md", ["ref"]),
]


def _matches(path: str, pattern: str) -> bool:
    if "**" in pattern:
        return fnmatch.fnmatchcase(path, pattern.replace("**", "*"))
    return fnmatch.fnmatchcase(path, pattern)


def detect_relevant_validators() -> list[str]:
    # staged 優先；fallback working tree
    files = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True, text=True,
    ).stdout.strip()
    if not files:
        files = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True, text=True,
        ).stdout.strip()

    if not files:
        return ALL_VALIDATORS + ["scripts"]

    needed = set()
    has_unknown = False

    for f in files.splitlines():
        if not f:
            continue
        matched = False
        for pat, validators in _RULES:
            if _matches(f, pat):
                needed.update(validators)
                matched = True
                break
        if matched:
            continue
        # 未匹配的 .agents/* → 保守加 sync
        if f.startswith(".agents/"):
            needed.add("sync")
            has_unknown = True
        # 非 .agents/* （src/ 等業務檔）→ 跳過

    if has_unknown:
        needed.add("schema")

    return sorted(needed)


if __name__ == "__main__":
    print(" ".join(detect_relevant_validators()))
