#!/usr/bin/env python3
"""gen-framework-version.py — Port of gen-framework-version.mjs (PROPOSAL_502_027 Sprint C).

自動 bump FRAMEWORK_VERSION minor/major + 更新 proposals_included + last_included_proposal。
依 PROPOSAL_20260423_007 Part 4 建立。

使用：
  python3 .agents/scripts/generators/gen-framework-version.py --bump minor --proposal <id>          # dry-run
  python3 .agents/scripts/generators/gen-framework-version.py --bump minor --proposal <id> --write  # 實際更新
  python3 .agents/scripts/generators/gen-framework-version.py --bump minor --proposal <id> --check  # drift 檢查

退出碼：
  0 = 成功
  1 = drift（--check）
  2 = 錯誤
"""
import re
import sys
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent.parent
FRAMEWORK_VERSION_PATH = AGENTS_ROOT / "FRAMEWORK_VERSION"
COMPLETED_DIR = AGENTS_ROOT / "proposals" / "completed"


def bump_version(current: str, type_: str = "minor") -> str:
    m = re.match(r"^v(\d+)\.(\d+)$", current)
    if not m:
        raise ValueError(f'Invalid version format: "{current}" (expected vX.Y)')
    major = int(m.group(1))
    minor = int(m.group(2))
    if type_ == "minor":
        return f"v{major}.{minor + 1}"
    if type_ == "major":
        return f"v{major + 1}.0"
    raise ValueError(f"Unknown bump type: {type_} (expected minor|major)")


def read_current_version(content: str) -> str | None:
    m = re.search(r"framework_version[:：]\s*(v\d+\.\d+)", content)
    return m.group(1) if m else None


def count_completed_proposals(completed_dir: Path) -> int:
    if not completed_dir.exists():
        return 0
    return sum(
        1
        for f in completed_dir.iterdir()
        if f.name.endswith(".md") and f.name != ".gitkeep"
    )


def update_framework_version_fields(
    content: str,
    *,
    new_version: str,
    new_date: str,
    baseline_proposal: str,
    last_proposal: str,
    proposals_total: int,
) -> str:
    updated = content

    updated = re.sub(
        r"^framework_version[:：]\s*v\d+\.\d+",
        f"framework_version: {new_version}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )

    updated = re.sub(
        r"^release_date[:：]\s*\d{4}-\d{2}-\d{2}",
        f"release_date: {new_date}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )

    updated = re.sub(
        r"^baseline_proposal[:：]\s*\S+",
        f"baseline_proposal: {baseline_proposal}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )

    updated = re.sub(
        r"^last_included_proposal[:：]\s*\S+",
        f"last_included_proposal: {last_proposal}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )

    # proposals_included.total: N → proposals_total
    # JS 用 [\s\S]*? + /m flag。Python re.MULTILINE 不影響 . 行為，需 re.DOTALL
    updated = re.sub(
        r"(proposals_included[\s\S]*?total[:：]\s*)\d+",
        lambda m: f"{m.group(1)}{proposals_total}",
        updated,
        count=1,
    )
    # proposals_included.framework: N → proposals_total
    updated = re.sub(
        r"(proposals_included[\s\S]*?framework[:：]\s*)\d+",
        lambda m: f"{m.group(1)}{proposals_total}",
        updated,
        count=1,
    )

    return updated


def main() -> None:
    args = sys.argv[1:]
    bump_type = "minor"
    proposal_id: str | None = None
    write_mode = False
    check_mode = False

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--bump" and i + 1 < len(args):
            bump_type = args[i + 1]
            i += 2
            continue
        if a == "--proposal" and i + 1 < len(args):
            proposal_id = args[i + 1]
            i += 2
            continue
        if a == "--write":
            write_mode = True
        elif a == "--check":
            check_mode = True
        elif a in ("--help", "-h"):
            print(
                "Usage: python3 gen-framework-version.py --bump <minor|major> "
                "--proposal <id> [--write | --check]"
            )
            sys.exit(0)
        i += 1

    if not proposal_id:
        print(
            "❌ --proposal <id> 為必填（例：--proposal PROPOSAL_20260423_007）",
            file=sys.stderr,
        )
        sys.exit(2)

    if not FRAMEWORK_VERSION_PATH.exists():
        print(f"❌ {FRAMEWORK_VERSION_PATH} 不存在", file=sys.stderr)
        sys.exit(2)

    content = FRAMEWORK_VERSION_PATH.read_text(encoding="utf-8")
    current_version = read_current_version(content)
    if not current_version:
        print("❌ 無法解析當前 framework_version", file=sys.stderr)
        sys.exit(2)

    new_version = bump_version(current_version, bump_type)
    proposals_total = count_completed_proposals(COMPLETED_DIR)
    new_date = date.today().isoformat()

    updated = update_framework_version_fields(
        content,
        new_version=new_version,
        new_date=new_date,
        baseline_proposal=proposal_id,
        last_proposal=proposal_id,
        proposals_total=proposals_total,
    )

    if check_mode:
        has_version = (new_version in content) or (current_version in content)
        has_proposal = proposal_id in content
        total_match = bool(
            re.search(
                rf"proposals_included[\s\S]*?total[:：]\s*{proposals_total}", content
            )
        )
        if has_version and has_proposal and total_match:
            print(
                f"✅ IN_SYNC: FRAMEWORK_VERSION 已含 {proposal_id} + total={proposals_total}"
            )
            sys.exit(0)
        print(
            f"❌ DRIFT: FRAMEWORK_VERSION 缺 {proposal_id} 引用或 "
            f"proposals_total≠{proposals_total}",
            file=sys.stderr,
        )
        sys.exit(1)

    if write_mode:
        FRAMEWORK_VERSION_PATH.write_text(updated, encoding="utf-8")
        print(
            f"✅ FRAMEWORK_VERSION 已更新：{current_version} → {new_version}"
            f"（proposals: {proposals_total}；baseline: {proposal_id}）"
        )
        sys.exit(0)

    print("--- FRAMEWORK_VERSION (dry-run preview)---\n")
    print("\n".join(updated.split("\n")[:15]))
    print("\n...（後續 notes 段落不變）")
    print(
        f"\n（{current_version} → {new_version}; proposals_total "
        f"{proposals_total}; --write 實寫 / --check 驗證）"
    )


if __name__ == "__main__":
    main()
