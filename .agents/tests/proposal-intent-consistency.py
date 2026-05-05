#!/usr/bin/env python3
"""proposal-intent-consistency.py — Port of proposal-intent-consistency.mjs (PROPOSAL_502_027)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
INDEX_FILE = SCRIPT_DIR.parent / "proposals" / "PROPOSAL_INDEX.md"
COMPLETED_DIR = SCRIPT_DIR.parent / "proposals" / "completed"


def load_inheritance_table(content: str) -> list[dict]:
    section_match = re.search(r"## 🔗 提案意圖繼承關係[\s\S]*?(?=##\s|$)", content)
    if not section_match:
        return []
    rows = re.findall(r"\| PROPOSAL_\w+[\s\S]*?\|", section_match.group(0))
    out = []
    for r in rows:
        cells = [c.strip() for c in r.split("|") if c.strip()]
        if len(cells) >= 3:
            out.append({"historical": cells[0], "original_intent": cells[1], "inheritor": cells[2]})
    return out


def scan_completed():
    if not COMPLETED_DIR.is_dir():
        return []
    return [
        {"id": f.stem, "path": f}
        for f in COMPLETED_DIR.iterdir()
        if f.name.startswith("PROPOSAL_") and f.suffix == ".md"
    ]


def main():
    print("🔍 Proposal Intent Consistency Check\n")
    if not INDEX_FILE.is_file():
        print("❌ PROPOSAL_INDEX.md not found", file=sys.stderr)
        sys.exit(2)

    index_content = INDEX_FILE.read_text(encoding="utf-8")
    table = load_inheritance_table(index_content)
    print(f"📋 Inheritance entries: {len(table)}")
    for e in table:
        print(f"   - {e['historical']} → {e['inheritor']}")

    proposals = scan_completed()
    print(f"\n📂 Completed proposals: {len(proposals)}")

    warnings = 0
    for p in proposals:
        content = p["path"].read_text(encoding="utf-8")
        overtones = re.findall(r"(推翻|取代|廢除)\s*PROPOSAL[-_]\d+", content)
        if overtones:
            listed = any(p["id"] in (e["historical"] or "") for e in table)
            if not listed:
                print(f"⚠️  {p['id']} 提及推翻歷史提案但未在 §🔗 繼承表註冊", file=sys.stderr)
                warnings += 1

    print(f"\n─────────────────────────────")
    print(f"Summary: {warnings} warnings")
    print(f"─────────────────────────────")
    sys.exit(1 if warnings > 0 else 0)


if __name__ == "__main__":
    main()
