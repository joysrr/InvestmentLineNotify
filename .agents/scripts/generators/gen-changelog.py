#!/usr/bin/env python3
"""gen-changelog.py — Port of gen-changelog.mjs (PROPOSAL_502_027 Sprint C).

從提案 markdown 自動產 CHANGELOG.md [vX.Y] 條目模板。
依 PROPOSAL_20260423_007 Part 2 建立。

使用：
  python3 .agents/scripts/generators/gen-changelog.py --proposal <path>          # dry-run
  python3 .agents/scripts/generators/gen-changelog.py --proposal <path> --write  # prepend 至 CHANGELOG
  python3 .agents/scripts/generators/gen-changelog.py --proposal <path> --check  # drift 檢查
  --bump minor|major  指定版本遞增類型（預設 minor）

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
CHANGELOG_PATH = AGENTS_ROOT / "CHANGELOG.md"
FRAMEWORK_VERSION_PATH = AGENTS_ROOT / "FRAMEWORK_VERSION"


def parse_proposal_metadata(content: str) -> dict:
    meta: dict = {}

    id_match = re.search(r"提案編號[:：]\s*(\S+)", content)
    meta["id"] = id_match.group(1) if id_match else "<unknown>"

    summary_match = re.search(
        r"執行摘要[（(]\d+\s*Part[）)][:：]?([\s\S]*?)(?=\n##|\n---)",
        content,
    )
    if summary_match:
        first_line = summary_match.group(1).strip().split("\n")[0].strip()
        meta["summary"] = first_line
    else:
        meta["summary"] = ""

    scope_match = re.search(r"scope[:：]\s*`?([a-z]+)`?", content)
    meta["scope"] = scope_match.group(1) if scope_match else "framework"

    date_match = re.search(r"提案日期[:：]\s*(\d{4}-\d{2}-\d{2})", content)
    meta["date"] = date_match.group(1) if date_match else date.today().isoformat()

    parts: list[dict] = []
    for m in re.finditer(
        r"^###\s*\d+\.\d+\s+Part\s+(\d+)[：:]\s*(.+)$", content, re.MULTILINE
    ):
        parts.append({"num": m.group(1), "title": m.group(2).strip()})
    meta["parts"] = parts

    summary_bullets: list[dict] = []
    for m in re.finditer(
        r"^\s*-\s*\*\*Part\s+(\d+)\*\*[：:]\s*(.+)$", content, re.MULTILINE
    ):
        summary_bullets.append({"num": m.group(1), "desc": m.group(2).strip()})
    meta["summaryBullets"] = summary_bullets

    return meta


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


def read_framework_version(framework_version_path: Path) -> str:
    if not framework_version_path.exists():
        return "v1.0"
    content = framework_version_path.read_text(encoding="utf-8")
    m = re.search(r"framework_version[:：]\s*(v\d+\.\d+)", content)
    return m.group(1) if m else "v1.0"


def build_changelog_entry(proposal: dict, version: str) -> str:
    lines = []
    lines.append(f"## [{version}] - {proposal['date']}")
    lines.append("")
    lines.append("### Added")
    summary = proposal.get("summary") or "<請填寫一句話摘要>"
    lines.append(f"- **{proposal['id']}**：{summary}")

    if proposal["parts"]:
        for p in proposal["parts"]:
            lines.append(f"  - Part {p['num']}: {p['title']}")
    elif proposal["summaryBullets"]:
        for b in proposal["summaryBullets"]:
            lines.append(f"  - Part {b['num']}: {b['desc']}")

    lines.append("")
    lines.append("### Changed")
    lines.append("- <請 @Lead 填寫實際變更檔案 / 版本 bump>")
    lines.append("")
    lines.append("### Notes")
    lines.append("- <請 @Lead 填寫設計原則 / 對偶 / 警告等內容判斷段落>")

    return "\n".join(lines)


def prepend_entry_to_changelog(changelog_content: str, entry: str) -> str:
    pattern = re.compile(r"(\n)(## \[v\d+\.\d+\])")
    if not pattern.search(changelog_content):
        # 若無既有 [vX.Y] 條目 → 在 `# Framework Changelog` 之後插入
        return re.sub(
            r"(# Framework Changelog\s*\n)",
            lambda m: f"{m.group(1)}\n{entry}\n\n---\n\n",
            changelog_content,
            count=1,
        )
    return pattern.sub(
        lambda m: f"\n{entry}\n\n---\n{m.group(1)}{m.group(2)}",
        changelog_content,
        count=1,
    )


def main() -> None:
    args = sys.argv[1:]
    proposal_path: str | None = None
    write_mode = False
    check_mode = False
    bump_type = "minor"

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--proposal" and i + 1 < len(args):
            proposal_path = args[i + 1]
            i += 2
            continue
        if a == "--write":
            write_mode = True
        elif a == "--check":
            check_mode = True
        elif a == "--bump" and i + 1 < len(args):
            bump_type = args[i + 1]
            i += 2
            continue
        elif a in ("--help", "-h"):
            print(
                "Usage: python3 gen-changelog.py --proposal <path> "
                "[--write | --check] [--bump minor|major]"
            )
            sys.exit(0)
        i += 1

    if not proposal_path:
        print("❌ --proposal <path> 為必填", file=sys.stderr)
        print(
            "Usage: python3 gen-changelog.py --proposal <path> "
            "[--write | --check] [--bump minor|major]",
            file=sys.stderr,
        )
        sys.exit(2)

    pp = Path(proposal_path)
    if not pp.exists():
        print(f"❌ 提案檔案不存在: {proposal_path}", file=sys.stderr)
        sys.exit(2)

    proposal_content = pp.read_text(encoding="utf-8")
    proposal = parse_proposal_metadata(proposal_content)

    current_version = read_framework_version(FRAMEWORK_VERSION_PATH)
    new_version = bump_version(current_version, bump_type)

    entry = build_changelog_entry(proposal, new_version)

    if check_mode:
        if not CHANGELOG_PATH.exists():
            print(f"❌ {CHANGELOG_PATH} 不存在", file=sys.stderr)
            sys.exit(1)
        changelog_content = CHANGELOG_PATH.read_text(encoding="utf-8")
        has_entry = (
            proposal["id"] in changelog_content
            and f"[{new_version}]" in changelog_content
        )
        if has_entry:
            print(f"✅ IN_SYNC: CHANGELOG 含 {proposal['id']} + [{new_version}] 條目")
            sys.exit(0)
        print(
            f"❌ DRIFT: CHANGELOG 缺 {proposal['id']} 或 [{new_version}] 條目",
            file=sys.stderr,
        )
        sys.exit(1)

    if write_mode:
        if not CHANGELOG_PATH.exists():
            print(f"❌ {CHANGELOG_PATH} 不存在", file=sys.stderr)
            sys.exit(2)
        changelog_content = CHANGELOG_PATH.read_text(encoding="utf-8")
        updated = prepend_entry_to_changelog(changelog_content, entry)
        CHANGELOG_PATH.write_text(updated, encoding="utf-8")
        print(
            f"✅ CHANGELOG.md 已 prepend [{new_version}] 條目（請 @Lead 檢視 Notes 段落）"
        )
        sys.exit(0)

    print("--- CHANGELOG entry（dry-run）---\n")
    print(entry)
    print(
        f"\n（提案: {proposal['id']} → 版本: {current_version} → {new_version}; "
        "--write 實寫 / --check 驗證條目）"
    )


if __name__ == "__main__":
    main()
