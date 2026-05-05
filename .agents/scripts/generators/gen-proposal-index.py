#!/usr/bin/env python3
"""gen-proposal-index.py — Port of gen-proposal-index.mjs (PROPOSAL_502_027 Sprint C).

自動更新 PROPOSAL_INDEX.md 四個機械性區塊：
統計摘要 / OPEN 列表 / IN_PROGRESS 列表 / 意圖繼承候選（PROPOSAL_502_023 A-3）。

依 PROPOSAL_20260423_007 Part 3 建立。

使用：
  python3 .agents/scripts/generators/gen-proposal-index.py            # dry-run
  python3 .agents/scripts/generators/gen-proposal-index.py --write    # 寫入 AUTO-GENERATED 區塊
  python3 .agents/scripts/generators/gen-proposal-index.py --check    # 比對 drift
  --workspace <name>  針對 workspace 提案區（依 PROPOSAL_20260423_015 Phase B）

退出碼：
  0 = 成功
  1 = drift（--check）
  2 = 錯誤
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from auto_generated_block import has_block, replace_block, check_drift  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent.parent
PROPOSALS_DIR = AGENTS_ROOT / "proposals"
INDEX_PATH = PROPOSALS_DIR / "PROPOSAL_INDEX.md"
ACTIVE_DIR = PROPOSALS_DIR / "active"
COMPLETED_DIR = PROPOSALS_DIR / "completed"
ARCHIVED_DIR = PROPOSALS_DIR / "archived"


def parse_proposal_status(content: str) -> str:
    # 從基本資訊區塊撈狀態，支援 markdown 粗體 / 斜體
    match = re.search(
        r"^-\s*狀態[:：]\s*(?:\*\*|__|_|\*)?([A-Z]+(?:_[A-Z]+)*)(?:\*\*|__|_|\*)?",
        content,
        re.MULTILINE,
    )
    return match.group(1) if match else "UNKNOWN"


def parse_proposal_title(content: str) -> str:
    """優先順序：frontmatter title → 執行摘要 Part 1 → H1 標題 → fallback。"""
    fm = re.match(r"^---\n([\s\S]*?)\n---", content)
    if fm:
        title_match = re.search(r"^title:\s*(.+?)$", fm.group(1), re.MULTILINE)
        if title_match:
            v = title_match.group(1).strip()
            v = re.sub(r'^["\']|["\']$', "", v)
            return v[:120]

    summary_match = re.search(
        r"執行摘要[（(]\d+\s*Part[）)][:：]?\s*\n\s*-\s*\*\*Part\s+1\*\*[:：]\s*(.+)",
        content,
    )
    if summary_match:
        return summary_match.group(1).strip()[:120]

    h1_match = re.search(
        r"^#\s+PROPOSAL_\d+_\d+[:：]\s*(.+?)$", content, re.MULTILINE
    )
    if h1_match:
        return h1_match.group(1).strip()[:120]

    return "<unknown title>"


def parse_proposal_meta(content: str, filename: str) -> dict:
    id_match = re.match(r"^(PROPOSAL_\d+_\d+)", filename)
    priority_match = re.search(
        r"^-\s*優先級[:：]\s*\*?\*?(P\d+)\*?\*?", content, re.MULTILINE
    )
    date_match = re.search(
        r"^-\s*提案日期[:：]\s*(\d{4}-\d{2}-\d{2})", content, re.MULTILINE
    )
    depends_match = re.search(
        r"^-\s*前置依賴[:：]\s*\n([\s\S]*?)(?=\n-\s+|\n##)",
        content,
        re.MULTILINE,
    )

    # PROPOSAL_502_023 A-3：抽取意圖繼承信號
    fm = re.match(r"^---\n([\s\S]*?)\n---", content)
    signals: list[str] = []
    candidate_reason = ""
    if fm:
        fm_text = fm.group(1)
        # amends_adr
        if re.search(r"^amends_adr:\s*\n\s*-", fm_text, re.MULTILINE) or re.search(
            r"^amends_adr:\s*\[", fm_text, re.MULTILINE
        ):
            signals.append("amends_adr")
        # supersedes — 對應 JS 表達式：
        #   blockForm || (inlineForm && !emptyInline)
        # JS 原碼第一行漏括號（沒寫 &&-block 環繞），所以實際 truthy 路徑：
        #   blockForm OR (inlineForm AND not empty)
        supersedes_block = bool(
            re.search(r"^supersedes:\s*\n\s*-", fm_text, re.MULTILINE)
        )
        supersedes_inline = bool(re.search(r"^supersedes:\s*\[", fm_text, re.MULTILINE))
        supersedes_empty = bool(
            re.search(r"^supersedes:\s*\[\s*\]", fm_text, re.MULTILINE)
        )
        # 對齊 JS：a || b && !c → a || (b && !c)
        if supersedes_block or (supersedes_inline and not supersedes_empty):
            signals.append("supersedes")
        # superseded_by — JS 寫成 a || (b && !c)（有括號）
        sb_block = bool(
            re.search(r"^superseded_by:\s*\n\s*-", fm_text, re.MULTILINE)
        )
        sb_inline = bool(re.search(r"^superseded_by:\s*\[", fm_text, re.MULTILINE))
        sb_empty = bool(
            re.search(r"^superseded_by:\s*\[\s*\]", fm_text, re.MULTILINE)
        )
        if sb_block or (sb_inline and not sb_empty):
            signals.append("superseded_by")

        related_match = re.search(
            r"^related_proposals:\s*\n((?:\s*-\s*PROPOSAL_\d+_\d+.*\n)+)",
            fm_text,
            re.MULTILINE,
        )
        if related_match:
            refs = re.findall(r"PROPOSAL_\d+_\d+", related_match.group(1))
            if len(refs) >= 2:
                signals.append(f"related_proposals({len(refs)})")

        if signals:
            if "amends_adr" in signals:
                candidate_reason = "修訂既有 ADR"
            elif "supersedes" in signals:
                candidate_reason = "取代既有提案"
            elif "superseded_by" in signals:
                candidate_reason = "已被取代"
            else:
                candidate_reason = "多前置提案參照"

    if depends_match:
        first_line = depends_match.group(1).strip().split("\n")[0]
        depends = re.sub(r"^\s*-\s*", "", first_line)[:60]
    else:
        depends = "無"

    return {
        "id": id_match.group(1) if id_match else filename.replace(".md", ""),
        "title": parse_proposal_title(content),
        "priority": priority_match.group(1) if priority_match else "P?",
        "date": date_match.group(1) if date_match else "<unknown>",
        "depends": depends,
        "signals": signals,
        "candidateReason": candidate_reason,
    }


def filter_md(d: Path) -> list[str]:
    if not d.exists():
        return []
    return sorted(
        f.name for f in d.iterdir() if f.name.endswith(".md") and f.name != ".gitkeep"
    )


def scan_proposals(active_dir: Path, completed_dir: Path, archived_dir: Path) -> dict:
    active_files = filter_md(active_dir)
    completed_files = filter_md(completed_dir)
    archived_files = filter_md(archived_dir)

    open_proposals: list[dict] = []
    in_progress_proposals: list[dict] = []
    for f in active_files:
        content = (active_dir / f).read_text(encoding="utf-8")
        status = parse_proposal_status(content)
        meta = parse_proposal_meta(content, f)
        if status == "OPEN":
            open_proposals.append(meta)
        elif status == "IN_PROGRESS":
            in_progress_proposals.append(meta)

    cancelled_count = 0
    done_count = 0
    all_proposals: list[dict] = list(open_proposals) + list(in_progress_proposals)
    for f in completed_files:
        content = (completed_dir / f).read_text(encoding="utf-8")
        status = parse_proposal_status(content)
        meta = parse_proposal_meta(content, f)
        all_proposals.append(meta)
        if status == "CANCELLED":
            cancelled_count += 1
        else:
            done_count += 1

    return {
        "counts": {
            "OPEN": len(open_proposals),
            "IN_PROGRESS": len(in_progress_proposals),
            "DONE": done_count,
            "CANCELLED": cancelled_count,
            "ARCHIVED": len(archived_files),
            "total": (
                len(open_proposals)
                + len(in_progress_proposals)
                + len(completed_files)
                + len(archived_files)
            ),
        },
        "openProposals": open_proposals,
        "inProgressProposals": in_progress_proposals,
        "allProposals": all_proposals,
    }


def build_stats_table(counts: dict) -> str:
    return (
        "| 狀態 | 數量 | 目錄位置 |\n"
        "|------|------|---------|\n"
        f"| OPEN | {counts['OPEN']} | `active/` |\n"
        f"| IN_PROGRESS | {counts['IN_PROGRESS']} | `active/` |\n"
        f"| DONE | {counts['DONE']} | `completed/` |\n"
        f"| CANCELLED | {counts['CANCELLED']} | `completed/` |\n"
        f"| ARCHIVED | {counts['ARCHIVED']} | `archived/` |\n"
        f"| **合計** | **{counts['total']}** | — |"
    )


def build_open_table(proposals: list[dict]) -> str:
    lines = [
        "| 編號 | 標題 | 優先級 | 提案日期 | 前置依賴 |",
        "|------|------|-------|---------|---------|",
    ]
    if not proposals:
        lines.append("| — | （目前無待執行項目）| — | — | — |")
    else:
        for p in proposals:
            lines.append(
                f"| {p['id']} | {p['title']} | {p['priority']} | {p['date']} | {p['depends']} |"
            )
    return "\n".join(lines)


def build_in_progress_table(proposals: list[dict]) -> str:
    lines = [
        "| 編號 | 標題 | 優先級 | 開始日期 | 預計完成 |",
        "|------|------|-------|---------|---------|",
    ]
    if not proposals:
        lines.append("| — | （目前無執行中項目）| — | — | — |")
    else:
        for p in proposals:
            lines.append(
                f"| {p['id']} | {p['title']} | {p['priority']} | {p['date']} | <由 @Lead 填寫> |"
            )
    return "\n".join(lines)


def build_intent_inheritance_candidates(all_proposals: list[dict]) -> str:
    """PROPOSAL_502_023 A-3 / C-5：意圖繼承候選掃描。"""
    lines = [
        "> 由 `gen-proposal-index.mjs` 依 frontmatter 自動掃描；"
        "@Retro 須人工判斷是否需上方主表記錄",
        "",
        "| 提案 | frontmatter 信號 | 候選原因 |",
        "|------|----------------|---------|",
    ]
    candidates = [p for p in all_proposals if p.get("signals")]
    if not candidates:
        lines.append(
            "| — | （無候選；近期提案 frontmatter 無 amends_adr / supersedes 信號）| — |"
        )
    else:
        # 最近 15 個有信號的
        for p in candidates[-15:]:
            signals_str = " / ".join(p["signals"])
            reason = p.get("candidateReason") or "見 frontmatter"
            lines.append(f"| {p['id']} | {signals_str} | {reason} |")
    return "\n".join(lines)


# Workspace-aware path resolution（依 PROPOSAL_20260423_015 Phase B）
def resolve_proposal_paths(agents_root: Path, workspace_name: str | None) -> dict:
    if workspace_name:
        ws_base = agents_root / "workspaces" / workspace_name / "proposals"
        return {
            "indexPath": ws_base / "PROPOSAL_INDEX.md",
            "activeDir": ws_base / "active",
            "completedDir": ws_base / "completed",
            "archivedDir": ws_base / "archived",
            "area": "project",
        }
    return {
        "indexPath": INDEX_PATH,
        "activeDir": ACTIVE_DIR,
        "completedDir": COMPLETED_DIR,
        "archivedDir": ARCHIVED_DIR,
        "area": "framework",
    }


# 區塊 builders（保持與 .mjs BLOCKS 順序一致）
def build_blocks(result: dict) -> dict[str, str]:
    return {
        "stats": build_stats_table(result["counts"]),
        "open_list": build_open_table(result["openProposals"]),
        "in_progress_list": build_in_progress_table(result["inProgressProposals"]),
        "intent_inheritance_candidates": build_intent_inheritance_candidates(
            result.get("allProposals", [])
        ),
    }


def main() -> None:
    args = sys.argv[1:]
    write_mode = "--write" in args
    check_mode = "--check" in args
    workspace_name: str | None = None
    if "--workspace" in args:
        idx = args.index("--workspace")
        if idx + 1 < len(args):
            workspace_name = args[idx + 1]

    paths = resolve_proposal_paths(AGENTS_ROOT, workspace_name)

    if workspace_name and not paths["activeDir"].exists():
        print(
            f"❌ Workspace '{workspace_name}' not found ({paths['activeDir']})",
            file=sys.stderr,
        )
        sys.exit(2)

    result = scan_proposals(
        paths["activeDir"], paths["completedDir"], paths["archivedDir"]
    )
    blocks = build_blocks(result)
    index_path_effective: Path = paths["indexPath"]

    if not write_mode and not check_mode:
        ws_suffix = f":{workspace_name}" if workspace_name else ""
        print(f"=== [{paths['area']}{ws_suffix}] 統計摘要 ===\n")
        print(blocks["stats"])
        print("\n=== OPEN 列表 ===\n")
        print(blocks["open_list"])
        print("\n=== IN_PROGRESS 列表 ===\n")
        print(blocks["in_progress_list"])
        print(
            "\n（dry-run；--write 實寫 / --check 比對 drift；--workspace <name> 掃專案區）"
        )
        sys.exit(0)

    if check_mode:
        content = index_path_effective.read_text(encoding="utf-8")
        total_drift = 0
        for name, expected in blocks.items():
            res = check_drift(content, name, expected)
            if res["drift"]:
                total_drift += 1
                print(f"❌ DRIFT [{name}]: {res['reason']}", file=sys.stderr)
                if res["reason"] == "CONTENT_DIFFERS":
                    print(
                        f"--- current ---\n{res['current']}\n"
                        f"--- expected ---\n{res['expected']}\n",
                        file=sys.stderr,
                    )
            else:
                print(f"✅ IN_SYNC [{name}]")
        sys.exit(0 if total_drift == 0 else 1)

    if write_mode:
        if not index_path_effective.exists():
            print(
                f"❌ INDEX file not found: {index_path_effective}", file=sys.stderr
            )
            sys.exit(2)
        content = index_path_effective.read_text(encoding="utf-8")
        missing = [name for name in blocks if not has_block(content, name)]
        if missing:
            print(
                f"❌ AUTO-GENERATED markers missing: {', '.join(missing)}",
                file=sys.stderr,
            )
            print(
                f"   請於 {index_path_effective} 先加入 "
                "<!-- AUTO-GENERATED:BEGIN <name> --> / "
                "<!-- AUTO-GENERATED:END <name> --> 標記",
                file=sys.stderr,
            )
            sys.exit(2)
        for name, expected in blocks.items():
            content = replace_block(content, name, expected)
        index_path_effective.write_text(content, encoding="utf-8")
        rel = str(index_path_effective).replace(str(AGENTS_ROOT) + "/", "")
        print(
            f"✅ {rel} 已更新（{len(blocks)} 區塊 / area={paths['area']}）"
        )
        sys.exit(0)


if __name__ == "__main__":
    main()
