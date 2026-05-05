#!/usr/bin/env python3
"""sub-agent-dispatch-validator.py — Port (PROPOSAL_502_027)."""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AGENTS_ROOT = REPO_ROOT / ".agents"

FORBIDDEN_PATTERNS = [
    re.compile(r"派遣\s*\d+\s*並行(?!\s*[（(])"),
    re.compile(r"派\s*\d+\s*並行\s*sub-agent", re.IGNORECASE),
    re.compile(r"5\s*個並行派遣(?!\s*[（(])"),
    re.compile(r"必\s*派\s*N\s*個\s*sub-agent"),
    re.compile(r"強制\s*sub-agent\s*dispatch", re.IGNORECASE),
]
SAFE_CTX = re.compile(r"serial|mode[- ]aware|opt[- ]in", re.IGNORECASE)

ALLOWLIST_FILES = {
    "tasks/harness-adapter-pattern.md",
    "rules/auditor.md",
    "tasks/auditor-dispatch-checklist.md",
    "tests/sub-agent-dispatch-validator.mjs",
    "tests/sub-agent-dispatch-validator.py",
    "INSTALL_ANTIGRAVITY.md",
    "docs/PLATFORM_COMPATIBILITY.md",
}
ALLOWLIST_DIRS = ["proposals/", "decisions/", "memory/.export/", "docs/Reports/"]


def is_allowlisted(rel: str) -> bool:
    if rel in ALLOWLIST_FILES:
        return True
    return any(rel.startswith(d) for d in ALLOWLIST_DIRS)


def main():
    total_files = 0
    all_hits = []
    for f in AGENTS_ROOT.rglob("*.md"):
        total_files += 1
        rel = f.relative_to(AGENTS_ROOT).as_posix()
        if is_allowlisted(rel):
            continue
        try:
            lines = f.read_text(encoding="utf-8").split("\n")
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(lines):
            for pat in FORBIDDEN_PATTERNS:
                if pat.search(line):
                    ctx = (lines[i - 1] if i > 0 else "") + " " + line
                    if SAFE_CTX.search(ctx):
                        continue
                    all_hits.append({"file": rel, "line": i + 1, "content": line.strip()})
                    break

    print("🔍 Sub-agent Dispatch Validator (PROPOSAL_502_021 Sprint A; Python port)")
    print()
    print(f"ℹ️  Scanned {total_files} markdown file(s)")
    print(f"ℹ️  Allowlist: {len(ALLOWLIST_FILES)} files + {len(ALLOWLIST_DIRS)} dirs")

    if not all_hits:
        print(f"ℹ️  Forbidden patterns: {len(FORBIDDEN_PATTERNS)} checked")
        print()
        print("─" * 30)
        print("Summary: 0 errors, 0 warnings")
        print("✅ Sub-agent Dispatch Validator: 全 PASS（rules 已 mode-neutral）")
        print("─" * 30)
        sys.exit(0)

    print()
    print(f"❌ Found {len(all_hits)} hardcoded sub-agent dispatch reference(s):")
    for h in all_hits:
        print(f"  {h['file']}:{h['line']}")
        print(f"    {h['content']}")
    print()
    print(f"Summary: {len(all_hits)} errors, 0 warnings")
    sys.exit(1)


if __name__ == "__main__":
    main()
