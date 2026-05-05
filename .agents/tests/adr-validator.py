#!/usr/bin/env python3
"""adr-validator.py — Port of adr-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證規則層（rules/ + skills/ + tasks/ + RULES_DESIGN_GUIDE 家族）的 PROPOSAL 引用清理狀態。
依 PROPOSAL_20260423_016 Batch 1 建立。

三類引用：
  Type A: frontmatter `last_proposal`        → 保留（audit trail）
  Type B: 內文「（依 PROPOSAL_XXX）」標頭    → 應移除
  Type C: 規則條款嵌入 PROPOSAL_XXX 編號    → 應改指 ADR

退出碼：
  0 = 合規（無 Type B / C 殘留；或強制模式未啟用）
  1 = 有違規（僅在 --strict 模式下）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent

SCAN_DIRS = ["rules", "skills", "tasks"]

SCAN_ROOT_FILES = [
    "RULES_DESIGN_GUIDE.md",
    "RULES_DESIGN_GUIDE.DESIGN.md",
    "RULES_DESIGN_GUIDE.SCOPE.md",
    "RULES_DESIGN_GUIDE.QUALITY.md",
    "RULES_METADATA_SCHEMA.md",
]

# 真實 PROPOSAL ID 精確 pattern
PROPOSAL_ID_PATTERN = re.compile(r"PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3}")
TYPE_B_PATTERN = re.compile(
    r"（依\s*(?:PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3})[^）]*）"
    r"|\(依\s*(?:PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3})[^)]*\)"
)


def strip_frontmatter(content: str) -> str:
    """去 YAML frontmatter 與 ADR-0022 版本標頭。"""
    out = content
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n", out)
    if fm_match:
        out = out[len(fm_match.group(0)) :]
    # 去 ADR-0022 版本標頭 `***...***`
    out = re.sub(r"\n\*\*\*\n[\s\S]*?\n\*\*\*\n", "\n", out, count=1)
    return out


def strip_legitimate_content(content: str) -> str:
    """移除合法 audit trail 區塊（不計為違規）。"""
    out = content
    # AUTO-GENERATED 區塊
    out = re.sub(
        r"<!--\s*AUTO-GENERATED:BEGIN[\s\S]*?AUTO-GENERATED:END\s+\w+\s*-->",
        "",
        out,
    )
    # Related Decisions section (文末 footer)
    out = re.sub(r"##\s+Related Decisions[\s\S]*$", "", out)
    # Related Proposals section (ADR 內部)
    out = re.sub(r"##\s+Related Proposals[\s\S]*?(?=\n##\s|\n---\n|$)", "", out)
    # Referenced By section (ADR 內部)
    out = re.sub(r"##\s+Referenced By[\s\S]*?(?=\n##\s|\n---\n|$)", "", out)
    # §🔗 意圖繼承關係 section
    out = re.sub(r"##\s+🔗\s+提案意圖繼承關係[\s\S]*?(?=\n##\s|$)", "", out)
    # 章節索引 TOC 表（orchestrator）
    out = re.sub(r"##\s+章節索引[\s\S]*?(?=\n##\s|$)", "", out)
    # 相容層
    out = re.sub(r"##\s+相容層[\s\S]*?(?=\n##\s|$)", "", out)
    # 溯源 section
    out = re.sub(r"##\s+溯源[\s\S]*?(?=\n##\s|$)", "", out)
    # Fenced code blocks
    out = re.sub(r"```[\s\S]*?```", "", out)
    # Inline code blocks
    out = re.sub(r"`[^`\n]*`", "", out)
    return out


def count_proposal_references(content: str) -> dict:
    body = strip_legitimate_content(strip_frontmatter(content))

    type_b = TYPE_B_PATTERN.findall(body)
    all_body_refs = PROPOSAL_ID_PATTERN.findall(body)

    type_b_inner_refs = PROPOSAL_ID_PATTERN.findall("".join(type_b))

    type_c = max(0, len(all_body_refs) - len(type_b_inner_refs))

    fm_match = re.match(r"^---\n([\s\S]*?)\n---", content)
    type_a = (
        len(PROPOSAL_ID_PATTERN.findall(fm_match.group(1))) if fm_match else 0
    )

    return {
        "typeA": type_a,
        "typeB_count": len(type_b),
        "typeC_residual": type_c,
        "total_body_refs": len(all_body_refs),
    }


def scan_file(file_path: Path):
    if not file_path.exists():
        return None
    content = file_path.read_text(encoding="utf-8")
    res = {"path": str(file_path)}
    res.update(count_proposal_references(content))
    return res


def scan_dir(dir_path: Path) -> list:
    if not dir_path.exists():
        return []
    results = []
    for f in sorted(dir_path.iterdir()):
        if f.is_file() and f.name.endswith(".md"):
            r = scan_file(f)
            if r:
                results.append(r)
    return results


def main():
    strict = "--strict" in sys.argv
    verbose = "--verbose" in sys.argv or "-v" in sys.argv

    print("🔍 ADR Validator (PROPOSAL_20260423_016)")
    print(f"Mode: {'STRICT（違規阻斷）' if strict else 'WARNING（僅報告）'}\n")

    all_results = []

    for d in SCAN_DIRS:
        results = scan_dir(AGENTS_ROOT / d)
        all_results.extend(results)
    for f in SCAN_ROOT_FILES:
        r = scan_file(AGENTS_ROOT / f)
        if r:
            all_results.append(r)

    totals = {"typeA": 0, "typeB": 0, "typeC": 0, "filesWithViolations": 0}
    violators = []

    for r in all_results:
        totals["typeA"] += r["typeA"]
        totals["typeB"] += r["typeB_count"]
        totals["typeC"] += r["typeC_residual"]
        if r["typeB_count"] > 0 or r["typeC_residual"] > 0:
            totals["filesWithViolations"] += 1
            violators.append(r)

    print("📊 引用統計：")
    print(f"  Type A（frontmatter audit trail；保留）：{totals['typeA']}")
    print(f"  Type B（內文標頭；應 Batch 2 清理）：{totals['typeB']}")
    print(f"  Type C（規則條款嵌入；應 Batch 4-5 清理）：{totals['typeC']}")
    print(
        f"  有違規的檔案數：{totals['filesWithViolations']} / {len(all_results)}"
    )

    if verbose and violators:
        print("\n違規詳情（前 10）：")
        for v in violators[:10]:
            rel = v["path"].replace(str(AGENTS_ROOT) + "/", "")
            print(f"  {rel}: B={v['typeB_count']}, C={v['typeC_residual']}")

    print("")
    has_violations = totals["typeB"] > 0 or totals["typeC"] > 0

    if not has_violations:
        print("✅ ADR Validator: 規則層已完全去 PROPOSAL 引用化")
        sys.exit(0)

    if strict:
        total = totals["typeB"] + totals["typeC"]
        print(
            f"❌ ADR Validator: 發現 {total} 處 Type B/C 引用（strict mode）",
            file=sys.stderr,
        )
        print("   修復路徑：", file=sys.stderr)
        print("   - Type B：移至檔案底部「Related Decisions」footer", file=sys.stderr)
        print("   - Type C：重寫為自我解釋條款 + 指向 ADR", file=sys.stderr)
        sys.exit(1)

    total = totals["typeB"] + totals["typeC"]
    print(f"⚠️  ADR Validator: 發現 {total} 處引用待清理（warning mode）")
    print("   預計於 PROPOSAL_20260423_016 Batch 2-5 完成")
    sys.exit(0)


if __name__ == "__main__":
    main()
