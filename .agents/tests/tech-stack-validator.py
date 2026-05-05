#!/usr/bin/env python3
"""tech-stack-validator.py — Port of tech-stack-validator.mjs (PROPOSAL_502_027 Sprint B).

PROPOSAL_20260423_017 Phase E + PROPOSAL_20260424_018 Phase F：
Tech-Stacks Catalog 一致性驗證。

檢查項目：
  1. MANIFEST.yaml 存在且可解析
  2. categories 區段存在 + 每個 stack.category 須為已定義
  3. MANIFEST 每個 stack entry 的 file/folder 路徑存在（若 installed:true）
  4. 實體 tech-stacks/ 下所有 .md 檔皆在 MANIFEST 中註冊
  5. depends_on 指向 MANIFEST 內已註冊的 stack name
  6. 無循環依賴（DFS 偵測）
  7. F2 class 的 stack 檔案（若 installed）須含「§專案特化」或 workspace 引用
  8. 資料夾模式須有 README.md + SOURCE.md
  9. vendor_source 存在時，vendor_last_vetted 應已填寫
 10. Workspace audit 欄位（last_audit_date / audit_interval_days）

退出碼：0 = pass, 1 = warnings, 2 = errors
"""
import re
import sys
from datetime import datetime, time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent.resolve()
TECH_STACKS_DIR = AGENTS_ROOT / "tech-stacks"
MANIFEST_PATH = TECH_STACKS_DIR / "MANIFEST.yaml"
CURRENT_WORKSPACE_PATH = AGENTS_ROOT / "CURRENT_WORKSPACE"

errors = 0
warnings = 0
error_msgs = []
warn_msgs = []


def error(msg):
    global errors
    errors += 1
    error_msgs.append(msg)
    print(f"❌ {msg}", file=sys.stderr)


def warn(msg):
    global warnings
    warnings += 1
    warn_msgs.append(msg)
    print(f"⚠️  {msg}")


def info(msg):
    print(f"ℹ️  {msg}")


def parse_scalar(s):
    """Parse a YAML scalar value."""
    s = (s or "").strip()
    s = re.sub(r"\s*#.*$", "", s).strip()
    if s == "" or s == "null" or s == "~":
        return None
    if s == "true":
        return True
    if s == "false":
        return False
    if re.match(r"^-?\d+(\.\d+)?$", s):
        try:
            if "." in s:
                f = float(s)
                # Match JS Number() semantics：1.0 → 1
                if f.is_integer():
                    return int(f)
                return f
            return int(s)
        except ValueError:
            return s
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    if s.startswith("'") and s.endswith("'"):
        return s[1:-1]
    if s.startswith("[") and s.endswith("]"):
        inner = s[1:-1].split(",")
        items = [parse_scalar(x) for x in inner]
        return [v for v in items if v is not None and v != ""]
    return s


def parse_manifest(text: str):
    """Minimal MANIFEST.yaml parser matching the .mjs structure."""
    out = {"version": None, "schema_version": None, "categories": {}, "stacks": []}
    mode = None
    cur_cat = None
    cur = None
    for raw in text.split("\n"):
        line = raw.rstrip("\r")
        if not line.strip() or re.match(r"^\s*#", line):
            continue
        indent_match = re.match(r"^(\s*)", line)
        indent = len(indent_match.group(1))
        t = line.strip()

        if indent == 0:
            m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", t)
            if not m:
                continue
            key = m.group(1)
            val = m.group(2)
            if key == "categories":
                mode = "categories"
                continue
            if key == "stacks":
                mode = "stacks"
                continue
            if key == "version":
                out["version"] = parse_scalar(val)
            if key == "schema_version":
                out["schema_version"] = parse_scalar(val)
            continue

        if mode == "categories":
            if indent == 2:
                m = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*$", t)
                if m:
                    cur_cat = m.group(1)
                    out["categories"][cur_cat] = {}
            elif indent == 4 and cur_cat:
                m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.+)$", t)
                if m:
                    out["categories"][cur_cat][m.group(1)] = parse_scalar(m.group(2))
        elif mode == "stacks":
            if indent == 2 and t.startswith("- name:"):
                cur = {"name": parse_scalar(t[len("- name:"):])}
                out["stacks"].append(cur)
            elif indent == 4 and cur is not None:
                m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", t)
                if m:
                    cur[m.group(1)] = parse_scalar(m.group(2))
    return out


def scan_physical_stacks():
    """Scan physical .md files / folder-stacks under tech-stacks/."""
    out = []
    if not TECH_STACKS_DIR.exists():
        return out

    def walk(d: Path):
        for entry in sorted(d.iterdir()):
            name = entry.name
            if name in ("MANIFEST.yaml", "README.md", ".gitkeep"):
                continue
            try:
                rel = entry.relative_to(TECH_STACKS_DIR).as_posix()
                if entry.is_dir():
                    has_readme = (entry / "README.md").exists()
                    has_source = (entry / "SOURCE.md").exists()
                    if has_readme or has_source:
                        out.append({"path": rel + "/", "type": "folder"})
                        continue  # 不深入
                    walk(entry)
                elif name.endswith(".md"):
                    out.append({"path": rel, "type": "file"})
            except OSError:
                continue

    walk(TECH_STACKS_DIR)
    return out


def detect_cycles(stacks):
    """DFS-based cycle detection."""
    by_name = {s["name"]: s for s in stacks if s.get("name")}
    color = {}  # 0/1/2: unvisited/visiting/done
    cycles = []

    def dfs(name, path):
        if color.get(name) == 2:
            return
        if color.get(name) == 1:
            try:
                idx = path.index(name)
                cycles.append(" → ".join(path[idx:] + [name]))
            except ValueError:
                pass
            return
        color[name] = 1
        s = by_name.get(name)
        deps = (s or {}).get("depends_on") or []
        if isinstance(deps, str):
            deps = [deps]
        for d in deps:
            if d not in by_name:
                continue
            dfs(d, path + [name])
        color[name] = 2

    for s in stacks:
        if s.get("name"):
            dfs(s["name"], [])
    return cycles


def main():
    print("🔍 Tech-Stack Validator (PROPOSAL_20260423_017 Phase E)")
    print("")

    if not MANIFEST_PATH.exists():
        try:
            rel_manifest = MANIFEST_PATH.relative_to(AGENTS_ROOT).as_posix()
        except ValueError:
            rel_manifest = str(MANIFEST_PATH)
        error(f"MANIFEST 不存在：{rel_manifest}")
        sys.exit(2)

    manifest = parse_manifest(MANIFEST_PATH.read_text(encoding="utf-8"))
    info(f"MANIFEST version: {manifest['version']}; schema: v{manifest['schema_version']}")
    info(f"Categories: {len(manifest['categories'])}; Stacks: {len(manifest['stacks'])}")

    # Check 1: categories 區段
    if not manifest["categories"]:
        error("MANIFEST 缺 categories 區段或為空")

    # Check 2-3: stack entries 完整性
    defined_cats = set(manifest["categories"].keys())
    all_names = set()
    for s in manifest["stacks"]:
        if not s.get("name"):
            error("stack entry 缺 name 欄位")
            continue
        if s["name"] in all_names:
            error(f"stack name 重複：{s['name']}")
        all_names.add(s["name"])

        if not s.get("category"):
            error(f"[{s['name']}] 缺 category 欄位")
        elif s["category"] not in defined_cats:
            error(f"[{s['name']}] 的 category \"{s['category']}\" 未在 categories 區段定義")

        if not s.get("file") and not s.get("folder"):
            error(f"[{s['name']}] 缺 file 或 folder 欄位（須擇一）")
        if s.get("file") and s.get("folder"):
            error(f"[{s['name']}] 同時有 file 和 folder（互斥）")

        # Check 3: installed 路徑存在性
        if s.get("installed") is True:
            rel_path = s.get("file") or s.get("folder")
            if rel_path:
                full_path = TECH_STACKS_DIR / rel_path
                if not full_path.exists():
                    error(f"[{s['name']}] installed:true 但檔案不存在：{rel_path}")
                elif s.get("folder"):
                    if not (full_path / "README.md").exists():
                        error(f"[{s['name']}] 資料夾模式缺 README.md：{rel_path}README.md")
                    if not (full_path / "SOURCE.md").exists():
                        warn(f"[{s['name']}] 資料夾模式建議補 SOURCE.md（audit trail）：{rel_path}SOURCE.md")

        # Check 9: vendor_source / vendor_last_vetted
        if s.get("vendor_source") and not s.get("vendor_last_vetted") and s.get("installed"):
            warn(f"[{s['name']}] 已 installed 且有 vendor_source，但 vendor_last_vetted 未填（audit trail 缺失）")

    # Check 4: 實體檔案 ↔ MANIFEST 雙向對應
    physical_stacks = scan_physical_stacks()
    manifest_paths = {s.get("file") or s.get("folder") for s in manifest["stacks"] if s.get("file") or s.get("folder")}
    for p in physical_stacks:
        if p["path"] not in manifest_paths:
            error(f"實體檔案未於 MANIFEST 註冊：{p['path']}")

    # Check 5: depends_on 合法性
    for s in manifest["stacks"]:
        deps = s.get("depends_on") or []
        if isinstance(deps, str):
            deps = [deps]
        for d in deps:
            if d not in all_names:
                error(f"[{s['name']}] depends_on \"{d}\" 未在 MANIFEST 中註冊")

    # Check 6: 循環依賴
    cycles = detect_cycles(manifest["stacks"])
    for c in cycles:
        error(f"循環依賴：{c}")

    # Check 7: F2 class 「§專案特化」或 workspace 引用
    keyword_re = re.compile(r"workspace\.|專案特化|特化參照|Fallback", re.IGNORECASE)
    for s in manifest["stacks"]:
        if s.get("class") != "F2" or s.get("installed") is not True:
            continue
        if s.get("folder"):
            rd = TECH_STACKS_DIR / s["folder"] / "README.md"
            if not rd.exists():
                continue
            c = rd.read_text(encoding="utf-8")
            if not keyword_re.search(c):
                warn(f"[{s['name']}] F2 資料夾 README.md 未見「workspace.* / 專案特化 / Fallback」關鍵字")
        elif s.get("file"):
            fp = TECH_STACKS_DIR / s["file"]
            if not fp.exists():
                continue
            c = fp.read_text(encoding="utf-8")
            if not keyword_re.search(c):
                warn(f"[{s['name']}] F2 檔案未見「workspace.* / 專案特化 / Fallback」關鍵字")

    # Check 10: Workspace audit 欄位
    if CURRENT_WORKSPACE_PATH.exists():
        ws_name = CURRENT_WORKSPACE_PATH.read_text(encoding="utf-8").strip()
        ws_path = AGENTS_ROOT / "workspaces" / f"{ws_name}.md" if ws_name else None
        if ws_path and ws_path.exists():
            ws_content = ws_path.read_text(encoding="utf-8")
            date_match = re.search(r"\*\*last_audit_date\*\*\s*[:：]\s*(\S+)", ws_content)
            interval_match = re.search(r"\*\*audit_interval_days\*\*\s*[:：]\s*(\S+)", ws_content)

            if date_match:
                val = date_match.group(1).strip()
                if val != "<not_applicable>":
                    if not re.match(r"^\d{4}-\d{2}-\d{2}$", val):
                        error(f"[workspace:{ws_name}] TECH_STACK.last_audit_date 格式錯誤（應為 YYYY-MM-DD）：{val}")
                    else:
                        try:
                            d = datetime.strptime(val, "%Y-%m-%d")
                        except ValueError:
                            d = None
                        today = datetime.combine(datetime.today().date(), time(23, 59, 59, 999000))
                        if d is None:
                            error(f"[workspace:{ws_name}] TECH_STACK.last_audit_date 非合法日期：{val}")
                        elif d > today:
                            error(f"[workspace:{ws_name}] TECH_STACK.last_audit_date 不可為未來日期：{val}")
                        elif interval_match:
                            int_val = interval_match.group(1).strip().replace("<not_applicable>", "")
                            try:
                                interval = float(int_val)
                            except ValueError:
                                interval = None
                            if interval is not None and interval > 0:
                                days_since = (today - d).days
                                if days_since > interval:
                                    warn(
                                        f"[workspace:{ws_name}] TECH_STACK audit 已過期 {days_since} 天（interval={int(interval) if float(interval).is_integer() else interval}）；建議執行 `python3 .agents/scripts/tech-stack-manage.py audit`"
                                    )

            if interval_match:
                val = interval_match.group(1).strip()
                if val != "<not_applicable>":
                    try:
                        n = float(val)
                        if not n.is_integer() or int(n) < 1:
                            raise ValueError()
                    except ValueError:
                        error(f"[workspace:{ws_name}] TECH_STACK.audit_interval_days 須為正整數：{val}")

    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    sys.exit(2 if errors > 0 else 1 if warnings > 0 else 0)


if __name__ == "__main__":
    main()
