#!/usr/bin/env python3
"""docs-location-validator.py — Port of docs-location-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證文件分層三原則（依 RULES_DESIGN_GUIDE §二十 + PROPOSAL_20260423_004 Part 4）。

規則 1：docs/ 下不得含 framework 說明特徵（否則應移至 .agents/docs/）
規則 2：.agents/docs/ 不得含專案特化命名（歷史範例除外）
規則 3：.agents/docs/*.md（除 README.md）必有 framework 標示區塊
規則 4：L2a 分類（AUDIT_*.md / RETRO_*.md）必歸 .agents/docs/Reports/

使用：python3 .agents/tests/docs-location-validator.py [--verbose]

退出碼：
  0 = 全部通過
  1 = warnings（規則 2 / 3）
  2 = errors（規則 1 / 4）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = AGENTS_ROOT.parent
DOCS_ROOT = PROJECT_ROOT / "docs"
AGENTS_DOCS = AGENTS_ROOT / "docs"

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
    if verbose:
        print(f"ℹ️  {msg}")


# Framework 說明特徵（規則 1）
FRAMEWORK_INDICATORS = [
    re.compile(r"@Lead.{0,40}@Planner.{0,40}@Architect", re.DOTALL),
    re.compile(r"RULES_DESIGN_GUIDE\s*§[一二三四五六七八九十]"),
    re.compile(r"AI\s*Agent\s*品質.{0,20}評鑒表"),
    re.compile(r"AI\s*Agent\s*品質.{0,20}評審手冊"),
    re.compile(r"\.agents\/[\s\S]{0,20}├──"),
]

# 專案特化命名（規則 2）
PROJECT_CONTAMINATION = [
    r"InvestmentLineNotify",
    r"strategyWeight",
    r"data\/Strategy\.json",
]

# 排除路徑（不套用規則 1）
EXCLUDE_FROM_RULE_1 = [
    re.compile(r"SYSTEM_AUDIT_"),
    re.compile(r"2026-04-17"),
    re.compile(r"InvestmentLineNotify AI Agents 系統"),
    re.compile(r"DoD_AUDIT_LOG\.md$"),
    re.compile(r"GLOBAL_STATUS_SUMMARY\.md$"),
    re.compile(r"\/summary\/"),
    re.compile(r"\/archive\/"),
]

# L2a 分類強制（規則 4）
L2A_PATTERNS = [
    re.compile(r"^AUDIT_[A-Z_]+\.md$"),
    re.compile(r"^RETRO_[A-Za-z0-9_-]+\.md$"),
]

# 標示區塊偵測（規則 3）
FRAMEWORK_HEADER_PATTERN = re.compile(r"\*\*文件分層\*\*\s*[:：]\s*framework")


def list_md_files_recursive(base: Path):
    """List relative .md paths under base, skipping hidden dirs and node_modules.

    NOTE: .mjs 原版有 bug：遞迴時 readdirSync 仍讀根目錄，造成子目錄不會被掃描。
    為達 functional parity，此處複製該行為（只列舉根目錄 .md，不深入）。
    """
    out = []
    if not base.exists():
        return out
    for entry in base.iterdir():
        name = entry.name
        if name.startswith(".") and name != ".gitkeep":
            continue
        if name == "node_modules":
            continue
        try:
            if entry.is_file() and name.endswith(".md"):
                out.append(name)
        except OSError:
            continue
    return out


def check_rule_1():
    info("Rule 1: docs/ 不得含 framework 說明特徵")
    if not DOCS_ROOT.exists():
        info("docs/ 不存在，跳過")
        return
    files = list_md_files_recursive(DOCS_ROOT)
    for rel in files:
        abs_path = DOCS_ROOT / rel
        if any(p.search(rel) for p in EXCLUDE_FROM_RULE_1):
            info(f"  skip (excluded): docs/{rel}")
            continue
        try:
            content = abs_path.read_text(encoding="utf-8")
        except OSError:
            continue
        hits = [p for p in FRAMEWORK_INDICATORS if p.search(content)]
        if hits:
            err(f"docs/{rel}: 命中 {len(hits)} 項 framework 說明特徵 → 建議移至 .agents/docs/")


def check_rule_2():
    info("Rule 2: .agents/docs/ 不得含專案特化命名")
    if not AGENTS_DOCS.exists():
        info(".agents/docs/ 不存在，跳過")
        return
    files = [f for f in AGENTS_DOCS.iterdir() if f.is_file() and f.suffix == ".md"]
    explanation_re = re.compile(r"歷史範例|示意|\(example\)|（範例）|as example", re.IGNORECASE)
    for f in files:
        content = f.read_text(encoding="utf-8")
        for p in PROJECT_CONTAMINATION:
            matches = re.findall(p, content)
            if matches:
                if not explanation_re.search(content):
                    warn(f".agents/docs/{f.name}: 含 {len(matches)} 處 \"{p}\" 但無「歷史範例」明文說明 → 建議通用化")
                else:
                    info(f"  {f.name}: 含 {len(matches)} 處 \"{p}\" 但有歷史範例說明（可接受）")


def check_rule_3():
    info("Rule 3: .agents/docs/*.md 必有 framework 標示區塊")
    if not AGENTS_DOCS.exists():
        info(".agents/docs/ 不存在，跳過")
        return
    files = [f for f in AGENTS_DOCS.iterdir() if f.is_file() and f.suffix == ".md" and f.name != "README.md"]
    for f in files:
        content = f.read_text(encoding="utf-8")
        head = "\n".join(content.split("\n")[:50])
        if not FRAMEWORK_HEADER_PATTERN.search(head):
            warn(f".agents/docs/{f.name}: 缺「文件分層：framework」標示區塊（前 50 行內）")


def check_rule_4():
    info("Rule 4: L2a 分類（AUDIT_*.md / RETRO_*.md）必歸 .agents/docs/Reports/")
    docs_reports = DOCS_ROOT / "Reports"
    if docs_reports.exists():
        for f in docs_reports.iterdir():
            if not f.is_file() or not f.name.endswith(".md"):
                continue
            if any(p.search(f.name) for p in L2A_PATTERNS):
                err(f"docs/Reports/{f.name}: 屬 L2a 分類（framework 跨專案通用）→ 必移至 .agents/docs/Reports/")
    agents_reports = AGENTS_DOCS / "Reports"
    if agents_reports.exists():
        found = sorted([
            f.name for f in agents_reports.iterdir()
            if f.is_file() and any(p.search(f.name) for p in L2A_PATTERNS)
        ])
        info(f"  .agents/docs/Reports/: {len(found)} 份 L2a 檔案（{', '.join(found)}）")


def main():
    print("🔍 Running docs-location-validator (PROPOSAL_20260423_004 + PROPOSAL_20260424_019 #5 L2a 強制)")

    check_rule_1()
    check_rule_2()
    check_rule_3()
    check_rule_4()

    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")

    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
