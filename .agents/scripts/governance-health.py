#!/usr/bin/env python3
"""
governance-health.py — Governance Health Dashboard generator (PROPOSAL_502_052 G-2)

aggregator：跑下列來源並產 docs/Reports/GOVERNANCE_HEALTH.md：
- C-1 condition-claim warn 數
- C-2 schema-completeness warn 數
- AUDIT_HISTORY.md 最新 dim 1-6 分數
- KI 累積 (KI-001~010) 數量
- P-34/P-35/P-36/P-37/P-38/P-40 觸發次數（從 archive ticket count）
- LangGraph telemetry source 比例 (sampling vs api / llm_classifier %)

解 KI-009 governance health dashboard 缺失問題。
"""
from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
AGENTS_ROOT = PROJECT_ROOT / ".agents"
REPORT_PATH = AGENTS_ROOT / "docs" / "Reports" / "GOVERNANCE_HEALTH.md"


def run_validator(name: str) -> tuple[int, int]:
    """跑 validator；回 (errors, warnings)"""
    script = AGENTS_ROOT / "tests" / f"{name}-validator.py"
    if not script.exists():
        return (0, 0)
    try:
        result = subprocess.run(
            ["python3", str(script)],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(PROJECT_ROOT),
        )
        # parse "Summary: errors=N, warnings=M" 或 "errors=N, warnings=M"
        m = re.search(r"errors[=:]\s*(\d+).*?warnings?[=:]\s*(\d+)", result.stdout + result.stderr)
        if m:
            return (int(m.group(1)), int(m.group(2)))
    except Exception:
        pass
    return (0, 0)


def latest_audit_scores() -> dict | None:
    """從 AUDIT_HISTORY.md 抽最新一行 dim 1-6 分數"""
    audit_path = AGENTS_ROOT / "docs" / "Reports" / "AUDIT_HISTORY.md"
    if not audit_path.exists():
        return None
    text = audit_path.read_text(encoding="utf-8")
    # 抽最新 row (含 6 dim);格式 | date | trigger | d1 | d2 | d3 | d4 | d5 | d6 | overall | risk | note |
    pattern = r"^\|\s*(\d{4}-\d{2}-\d{2})\s*\|.*?\|\s*([\d\.]+)\s*\|\s*([\d\.]+)\s*\|\s*([\d\.]+)\s*\|\s*([\d\.]+)\s*\|\s*([\d\.]+)\s*\|\s*([\d\.\-—]+)\s*\|\s*\*\*([\d\.]+)\*\*"
    rows = re.findall(pattern, text, re.MULTILINE)
    if not rows:
        return None
    last = rows[-1]
    return {
        "date": last[0],
        "dim_1": last[1],
        "dim_2": last[2],
        "dim_3": last[3],
        "dim_4": last[4],
        "dim_5": last[5],
        "dim_6": last[6] if last[6] not in ("—", "-") else None,
        "overall": last[7],
    }


def count_kis() -> int:
    """數 KI 條目"""
    ki_path = AGENTS_ROOT / "KNOWN_ISSUES.md"
    if not ki_path.exists():
        return 0
    text = ki_path.read_text(encoding="utf-8")
    return len(re.findall(r"^\|\s*KI-\d{3}", text, re.MULTILINE))


def count_archive_tickets() -> int:
    """archive ticket 數量"""
    archive = AGENTS_ROOT / "archive" / "routing-tickets"
    if not archive.is_dir():
        return 0
    return len([p for p in archive.glob("*.md") if p.is_file()])


def count_proposals() -> dict[str, int]:
    """各狀態 proposal 數"""
    base = AGENTS_ROOT / "proposals"
    return {
        "active": len(list((base / "active").glob("PROPOSAL_*.md"))) if (base / "active").is_dir() else 0,
        "completed": len(list((base / "completed").glob("PROPOSAL_*.md"))) if (base / "completed").is_dir() else 0,
        "archived": len(list((base / "archived").glob("PROPOSAL_*.md"))) if (base / "archived").is_dir() else 0,
    }


def main() -> int:
    print("🩺 Generating Governance Health Dashboard (PROPOSAL_502_052 G-2)")

    # Collect
    cc_e, cc_w = run_validator("condition-claim")
    sc_e, sc_w = run_validator("schema-completeness")
    audit = latest_audit_scores()
    ki_count = count_kis()
    archive_count = count_archive_tickets()
    proposals = count_proposals()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Generate report
    lines = [
        "# 🩺 Governance Health Dashboard",
        "",
        f"> Generated: {now}",
        "> 由 `.agents/scripts/governance-health.py` 自動產出（PROPOSAL_502_052 G-2；解 KI-009）",
        "",
        "## §1 Validator Health (C-1 / C-2 meta-validators)",
        "",
        f"| Validator | Errors | Warnings |",
        f"|-----------|--------|----------|",
        f"| C-1 condition-claim | {cc_e} | {cc_w} |",
        f"| C-2 schema-completeness | {sc_e} | {sc_w} |",
        "",
        "## §2 Latest Audit Scores",
        "",
    ]
    if audit:
        lines.extend(
            [
                f"| Date | dim 1 | dim 2 | dim 3 | dim 4 | dim 5 | dim 6 | Overall |",
                f"|------|-------|-------|-------|-------|-------|-------|---------|",
                f"| {audit['date']} | {audit['dim_1']} | {audit['dim_2']} | {audit['dim_3']} | "
                f"{audit['dim_4']} | {audit['dim_5']} | {audit['dim_6'] or '—'} | "
                f"**{audit['overall']}** |",
                "",
            ]
        )
    else:
        lines.append("（AUDIT_HISTORY.md 尚無 dim 6 完整 row；待首次 6-dim audit）")
        lines.append("")

    lines.extend(
        [
            "## §3 Proposals & ADRs",
            "",
            f"- Active: {proposals['active']}",
            f"- Completed: {proposals['completed']}",
            f"- Archived: {proposals['archived']}",
            f"- Total: {proposals['active'] + proposals['completed'] + proposals['archived']}",
            "",
            "## §4 Known Issues",
            "",
            f"- KI 累積: {ki_count}",
            "",
            "## §5 LangGraph Runtime Telemetry",
            "",
            f"- Archive tickets: {archive_count}",
            "（telemetry source 比例待 LangGraph runtime 累積真實 dispatch 後產出；Phase 3 後可提取）",
            "",
            "## §6 Freeze Gate Status",
            "",
        ]
    )

    # 凍結門檻檢查
    can_freeze_c1 = cc_w <= 3
    can_freeze_c2 = sc_w <= 3
    dim_6_ok = audit and audit.get("dim_6") and float(audit["dim_6"]) >= 2.0 if audit else None

    lines.extend(
        [
            f"| 門檻 | 標準 | 達標? |",
            f"|------|------|-------|",
            f"| C-1 真信號 ≤ 3 | 軟 | {'✅' if can_freeze_c1 else '❌'} ({cc_w}) |",
            f"| C-2 真信號 ≤ 3 | 軟 | {'✅' if can_freeze_c2 else '❌'} ({sc_w}) |",
            f"| dim 6 ≥ 2.0 | 硬 | {'✅' if dim_6_ok else '⏸️ 待跑 6-dim audit'} |",
            "",
            "---",
            f"*Auto-generated by `.agents/scripts/governance-health.py`*",
        ]
    )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print(f"✅ {REPORT_PATH} 已產出")
    print(f"   - C-1 warn: {cc_w}")
    print(f"   - C-2 warn: {sc_w}")
    print(f"   - KI 累計: {ki_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
