#!/usr/bin/env python3
"""gen-rules-version-index.py — Port of gen-rules-version-index.mjs (PROPOSAL_502_027 Sprint C).

從 .agents/ 各檔 frontmatter 的 version 欄位自動重建 RULES_VERSION_INDEX.md 的「版本總覽」表格。
依 PROPOSAL_20260423_007 Part 1 建立。

使用：
  python3 .agents/scripts/generators/gen-rules-version-index.py           # dry-run
  python3 .agents/scripts/generators/gen-rules-version-index.py --write   # 寫入 AUTO-GENERATED 區塊
  python3 .agents/scripts/generators/gen-rules-version-index.py --check   # 比對 drift

退出碼：
  0 = 成功
  1 = drift（--check）
  2 = 錯誤
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from auto_generated_block import has_block, replace_block, check_drift  # noqa: E402
from frontmatter import (  # noqa: E402
    parse_frontmatter as parse_md_frontmatter,
    parse_frontmatter_text,
)

AGENTS_ROOT = SCRIPT_DIR.parent.parent
PROJECT_ROOT = AGENTS_ROOT.parent
INDEX_PATH = AGENTS_ROOT / "RULES_VERSION_INDEX.md"

BLOCK_NAME = "rules_versions"

# 14 + 系統層追蹤檔案清單
TRACKED_FILES = [
    ".agents/RULES_DESIGN_GUIDE.md",
    ".agents/RULES_METADATA_SCHEMA.md",
    ".agents/rules/system-prompt.md",
    ".agents/rules/lead.md",
    ".agents/rules/planner.md",
    ".agents/rules/architect.md",
    ".agents/rules/backend.md",
    ".agents/rules/frontend.md",
    ".agents/rules/qa.md",
    ".agents/rules/reviewer.md",
    ".agents/rules/consultant.md",
    ".agents/rules/retro.md",
    ".agents/rules/assistant.md",
    ".agents/rules/security.md",
    ".agents/rules/auditor.md",
    ".agents/SYSTEM_THRESHOLDS.yaml",
    ".agents/WORKSPACE_SCHEMA.yaml",
]


def parse_frontmatter(content: str) -> dict | None:
    """markdown frontmatter 優先；若無，嘗試 YAML 前 30 行。"""
    md_fm = parse_md_frontmatter(content)
    if md_fm:
        return md_fm

    lines = content.split("\n")[:30]
    yaml_lines = [
        line for line in lines if re.match(r"^[a-z_]+:", line, re.IGNORECASE)
    ]
    if not yaml_lines:
        return None
    return parse_frontmatter_text("\n".join(yaml_lines))


def build_version_table(files_info: list[dict]) -> str:
    lines = [
        "| 文件 | 當前版本 | 最後修改日期 | 最近提案 | 審計基準版本 |",
        "|------|---------|------------|---------|------------|",
    ]
    for info in files_info:
        baseline = info.get("audit_baseline") or "—"
        lines.append(
            f"| `{info['path']}` | **{info['version']}** | "
            f"{info['last_modified']} | {info['last_proposal']} | {baseline} |"
        )
    return "\n".join(lines)


def collect_files_info(tracked_files: list[str], project_root: Path) -> list[dict]:
    result = []
    for rel in tracked_files:
        abs_path = project_root / rel
        if not abs_path.exists():
            result.append(
                {
                    "path": rel,
                    "version": "<missing>",
                    "last_modified": "<missing>",
                    "last_proposal": "<missing>",
                    "audit_baseline": None,
                }
            )
            continue
        content = abs_path.read_text(encoding="utf-8")
        fm = parse_frontmatter(content) or {}

        version = fm.get("version") or fm.get("schema_version")
        if not version:
            comment_match = re.search(
                r"#\s*(?:版本|Version)\s*[:：]\s*(v?[\d.]+)",
                content,
                re.IGNORECASE,
            )
            if comment_match:
                version = comment_match.group(1)
        version = version or "<unknown>"

        last_modified = fm.get("last_modified")
        if not last_modified:
            date_match = re.search(r"#\s*版本.*?\((\d{4}-\d{2}-\d{2})", content)
            if date_match:
                last_modified = date_match.group(1)
        last_modified = last_modified or "<unknown>"

        result.append(
            {
                "path": rel,
                "version": version,
                "last_modified": last_modified,
                "last_proposal": fm.get("last_proposal") or "<unknown>",
                "audit_baseline": fm.get("audit_baseline"),
            }
        )
    return result


def main() -> None:
    write_mode = "--write" in sys.argv
    check_mode = "--check" in sys.argv

    if not INDEX_PATH.exists():
        print(f"❌ {INDEX_PATH} 不存在", file=sys.stderr)
        sys.exit(2)

    files_info = collect_files_info(TRACKED_FILES, PROJECT_ROOT)
    table = build_version_table(files_info)

    warnings = 0
    for info in files_info:
        if info["version"] in ("<missing>", "<unknown>"):
            print(f"⚠️  {info['path']}: {info['version']}", file=sys.stderr)
            warnings += 1

    if not write_mode and not check_mode:
        print("--- 版本總覽（dry-run）---\n")
        print(table)
        print(
            f"\n（{len(files_info)} 列；{warnings} warnings；"
            "--write 實寫 / --check 比對 drift）"
        )
        sys.exit(0)

    index_content = INDEX_PATH.read_text(encoding="utf-8")

    if check_mode:
        if not has_block(index_content, BLOCK_NAME):
            print(
                f'❌ AUTO-GENERATED marker missing: "{BLOCK_NAME}" in {INDEX_PATH}',
                file=sys.stderr,
            )
            sys.exit(1)
        res = check_drift(index_content, BLOCK_NAME, table)
        if res["drift"]:
            print(f"❌ DRIFT [{BLOCK_NAME}]: {res['reason']}", file=sys.stderr)
            sys.exit(1)
        print(f"✅ IN_SYNC [{BLOCK_NAME}]")
        sys.exit(0)

    if write_mode:
        if not has_block(index_content, BLOCK_NAME):
            print(
                f'❌ AUTO-GENERATED marker missing: "{BLOCK_NAME}"；'
                f"請於 RULES_VERSION_INDEX.md 加入 "
                f"<!-- AUTO-GENERATED:BEGIN {BLOCK_NAME} --> / "
                f"<!-- AUTO-GENERATED:END {BLOCK_NAME} --> 標記",
                file=sys.stderr,
            )
            sys.exit(2)
        updated = replace_block(index_content, BLOCK_NAME, table)
        INDEX_PATH.write_text(updated, encoding="utf-8")
        print(
            f"✅ RULES_VERSION_INDEX.md 已更新（{len(files_info)} 列；{warnings} warnings）"
        )
        sys.exit(0)


if __name__ == "__main__":
    main()
