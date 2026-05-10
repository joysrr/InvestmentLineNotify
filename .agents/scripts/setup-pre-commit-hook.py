#!/usr/bin/env python3
"""Setup git pre-commit hook to run framework validators (PROPOSAL_502_049 gov-3).

啟用 .git/hooks/pre-commit；commit 前自動跑 routing-ticket-validator + condition-claim
+ schema-completeness（C-1/C-2）；fail → 阻斷 commit。

User 啟用：
    python3 .agents/scripts/setup-pre-commit-hook.py [--force]

啟用後每次 git commit 自動跑 `python3 .agents/tests/run-all.py --fast`；
errors 非 0 → 阻斷 commit；warnings 不阻斷。

避免：
- 已存在 hook 不覆蓋（除非 --force）
- chmod +x 確保可執行
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
GIT_DIR = ROOT / ".git"
HOOK_PATH = GIT_DIR / "hooks" / "pre-commit"

HOOK_CONTENT = """#!/bin/sh
# Framework pre-commit hook (PROPOSAL_502_049 gov-3)
# 跑 routing-ticket-validator + condition-claim + schema-completeness
# fail → 阻斷 commit；warnings 不阻斷

cd "$(git rev-parse --show-toplevel)" || exit 1

if [ -f .agents/tests/run-all.py ]; then
    python3 .agents/tests/run-all.py --fast
    EXIT=$?
    if [ "$EXIT" -ne 0 ]; then
        echo ""
        echo "❌ Framework validators 失敗 (exit $EXIT)；commit 阻斷"
        echo "   修補後重試；緊急情況可 git commit --no-verify 跳過（不建議）"
        exit "$EXIT"
    fi
fi
exit 0
"""


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--force", action="store_true", help="覆蓋既有 hook")
    args = p.parse_args()

    if not GIT_DIR.is_dir():
        print(f"❌ {GIT_DIR} 不存在；非 git repo？", file=sys.stderr)
        return 2

    HOOK_PATH.parent.mkdir(parents=True, exist_ok=True)

    if HOOK_PATH.exists() and not args.force:
        print(f"⚠️  {HOOK_PATH} 已存在；--force 覆蓋")
        return 1

    HOOK_PATH.write_text(HOOK_CONTENT, encoding="utf-8")
    os.chmod(HOOK_PATH, 0o755)
    print(f"✅ 已啟用 pre-commit hook：{HOOK_PATH}")
    print(f"   每次 git commit 自動跑 run-all.py --fast")
    return 0


if __name__ == "__main__":
    sys.exit(main())
