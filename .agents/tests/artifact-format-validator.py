#!/usr/bin/env python3
"""artifact-format-validator.py — Port of artifact-format-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證產出物符合 M2M 合約（PROPOSAL_20260422_003）。
使用：python3 .agents/tests/artifact-format-validator.py <file>

退出碼：
  0 = OK
  1 = unknown artifact type
  2 = error / 首行格式違反
"""
import re
import sys
from pathlib import Path

RULES = {
    "REVIEW_REPORT": {
        "first_line": re.compile(r"^[🔴❌🟡✅🟢]\s+.+$"),
        "description": "第一行為五級符號 + 一句話摘要",
    },
    "SECURITY_REPORT": {
        "first_line": re.compile(r"^【@Security 資安審查報告】[🔴❌🟡✅🟢]\s+.+$"),
        "description": "第一行為 【@Security 資安審查報告】<符號> <摘要>",
    },
    "TEST_REPORT": {
        "first_line": re.compile(r"^[🔴❌🟡✅🟢]\s+測試結論[：:]\s*(通過|未通過)"),
        "description": "第一行為 <符號> 測試結論：通過/未通過",
    },
    "TEST_SPEC": {
        "first_line": re.compile(r"^📋\s*TEST_SPEC[：:]\s*.+$"),
        "description": "第一行為 📋 TEST_SPEC: <功能名稱>",
    },
}

FORBIDDEN_PREAMBLES = ["好的", "我已", "經過", "讓我", "首先"]
FORBIDDEN_CLOSINGS = ["希望", "以上是", "請參考", "如有", "謝謝"]


def detect_type(file_path: str) -> str | None:
    name = file_path.split("/")[-1]
    if "REVIEW_REPORT" in name:
        return "REVIEW_REPORT"
    if "SECURITY_REPORT" in name:
        return "SECURITY_REPORT"
    if "TEST_REPORT" in name:
        return "TEST_REPORT"
    if re.search(r"TEST_SPEC_", name):
        return "TEST_SPEC"
    return None


def validate_artifact(file_path: str) -> int:
    p = Path(file_path)
    if not p.exists():
        print(f"❌ File not found: {file_path}", file=sys.stderr)
        return 2

    art_type = detect_type(file_path)
    if not art_type:
        print(f"⚠️  Unknown artifact type: {file_path}", file=sys.stderr)
        return 1

    rule = RULES[art_type]
    content = p.read_text(encoding="utf-8")
    lines = content.split("\n")
    first_line = lines[0] if lines else ""

    print(f"🔍 Validating {art_type}: {file_path}\n")

    errors = 0

    # 1. 首行符號錨點
    if not rule["first_line"].match(first_line):
        print(
            f"❌ First line does not match: {rule['description']}",
            file=sys.stderr,
        )
        print(f'   Found: "{first_line[:60]}..."', file=sys.stderr)
        errors += 1
    else:
        print("✅ First line format OK")

    # 2. 禁止前言
    for preamble in FORBIDDEN_PREAMBLES:
        if preamble in content[:500]:
            print(
                f'⚠️  Possible forbidden preamble found: "{preamble}"',
                file=sys.stderr,
            )

    # 3. 禁止結語
    last_chunk = content[-500:]
    for closing in FORBIDDEN_CLOSINGS:
        if closing in last_chunk:
            print(
                f'⚠️  Possible forbidden closing found: "{closing}"',
                file=sys.stderr,
            )

    print("\n─────────────────────────────")
    print(f"Summary: {errors} errors")
    print("─────────────────────────────")
    return 2 if errors > 0 else 0


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: python3 artifact-format-validator.py <file>", file=sys.stderr
        )
        sys.exit(2)
    sys.exit(validate_artifact(sys.argv[1]))


if __name__ == "__main__":
    main()
