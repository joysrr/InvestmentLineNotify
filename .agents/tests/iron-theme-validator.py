#!/usr/bin/env python3
"""iron-theme-validator.py — Port (PROPOSAL_502_027)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa

AGENTS_ROOT = SCRIPT_DIR.parent
RULES_DIR = AGENTS_ROOT / "rules"
IRON_RULES_DIR = AGENTS_ROOT / "iron-rules"

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
    print(f"ℹ️  {msg}")


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


def load_rule(p: Path) -> dict:
    content = p.read_text(encoding="utf-8")
    fm = parse_frontmatter(content) or {}
    return {
        "path": p,
        "agentId": fm.get("agent_id"),
        "themes": parse_multiline_list(content, "applies_iron_themes"),
        "content": content,
    }


def load_iron_theme(p: Path) -> dict:
    content = p.read_text(encoding="utf-8")
    fm = parse_frontmatter(content) or {}
    return {
        "path": p,
        "themeId": fm.get("theme_id"),
        "fileType": fm.get("file_type"),
        "immutable": fm.get("immutable") in ("true", True),
        "appliesTo": parse_multiline_list(content, "applies_to"),
        "content": content,
    }


def main():
    print("🔍 Iron Theme Validator (PROPOSAL_20260501_002 + ADR-0037; Python port)\n")
    if not IRON_RULES_DIR.is_dir():
        err(f"iron-rules/ 目錄不存在: {IRON_RULES_DIR}")
        sys.exit(2)

    theme_files = [f for f in IRON_RULES_DIR.iterdir() if f.suffix == ".md" and f.name != "README.md"]
    themes = [load_iron_theme(f) for f in theme_files]
    info(f"載入 {len(themes)} 個 iron themes")

    for t in themes:
        if not t["themeId"]:
            err(f"{t['path']}: 缺 theme_id")
        if t["fileType"] != "iron_theme":
            err(f"{t['path']}: file_type 應為 iron_theme（實際: {t['fileType']}）")
        if not t["immutable"]:
            warn(f"{t['path']}: immutable 應為 true")
        if not t["appliesTo"]:
            err(f"{t['path']}: applies_to 為空")

    rule_files = [f for f in RULES_DIR.iterdir() if f.suffix == ".md"]
    rules = [load_rule(f) for f in rule_files]
    info(f"載入 {len(rules)} 個 rules")

    print("\n📋 雙向一致性檢查")

    for t in themes:
        for agent_id in t["appliesTo"]:
            rule = next((r for r in rules if r["agentId"] == agent_id), None)
            if not rule:
                err(f"Theme {t['themeId']} applies_to {agent_id}，但無對應 rules/{agent_id}.md")
                continue
            if t["themeId"] not in rule["themes"]:
                err(f"Theme {t['themeId']} applies_to {agent_id}，但 rule {rule['path']} 未列 {t['themeId']}")

    for r in rules:
        for theme_id in r["themes"]:
            theme = next((t for t in themes if t["themeId"] == theme_id), None)
            if not theme:
                err(f"Rule {r['path']} 引用 iron theme {theme_id}，但 iron-rules/{theme_id}.md 不存在")
                continue
            if r["agentId"] not in theme["appliesTo"]:
                err(f"Rule {r['path']} (agent_id={r['agentId']}) 引用 {theme_id}，但 theme applies_to 未列 {r['agentId']}")

    print("\n─────────────────────────────")
    print(f"Summary: {errors} errors, {warnings} warnings")
    if errors == 0 and warnings == 0:
        print("✅ Iron Theme Validator: 全 PASS（雙向一致 + schema 完整）")
    print("─────────────────────────────")
    sys.exit(2 if errors > 0 else 1 if warnings > 0 else 0)


if __name__ == "__main__":
    main()
