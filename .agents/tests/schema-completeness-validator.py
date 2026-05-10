#!/usr/bin/env python3
"""Schema Completeness Meta-Validator (PROPOSAL_502_047 C-2)

解 R5-3 雙重盲點：framework 各處 grep 引用 yaml 欄位，但 schema 從未明文宣告。

掃描：
1. routing-ticket-protocol.md §schema 抽出已定義欄位
2. rules/ + skills/ + tasks/ + decisions/ 中 grep 「yaml-like」欄位引用
   - pattern: `\\.<field_name>` / `<field_name>:` 在 ROUTING_TICKET context 中
3. 引用 - 已定義 = 未宣告但被引用 → drift（需補 schema）
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "skills" / "routing-ticket-protocol.md"
SCAN_DIRS = [ROOT / "rules", ROOT / "skills", ROOT / "tasks", ROOT / "decisions"]

ERRORS: list[str] = []
WARNINGS: list[str] = []


def extract_schema_fields() -> set[str]:
    """從 routing-ticket-protocol.md §schema yaml 區塊抽出已定義欄位"""
    if not SCHEMA_FILE.exists():
        return set()
    text = SCHEMA_FILE.read_text(encoding="utf-8")

    # 抽 ```yaml ... ``` 區塊內的欄位
    fields: set[str] = set()
    in_yaml = False
    for line in text.splitlines():
        if line.strip().startswith("```yaml"):
            in_yaml = True
            continue
        if line.strip().startswith("```") and in_yaml:
            in_yaml = False
            continue
        if in_yaml:
            # 抽 "field_name:" 或 "  field_name:"
            m = re.match(r"^\s{0,4}([a-z_][a-z0-9_]+):", line)
            if m:
                fields.add(m.group(1))
    return fields


def extract_referenced_fields() -> dict[str, list[Path]]:
    """掃 rules/skills/tasks/decisions 中提及 ROUTING_TICKET 欄位的引用

    保守 heuristic：grep 「ROUTING_TICKET」附近 + 「ticket.\\w+」反向參照 + ${...} 引用
    """
    refs: dict[str, list[Path]] = {}

    for d in SCAN_DIRS:
        if not d.is_dir():
            continue
        for md in d.rglob("*.md"):
            if "archive" in md.parts:
                continue
            try:
                text = md.read_text(encoding="utf-8")
            except Exception:
                continue
            # Pattern A: 「ticket `field_name`」 / 「ROUTING_TICKET ... `field_name`」
            for m in re.finditer(
                r"(?:ticket|ROUTING_TICKET|routing[-_]ticket|routing_ticket)\s*[\.\s][^\n]{0,80}?[`\"']([a-z_][a-z0-9_]+)[`\"']",
                text,
                re.IGNORECASE,
            ):
                field = m.group(1)
                if len(field) >= 3:
                    refs.setdefault(field, []).append(md)
            # Pattern B: schema-like inline 「`field_name:`」 in markdown
            for m in re.finditer(
                r"(?:必填|選填|optional|required|frontmatter)\s*[`\"']?([a-z_][a-z0-9_]+)[`\"']?",
                text,
                re.IGNORECASE,
            ):
                field = m.group(1)
                if len(field) >= 5:  # 較嚴；避免 noise
                    refs.setdefault(field, []).append(md)

    return refs


def main() -> int:
    print("🔍 Running Schema Completeness Meta-Validator (PROPOSAL_502_047 C-2)")
    print("ℹ️  解 R5-3 雙重盲點：實作引用 yaml 欄位 ↔ schema 定義對齊")
    print()

    schema_fields = extract_schema_fields()
    refs = extract_referenced_fields()

    print(f"ℹ️  Schema 已定義欄位 {len(schema_fields)} 個")
    print(f"ℹ️  Framework 引用候選 {len(refs)} 個（含 noise；會過濾）")

    # 過濾 noise：常見通用詞 / 非 ROUTING_TICKET 欄位
    noise = {
        "name", "type", "value", "key", "id", "data", "info", "text", "description",
        "title", "status", "version", "field", "fields", "default", "format",
        "schema", "metadata", "frontmatter", "yaml", "block", "content", "body",
        "label", "header", "footer", "summary", "result", "output", "input",
        "method", "function", "module", "class", "object", "array", "string",
        "boolean", "number", "integer", "tags", "list", "dict", "config",
        "settings", "options", "params", "args", "main", "test", "example",
        # 框架專用名（非 ticket schema）
        "wing", "room", "drawer", "rule", "skill", "task", "proposal",
        "prior", "review", "audit", "plan", "report",
    }
    candidates = {k: v for k, v in refs.items() if k not in noise and k not in schema_fields}

    if candidates:
        for field, files in sorted(candidates.items()):
            file_list = ", ".join(sorted(set(f.name for f in files))[:3])
            WARNINGS.append(
                f"潛在 schema gap: 欄位 '{field}' 被 {len(set(files))} 檔引用但 schema 未定義（{file_list}...）"
            )
    else:
        print("ℹ️  schema completeness OK")

    # Output
    print("\n──────────────────────────────────────────────────")
    for w in WARNINGS[:20]:  # 限 20 條避免輸出爆炸
        print(f"⚠️  [WARN] {w}")
    if len(WARNINGS) > 20:
        print(f"⚠️  [WARN] ... 還有 {len(WARNINGS) - 20} 條 schema gap warnings 略")
    for e in ERRORS:
        print(f"❌ [ERROR] {e}")
    print(f"\nSummary: errors={len(ERRORS)}, warnings={len(WARNINGS)}")
    print("──────────────────────────────────────────────────")

    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
