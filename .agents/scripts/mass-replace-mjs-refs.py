#!/usr/bin/env python3
"""
Mass replace .mjs / node command references → .py / python3 in active framework docs.
PROPOSAL_502_028 (post-v7.0 doc cleanup; 一次性 script)。

Skip historical / auto-gen / tech-stack-specific:
- proposals/  decisions/  docs/Reports/  memory/.export/
- tech-stacks/ (Node tech docs SHOULD mention Node)
- *.archive

Replacement rules（順序敏感）：
  bash .agents/tests/run-all.sh    → python3 .agents/tests/run-all.py
  node .agents/scripts/X.mjs       → python3 .agents/scripts/X.py
  node .agents/tests/X.mjs         → python3 .agents/tests/X.py
  node X.mjs (相對)                 → python3 X.py（保守；只在 .agents 路徑下做）

Logging: 列出每檔修改數；dry-run mode 不寫檔。
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # .agents/scripts/X.py → repo root
AGENTS = REPO_ROOT / ".agents"

SKIP_DIRS = [
    "proposals/",          # historical
    "decisions/",          # ADR 歷史
    "docs/Reports/",       # append-only
    "memory/.export/",     # cold backup
    "memory/.pending/",
    "tech-stacks/",        # Node IS the tech here
]

SKIP_FILES = {
    # 含 archive 後綴的不動
    # auto-generated 也保留（此處非阻斷）
}

# 替換規則（順序：先長的/特定的）
RULES = [
    # bash run-all.sh
    (re.compile(r"\bbash\s+\.agents/tests/run-all\.sh\b"),
        "python3 .agents/tests/run-all.py"),
    (re.compile(r"\bbash\s+\.agents/tests/scripts/run\.sh\b"),
        "python3 .agents/tests/scripts/run.py"),
    (re.compile(r"\bbash\s+\.agents/tests/scripts/smoke\.test\.sh\b"),
        "python3 .agents/tests/scripts/smoke_test.py"),
    (re.compile(r"\bbash\s+\.agents/tests/index-drift-validator\.sh\b"),
        "python3 .agents/tests/index-drift-validator.py"),
    (re.compile(r"\bbash\s+\.agents/scripts/hooks/mempalace-auto-mine\.sh\b"),
        "python3 .agents/scripts/hooks/mempalace_auto_mine.py"),

    # node .agents/scripts/lib/rule-loader.mjs → rule_loader.py
    (re.compile(r"\bnode\s+\.agents/scripts/lib/rule-loader\.mjs\b"),
        "python3 .agents/scripts/lib/rule_loader.py"),

    # node .agents/scripts/generators/lib/<name>.mjs → snake-case .py
    (re.compile(r"\bnode\s+\.agents/scripts/generators/lib/auto-generated-block\.mjs\b"),
        "python3 .agents/scripts/generators/lib/auto_generated_block.py"),
    (re.compile(r"\bnode\s+\.agents/scripts/generators/lib/frontmatter\.mjs\b"),
        "python3 .agents/scripts/generators/lib/frontmatter.py"),
    (re.compile(r"\bnode\s+\.agents/tests/lib/frontmatter\.mjs\b"),
        "python3 .agents/tests/lib/frontmatter.py"),

    # 一般通用 node X.mjs → python3 X.py
    (re.compile(r"\bnode\s+(\.agents/[\w/.\-]+)\.mjs\b"),
        r"python3 \1.py"),

    # 純檔名引用（無 node 命令；如「scripts/foo.mjs 提供」）
    (re.compile(r"`(\.agents/[\w/.\-]+)\.mjs`"),
        r"`\1.py`"),

    # 含 `bash X.sh` 含路徑：generic bash → python3
    (re.compile(r"\bbash\s+(\.agents/[\w/.\-]+)\.sh\b"),
        r"python3 \1.py"),
]


def should_skip(rel: str) -> bool:
    if any(rel.startswith(d) for d in SKIP_DIRS):
        return True
    if rel in SKIP_FILES:
        return True
    if rel.endswith(".archive"):
        return True
    return False


def process_file(path: Path) -> int:
    """Return number of replacements."""
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return 0
    new_content = content
    total = 0
    for pat, repl in RULES:
        new_content, n = pat.subn(repl, new_content)
        total += n
    if total > 0 and new_content != content and not DRY_RUN:
        path.write_text(new_content, encoding="utf-8")
    return total


DRY_RUN = "--dry-run" in sys.argv

print(f"🔧 Mass replace .mjs/.sh refs → .py（{'DRY-RUN' if DRY_RUN else 'APPLY'}）")
print()

total_files_changed = 0
total_replacements = 0

# Active docs in .agents/
for f in AGENTS.rglob("*.md"):
    rel = f.relative_to(AGENTS).as_posix()
    if should_skip(rel):
        continue
    n = process_file(f)
    if n > 0:
        total_files_changed += 1
        total_replacements += n
        print(f"  {n:3}  {rel}")

# Root files (qwen.md)
for f in [REPO_ROOT / "qwen.md"]:
    if not f.is_file():
        continue
    n = process_file(f)
    if n > 0:
        total_files_changed += 1
        total_replacements += n
        print(f"  {n:3}  {f.name}")

print()
print(f"Files changed: {total_files_changed}")
print(f"Total replacements: {total_replacements}")
if DRY_RUN:
    print("(DRY-RUN — 無實際改動；--apply 套用)")
