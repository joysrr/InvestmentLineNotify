#!/usr/bin/env python3
"""
user-execution-language-validator.py
PROPOSAL_502_025 Sprint A T-2 — framework 第一支 Python validator。

偵測 framework 文件中向 User 指示執行 framework 內部腳本的語氣。
這違反 PROPOSAL_502_024 核心原則（agent 全自動；user 0 腳本呼叫）。

ALLOWLIST：bootstrap 例外章節（pip install / mempalace init / git clone 等
framework 還沒就位時 user 必須自跑的階段）。

使用：
    python3 .agents/tests/user-execution-language-validator.py
    python3 .agents/tests/user-execution-language-validator.py --verbose
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AGENTS_ROOT = REPO_ROOT / ".agents"

# 違規 patterns — User-facing 指示語（Chinese + English）
FORBIDDEN_PATTERNS = [
    re.compile(r"請\s*(?:你\s*)?(?:手動\s*)?(?:跑|執行|run)"),  # 請執行 / 請你跑 / 請手動跑
    re.compile(r"請\s*(?:你\s*)?手動"),  # 請手動 / 請你手動
    re.compile(r"please\s+(?:manually\s+)?run", re.IGNORECASE),
    re.compile(r"you\s+(?:need\s+to|should|must)\s+run", re.IGNORECASE),
]

# ALLOWLIST 例外
# 1. 整檔 — bootstrap 文件 / 歷史紀錄 / 例外白名單檔
ALLOWLIST_FILES = {
    # bootstrap & historical
    "decisions/",  # 歷史 ADR
    "proposals/",  # 歷史提案
    "memory/.export/",  # cold backup（外部 drawer 內容）
    "memory/.pending/",  # MCP fallback buffer
    "docs/Reports/",  # 歷史 audit log
    # 例外規範本身
    "skills/agent-script-orchestration.md",  # 規範檔；含 ❌「禁止」範例
    "tests/user-execution-language-validator.py",  # 本檔
    # bootstrap-only 內容（pip install / git clone 等真的需要 user 跑）
    "INSTALL.md",  # 已加 [User 必跑] / [Agent 自動] / [Reference] 標記
    "INSTALL_ANTIGRAVITY.md",  # 同上；IDE settings 等不可 agent 自動
    # @Lead 自我指示模板（@Lead → @Lead；非 User-facing）
    "skills/templates/proposal-integration-analysis-template.md",
}

# 2. 行級 — 同行有 [User 必跑] / [Agent 自動] / [Reference] 標記則放行
LINE_ALLOWLIST_MARKERS = [
    "[User 必跑]",
    "[Agent 自動]",
    "[Reference]",
    "agent 自動",
    "Agent 自動",
    "agent 將自動",
    "❌",  # 反例（規範文件示範違規）
    "範例（錯誤）",
    "錯誤示範",
]


def is_path_allowlisted(rel_path: str) -> bool:
    return any(rel_path.startswith(item) or rel_path == item for item in ALLOWLIST_FILES)


def line_has_allowlist_marker(line: str, prev_line: str = "") -> bool:
    ctx = (prev_line or "") + " " + line
    return any(marker in ctx for marker in LINE_ALLOWLIST_MARKERS)


def scan_file(path: Path) -> list[dict]:
    rel = path.relative_to(AGENTS_ROOT).as_posix()
    if is_path_allowlisted(rel):
        return []
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    lines = content.split("\n")
    hits = []
    for i, line in enumerate(lines):
        for pat in FORBIDDEN_PATTERNS:
            if pat.search(line):
                prev = lines[i - 1] if i > 0 else ""
                if line_has_allowlist_marker(line, prev):
                    continue
                hits.append({
                    "file": rel,
                    "line": i + 1,
                    "content": line.strip()[:160],
                    "pattern": pat.pattern,
                })
                break
    return hits


def main():
    verbose = "--verbose" in sys.argv
    print("🔍 User Execution Language Validator (PROPOSAL_502_025 Sprint A T-2 / Python)")
    print()
    md_files = list(AGENTS_ROOT.rglob("*.md"))
    print(f"ℹ️  Scanned {len(md_files)} markdown file(s)")
    print(f"ℹ️  Allowlist: {len(ALLOWLIST_FILES)} files/dirs")
    print(f"ℹ️  Forbidden patterns: {len(FORBIDDEN_PATTERNS)}")
    print()

    all_hits = []
    for f in md_files:
        all_hits.extend(scan_file(f))

    if not all_hits:
        print("─" * 50)
        print("Summary: 0 errors, 0 warnings")
        print("✅ User Execution Language Validator: 全 PASS")
        print("─" * 50)
        sys.exit(0)

    print(f"❌ Found {len(all_hits)} user-execution language hit(s):")
    print()
    for h in all_hits:
        print(f"  {h['file']}:{h['line']}")
        print(f"    {h['content']}")
        if verbose:
            print(f"    pattern: {h['pattern']}")
    print()
    print("修法：")
    print("  - 改寫成「Agent 將自動執行」/「@Lead 在 trigger 時呼叫」")
    print("  - 或加 [Agent 自動] / [User 必跑] / [Reference] 標記同行")
    print("  - 若是 bootstrap 真的須 user 自跑（pip install / git clone）→ 移至 INSTALL.md（已 allowlist）")
    print()
    print("─" * 50)
    print(f"Summary: {len(all_hits)} errors, 0 warnings")
    print("❌ User Execution Language Validator: FAIL")
    print("─" * 50)
    sys.exit(1)


if __name__ == "__main__":
    main()
