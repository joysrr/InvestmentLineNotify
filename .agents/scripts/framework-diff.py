#!/usr/bin/env python3
"""framework-diff.py — Framework layer diff (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of framework-diff.mjs (PROPOSAL_20260423_001 Part 5).

比對兩份 .agents/ 目錄的框架層差異；零網路依賴。

使用：
  python3 .agents/scripts/framework-diff.py --target <path-to-other-.agents>

退出碼：
  0 = 兩框架層一致（無差異）
  1 = 有差異，User 需審視（正常升級情境）
  2 = 結構錯誤（如目錄非 .agents/ 結構）

安全保證：
  - 本工具不自動執行 merge；僅輸出 diff 報告 + 建議指令
  - 本工具不觸及 project_layer；即使在 target 中存在，diff 報告標記為 🔒 Protected
  - User 最終決定是否 cp / rsync；可選擇性合併
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_AGENTS_ROOT = SCRIPT_DIR.parent.resolve()

# -------- Layer classification --------
FRAMEWORK_LAYER_PATTERNS = [
    re.compile(r"^rules/[^/]+\.md$"),
    re.compile(r"^skills/[^/]+\.md$"),
    re.compile(r"^tech-stacks/[^/]+\.md$"),
    re.compile(r"^docs/[^/]+\.md$"),
    re.compile(r"^tech-stacks/[^/]+/[^/]+\.md$"),
    re.compile(r"^domains/[^/]+\.md$"),
    re.compile(r"^tasks/[^/]+\.md$"),
    re.compile(r"^tests/[^/]+\.mjs$"),
    re.compile(r"^tests/[^/]+\.sh$"),
    re.compile(r"^tests/[^/]+\.py$"),
    re.compile(r"^scripts/[^/]+\.mjs$"),
    re.compile(r"^scripts/[^/]+\.py$"),
    re.compile(r"^proposals/completed/[^/]+\.md$"),
    re.compile(r"^proposals/archived/[^/]+\.md$"),
    re.compile(r"^RULES_DESIGN_GUIDE\.md$"),
    re.compile(r"^RULES_METADATA_SCHEMA\.md$"),
    re.compile(r"^RULES_VERSION_INDEX\.md$"),
    re.compile(r"^SYSTEM_THRESHOLDS\.yaml$"),
    re.compile(r"^WORKSPACE_SCHEMA\.yaml$"),
    re.compile(r"^FRAMEWORK_VERSION$"),
    re.compile(r"^CHANGELOG\.md$"),
    re.compile(r"^workspaces/default_env\.md$"),
    re.compile(r"^workspaces/README\.md$"),
    re.compile(r"^tests/README\.md$"),
    re.compile(r"^\.gitkeep$"),
]

PROJECT_LAYER_PATTERNS = [
    re.compile(r"^CURRENT_WORKSPACE$"),
    re.compile(r"^workspaces/(?!default_env\.md|README\.md)[^/]+\.md$"),
    re.compile(r"^workspaces/[^/]+/"),
    re.compile(r"^proposals/active/[^/]+\.md$"),
    re.compile(r"^proposals/PROPOSAL_INDEX\.md$"),
]


def classify_path(rel_path: str) -> str:
    for p in PROJECT_LAYER_PATTERNS:
        if p.search(rel_path):
            return "project"
    for p in FRAMEWORK_LAYER_PATTERNS:
        if p.search(rel_path):
            return "framework"
    return "unknown"


# -------- Utility --------
def is_agents_dir(root: Path) -> bool:
    markers = ["rules", "skills", "RULES_DESIGN_GUIDE.md"]
    hit = sum(1 for m in markers if (root / m).exists())
    return hit >= 2


def list_all_files(root: Path):
    out = []
    if not root.exists():
        return out
    for dirpath, dirnames, filenames in os.walk(root):
        # 過濾不掃描的子目錄
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules") and not d.startswith(".DS_")]
        for fn in filenames:
            if fn.startswith(".DS_"):
                continue
            full = Path(dirpath) / fn
            try:
                rel = full.relative_to(root).as_posix()
            except ValueError:
                continue
            out.append(rel)
    return out


def hash_file(path: Path):
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def read_version(root: Path) -> str:
    path = root / "FRAMEWORK_VERSION"
    if not path.exists():
        return "<無 FRAMEWORK_VERSION>"
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return "<無 FRAMEWORK_VERSION>"
    m = re.search(r"framework_version:\s*(\S+)", text)
    d = re.search(r"release_date:\s*(\S+)", text)
    if m:
        return f"{m.group(1)}（{d.group(1)}）" if d else m.group(1)
    return "<無版本號>"


# -------- Main --------
def parse_args(argv):
    target_root = None
    i = 0
    while i < len(argv):
        if argv[i] == "--target" and i + 1 < len(argv):
            target_root = Path(argv[i + 1]).resolve()
            i += 2
            continue
        if argv[i] in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        i += 1
    return target_root


def run_diff(target_root: Path) -> int:
    if not is_agents_dir(LOCAL_AGENTS_ROOT):
        print(f"❌ Local 目錄不是 .agents/ 結構: {LOCAL_AGENTS_ROOT}", file=sys.stderr)
        return 2
    if not target_root.exists():
        print(f"❌ Target 路徑不存在: {target_root}", file=sys.stderr)
        return 2
    if not is_agents_dir(target_root):
        print(f"❌ Target 目錄不是 .agents/ 結構: {target_root}", file=sys.stderr)
        return 2

    local_files = set(list_all_files(LOCAL_AGENTS_ROOT))
    target_files = set(list_all_files(target_root))

    local_ver = read_version(LOCAL_AGENTS_ROOT)
    target_ver = read_version(target_root)

    print("📂 Framework Layer Diff Report")
    print(f"📍 Local:  {LOCAL_AGENTS_ROOT}")
    print(f"📍 Target: {target_root}")
    print(f"📅 Local  FRAMEWORK_VERSION: {local_ver}")
    print(f"📅 Target FRAMEWORK_VERSION: {target_ver}")
    print("")

    new_files = []
    deleted_files = []
    modified_files = []
    protected_files = []
    unknown_files = []

    all_paths = local_files | target_files
    for rel in sorted(all_paths):
        cls = classify_path(rel)
        if cls == "project":
            protected_files.append(rel)
            continue
        if cls == "unknown":
            unknown_files.append(rel)
            continue
        in_local = rel in local_files
        in_target = rel in target_files
        if not in_local and in_target:
            new_files.append(rel)
        elif in_local and not in_target:
            deleted_files.append(rel)
        elif in_local and in_target:
            h_l = hash_file(LOCAL_AGENTS_ROOT / rel)
            h_t = hash_file(target_root / rel)
            if h_l != h_t:
                modified_files.append(rel)

    # 輸出 5 類區塊
    print(f"✨ New Files ({len(new_files)})  [target 有、local 沒有]")
    if not new_files:
        print("   (none)")
    for f in new_files:
        print(f"   + {f}")
    print("")

    print(f"✏️  Modified Files ({len(modified_files)})  [內容不同]")
    if not modified_files:
        print("   (none)")
    for f in modified_files:
        print(f"   ~ {f}")
    print("")

    print(f"🗑️  Deleted Files ({len(deleted_files)})  [local 有、target 沒有；升級時可評估刪除]")
    if not deleted_files:
        print("   (none)")
    for f in deleted_files:
        print(f"   - {f}")
    print("")

    print(f"🔒 Protected Layer ({len(protected_files)})  [project_layer；升級時不觸及]")
    if not protected_files:
        print("   (none)")
    for f in protected_files:
        print(f"   🔒 {f}")
    print("")

    if unknown_files:
        print(f"⚠️  Unknown / 未分類 ({len(unknown_files)})  [保守略過；升級時人工判斷]")
        for f in unknown_files:
            print(f"   ? {f}")
        print("")

    # 建議合併指令
    if new_files or modified_files:
        print("📋 Recommended Merge Commands (User 審視後選擇性執行)")
        print("")
        cwd = Path.cwd()
        for f in (*new_files, *modified_files):
            src_abs = (target_root / f).resolve()
            dst_abs = (LOCAL_AGENTS_ROOT / f).resolve()
            dst_dir = dst_abs.parent
            try:
                rel_dst_dir = dst_dir.relative_to(cwd) if dst_dir.is_relative_to(cwd) else dst_dir
            except (ValueError, AttributeError):
                rel_dst_dir = dst_dir
            try:
                rel_src = src_abs.relative_to(cwd) if src_abs.is_relative_to(cwd) else src_abs
            except (ValueError, AttributeError):
                rel_src = src_abs
            try:
                rel_dst = dst_abs.relative_to(cwd) if dst_abs.is_relative_to(cwd) else dst_abs
            except (ValueError, AttributeError):
                rel_dst = dst_abs
            if not dst_dir.exists():
                print(f'   mkdir -p "{rel_dst_dir}"')
            print(f'   cp "{rel_src}" "{rel_dst}"')
        print("")
        print("⚠️  Post-merge Checks")
        print("   1. python3 .agents/tests/run-all.py")
        print("   2. python3 .agents/tests/workspace-schema-validator.py")
        print("   3. Review CHANGELOG.md for new proposals affecting workspace")
        print("   4. 參照 .agents/tasks/framework-upgrade-workflow.md 執行完整 8 步驟 SOP")
        print("")

    has_diff = len(new_files) + len(modified_files) + len(deleted_files) > 0
    if has_diff:
        print("ℹ️  兩框架層有差異 → exit 1（正常升級情境）")
        return 1
    print("✅ 兩框架層一致 → exit 0")
    return 0


def main() -> int:
    target_root = parse_args(sys.argv[1:])
    if not target_root:
        print(
            "Usage: python3 framework-diff.py --target <path-to-other-.agents>",
            file=sys.stderr,
        )
        return 2
    return run_diff(target_root)


if __name__ == "__main__":
    sys.exit(main())
