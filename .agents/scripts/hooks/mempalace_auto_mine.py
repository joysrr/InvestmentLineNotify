#!/usr/bin/env python3
"""
mempalace_auto_mine.py — 自動採礦 hook (Python port of mempalace-auto-mine.sh)
PROPOSAL_502_025 Sprint A T-3a。

偵測 git 最新 commit / staged 變動是否含 .agents/memory/ 或 workspace memory，
若有 → 增量呼叫 `mempalace mine <changed-paths>`（mempalace 自動跳過已採礦檔案；冪等）。

安裝方式（兩擇一）：
    A. post-commit hook：
         ln -sf ../../.agents/scripts/hooks/mempalace_auto_mine.py .git/hooks/post-commit
    B. Git hook 命名直接：cp ... .git/hooks/post-commit; chmod +x

退出碼：
    0 = 成功 / 跳過（無變動或冪等）
    1 = mempalace 命令失敗（post-commit 不阻斷下游）
    2 = 旗標錯誤

旗標：
    --dry-run    只列偵測結果不執行 mine
    --staged     從 staged 而非最新 commit 偵測（pre-commit 用）
    --quiet      只輸出錯誤
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    def log(msg):
        if not args.quiet:
            print(f"[mempalace-auto-mine] {msg}")

    def warn(msg):
        print(f"[mempalace-auto-mine] WARN: {msg}", file=sys.stderr)

    # 1. 偵測倉庫根目錄
    try:
        repo_root = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except subprocess.CalledProcessError:
        warn("not in a git repo; skip")
        return 0

    repo_root = Path(repo_root)

    # 2. 取變動檔案
    if args.staged:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
            capture_output=True, text=True, cwd=repo_root,
        )
        source_desc = "staged"
    else:
        result = subprocess.run(
            ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
            capture_output=True, text=True, cwd=repo_root,
        )
        source_desc = "HEAD commit"

    changed = [l for l in result.stdout.splitlines() if l.strip()]
    if not changed:
        log(f"no changes in {source_desc}; skip")
        return 0

    # 3. 篩 memory 路徑
    memory_paths = []
    for f in changed:
        if f.startswith(".agents/memory/") or (
            f.startswith(".agents/workspaces/") and "/memory/" in f
        ):
            memory_paths.append(f)

    if not memory_paths:
        log(f"no memory changes in {source_desc}; skip")
        return 0

    # 4. 去重根目錄
    mine_roots = []
    seen = set()
    for p in memory_paths:
        parts = p.split("/")
        if p.startswith(".agents/memory/") and len(parts) >= 3:
            root = "/".join(parts[:3])  # .agents/memory/<room>
        elif p.startswith(".agents/workspaces/") and len(parts) >= 5:
            root = "/".join(parts[:5])  # .agents/workspaces/<ws>/memory/<room>
        else:
            continue
        if root not in seen:
            seen.add(root)
            mine_roots.append(root)

    log(f"memory changes detected ({len(memory_paths)} files; {len(mine_roots)} room roots)")
    for r in mine_roots:
        log(f"  → {r}")

    if args.dry_run:
        log("dry-run; not executing mempalace mine")
        return 0

    # 5. 確認 mempalace 可達
    if not shutil.which("mempalace"):
        warn("mempalace not found in PATH; skip (install: pip install mempalace>=3.3.4)")
        return 0

    # 6. 增量採礦
    fail = 0
    for r in mine_roots:
        full_path = repo_root / r
        if not full_path.is_dir():
            continue
        log(f"mining {r} ...")
        rc = subprocess.run(
            ["mempalace", "mine", r, "--yes", "--auto-mine", "--no-llm"],
            cwd=repo_root,
            capture_output=True,
        ).returncode
        if rc != 0:
            warn(f"mempalace mine {r} failed")
            fail += 1

    if fail > 0:
        warn(f"{fail} mine call(s) failed; commit not blocked")
        return 1

    log("auto-mine complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
