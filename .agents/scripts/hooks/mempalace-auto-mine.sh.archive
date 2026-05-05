#!/usr/bin/env bash
# mempalace-auto-mine.sh
# 自動採礦 hook（PROPOSAL_20260502_003 C-1）
#
# 偵測 git 最新 commit / staged 變動是否含 .agents/memory/ 或 workspace memory，
# 若有 → 增量呼叫 `mempalace mine <changed-paths>`（mempalace 自動跳過已採礦檔案；冪等）。
#
# 安裝方式（兩擇一）：
#   A. post-commit hook：
#        ln -sf ../../.agents/scripts/hooks/mempalace-auto-mine.sh .git/hooks/post-commit
#   B. Claude Code PostToolUse hook（.claude/settings.local.json）：
#        {"hooks":{"PostToolUse":[{"matcher":"Edit|Write","hooks":[{"type":"command","command":".agents/scripts/hooks/mempalace-auto-mine.sh"}]}]}}
#
# 退出碼（PROPOSAL_502_004 D-5 契約釐清）：
#   0 = 成功 / 跳過（無變動或冪等）
#   1 = mempalace 命令失敗
#       - post-commit / Claude Code PostToolUse 安裝 → 不阻斷下游（git 已 commit）
#       - --staged + pre-commit 安裝 → 會阻斷 commit（建議改裝 post-commit；
#         若必裝 pre-commit，請改寫此處 exit 1 → exit 0 並另外 log 至 @Assistant）
#
# 旗標：
#   --dry-run    只列偵測結果不執行 mine
#   --staged     從 staged 而非最新 commit 偵測（pre-commit 用）
#   --quiet      只輸出錯誤

set -uo pipefail

DRY_RUN=0
USE_STAGED=0
QUIET=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --staged)  USE_STAGED=1 ;;
    --quiet)   QUIET=1 ;;
    -h|--help)
      grep -E "^#( |$)" "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log()  { [[ $QUIET -eq 0 ]] && echo "[mempalace-auto-mine] $*"; }
warn() { echo "[mempalace-auto-mine] WARN: $*" >&2; }

# 1. 偵測倉庫根目錄
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  warn "not in a git repo; skip"
  exit 0
}
cd "$REPO_ROOT"

# 2. 取變動檔案清單
if [[ $USE_STAGED -eq 1 ]]; then
  CHANGED="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"
  SOURCE_DESC="staged"
else
  CHANGED="$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)"
  SOURCE_DESC="HEAD commit"
fi

if [[ -z "$CHANGED" ]]; then
  log "no changes in $SOURCE_DESC; skip"
  exit 0
fi

# 3. 篩 memory 路徑（framework + workspace memory）
MEMORY_PATHS=()
while IFS= read -r f; do
  case "$f" in
    .agents/memory/*) MEMORY_PATHS+=("$f") ;;
    .agents/workspaces/*/memory/*) MEMORY_PATHS+=("$f") ;;
  esac
done <<< "$CHANGED"

if [[ ${#MEMORY_PATHS[@]} -eq 0 ]]; then
  log "no memory changes in $SOURCE_DESC; skip"
  exit 0
fi

# 4. 去重根目錄（mempalace mine 接目錄；逐檔太碎）
MINE_ROOTS=()
declare -A SEEN_ROOTS
for p in "${MEMORY_PATHS[@]}"; do
  # framework: .agents/memory/<room>/...  → root = .agents/memory/<room>
  # workspace: .agents/workspaces/<ws>/memory/<room>/... → root = .agents/workspaces/<ws>/memory/<room>
  root="$(echo "$p" | awk -F/ '
    /^\.agents\/memory\// { print $1"/"$2"/"$3; next }
    /^\.agents\/workspaces\// { print $1"/"$2"/"$3"/"$4"/"$5 }
  ')"
  [[ -z "$root" ]] && continue
  if [[ -z "${SEEN_ROOTS[$root]:-}" ]]; then
    SEEN_ROOTS[$root]=1
    MINE_ROOTS+=("$root")
  fi
done

log "memory changes detected (${#MEMORY_PATHS[@]} files; ${#MINE_ROOTS[@]} room roots)"
for r in "${MINE_ROOTS[@]}"; do
  log "  → $r"
done

if [[ $DRY_RUN -eq 1 ]]; then
  log "dry-run; not executing mempalace mine"
  exit 0
fi

# 5. 確認 mempalace 可達
if ! command -v mempalace >/dev/null 2>&1; then
  warn "mempalace not found in PATH; skip (install: pip install mempalace>=3.3.4)"
  exit 0
fi

# 6. 增量採礦（每個 room root 一次）
FAIL=0
for r in "${MINE_ROOTS[@]}"; do
  if [[ -d "$r" ]]; then
    log "mining $r ..."
    if ! mempalace mine "$r" --yes --auto-mine --no-llm >/dev/null 2>&1; then
      warn "mempalace mine $r failed"
      FAIL=$((FAIL+1))
    fi
  fi
done

if [[ $FAIL -gt 0 ]]; then
  warn "$FAIL mine call(s) failed; commit not blocked"
  exit 1
fi

log "auto-mine complete"
exit 0
