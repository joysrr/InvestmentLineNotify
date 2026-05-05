#!/usr/bin/env python3
"""routing-ticket-validator.py — Port of routing-ticket-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證專案根層 ROUTING_TICKET.md 的 schema 完整性 + Lane/Model 對應一致性。
依 PROPOSAL_20260424_023 Phase E。

使用：python3 .agents/tests/routing-ticket-validator.py [--verbose]

退出碼：
  0 = 通過（ticket 缺失或合法）
  1 = warnings（schema_version 缺 / hotfix 欄位部分缺）
  2 = errors（必填欄位缺 / Lane↔Model 不對應 / hotfix.enabled=true 但 sc_evaluation 缺）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = AGENTS_ROOT.parent
TICKET_PATH = PROJECT_ROOT / "ROUTING_TICKET.md"

verbose = "--verbose" in sys.argv
errors = 0
warnings = 0


def err(msg):
    global errors
    print(f"❌ [ERROR] {msg}", file=sys.stderr)
    errors += 1


def warn(msg):
    global warnings
    print(f"⚠️  [WARN]  {msg}")
    warnings += 1


def info(msg):
    if verbose:
        print(f"ℹ️  {msg}")


REQUIRED_TOP = [
    "schema_version", "ticket_id", "created_at", "created_by", "status",
    "original_request", "assigned_lane", "model_tier", "complexity_tier", "tier_reason",
    "target_agent", "sibling_agents", "touched_files", "artifact_paths", "tech_stacks",
]

VALID_PAIRS = {
    "fast": ["haiku"],
    "standard": ["sonnet"],
    "heavy": ["opus"],
}


def has_hotfix_enabled(text: str) -> bool:
    return bool(re.search(r"^hotfix:\s*\n\s+enabled:\s*true", text, re.MULTILINE))


def has_sc_evaluation(text: str) -> bool:
    return "sc_evaluation:" in text


def summary():
    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


def main():
    print("🔍 Running routing-ticket-validator (PROPOSAL_20260424_023 Phase E)")

    if not TICKET_PATH.exists():
        info(f"ROUTING_TICKET.md 不存在於 {TICKET_PATH}（運行時 artifact；非派發中為合法）")
        print("")
        print("Summary: errors=0, warnings=0 (no ticket present)")
        sys.exit(0)

    text = TICKET_PATH.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    if not fm:
        err("ROUTING_TICKET.md 缺 YAML frontmatter（--- 包圍）")
        summary()
        return

    for k in REQUIRED_TOP:
        if k not in fm or fm.get(k) in ("", "[]", None):
            if k not in fm:
                err(f"必填欄位缺失: {k}")
            elif k in ("original_request", "tier_reason", "target_agent", "ticket_id", "created_at") and fm.get(k) == "":
                err(f"必填欄位 {k} 為空字串")

    info(f"schema_version: {fm.get('schema_version', '<missing>')}")
    if fm.get("schema_version") and fm["schema_version"] != "v1":
        warn(f'schema_version "{fm["schema_version"]}" 非 v1（當前 protocol 唯一支援版本）')

    lane = fm.get("assigned_lane")
    model = fm.get("model_tier")
    if lane and model and lane in VALID_PAIRS and model not in VALID_PAIRS[lane]:
        err(
            f"assigned_lane={lane} 與 model_tier={model} 不對應；合法對應 {lane}→{'|'.join(VALID_PAIRS[lane])}"
        )

    valid_status = ["dispatched", "acknowledged", "completed", "cancelled",
                    "paused", "timeout", "retried", "failed"]
    if fm.get("status") and fm["status"] not in valid_status:
        err(f'status="{fm["status"]}" 不在合法值 [{"|".join(valid_status)}]')

    valid_task_class = ["feature", "modify-existing", "doc-sync", "hotfix"]
    if fm.get("task_class") and fm["task_class"] not in valid_task_class:
        err(
            f'task_class="{fm["task_class"]}" 不在合法值 [{"|".join(valid_task_class)}]；對應 lead.md §s05 任務分類例外'
        )

    valid_memory_mode = ["mcp", "filesystem_fallback"]
    if fm.get("memory_mode") and fm["memory_mode"] not in valid_memory_mode:
        err(
            f'memory_mode="{fm["memory_mode"]}" 不在合法值 [{"|".join(valid_memory_mode)}]；ADR-0039 hybrid fallback 規範'
        )

    if has_hotfix_enabled(text) and not has_sc_evaluation(text):
        err("hotfix.enabled=true 但缺 sc_evaluation 區塊")

    summary()


if __name__ == "__main__":
    main()
