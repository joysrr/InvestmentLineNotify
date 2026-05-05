#!/usr/bin/env python3
"""rule_loader.py — Rule + Iron Themes loader (Port of rule-loader.mjs; PROPOSAL_502_027)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(AGENTS_ROOT / "tests" / "lib"))
from frontmatter import parse_frontmatter  # noqa

RULES_DIR = AGENTS_ROOT / "rules"
IRON_RULES_DIR = AGENTS_ROOT / "iron-rules"


def estimate_tokens(content: str) -> int:
    return round(len(content.encode("utf-8")) * 0.6 / 4)


def parse_multiline_list(content: str, key: str) -> list[str]:
    pattern = rf"^{re.escape(key)}:\s*\n((?:\s+-\s+\S.*\n?)+)"
    m = re.search(pattern, content, re.MULTILINE)
    if not m:
        return []
    out = []
    for line in m.group(1).split("\n"):
        item = re.match(r"^\s+-\s+(.+?)$", line)
        if item:
            v = item.group(1).strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            out.append(v)
    return out


def load_rule(agent_id: str) -> dict:
    path = RULES_DIR / f"{agent_id}.md"
    if not path.is_file():
        raise FileNotFoundError(f"Rule not found: rules/{agent_id}.md")
    content = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(content) or {}
    return {
        "agentId": fm.get("agent_id") or agent_id,
        "path": path,
        "content": content,
        "fm": fm,
        "themeIds": parse_multiline_list(content, "applies_iron_themes"),
    }


def load_iron_theme(theme_id: str) -> dict:
    path = IRON_RULES_DIR / f"{theme_id}.md"
    if not path.is_file():
        raise FileNotFoundError(f"Iron theme not found: iron-rules/{theme_id}.md")
    content = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(content) or {}
    return {"themeId": fm.get("theme_id") or theme_id, "path": path, "content": content, "fm": fm}


def load_rule_with_themes(agent_id: str) -> dict:
    rule = load_rule(agent_id)
    themes = [load_iron_theme(t) for t in rule["themeIds"]]
    parts = [rule["content"]]
    for t in themes:
        parts.append(f"\n\n<!-- IRON_THEME: {t['themeId']} -->\n{t['content']}")
    total_context = "".join(parts)
    return {
        "rule": rule,
        "themes": themes,
        "totalContext": total_context,
        "totalTokens": estimate_tokens(total_context),
    }


def find_rules_by_theme(theme_id: str) -> list[dict]:
    out = []
    for f in RULES_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8")
        if theme_id in parse_multiline_list(content, "applies_iron_themes"):
            fm = parse_frontmatter(content) or {}
            out.append({"agentId": fm.get("agent_id"), "path": f})
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 rule_loader.py <agent_id>", file=sys.stderr)
        print("Example: python3 rule_loader.py reviewer", file=sys.stderr)
        sys.exit(1)
    result = load_rule_with_themes(sys.argv[1])
    print(f"Rule: {result['rule']['path']}")
    print(f"Themes ({len(result['themes'])}):")
    for t in result["themes"]:
        print(f"  - {t['themeId']} ({t['path']})")
    print(f"Total tokens: {result['totalTokens']}")
    print("---")
    print("Context preview (first 500 chars):")
    print(result["totalContext"][:500])
