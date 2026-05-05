#!/usr/bin/env python3
"""agents-overview-sync-validator.py — Port of agents-overview-sync-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證 .agents/docs/agents-overview.md 派生視圖與 .agents/ 實際狀態一致。
依 PROPOSAL_20260422_028 建立；實現 @Auditor §2.2 可觀察性自動掃描 5 項對齐。
PROPOSAL_20260423_004 路徑變更：docs/agents-overview.md → .agents/docs/agents-overview.md。

使用：python3 .agents/tests/agents-overview-sync-validator.py [--verbose]

退出碼：
  0 = 全部對齐
  1 = 1-2 項不一致（warning）
  2 = ≥ 3 項不一致 或 Agents 數等關鍵項不一致（error）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
OVERVIEW_PATH = AGENTS_ROOT / "docs" / "agents-overview.md"
RULES_DIR = AGENTS_ROOT / "rules"
VERSION_INDEX_PATH = AGENTS_ROOT / "RULES_VERSION_INDEX.md"
THRESHOLDS_PATH = AGENTS_ROOT / "SYSTEM_THRESHOLDS.yaml"
PATROL_CATALOG_PATH = AGENTS_ROOT / "skills" / "patrol-notification-catalog.md"

verbose = "--verbose" in sys.argv
errors = 0
warnings = 0


def err(msg):
    global errors
    print(f"❌ [ERROR] {msg}", file=sys.stderr)
    errors += 1


def warn(msg):
    global warnings
    print(f"⚠️  [WARN]  {msg}")
    warnings += 1


def info(msg):
    print(f"ℹ️  {msg}")


def vlog(msg):
    if verbose:
        print(f"   {msg}")


def extract_section(content: str, section_pattern: str):
    """從 '### X.Y 標題' 到下個 '### ' 或 '## ' 的範圍。"""
    lines = content.split("\n")
    start_re = re.compile(rf"^### {section_pattern}")
    start_idx = -1
    for i, line in enumerate(lines):
        if start_re.search(line):
            start_idx = i
            break
    if start_idx < 0:
        return None
    end_idx = len(lines)
    for i in range(start_idx + 1, len(lines)):
        if re.match(r"^### ", lines[i]) or re.match(r"^## ", lines[i]):
            end_idx = i
            break
    return "\n".join(lines[start_idx:end_idx])


def check_agents_count(overview: str):
    section = extract_section(overview, r"2\.1 全員總覽表")
    if not section:
        err("§2.1 全員總覽表 not found in agents-overview.md")
        return

    table_lines = [l for l in section.split("\n") if l.strip().startswith("|")]
    sep_idx = -1
    for i, l in enumerate(table_lines):
        if re.match(r"^\|\s*:?-+", l.strip()):
            sep_idx = i
            break
    data_rows = table_lines[sep_idx + 1:] if sep_idx >= 0 else table_lines
    documented_count = sum(1 for l in data_rows if not re.match(r"^\|\s*:?-+", l.strip()))

    # Match Node readdirSync ordering（alphabetical on Linux）
    actual_files = sorted([f.name for f in RULES_DIR.iterdir() if f.suffix == ".md"])
    actual_count = len(actual_files)

    vlog(f"§2.1 documented rows: {documented_count}")
    vlog(f"rules/ actual files: {actual_count} ({', '.join(actual_files)})")

    if documented_count != actual_count:
        err(f"Agents count mismatch: §2.1 has {documented_count} rows vs rules/ has {actual_count} files")
    else:
        info(f"✓ Agents count match ({actual_count})")


def check_patrol_range(overview: str):
    section = extract_section(overview, r"4\.2 @Assistant 巡邏規則")
    if not section:
        err("§4.2 巡邏規則 not found")
        return

    range_match = re.search(r"P-01\s*~\s*P-(\d+)", section)
    documented_max = int(range_match.group(1)) if range_match else None

    actual_max = 0
    if PATROL_CATALOG_PATH.exists():
        catalog = PATROL_CATALOG_PATH.read_text(encoding="utf-8")
        ids = [int(m.group(1)) for m in re.finditer(r"\|\s*P-(\d+)\s*\|", catalog)]
        if ids:
            actual_max = max(ids)

    vlog(f"§4.2 documented range: P-01 ~ P-{documented_max}")
    vlog(f"patrol-catalog actual max: P-{actual_max}")

    if documented_max != actual_max:
        err(f"Patrol range mismatch: §4.2 max = P-{documented_max} vs catalog max = P-{actual_max}")
    else:
        info(f"✓ Patrol range match (P-01 ~ P-{actual_max})")


def check_version_index(overview: str):
    section = extract_section(overview, r"9\.2 Rules 文件清單")
    if not section:
        warn("§9.2 Rules 文件清單 not found; skipping")
        return
    if not VERSION_INDEX_PATH.exists():
        warn("RULES_VERSION_INDEX.md not found; skipping")
        return

    version_index = VERSION_INDEX_PATH.read_text(encoding="utf-8")

    overview_versions = [
        {"file": m.group(1), "version": m.group(2)}
        for m in re.finditer(r"\|\s*`?([\w./-]+\.md)`?\s*\|\s*\*?\*?v(\d+\.\d+)", section)
    ]
    index_versions = [
        {"file": m.group(1).split("/")[-1], "version": m.group(2)}
        for m in re.finditer(r"\|\s*`([\w./-]+\.md)`\s*\|\s*\*?\*?v(\d+\.\d+)", version_index)
    ]

    mismatches = 0
    for ov in overview_versions:
        match = next(
            (iv for iv in index_versions if iv["file"] == ov["file"] or iv["file"].endswith(ov["file"])),
            None,
        )
        if match and match["version"] != ov["version"]:
            warn(f"Version mismatch: {ov['file']} overview=v{ov['version']} index=v{match['version']}")
            mismatches += 1

    vlog(f"§9.2 compared {len(overview_versions)} versions; {mismatches} mismatches")
    if mismatches == 0:
        info("✓ Rules versions match")


def check_system_thresholds(overview: str):
    section = extract_section(overview, r"7\.1 參數總表")
    if not section:
        err("§7.1 參數總表 not found")
        return
    if not THRESHOLDS_PATH.exists():
        err("SYSTEM_THRESHOLDS.yaml not found")
        return

    yaml_text = THRESHOLDS_PATH.read_text(encoding="utf-8")
    excluded = {"schema_version", "last_modified", "last_proposal"}
    yaml_keys = [
        m.group(1)
        for m in re.finditer(r"^([A-Za-z_][\w]*)\s*:", yaml_text, re.MULTILINE)
        if m.group(1) not in excluded
    ]

    expected_keywords = [
        "REVIEW_CYCLE", "PATROL", "PENDING", "EXEMPTION", "PROPOSAL_OPEN",
        "TOKEN", "AUDIT", "MODEL_ROUTING", "LANE_ROUTING",
    ]
    missing_in_overview = [kw for kw in expected_keywords if kw not in section]

    vlog(f"YAML top-level keys: {', '.join(yaml_keys)}")
    vlog(f"§7.1 missing keywords: {', '.join(missing_in_overview) if missing_in_overview else 'none'}")

    if missing_in_overview:
        warn(f"§7.1 may be missing entries for: {', '.join(missing_in_overview)}")
    else:
        info("✓ System thresholds coverage OK")


def check_produces(overview: str):
    section = extract_section(overview, r"9\.3 產出物交叉引用")
    if not section:
        warn("§9.3 產出物交叉引用 not found; skipping")
        return

    # Insertion-order preserving "set"（match JS Set semantics）
    produces_set = {}
    for f in sorted(RULES_DIR.iterdir(), key=lambda p: p.name):
        if f.suffix != ".md":
            continue
        content = f.read_text(encoding="utf-8")
        fm_match = re.match(r"^---\n([\s\S]*?)\n---", content)
        if not fm_match:
            continue
        produces_match = re.search(
            r"produces:\s*([\s\S]*?)(?=\n[A-Za-z_]+:|$)", fm_match.group(1)
        )
        if not produces_match:
            continue
        items = [m.group(1) for m in re.finditer(r"^\s*-\s*(\S+)", produces_match.group(1), re.MULTILINE)]
        for it in items:
            produces_set[it] = None

    overview_text = section.lower()
    missing = []
    for p in produces_set:
        basename = p.lower().split("/")[-1]
        if not basename or len(basename) < 3:
            continue
        stem = basename.replace("*", "")
        if stem.endswith(".md"):
            stem = stem[:-3]
        if len(stem) < 3:
            continue
        if stem not in overview_text:
            missing.append(p)

    vlog(f"produces from rules: {len(produces_set)}")
    sample = ", ".join(missing[:5]) + ("..." if len(missing) > 5 else "")
    vlog(f"§9.3 missing mentions: {sample}")

    missing_ratio = len(missing) / len(produces_set) if produces_set else 0
    if missing_ratio > 0.5:
        warn(
            f"§9.3 may be missing > 50% artifacts ({len(missing)}/{len(produces_set)}; sample: {', '.join(missing[:3])})"
        )
    elif missing:
        info(f"§9.3 mostly aligned ({len(missing)}/{len(produces_set)} minor gaps; acceptable)")
    else:
        info("✓ Artifacts cross-ref complete")


def main():
    global errors, warnings
    if not OVERVIEW_PATH.exists():
        err(f"agents-overview.md not found: {OVERVIEW_PATH}")
        sys.exit(2)
    overview = OVERVIEW_PATH.read_text(encoding="utf-8")

    info("Checking agents-overview.md sync with .agents/ state...")
    print("")

    info("Check 1: Agents count (§2.1 ↔ rules/)")
    check_agents_count(overview)
    print("")

    info("Check 2: Patrol range (§4.2 ↔ patrol-catalog)")
    check_patrol_range(overview)
    print("")

    info("Check 3: Rules versions (§9.2 ↔ RULES_VERSION_INDEX)")
    check_version_index(overview)
    print("")

    info("Check 4: System thresholds (§7.1 ↔ SYSTEM_THRESHOLDS.yaml)")
    check_system_thresholds(overview)
    print("")

    info("Check 5: Produces cross-ref (§9.3 ↔ rules frontmatter)")
    check_produces(overview)
    print("")

    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors >= 1:
        sys.exit(2)
    if warnings >= 3:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
