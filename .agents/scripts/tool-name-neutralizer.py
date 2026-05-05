#!/usr/bin/env python3
"""tool-name-neutralizer.py — Neutralize hardcoded tool names (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of tool-name-neutralizer.mjs (PROPOSAL_502_021 Sprint B-1).

目標：找出「Read tool / Bash tool / ...」等 Claude Code-specific 工具名引用，
  分類為「應改為中性語」vs「保留（範例 / 對照表 / 設定檔）」。

使用：
  python3 .agents/scripts/tool-name-neutralizer.py --dry-run    # 列出所有 hits 不改檔
  python3 .agents/scripts/tool-name-neutralizer.py --report     # 輸出 markdown 報告
  python3 .agents/scripts/tool-name-neutralizer.py --apply      # 套用改寫（自動可改部分）

**預設 dry-run**；--apply 才真改檔；--report 產 .agents/docs/Reports/TOOL_NAME_NEUTRALIZATION_REPORT.md
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
AGENTS_ROOT = REPO_ROOT / ".agents"
REPORT_PATH = AGENTS_ROOT / "docs" / "Reports" / "TOOL_NAME_NEUTRALIZATION_REPORT.md"

# 工具名 → 中性語對照
NEUTRAL_MAP = [
    {"claude": re.compile(r"\bRead tool\b"), "neutral": "讀檔工具", "desc": "Read → view_file (Antigravity)"},
    {"claude": re.compile(r"\bWrite tool\b"), "neutral": "寫檔工具", "desc": "Write → write_to_file"},
    {"claude": re.compile(r"\bEdit tool\b"), "neutral": "改檔工具", "desc": "Edit → replace_file_content"},
    {"claude": re.compile(r"\bBash tool\b"), "neutral": "執行命令工具", "desc": "Bash → run_command"},
    {"claude": re.compile(r"\bLS tool\b"), "neutral": "列目錄工具", "desc": "LS → list_dir"},
    {"claude": re.compile(r"\bGrep tool\b"), "neutral": "搜尋工具", "desc": "Grep → grep_search"},
    {"claude": re.compile(r"\bGlob tool\b"), "neutral": "檔案 glob 工具", "desc": "Glob → file pattern matcher"},
    {"claude": re.compile(r"\bWebFetch tool\b"), "neutral": "網頁抓取工具", "desc": "WebFetch → read_url_content"},
    {"claude": re.compile(r"\bWebSearch tool\b"), "neutral": "網路搜尋工具", "desc": "WebSearch → search_web"},
    {"claude": re.compile(r"\bTodoWrite tool\b"), "neutral": "Todo 管理工具", "desc": "TodoWrite (Claude Code only)"},
    {"claude": re.compile(r"\bTask tool\b"), "neutral": "sub-agent 派遣工具", "desc": "Task → harness-specific (parallel mode)"},
]

ALLOWLIST_FILES = [
    "INSTALL_ANTIGRAVITY.md",
    "docs/PLATFORM_COMPATIBILITY.md",
    "tasks/harness-adapter-pattern.md",
    "INSTALL.md",
    "scripts/tool-name-neutralizer.mjs",
    "scripts/tool-name-neutralizer.py",
    "scripts/platform-detect.mjs",
    "scripts/platform-detect.py",
    "tests/sub-agent-dispatch-validator.mjs",
    "tests/sub-agent-dispatch-validator.py",
]
ALLOWLIST_DIRS = [
    "proposals/",
    "decisions/",
    "memory/.export/",
    "docs/Reports/",
]


def walk_md_files(d: Path):
    for dirpath, dirnames, filenames in os.walk(d):
        # 過濾隱藏與 git/node_modules
        dirnames[:] = [
            sub for sub in dirnames
            if (not sub.startswith(".") or sub == ".agents")
            and sub not in ("node_modules", ".git")
        ]
        for fn in filenames:
            if fn.endswith(".md"):
                yield Path(dirpath) / fn


def is_allowlisted(rel: str) -> bool:
    if rel in ALLOWLIST_FILES:
        return True
    return any(rel.startswith(p) for p in ALLOWLIST_DIRS)


def now_iso() -> str:
    n = datetime.now(timezone.utc)
    return n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond // 1000:03d}Z"


def main() -> int:
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print(__doc__)
        return 0
    dry_run = "--apply" not in args
    want_report = "--report" in args
    verbose = "--verbose" in args

    stats = {
        "filesScanned": 0,
        "filesAllowlisted": 0,
        "filesWithHits": 0,
        "totalHits": 0,
        "byTool": {},
        "filesChanged": 0,
    }
    report_entries = []

    for file_path in walk_md_files(AGENTS_ROOT):
        stats["filesScanned"] += 1
        try:
            rel = file_path.relative_to(AGENTS_ROOT).as_posix()
        except ValueError:
            continue
        if is_allowlisted(rel):
            stats["filesAllowlisted"] += 1
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue
        new_content = content
        file_hits = []
        for entry in NEUTRAL_MAP:
            matches = list(entry["claude"].finditer(content))
            if matches:
                stats["byTool"][entry["desc"]] = (
                    stats["byTool"].get(entry["desc"], 0) + len(matches)
                )
                stats["totalHits"] += len(matches)
                file_hits.append({
                    "tool": entry["desc"],
                    "count": len(matches),
                    "sample": matches[0].group(0),
                })
                if not dry_run:
                    new_content = entry["claude"].sub(entry["neutral"], new_content)

        if file_hits:
            stats["filesWithHits"] += 1
            report_entries.append({"file": rel, "hits": file_hits})
            if verbose:
                print(f"[hit] {rel}")
                for h in file_hits:
                    print(f"  {h['tool']}: {h['count']} (sample: \"{h['sample']}\")")
            if not dry_run and new_content != content:
                file_path.write_text(new_content, encoding="utf-8")
                stats["filesChanged"] += 1

    print("🔍 Tool-name Neutralizer (PROPOSAL_502_021 Sprint B-1)")
    print(f"Mode: {'DRY-RUN' if dry_run else 'APPLY'}")
    print("")
    print(f"Scanned:      {stats['filesScanned']} files")
    print(f"Allowlisted:  {stats['filesAllowlisted']} files")
    print(f"With hits:    {stats['filesWithHits']} files")
    print(f"Total hits:   {stats['totalHits']}")
    if not dry_run:
        print(f"Files changed: {stats['filesChanged']}")
    print("")
    print("By tool:")
    for tool, count in sorted(stats["byTool"].items(), key=lambda x: -x[1]):
        print(f"  {str(count).rjust(3)}  {tool}")

    if want_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        md = []
        md.append("# Tool Name Neutralization Report (PROPOSAL_502_021 Sprint B-1)")
        md.append("")
        md.append(f"Generated: {now_iso()}")
        md.append(f"Mode: {'DRY-RUN' if dry_run else 'APPLY'}")
        md.append("")
        md.append("## Summary")
        md.append("")
        md.append(f"- Scanned: {stats['filesScanned']} files")
        md.append(f"- Allowlisted: {stats['filesAllowlisted']} files")
        md.append(f"- With hits: {stats['filesWithHits']} files")
        md.append(f"- Total hits: {stats['totalHits']}")
        md.append("")
        md.append("## By tool")
        md.append("")
        md.append("| Tool | Count |")
        md.append("|------|-------|")
        for tool, count in sorted(stats["byTool"].items(), key=lambda x: -x[1]):
            md.append(f"| {tool} | {count} |")
        md.append("")
        md.append("## File details")
        md.append("")
        for entry in report_entries:
            md.append(f"### {entry['file']}")
            md.append("")
            for h in entry["hits"]:
                md.append(f"- {h['tool']}: {h['count']} (sample: `{h['sample']}`)")
            md.append("")
        REPORT_PATH.write_text("\n".join(md), encoding="utf-8")
        print("")
        print(f"📄 Report: {REPORT_PATH}")

    if dry_run:
        print("")
        print("（DRY-RUN；無實際改動。要套用：--apply；要產報告：--report）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
