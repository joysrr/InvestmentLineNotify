#!/usr/bin/env python3
"""gen-adr-index.py — Port of gen-adr-index.mjs (PROPOSAL_502_027 Sprint C).

自動維護 decisions/README.md 索引表（依 PROPOSAL_20260423_016 Batch 1 建立）。

使用：
  python3 .agents/scripts/generators/gen-adr-index.py           # dry-run
  python3 .agents/scripts/generators/gen-adr-index.py --write   # 實寫 AUTO-GENERATED 區塊
  python3 .agents/scripts/generators/gen-adr-index.py --check   # 比對 drift

退出碼：
  0 = 成功
  1 = drift（--check 模式）
  2 = 結構錯誤
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from auto_generated_block import has_block, replace_block, check_drift  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent.parent
DECISIONS_DIR = AGENTS_ROOT / "decisions"
INDEX_PATH = DECISIONS_DIR / "README.md"

BLOCK_NAME = "adr_list"


def parse_adr_frontmatter(content: str) -> dict | None:
    fm = re.match(r"^---\n([\s\S]*?)\n---", content)
    if not fm:
        return None
    body = fm.group(1)

    def get(key: str) -> str | None:
        m = re.search(rf"^{key}:\s*(.+?)$", body, re.MULTILINE)
        if not m:
            return None
        v = m.group(1).strip()
        # 去頭尾引號
        if (v.startswith('"') and v.endswith('"')) or (
            v.startswith("'") and v.endswith("'")
        ):
            v = v[1:-1]
        return v

    def parse_list(key: str) -> list[str]:
        # inline list [a, b, c]
        m = re.search(rf"^{key}:\s*\[(.*?)\]", body, re.MULTILINE)
        if m and m.group(1).strip():
            items = []
            for s in m.group(1).split(","):
                s = s.strip()
                if (s.startswith('"') and s.endswith('"')) or (
                    s.startswith("'") and s.endswith("'")
                ):
                    s = s[1:-1]
                if s:
                    items.append(s)
            return items
        # YAML block form (multiline)
        block_match = re.search(
            rf"^{key}:\s*\n((?:\s+-\s+.+\n?)+)", body, re.MULTILINE
        )
        if block_match:
            items = []
            for line in block_match.group(1).split("\n"):
                stripped = re.sub(r"^\s+-\s+", "", line).strip()
                if stripped:
                    items.append(stripped)
            return items
        return []

    return {
        "adr_id": get("adr_id"),
        "title": get("title"),
        "status": get("status"),
        "date": get("date"),
        "supersedes": parse_list("supersedes"),
        "superseded_by": parse_list("superseded_by"),
        "related_proposals": parse_list("related_proposals"),
        "referenced_by": parse_list("referenced_by"),
    }


def scan_adrs(decisions_dir: Path) -> list[dict]:
    if not decisions_dir.exists():
        return []
    results = []
    for f in sorted(decisions_dir.iterdir()):
        if not re.match(r"^\d{4}-.+\.md$", f.name):
            continue
        content = f.read_text(encoding="utf-8")
        fm = parse_adr_frontmatter(content)
        if fm and fm.get("adr_id"):
            entry = {"file": f.name}
            entry.update(fm)
            results.append(entry)
    results.sort(key=lambda a: a["adr_id"] or "")
    return results


def build_adr_table(adrs: list[dict]) -> str:
    if not adrs:
        return (
            "| ADR | Title | Status | Date | Supersedes |\n"
            "|-----|-------|--------|------|-----------|\n"
            "| — | （尚無 ADRs；PROPOSAL_20260423_016 Batch 3 起填入）| — | — | — |"
        )
    lines = [
        "| ADR | Title | Status | Date | Supersedes |",
        "|-----|-------|--------|------|-----------|",
    ]
    for a in adrs:
        link = f"[{a['adr_id']}]({a['file']})"
        supersedes = ", ".join(a["supersedes"]) if a.get("supersedes") else "—"
        title = a.get("title") or "<unknown>"
        status = a.get("status") or "Proposed"
        date = a.get("date") or "?"
        lines.append(f"| {link} | {title} | {status} | {date} | {supersedes} |")
    return "\n".join(lines)


def main() -> None:
    write_mode = "--write" in sys.argv
    check_mode = "--check" in sys.argv

    if not INDEX_PATH.exists():
        print(f"❌ {INDEX_PATH} not found", file=sys.stderr)
        sys.exit(2)

    adrs = scan_adrs(DECISIONS_DIR)
    table = build_adr_table(adrs)

    if not write_mode and not check_mode:
        rel = str(DECISIONS_DIR).replace(str(AGENTS_ROOT) + "/", "")
        print(f"📋 Found {len(adrs)} ADRs in {rel}\n")
        print(table)
        print("\n（dry-run；--write 實寫 / --check 比對 drift）")
        sys.exit(0)

    index_content = INDEX_PATH.read_text(encoding="utf-8")

    if check_mode:
        if not has_block(index_content, BLOCK_NAME):
            print(f'❌ AUTO-GENERATED marker missing: "{BLOCK_NAME}"', file=sys.stderr)
            sys.exit(1)
        res = check_drift(index_content, BLOCK_NAME, table)
        if res["drift"]:
            print(f"❌ DRIFT [{BLOCK_NAME}]: {res['reason']}", file=sys.stderr)
            sys.exit(1)
        print(f"✅ IN_SYNC [{BLOCK_NAME}] ({len(adrs)} ADRs)")
        sys.exit(0)

    if write_mode:
        if not has_block(index_content, BLOCK_NAME):
            print(
                f'❌ AUTO-GENERATED marker "{BLOCK_NAME}" missing in {INDEX_PATH}',
                file=sys.stderr,
            )
            sys.exit(2)
        updated = replace_block(index_content, BLOCK_NAME, table)
        INDEX_PATH.write_text(updated, encoding="utf-8")
        print(f"✅ decisions/README.md 已更新（{len(adrs)} ADRs）")
        sys.exit(0)


if __name__ == "__main__":
    main()
