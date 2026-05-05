#!/usr/bin/env python3
"""gen-proposal-summary.py — Port of gen-proposal-summary.mjs (PROPOSAL_502_027 Sprint C).

產生季度 / 區間提案摘要（依 PROPOSAL_20260423_015 Phase C）。

使用：
  python3 gen-proposal-summary.py --period 2026Q2 [--write]
  python3 gen-proposal-summary.py --range PROPOSAL_20260420_001:PROPOSAL_20260423_015 [--write]
  python3 gen-proposal-summary.py --workspace <name> --period 2026Q2 [--write]

退出碼：
  0 = 成功
  2 = 錯誤
"""
import re
import sys
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from frontmatter import parse_frontmatter  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent.parent


def extract_date_from_id(id_: str | None) -> str | None:
    if not id_:
        return None
    m = re.search(r"PROPOSAL_(\d{4})(\d{2})(\d{2})_", id_)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def extract_priority(content: str) -> str:
    m = re.search(r"優先級[:：]\s*\*?\*?(P\d+)", content)
    return m.group(1) if m else "P?"


def extract_affected_files(content: str) -> list[str]:
    files: list[str] = []
    seen: set[str] = set()
    for line in content.split("\n")[:200]:
        for m in re.finditer(
            r"\.agents/[a-zA-Z0-9_./-]+\.(md|mjs|sh|yaml|yml)", line
        ):
            v = m.group(0)
            if v not in seen:
                seen.add(v)
                files.append(v)
    return files[:5]


def extract_theme_keywords(content: str) -> list[str]:
    """掃標題 + §一 + §三 區段；每主題需 ≥min 次匹配以入選。"""
    head_part = content[:5000]
    themes: list[str] = []
    patterns = [
        (re.compile(r"validator|驗證器|自動偵測", re.IGNORECASE), "validator", 3),
        (
            re.compile(
                r"generator|產生器|生成器|--write|--check", re.IGNORECASE
            ),
            "generator",
            3,
        ),
        (
            re.compile(r"hotfix|緊急修復|事故|complexity_tier", re.IGNORECASE),
            "hotfix",
            3,
        ),
        (
            re.compile(r"workspace|專案特化|project-specific", re.IGNORECASE),
            "workspace",
            4,
        ),
        (
            re.compile(
                r"scope.*分層|framework.*vs.*project|scope: (framework|project)",
                re.IGNORECASE,
            ),
            "scope-tier",
            3,
        ),
        (re.compile(r"HITL|人工介入|Human-in-the-loop", re.IGNORECASE), "HITL", 3),
        (
            re.compile(r"token.*預算|token.*budget|TOKEN_", re.IGNORECASE),
            "token-budget",
            2,
        ),
        (
            re.compile(r"@Security|SC-0[1-9]|SC-10|資安審查", re.IGNORECASE),
            "security",
            3,
        ),
        (
            re.compile(r"@Auditor|drift_score|5 維度評分", re.IGNORECASE),
            "audit",
            3,
        ),
        (
            re.compile(r"@Retro|根因|RULE_UPDATE_PROPOSAL", re.IGNORECASE),
            "retro",
            3,
        ),
        (
            re.compile(
                r"lite.*proposal|輕量.*提案|Lite Proposal|Full Proposal",
                re.IGNORECASE,
            ),
            "proposal-tier",
            3,
        ),
        (
            re.compile(
                r"RULES_DESIGN_GUIDE.*拆|design.*scope.*quality|orchestrator",
                re.IGNORECASE,
            ),
            "design-guide-split",
            2,
        ),
        # 注意：JS 此 pattern 無 i flag
        (re.compile(r"skills/|tasks/|tech-stacks/"), "content-layer", 5),
        (
            re.compile(r"pre-commit|AUTO-GENERATED|SOP", re.IGNORECASE),
            "enforcement",
            3,
        ),
    ]
    for rx, tag, min_count in patterns:
        matches = rx.findall(head_part)
        if matches and len(matches) >= min_count:
            themes.append(tag)
    return themes


def parse_proposal_file(path: Path) -> dict:
    content = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(content)

    def get(key: str):
        return fm.get(key) or None

    h1 = re.search(
        r"^#\s+(PROPOSAL_\d+_\d+)[:：]\s*(.+?)$", content, re.MULTILINE
    )
    bullet_title = re.search(
        r"^-\s+提案編號[:：]\s*\*?\*?(PROPOSAL_\d+_\d+)", content, re.MULTILINE
    )

    filename = path.name.replace(".md", "")
    id_ = (
        get("id")
        or (h1.group(1) if h1 else None)
        or (bullet_title.group(1) if bullet_title else None)
        or filename
    )

    title = get("title") or (h1.group(2).strip() if h1 else "<unknown>")

    tier = get("tier") or "full"
    scope = get("scope") or "unknown"
    date_ = get("date") or extract_date_from_id(id_)
    priority = get("priority") or extract_priority(content)

    affected_files = extract_affected_files(content)
    theme_keywords = extract_theme_keywords(content)

    return {
        "id": id_,
        "title": title,
        "tier": tier,
        "scope": scope,
        "date": date_,
        "priority": priority,
        "affectedFiles": affected_files,
        "themeKeywords": theme_keywords,
        "path": str(path),
    }


def date_in_period(date_str: str | None, period: str) -> bool:
    if not date_str:
        return False
    parts = date_str.split("-")
    if len(parts) < 2:
        return False
    try:
        y = int(parts[0])
        m = int(parts[1])
    except ValueError:
        return False
    q_match = re.match(r"^(\d{4})Q([1-4])$", period)
    if q_match:
        py = int(q_match.group(1))
        pq = int(q_match.group(2))
        if y != py:
            return False
        q_start = (pq - 1) * 3 + 1
        return q_start <= m < q_start + 3
    ym_match = re.match(r"^(\d{4})-(\d{2})$", period)
    if ym_match:
        return y == int(ym_match.group(1)) and m == int(ym_match.group(2))
    return False


def id_in_range(id_: str, range_str: str) -> bool:
    parts = range_str.split(":")
    if len(parts) != 2:
        return False
    start, end = parts
    if not start or not end:
        return False
    return start <= id_ <= end


def scan_source(scope: str, workspace_name: str | None) -> list[dict]:
    dirs: list[Path] = []
    if scope == "framework":
        dirs.extend(
            [
                AGENTS_ROOT / "proposals" / "active",
                AGENTS_ROOT / "proposals" / "completed",
                AGENTS_ROOT / "proposals" / "archived",
            ]
        )
    elif scope == "project" and workspace_name:
        base = AGENTS_ROOT / "workspaces" / workspace_name / "proposals"
        dirs.extend([base / "active", base / "completed", base / "archived"])
    results: list[dict] = []
    for d in dirs:
        if not d.exists():
            continue
        for f in sorted(d.iterdir()):
            if not f.name.startswith("PROPOSAL_") or not f.name.endswith(".md"):
                continue
            results.append(parse_proposal_file(f))
    return results


def filter_proposals(
    all_: list[dict], *, period: str | None, range_: str | None
) -> list[dict]:
    if period:
        return [p for p in all_ if date_in_period(p["date"], period)]
    if range_:
        return [p for p in all_ if id_in_range(p["id"], range_)]
    return all_


def group_by_theme(proposals: list[dict]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for p in proposals:
        tags = p["themeKeywords"] if p["themeKeywords"] else ["other"]
        for t in tags:
            groups.setdefault(t, []).append(p["id"])
    return groups


def build_summary(
    *,
    period: str | None,
    range_: str | None,
    scope: str,
    workspace_name: str | None,
    proposals: list[dict],
) -> str:
    sorted_p = sorted(proposals, key=lambda a: a["id"])
    theme_groups = group_by_theme(sorted_p)

    major_bumps = [
        p
        for p in sorted_p
        if re.search(r"拆檔|v\d+\.0.*→|重大結構|major", p["title"] or "", re.IGNORECASE)
    ]

    tier_counts = {"full": 0, "lite": 0, "unknown": 0}
    for p in sorted_p:
        t = p["tier"]
        tier_counts[t] = tier_counts.get(t, 0) + 1

    proposal_range = (
        f"{sorted_p[0]['id']} ~ {sorted_p[-1]['id']}" if sorted_p else "empty"
    )

    header_lines = [
        "---",
        f"period: {period or range_ or 'all'}",
        f"scope: {scope}",
    ]
    if workspace_name:
        header_lines.append(f"workspace: {workspace_name}")
    header_lines.extend(
        [
            f"generated: {date.today().isoformat()}",
            f"total: {len(sorted_p)}",
            f"tier_full: {tier_counts['full']}",
            f"tier_lite: {tier_counts['lite']}",
            f"proposal_range: {proposal_range}",
            "---",
        ]
    )
    header = "\n".join(header_lines)

    ws_part = f" / {workspace_name}" if workspace_name else ""
    lines = [
        header,
        "",
        f"# 提案摘要：{period or range_ or 'all'}（scope: {scope}{ws_part}）",
        "",
    ]

    lines.extend(["## 概觀", ""])
    lines.append(
        f"- **總數**：{len(sorted_p)} 份"
        f"（Full: {tier_counts['full']} / Lite: {tier_counts['lite']}）"
    )
    if major_bumps:
        lines.append(f"- **重大變更**：{len(major_bumps)} 份")
    lines.append("")

    lines.extend(["## 主題聚合", ""])
    sorted_themes = sorted(
        theme_groups.items(), key=lambda kv: len(kv[1]), reverse=True
    )
    lines.append("| 主題 | 提案數 | 成員 |")
    lines.append("|------|-------|------|")
    for theme, ids in sorted_themes:
        short_ids = ", ".join(re.sub(r"^PROPOSAL_", "", i) for i in ids)
        lines.append(f"| `{theme}` | {len(ids)} | {short_ids} |")
    lines.append("")

    if major_bumps:
        lines.extend(["## 關鍵變更 Highlight", ""])
        for p in major_bumps:
            lines.append(f"### {p['id']}：{p['title']}")
            lines.append(
                f"- 日期：{p['date']} / 優先級：{p['priority']} / tier：{p['tier']}"
            )
            if p["affectedFiles"]:
                lines.append(
                    f"- 主要檔案：{' / '.join(p['affectedFiles'][:3])}"
                )
            lines.append("")

    lines.extend(["## 逐份摘要", ""])
    lines.append("| ID | Title | Date | Priority | Tier | Themes |")
    lines.append("|----|-------|------|----------|------|--------|")
    for p in sorted_p:
        id_short = re.sub(r"^PROPOSAL_", "", p["id"])
        title_short = (p.get("title") or "")[:60]
        themes = ", ".join(p["themeKeywords"][:3]) or "—"
        lines.append(
            f"| {id_short} | {title_short} | {p['date'] or '?'} | "
            f"{p['priority']} | {p['tier']} | {themes} |"
        )
    lines.append("")

    lines.extend(["## 跨提案主題鏈", ""])
    lines.append("（手動維護；列出具語意繼承關係的提案組合）")
    lines.append("")
    lines.append("- 參見 `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 完整圖譜")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "生成工具：`scripts/generators/gen-proposal-summary.mjs`"
        "（PROPOSAL_20260423_015 Phase C）"
    )

    return "\n".join(lines)


def main() -> None:
    args = sys.argv[1:]
    period: str | None = None
    range_: str | None = None
    write_mode = False
    workspace_name: str | None = None

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--period" and i + 1 < len(args):
            period = args[i + 1]
            i += 2
            continue
        if a == "--range" and i + 1 < len(args):
            range_ = args[i + 1]
            i += 2
            continue
        if a == "--workspace" and i + 1 < len(args):
            workspace_name = args[i + 1]
            i += 2
            continue
        if a == "--write":
            write_mode = True
        elif a in ("--help", "-h"):
            print(
                "Usage: python3 gen-proposal-summary.py "
                "[--period 2026Q2 | --range ID1:ID2] [--workspace <name>] [--write]"
            )
            sys.exit(0)
        i += 1

    if not period and not range_:
        print(
            "❌ 需指定 --period YYYYQN / YYYY-MM 或 --range ID1:ID2",
            file=sys.stderr,
        )
        sys.exit(2)

    scope = "project" if workspace_name else "framework"
    all_ = scan_source(scope, workspace_name)
    proposals = filter_proposals(all_, period=period, range_=range_)

    ws_str = f", workspace={workspace_name}" if workspace_name else ""
    print(f"📊 Found {len(proposals)} proposals (scope={scope}{ws_str})")

    summary = build_summary(
        period=period,
        range_=range_,
        scope=scope,
        workspace_name=workspace_name,
        proposals=proposals,
    )

    if write_mode:
        if workspace_name:
            summaries_dir = (
                AGENTS_ROOT
                / "workspaces"
                / workspace_name
                / "proposals"
                / "summaries"
            )
        else:
            summaries_dir = AGENTS_ROOT / "proposals" / "summaries"
        summaries_dir.mkdir(parents=True, exist_ok=True)

        suffix = period or (range_.replace(":", "_") if range_ else "all")
        fname = f"SUMMARY_{suffix}.md"
        out_path = summaries_dir / fname
        out_path.write_text(summary, encoding="utf-8")
        rel = str(out_path).replace(str(AGENTS_ROOT) + "/", "")
        print(f"✅ {rel} 已產生（{len(proposals)} 份提案）")
    else:
        print("\n--- Summary preview (dry-run) ---\n")
        print(summary)
        print("\n（dry-run；--write 實寫至 proposals/summaries/）")


if __name__ == "__main__":
    main()
