#!/usr/bin/env python3
"""rule-token-budget-validator.py — Port of rule-token-budget-validator.mjs (PROPOSAL_502_027 Sprint B).

偵測 rules/*.md 是否超過 token 預算門檻。
依 PROPOSAL_20260424_020 Phase F；PROPOSAL_20260501_003 + ADR-0038 升級為 tier-based。

估算公式：bytes × 0.6 / 4（中英混合，與 schema-validator 對齊）

Tier-based budget（ADR-0038）：
  meta:                 warn=500   block=1000
  worker:               warn=1500  block=2500
  orchestrator:         warn=1800  block=3000
  central_orchestrator: warn=2500  block=3500
  iron_theme:           warn=600   block=1000

使用：python3 .agents/tests/rule-token-budget-validator.py [--verbose]

退出碼：
  0 = 全部通過（所有 rules ≤ warn）
  1 = warning（任一 rule 超 warn；不阻斷 commit）
  2 = error（任一 rule 超 block；阻斷 commit）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent
RULES_DIR = AGENTS_ROOT / "rules"
IRON_RULES_DIR = AGENTS_ROOT / "iron-rules"
THRESHOLDS_PATH = AGENTS_ROOT / "SYSTEM_THRESHOLDS.yaml"
KNOWN_ISSUES_PATH = AGENTS_ROOT / "KNOWN_ISSUES.md"

verbose = "--verbose" in sys.argv

TIER_BUDGETS = {
    "meta":                 {"warn": 500,  "block": 1000},
    "worker":               {"warn": 1500, "block": 2500},
    "orchestrator":         {"warn": 1800, "block": 3000},
    "central_orchestrator": {"warn": 2500, "block": 3500},
    "iron_theme":           {"warn": 600,  "block": 1000},
}


def estimate_tokens(text: str) -> int:
    """bytes × 0.6 / 4（與 schema-validator 統一；單一 SoT）。"""
    n_bytes = len(text.encode("utf-8"))
    return round(n_bytes * 0.6 / 4)


def load_ki_allowlist():
    fallback = ["iron-rules/data-deletion-zero-tolerance.md"]
    if not KNOWN_ISSUES_PATH.exists():
        return fallback
    text = KNOWN_ISSUES_PATH.read_text(encoding="utf-8")
    ki001_line = None
    for line in text.split("\n"):
        if re.match(r"^\|\s*KI-001\s*\|", line):
            ki001_line = line
            break
    if not ki001_line:
        return fallback
    m = re.search(r"`([^`]+\.md)`", ki001_line)
    return [m.group(1)] if m else fallback


def load_thresholds():
    """Parse SYSTEM_THRESHOLDS.yaml rule_token_thresholds block."""
    fallback = {"warn": 3000, "block": 4000, "target_max": 4000, "exempt_files": []}
    if not THRESHOLDS_PATH.exists():
        return fallback
    text = THRESHOLDS_PATH.read_text(encoding="utf-8")
    block_match = re.search(r"rule_token_thresholds:\s*\n((?:\s+.+\n?)+)", text)
    if not block_match:
        return fallback
    cfg = {"warn": 3000, "block": 4000, "target_max": 4000, "exempt_files": []}
    in_exempt_list = False
    for line in block_match.group(1).split("\n"):
        list_item = re.match(r"^\s+-\s*(.+?)\s*(?:#.*)?$", line)
        if in_exempt_list and list_item:
            cfg["exempt_files"].append(list_item.group(1).strip())
            continue
        m = re.match(r"^(\w+):\s*(.*?)\s*(#.*)?$", line.strip())
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        in_exempt_list = False
        if key in ("warn", "block", "target_max"):
            try:
                cfg[key] = int(val)
            except ValueError:
                pass
        elif key == "exempt_files":
            if val and val.startswith("["):
                inner = val.strip("[]").split(",")
                cfg["exempt_files"] = [s.strip() for s in inner if s.strip()]
            else:
                in_exempt_list = True
    return cfg


def main():
    print("🔍 Running rule-token-budget-validator (ADR-0038 tier-based)")

    if not RULES_DIR.exists():
        print(f"❌ rules/ 目錄不存在：{RULES_DIR}", file=sys.stderr)
        sys.exit(2)

    cfg_fallback = load_thresholds()
    if verbose:
        print("ℹ️  ADR-0038 tier budgets: meta=500/1000  worker=1500/2500  orchestrator=1800/3000  iron_theme=300/500")

    ki_allowlist = load_ki_allowlist()
    if verbose and ki_allowlist:
        print(f"ℹ️  KI allowlist: {', '.join(ki_allowlist)}")

    rules = sorted([f.name for f in RULES_DIR.iterdir() if f.suffix == ".md"])
    iron_themes = []
    if IRON_RULES_DIR.exists():
        iron_themes = sorted([
            f.name for f in IRON_RULES_DIR.iterdir()
            if f.suffix == ".md" and f.name != "README.md"
        ])

    errors = 0
    warnings = 0
    total = 0
    results = []

    def check_file(directory: Path, filename: str, tier_override: str | None = None):
        nonlocal errors, warnings, total
        if filename in cfg_fallback["exempt_files"]:
            if verbose:
                print(f"ℹ️  (exempt) {filename}")
            return
        text = (directory / filename).read_text(encoding="utf-8")
        fm = parse_frontmatter(text) or {}
        cat = tier_override or fm.get("rule_category")
        if not cat:
            print(f"❌ {filename}: 缺 rule_category 欄位（ADR-0038 必填）", file=sys.stderr)
            errors += 1
            return
        budget = TIER_BUDGETS.get(cat)
        if not budget:
            print(f'❌ {filename}: rule_category="{cat}" 不合法（合法：meta/worker/orchestrator/iron_theme）', file=sys.stderr)
            errors += 1
            return
        tokens = estimate_tokens(text)
        total += tokens
        status = "✅"
        rel_path = f"{directory.name}/{filename}"
        is_ki = rel_path in ki_allowlist
        if tokens > budget["block"]:
            print(
                f"❌ [BLOCK] {rel_path}: {tokens} tokens > {cat} block {budget['block']} → 必先立案拆檔（rule_edit_critical）",
                file=sys.stderr,
            )
            errors += 1
            status = "🔴"
        elif tokens > budget["warn"]:
            if is_ki:
                print(
                    f"ℹ️  [KI] {rel_path}: {tokens} tokens > {cat} warn {budget['warn']}（已知接受；KNOWN_ISSUES.md 追蹤）"
                )
                status = "🟢"
            else:
                print(
                    f"⚠️  [WARN]  {rel_path}: {tokens} tokens > {cat} warn {budget['warn']} → 建議立案拆檔（rule_edit_large）"
                )
                warnings += 1
                status = "🟡"
        elif verbose:
            print(f"ℹ️  {filename} ({cat}): {tokens}/{budget['warn']} tokens ✅")
        results.append({"file": filename, "tokens": tokens, "status": status, "cat": cat})

    for f in rules:
        check_file(RULES_DIR, f)
    for f in iron_themes:
        check_file(IRON_RULES_DIR, f, "iron_theme")

    print("")
    print(
        f"Summary: {len(rules)} rules + {len(iron_themes)} iron-themes; total ~{total} tokens; errors={errors}, warnings={warnings}"
    )
    if verbose or errors + warnings > 0:
        print("")
        print("Top 5 largest:")
        for r in sorted(results, key=lambda x: -x["tokens"])[:5]:
            print(f"  {r['status']} {r['file']} ({r['cat']}): {r['tokens']} tokens")

    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
