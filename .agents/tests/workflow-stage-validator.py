#!/usr/bin/env python3
"""workflow-stage-validator.py — Port of workflow-stage-validator.mjs (PROPOSAL_502_027)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RULES_DIR = SCRIPT_DIR.parent / "rules"

VALID_STAGES = {
    "requirement", "strategy_review", "strategic_review", "design", "prior_art",
    "test_spec", "implementation", "self_audit", "review", "security_review",
    "verification", "convergence", "evolution", "phase_e",
    "audit", "patrol", "monitoring_all", "coordination_all",
}


def parse_frontmatter(content: str) -> dict:
    fm_match = re.match(r"^---\n([\s\S]*?)\n---", content)
    if not fm_match:
        return {}
    fm = fm_match.group(1)
    result = {}
    stages = re.search(r"^workflow_stages:\s*\[(.+?)\]", fm, re.MULTILINE)
    if stages:
        result["workflow_stages"] = [
            s.strip().strip("'").strip('"') for s in stages.group(1).split(",")
        ]
    aid = re.search(r"^agent_id:\s*(.+)$", fm, re.MULTILINE)
    if aid:
        result["agent_id"] = aid.group(1).strip()
    return result


def main():
    print("🔍 Workflow Stage Validator (PROPOSAL_502_023 Sprint C-1; Python port)")
    print()
    print(f"ℹ️  Valid stages: {len(VALID_STAGES)}")
    print()

    errors = 0
    rule_stages = {}
    for f in sorted(RULES_DIR.glob("*.md")):
        content = f.read_text(encoding="utf-8")
        meta = parse_frontmatter(content)
        if "workflow_stages" not in meta:
            continue
        rule_stages[meta.get("agent_id", f.name)] = meta["workflow_stages"]
        for stage in meta["workflow_stages"]:
            if stage not in VALID_STAGES:
                print(f"❌ {f.name}: workflow_stages 含未定義 stage '{stage}'", file=sys.stderr)
                errors += 1

    claimed = set()
    for stages in rule_stages.values():
        claimed.update(stages)
    orphans = sorted(VALID_STAGES - claimed)
    if orphans:
        print(f"ℹ️  Stages without claiming rule (advisory): {', '.join(orphans)}")

    print()
    print("Rule × Stage matrix:")
    for agent, stages in sorted(rule_stages.items()):
        print(f"  {agent:<15} → {', '.join(stages)}")

    print()
    print("─" * 30)
    if errors == 0:
        print("Summary: 0 errors, 0 warnings")
        print("✅ Workflow Stage Validator: 全 PASS")
    else:
        print(f"Summary: {errors} errors, 0 warnings")
        print("❌ Workflow Stage Validator: FAIL")
    print("─" * 30)
    sys.exit(0 if errors == 0 else 1)


if __name__ == "__main__":
    main()
