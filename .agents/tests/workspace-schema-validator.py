#!/usr/bin/env python3
"""workspace-schema-validator.py — Workspace SCHEMA validator (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of workspace-schema-validator.mjs
(PROPOSAL_20260422_022 Phase E).

驗證 WORKSPACE_SCHEMA.yaml 與當前 active workspace 的欄位對齊性。

使用：python3 .agents/tests/workspace-schema-validator.py [--workspace <name>] [--strict]

退出碼：
  0 = 通過
  1 = 警告（required 齊全、僅 optional 缺失 / Markdown 標題不對齊）
  2 = 錯誤（required 欄位缺失 / SCHEMA 無法解析 / workspace 不存在）
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
SCHEMA_PATH = AGENTS_ROOT / "WORKSPACE_SCHEMA.yaml"
CURRENT_WORKSPACE_PATH = AGENTS_ROOT / "CURRENT_WORKSPACE"
WORKSPACES_DIR = AGENTS_ROOT / "workspaces"
SKILLS_DIR = AGENTS_ROOT / "skills"
TASKS_DIR = AGENTS_ROOT / "tasks"

errors = 0
warnings = 0


def err(msg: str) -> None:
    global errors
    print(f"❌ [ERROR] {msg}", file=sys.stderr)
    errors += 1


def warn(msg: str) -> None:
    global warnings
    print(f"⚠️  [WARN]  {msg}", file=sys.stderr)
    warnings += 1


def info(msg: str) -> None:
    print(f"ℹ️  {msg}")


# -------- Minimal YAML parser (mirrors mjs version) --------
def split_top_level(s: str, sep: str):
    out = []
    buf = ""
    depth = 0
    for c in s:
        if c in "[{":
            depth += 1
        if c in "]}":
            depth -= 1
        if c == sep and depth == 0:
            out.append(buf)
            buf = ""
        else:
            buf += c
    if buf.strip():
        out.append(buf)
    return out


def parse_scalar(s):
    s = s.strip()
    if s == "true":
        return True
    if s == "false":
        return False
    if s == "null" or s == "":
        return None
    if re.match(r"^-?\d+(\.\d+)?$", s):
        try:
            if "." in s:
                return float(s)
            return int(s)
        except ValueError:
            return s
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    if s.startswith("'") and s.endswith("'"):
        return s[1:-1]
    if s.startswith("[") and s.endswith("]"):
        return [parse_scalar(x) for x in split_top_level(s[1:-1], ",")]
    return s


def parse_yaml(text: str):
    root = {}
    stack = [{"indent": -1, "obj": root}]
    for raw_line in text.split("\n"):
        line = raw_line.rstrip("\r")
        if not line.strip() or re.match(r"^\s*#", line):
            continue
        indent_match = re.match(r"^(\s*)", line)
        indent = len(indent_match.group(1)) if indent_match else 0
        stripped = line.strip()
        while len(stack) > 1 and stack[-1]["indent"] >= indent:
            stack.pop()
        parent = stack[-1]["obj"]
        kv = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", stripped)
        if kv:
            key = kv.group(1)
            rest = re.sub(r"\s*#.*$", "", kv.group(2)).strip()
            if rest == "":
                parent[key] = {}
                stack.append({"indent": indent, "obj": parent[key]})
            elif rest.startswith("{") and rest.endswith("}"):
                inner = rest[1:-1]
                obj = {}
                for p in split_top_level(inner, ","):
                    m = re.match(r"^\s*([A-Za-z_][\w]*)\s*:\s*(.+?)\s*$", p)
                    if m:
                        obj[m.group(1)] = parse_scalar(m.group(2))
                parent[key] = obj
            else:
                parent[key] = parse_scalar(rest)
    return root


# -------- Extract field definitions from parsed schema --------
def flatten_schema(schema, prefix=""):
    out = {}
    for k, v in schema.items():
        if k in ("schema_version", "last_modified", "last_proposal"):
            continue
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and "type" in v:
            out[path] = v
        elif isinstance(v, dict):
            out.update(flatten_schema(v, path))
    return out


def escape_regexp(s: str) -> str:
    return re.escape(s)


def check_workspace_has_section(md_content: str, section_title: str) -> bool:
    pattern = re.compile(rf"^##+\s*{escape_regexp(section_title)}", re.MULTILINE)
    return bool(pattern.search(md_content))


def validate_skills_and_tasks(top_level_keys):
    dirs = [(SKILLS_DIR, "skill"), (TASKS_DIR, "task")]
    allowed_prefixes = set(top_level_keys) | {"WORKSPACE_SCHEMA", "CURRENT_WORKSPACE"}
    scanned = 0
    f2_count = 0

    for dir_path, label in dirs:
        if not dir_path.exists():
            continue
        for f in sorted(dir_path.iterdir()):
            if not (f.is_file() and f.name.endswith(".md")):
                continue
            scanned += 1
            content = f.read_text(encoding="utf-8")
            mr_match = re.search(r"<!--\s*MACHINE_READABLE\s*([\s\S]*?)-->", content)
            has_references_section = bool(re.search(r"##\s+🔗?\s*專案特化參照", content))

            category = None
            anchor_type = None
            if mr_match:
                anchor = mr_match.group(1)
                type_match = re.search(r"type:\s*([a-z-]+)", anchor)
                category_match = re.search(r"category:\s*(F[123])", anchor)
                anchor_type = type_match.group(1) if type_match else None
                if anchor_type == "project-specific-references":
                    category = category_match.group(1) if category_match else None

            if category == "F2":
                f2_count += 1
                if not has_references_section:
                    err(f"F2 {label} missing §專案特化參照 section: {f.name}")
                    continue
                ref_block_match = re.search(r"##\s+🔗[\s\S]*$", content)
                if ref_block_match:
                    block = ref_block_match.group(0)
                    refs = re.findall(r"`([A-Z][A-Z_]+)(?:\.[\w.*]+)?`", block)
                    unique = list(dict.fromkeys(refs))
                    for key in unique:
                        if key not in allowed_prefixes:
                            warn(
                                f"F2 {label} {f.name}: referenced workspace key "
                                f'"{key}" not in WORKSPACE_SCHEMA top-level'
                            )
            elif category == "F3":
                err(
                    f"F3 category 禁止於 .agents/skills/ 或 .agents/tasks/"
                    f"（應入 workspace 實值欄位）: {f.name}"
                )
            elif not category and has_references_section:
                warn(
                    f"{label} {f.name}: has §專案特化參照 but missing F2 MACHINE_READABLE anchor "
                    "(F1 類勿用此區塊；F2 類請補 anchor)"
                )

    info(f"Scanned {scanned} skills/tasks files; F2 identified: {f2_count}")


# -------- CLI args --------
def parse_args(argv):
    target_workspace = None
    strict = False
    i = 0
    while i < len(argv):
        if argv[i] == "--workspace" and i + 1 < len(argv):
            target_workspace = argv[i + 1]
            i += 2
            continue
        if argv[i] == "--strict":
            strict = True
        if argv[i] in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        i += 1
    return target_workspace, strict


def summary(strict: bool) -> int:
    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors > 0:
        return 2
    if warnings > 0:
        return 1
    return 0


def main() -> int:
    target_workspace, strict = parse_args(sys.argv[1:])

    if not SCHEMA_PATH.exists():
        err(f"SCHEMA not found: {SCHEMA_PATH}")
        return 2

    schema_text = SCHEMA_PATH.read_text(encoding="utf-8")
    try:
        schema = parse_yaml(schema_text)
    except Exception as e:
        err(f"YAML parse failed: {e}")
        return 2

    info(f"Schema version: {schema.get('schema_version', '<unknown>')}")
    fields = flatten_schema(schema)
    required_fields = [k for k, v in fields.items() if v.get("required") is True]
    info(f"Total fields: {len(fields)}; Required: {len(required_fields)}")

    # interactive / auto_populate 合法性檢查（schema v1.4+）
    VALID_AUTO_SOURCES = {"system", "default", "derive_from_stacks"}
    for path, defn in fields.items():
        if defn.get("interactive") is False:
            ap = defn.get("auto_populate")
            if not isinstance(ap, dict):
                err(f'schema field "{path}" has interactive:false but missing auto_populate block')
                continue
            src = ap.get("source")
            if src not in VALID_AUTO_SOURCES:
                err(
                    f'schema field "{path}" auto_populate.source "{src}" not in '
                    "[system, default, derive_from_stacks]"
                )
            if src == "system" and ap.get("value") != "today":
                warn(f'schema field "{path}" auto_populate.source=system；目前僅支援 value: today')
        if defn.get("auto_populate") and defn.get("interactive") is not False:
            warn(
                f'schema field "{path}" has auto_populate but interactive not set to false'
                "（auto_populate 不會被套用）"
            )

    top_level_keys = [
        k for k in schema.keys()
        if k not in ("schema_version", "last_modified", "last_proposal")
    ]

    validate_skills_and_tasks(top_level_keys)

    # 決定目標 workspace
    if not target_workspace:
        if CURRENT_WORKSPACE_PATH.exists():
            target_workspace = CURRENT_WORKSPACE_PATH.read_text(encoding="utf-8").strip()
    if not target_workspace or target_workspace == "default_env":
        warn(
            f'No active workspace set (CURRENT_WORKSPACE = "{target_workspace or "<empty>"}");'
            " skip workspace field validation"
        )
        return summary(strict)

    workspace_file = WORKSPACES_DIR / f"{target_workspace}.md"
    if not workspace_file.exists():
        err(f"Workspace file not found: {workspace_file}")
        return summary(strict)

    md_content = workspace_file.read_text(encoding="utf-8")

    # top-level sections
    for key in top_level_keys:
        has_section = check_workspace_has_section(md_content, key)
        if not has_section:
            child_required = any(f.startswith(f"{key}.") or f == key for f in required_fields)
            if child_required:
                err(f"workspace missing required section: {key}")
            else:
                warn(f"workspace missing optional section: {key}")

    # required 欄位的 key 出現在 workspace md
    for req_key in required_fields:
        leaf_name = req_key.split(".")[-1]
        pattern = re.compile(rf"\*\*{escape_regexp(leaf_name)}\*\*\s*[:：]", re.MULTILINE)
        if not pattern.search(md_content):
            err(
                f'workspace "{target_workspace}" missing required field: '
                f"{req_key} (leaf: {leaf_name})"
            )

    return summary(strict)


if __name__ == "__main__":
    sys.exit(main())
