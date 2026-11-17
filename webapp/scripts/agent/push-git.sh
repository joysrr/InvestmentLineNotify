#!/bin/sh
# Git 交付：驗證通過 → commit → push 到 GitHub main
# 用法：sh scripts/agent/push-git.sh "commit message"
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MSG="${1:-chore(ui): agent auto-commit}"
cd "$REPO_ROOT"

echo "[push-git] 倉庫：$REPO_ROOT"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "[push-git] 錯誤：目前分支為 $BRANCH，僅允許在 main 交付"
  exit 1
fi

# ── 門禁：先跑 verify（build 必須通過）──
echo "[push-git] 執行驗證 …"
if ! (cd webapp && node scripts/agent/verify-git.mjs); then
  echo "[push-git] ✗ 驗證失敗，中止交付。請看 webapp/.agent-report/latest/REPORT.md"
  exit 2
fi

# ── 是否有改動 ──
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "[push-git] 無改動，無需交付"
  exit 0
fi

echo "[push-git] 暫存改動 …"
git add -A
echo "[push-git] 變更檔案："
git diff --cached --name-status | head -40

git -c user.name="${GIT_AUTHOR_NAME:-UI Agent}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-agent@ui}" \
    commit -m "$MSG"

echo "[push-git] 推送到 origin/main …"
git push origin main
echo "[push-git] ✓ 完成：$(git log --oneline -1)"
