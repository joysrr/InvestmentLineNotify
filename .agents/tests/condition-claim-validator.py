#!/usr/bin/env python3
"""Condition-Claim Meta-Validator (PROPOSAL_502_047 C-1)

掃 ADR / skill / task markdown 中「condition-claim 模式」反查實作對齊。
解 R5/R6 累積發現的「條文寫了但實作層未跟上」drift 模式。

Claim 模式：
1. validator claim: "validator 驗 X" / "validator 加 X 檢查" / "validator 加 enum X"
2. patrol claim: "patrol P-N" / "新建 P-N" / "P-N 偵測"
3. agent action claim（audit only；不強制）："sub-agent 必執行 X" / "agent 必寫 X"

對齊規則：
- validator claim → grep .agents/tests/*.py 含對應 enum / 欄位 / 邏輯
- patrol claim → grep patrol-notification-catalog.md 含 P-N 條目
- 不對齊 → fail with drift 報告
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS_DIR = ROOT / "tests"
DECISIONS_DIR = ROOT / "decisions"
SKILLS_DIR = ROOT / "skills"
TASKS_DIR = ROOT / "tasks"
PATROL_CATALOG = SKILLS_DIR / "patrol-notification-catalog.md"

ERRORS: list[str] = []
WARNINGS: list[str] = []


def _add_err(msg: str) -> None:
    ERRORS.append(msg)


def _add_warn(msg: str) -> None:
    WARNINGS.append(msg)


def scan_markdown_files() -> list[Path]:
    """掃所有 ADR / skill / task markdown（不含已 archived）"""
    files = []
    for d in (DECISIONS_DIR, SKILLS_DIR, TASKS_DIR):
        if d.is_dir():
            files.extend(d.rglob("*.md"))
    return [f for f in files if "archive" not in f.parts]


def extract_validator_claims(text: str, file_path: Path) -> list[tuple[str, str]]:
    """抽出文字中「validator 驗/加 X」claims；回 (claim, context) list

    限 ASCII identifier-like token（[a-zA-Z][a-zA-Z0-9_-]+）；避免中文 phrase 誤匹配。
    """
    claims = []
    # Pattern: "validator ..." 後接 ASCII identifier
    for m in re.finditer(
        r"validator\s*(?:驗|加|檢查|實作|enforce)[\s\S]{0,120}?[`\"']([a-zA-Z][a-zA-Z0-9_\-]{2,})[`\"']",
        text,
    ):
        claim = m.group(1)
        # 排除常見 noise
        if claim.lower() in {"schema", "enum", "field", "value", "type", "string", "bool", "int", "true", "false", "null"}:
            continue
        claims.append((claim, m.group(0)[:80]))
    return claims


def extract_patrol_claims(text: str) -> list[str]:
    """抽出 P-N 引用（如「P-39」「新建 P-N」）"""
    return re.findall(r"P-(\d{2,3})", text)


def check_validator_alignment(claims: list[tuple[str, str]], source_file: Path) -> None:
    """驗 validator claim 是否真實作"""
    # 抽 .py validator 文字
    validator_text = ""
    for v in TESTS_DIR.glob("*.py"):
        try:
            validator_text += v.read_text(encoding="utf-8") + "\n"
        except Exception:
            pass

    for claim, context in claims:
        # 簡易啟發式：claim 字串該在某 validator 出現（grep）
        # 排除常見 noise（schema / enum 等通用詞）
        if claim.lower() in {"schema", "enum", "field", "value", "type", "string", "bool", "int", "x"}:
            continue
        if claim not in validator_text:
            _add_warn(
                f"[drift?] {source_file.name}: validator claim '{claim}' 未在 tests/*.py 找到對應實作（context: {context}...）"
            )


def check_patrol_alignment(patrol_ids: set[str], source_file: Path) -> None:
    """驗 patrol P-N claim 是否真在 catalog 註冊"""
    if not PATROL_CATALOG.exists():
        return
    catalog_text = PATROL_CATALOG.read_text(encoding="utf-8")
    catalog_ids = set(re.findall(r"^\|\s*P-(\d{2,3})\s*\|", catalog_text, re.MULTILINE))

    for pid in patrol_ids:
        if pid not in catalog_ids:
            _add_err(
                f"[drift] {source_file.name}: 引用 P-{pid} 但 patrol-notification-catalog 無對應條目"
            )


def main() -> int:
    print("🔍 Running Condition-Claim Meta-Validator (PROPOSAL_502_047 C-1)")
    print("ℹ️  掃 ADR / skill / task 中 condition-claim 反查實作對齊")
    print()

    md_files = scan_markdown_files()
    print(f"ℹ️  Scanned {len(md_files)} markdown file(s)")

    all_patrol_claims: dict[Path, set[str]] = {}
    all_validator_claims: dict[Path, list[tuple[str, str]]] = {}

    for md in md_files:
        try:
            text = md.read_text(encoding="utf-8")
        except Exception:
            continue

        # validator claims
        v_claims = extract_validator_claims(text, md)
        if v_claims:
            all_validator_claims[md] = v_claims

        # patrol claims
        p_claims = set(extract_patrol_claims(text))
        if p_claims:
            all_patrol_claims[md] = p_claims

    # 對齊檢查
    for md, claims in all_validator_claims.items():
        check_validator_alignment(claims, md)

    for md, pids in all_patrol_claims.items():
        check_patrol_alignment(pids, md)

    # Output
    print("\n──────────────────────────────────────────────────")
    for w in WARNINGS:
        print(f"⚠️  [WARN] {w}")
    for e in ERRORS:
        print(f"❌ [ERROR] {e}")
    print(f"\nSummary: errors={len(ERRORS)}, warnings={len(WARNINGS)}")
    print("──────────────────────────────────────────────────")

    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
