#!/usr/bin/env python3
"""schema-validator.py — Port of schema-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證 rules frontmatter + XML section 合規性。
依 PROPOSAL_20260422_009 + 014 建立；Python port 維持 functional parity。

使用：python3 .agents/tests/schema-validator.py [--strict] [--file <path>]

退出碼：
  0 = 全部通過
  1 = warnings only
  2 = errors
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa: E402

RULES_DIR = SCRIPT_DIR.parent / "rules"

REQUIRED_FRONTMATTER = [
    "agent_id", "agent_name", "file_type", "version",
    "last_modified", "last_proposal", "audit_baseline", "trigger",
]

# PROPOSAL_20260501_003 + ADR-0038：Tier-based budget
TIER_BUDGETS = {
    "meta":                 {"warn": 500,  "block": 1000},
    "worker":               {"warn": 1500, "block": 2500},
    "orchestrator":         {"warn": 1800, "block": 3000},
    "central_orchestrator": {"warn": 2500, "block": 3500},
}
DESIGN_GUIDE_BUDGET = {"warn": 3000, "block": 6000}

errors = 0
warnings = 0


def estimate_tokens(content: str) -> int:
    """中英混合估算：bytes × 0.6 / 4。"""
    n_bytes = len(content.encode("utf-8"))
    return round(n_bytes * 0.6 / 4)


def validate_sections(content: str):
    global errors
    sections = re.findall(r'<section id="[^"]+" priority="[^"]+"', content)
    ids = [re.search(r'id="([^"]+)"', s).group(1) for s in sections]
    duplicates = [x for i, x in enumerate(ids) if ids.index(x) != i]
    if duplicates:
        unique_dups = list(dict.fromkeys(duplicates))
        print(f"  ❌ Duplicate section ids: {', '.join(unique_dups)}", file=sys.stderr)
        errors += 1
    return {"count": len(sections), "duplicates": duplicates}


def validate_file(file_path: Path):
    global errors, warnings
    content = file_path.read_text(encoding="utf-8")
    file_name = file_path.name
    print(f"\n📄 Validating: {file_name}")

    fm = parse_frontmatter(content)
    if not fm:
        print("  ❌ Missing YAML frontmatter", file=sys.stderr)
        errors += 1
        return

    missing = [k for k in REQUIRED_FRONTMATTER if not fm.get(k)]
    if missing:
        print(f"  ❌ Missing required fields: {', '.join(missing)}", file=sys.stderr)
        errors += 1

    tokens = estimate_tokens(content)
    if fm.get("file_type") == "design_guide":
        budget = DESIGN_GUIDE_BUDGET
        tier_name = "design_guide"
    else:
        cat = fm.get("rule_category")
        if not cat:
            print("  ❌ Missing required field: rule_category（ADR-0038 必填；meta/worker/orchestrator/central_orchestrator）", file=sys.stderr)
            errors += 1
            return
        if cat not in TIER_BUDGETS:
            print(f'  ❌ Invalid rule_category: "{cat}"（合法值：meta / worker / orchestrator / central_orchestrator）', file=sys.stderr)
            errors += 1
            return
        budget = TIER_BUDGETS[cat]
        tier_name = cat

    pct = round(tokens / budget["warn"] * 100)
    if tokens > budget["block"]:
        print(f"  ❌ Token estimate {tokens} exceeds BLOCK {budget['block']} ({tier_name} tier; pct={pct}%)", file=sys.stderr)
        errors += 1
    elif tokens > budget["warn"]:
        print(f"  ⚠️  Token estimate {tokens} exceeds WARN {budget['warn']} ({tier_name} tier; pct={pct}%)")
        warnings += 1
    else:
        print(f"  ✅ Token: {tokens} / {budget['warn']} ({tier_name} tier; {pct}%)")

    if fm.get("file_type") != "always_on":
        result = validate_sections(content)
        if result["count"] == 0:
            print("  ❌ No <section> tags found (required for non-AlwaysOn)", file=sys.stderr)
            errors += 1
        else:
            print(f"  ✅ Sections: {result['count']} (no duplicates)")

    if fm.get("file_type") != "always_on":
        if not re.search(r"\*\*\*\n版本：v\d+\.\d+", content):
            print("  ⚠️  Missing body version header")
            warnings += 1


def main():
    args = sys.argv[1:]
    target_file = None
    if "--file" in args:
        idx = args.index("--file")
        if idx + 1 < len(args):
            target_file = args[idx + 1]

    print("🔍 Schema Validator (PROPOSAL_20260422_009)\n")

    if target_file:
        validate_file(Path(target_file))
    else:
        files = sorted([f for f in RULES_DIR.iterdir() if f.suffix == ".md"])
        for f in files:
            validate_file(f)

    print("\n─────────────────────────────")
    print(f"Summary: {errors} errors, {warnings} warnings")
    print("─────────────────────────────")
    sys.exit(2 if errors > 0 else 1 if warnings > 0 else 0)


if __name__ == "__main__":
    main()
