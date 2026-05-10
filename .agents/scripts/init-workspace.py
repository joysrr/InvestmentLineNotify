#!/usr/bin/env python3
"""init-workspace.py — Interactive workspace initialization CLI (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port (PyYAML for --config) of init-workspace.mjs
(PROPOSAL_20260423_005 + PROPOSAL_20260424_018 Phase B + PROPOSAL_20260424_019 F-3).

對齊 tasks/project-onboarding-workflow.md 6 步驟 SOP

使用：
  python3 .agents/scripts/init-workspace.py                 # 基本互動模式
  python3 .agents/scripts/init-workspace.py --name myapp    # 指定名稱跳過第一問
  python3 .agents/scripts/init-workspace.py --dry-run       # 僅預覽不寫檔
  python3 .agents/scripts/init-workspace.py --force         # 覆寫已存在 CURRENT_WORKSPACE
  python3 .agents/scripts/init-workspace.py --config <yaml> # 非互動模式
  python3 .agents/scripts/init-workspace.py --help          # 顯示說明
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent.resolve()
SCHEMA_PATH = AGENTS_ROOT / "WORKSPACE_SCHEMA.yaml"
CURRENT_WORKSPACE_PATH = AGENTS_ROOT / "CURRENT_WORKSPACE"
WORKSPACES_DIR = AGENTS_ROOT / "workspaces"
TECH_STACKS_DIR = AGENTS_ROOT / "tech-stacks"
WORKSPACES_README = WORKSPACES_DIR / "README.md"

# -------- CLI args --------
nameArg = None
dryRun = False
force = False
configPath = None


def parse_cli_args():
    global nameArg, dryRun, force, configPath
    args = sys.argv[1:]
    show_help = False
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--name" and i + 1 < len(args):
            nameArg = args[i + 1]
            i += 2
            continue
        if a == "--dry-run":
            dryRun = True
        elif a == "--force":
            force = True
        elif a == "--config" and i + 1 < len(args):
            configPath = args[i + 1]
            i += 2
            continue
        elif a in ("--help", "-h"):
            show_help = True
        i += 1
    return show_help


def print_help():
    print("""
init-workspace.py — Interactive workspace initialization CLI

USAGE:
  python3 .agents/scripts/init-workspace.py [OPTIONS]

OPTIONS:
  --name <name>    Specify workspace name (skip first prompt)
  --dry-run        Preview without writing files
  --force          Overwrite existing CURRENT_WORKSPACE without confirmation
  --config <yaml>  Non-interactive mode; read all answers + tech-stack choices from YAML
                   (PROPOSAL_20260424_018 Phase B; 供 agent 驅動 onboarding)
  --help, -h       Show this help

DESCRIPTION:
  依 .agents/tasks/project-onboarding-workflow.md 6 步驟 SOP 引導建立新專案 workspace。
  動態讀取 .agents/WORKSPACE_SCHEMA.yaml 產生問答；新增 schema 欄位 CLI 自動涵蓋。

  產出：
    - .agents/workspaces/<name>.md             （填好的 workspace 檔）
    - .agents/workspaces/<name>/proposals/     （專案 scope 提案目錄）
    - .agents/CURRENT_WORKSPACE                （寫入 <name>）
    - 更新 .agents/workspaces/README.md 當前已建立的 workspace 表格

  失敗完整回退；不留半成品。
  結束前呼叫 workspace-schema-validator.py 驗證；失敗則回退。
  成功後呼叫 mempalace wake-up 注入 L0+L1 跨 session 上下文（PROPOSAL_502_003 C-3）。

REFERENCE:
  PROPOSAL_20260423_005 / tasks/project-onboarding-workflow.md / WORKSPACE_SCHEMA.yaml
  PROPOSAL_20260502_003 C-3（workspace switch wake-up）
""")


def fatal(msg: str) -> None:
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(2)


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
        indent_m = re.match(r"^(\s*)", line)
        indent = len(indent_m.group(1)) if indent_m else 0
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


# -------- Auto-populate helpers (PROPOSAL_20260424_019 F-3) --------
def resolve_auto_populate(ap_cfg):
    if not isinstance(ap_cfg, dict):
        return None
    source = ap_cfg.get("source")
    value = ap_cfg.get("value")
    if source == "system":
        if value == "today":
            return datetime.utcnow().strftime("%Y-%m-%d")
        return None
    if source == "default":
        return str(value) if value is not None else None
    return None  # derive_from_stacks 由 selectTechStacks 處理


def apply_auto_populate(schema, answers):
    for block, block_fields in schema.items():
        if block in ("schema_version", "last_modified", "last_proposal"):
            continue
        if not isinstance(block_fields, dict):
            continue
        if isinstance(block_fields.get("type"), str):
            continue
        for field, defn in block_fields.items():
            if not isinstance(defn, dict) or "type" not in defn:
                continue
            if defn.get("interactive") is not False:
                continue
            if not defn.get("auto_populate"):
                continue
            key = f"{block}.{field}"
            if key in answers and answers[key] != "<not_applicable>":
                continue
            v = resolve_auto_populate(defn["auto_populate"])
            if v is not None:
                answers[key] = v
    return answers


# -------- Renderers --------
def render_workspace_md(name: str, answers: dict) -> str:
    lines = []
    today = datetime.utcnow().strftime("%Y-%m-%d")
    lines.append(f"# Workspace: {name}")
    lines.append("")
    lines.append("> 由 `.agents/scripts/init-workspace.py` CLI 建立（依 PROPOSAL_20260423_005）")
    lines.append(f"> 建立日期：{today}")
    lines.append("> **契約**：所有欄位定義參照 `.agents/WORKSPACE_SCHEMA.yaml` SSOT")
    lines.append("")
    lines.append("---")
    lines.append("")

    blocks = {}
    single_field_blocks = {}
    for key, value in answers.items():
        if "." in key:
            block, field = key.split(".", 1)
            blocks.setdefault(block, {})[field] = value
        else:
            single_field_blocks[key] = value

    for block, fields in blocks.items():
        lines.append(f"## {block}")
        lines.append("")
        for field, value in fields.items():
            lines.append(f"- **{field}**：{value}")
        lines.append("")

    for block, value in single_field_blocks.items():
        lines.append(f"## {block}")
        lines.append("")
        lines.append(str(value))
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("**維護紀錄**：")
    lines.append(f"- {today} 由 init-workspace.py CLI 建立")
    lines.append("")
    return "\n".join(lines)


def render_proposal_index_shell(name: str) -> str:
    return f"""# PROPOSAL_INDEX — Project Scope ({name})

> 本索引管理 `workspaces/{name}/proposals/` 下的 **project scope** 提案（依 PROPOSAL_20260422_023）。
> Framework scope 提案索引請見 `.agents/proposals/PROPOSAL_INDEX.md`。

## 統計摘要

| 狀態 | 數量 | 目錄 |
|------|------|------|
| OPEN | 0 | active/ |
| IN_PROGRESS | 0 | active/ |
| DONE | 0 | completed/ |
| CANCELLED | 0 | completed/ |
| ARCHIVED | 0 | archived/ |
| **合計** | **0** | — |

## 🟡 OPEN（待執行）

| 編號 | 標題 | 優先級 | 提案日期 | 前置依賴 |
|------|------|-------|---------|---------|
| — | （目前無待執行項目）| — | — | — |

## 🔵 IN_PROGRESS（執行中）

| 編號 | 標題 | 優先級 | 開始日期 | 預計完成 |
|------|------|-------|---------|---------|
| — | （目前無執行中項目）| — | — | — |

## ✅ DONE（已完成）

| 編號 | 標題 | 優先級 | 完成日期 | 執行者 |
|------|------|-------|---------|-------|
| — | （尚無完成項目）| — | — | — |
"""


# -------- Input wrapper（input() 自動接 stdin / TTY 雙模） --------
def question(prompt: str) -> str:
    sys.stdout.write(prompt)
    sys.stdout.flush()
    try:
        line = sys.stdin.readline()
    except KeyboardInterrupt:
        print("\n\n⚠️  使用者中斷（Ctrl+C）。若已有變更將執行回退。")
        sys.exit(130)
    if line == "":  # EOF
        return ""
    return line.rstrip("\n").rstrip("\r")


# -------- Tech-stacks availability scan --------
def scan_available_tech_stacks():
    if not TECH_STACKS_DIR.exists():
        return []
    manifest_path = TECH_STACKS_DIR / "MANIFEST.yaml"
    if manifest_path.exists():
        try:
            names = []
            for raw in manifest_path.read_text(encoding="utf-8").split("\n"):
                m = re.match(r"^\s*-\s*name:\s*(.+?)\s*(?:#.*)?$", raw)
                if m:
                    n = re.sub(r"^[\"']|[\"']$", "", m.group(1))
                    names.append(n)
            if names:
                return names
        except Exception:
            pass
    out = []
    for dirpath, dirnames, filenames in os.walk(TECH_STACKS_DIR):
        for fn in filenames:
            if fn.endswith(".md"):
                out.append(fn[:-3])
    return out


def load_manifest_stacks():
    manifest_path = TECH_STACKS_DIR / "MANIFEST.yaml"
    if not manifest_path.exists():
        return None
    text = manifest_path.read_text(encoding="utf-8")
    stacks = []
    cur = None
    for raw in text.split("\n"):
        line = raw.rstrip("\r")
        if not line.strip() or re.match(r"^\s*#", line):
            continue
        indent_m = re.match(r"^(\s*)", line)
        indent = len(indent_m.group(1)) if indent_m else 0
        stripped = line.strip()
        if indent == 2 and stripped.startswith("- name:"):
            name_str = stripped[len("- name:"):].strip()
            name_str = re.sub(r"^[\"']|[\"']$", "", name_str)
            cur = {"name": name_str}
            stacks.append(cur)
        elif indent == 4 and cur is not None:
            m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.+?)\s*(?:#.*)?$", stripped)
            if m:
                val = m.group(2).strip()
                if val == "true":
                    cur[m.group(1)] = True
                elif val == "false":
                    cur[m.group(1)] = False
                elif val.startswith("[") and val.endswith("]"):
                    items = [x.strip() for x in val[1:-1].split(",") if x.strip()]
                    cur[m.group(1)] = items
                else:
                    cur[m.group(1)] = val
    return stacks


def answer_matches_available_stacks(answer, stacks):
    if not answer or answer == "<not_applicable>":
        return True
    low_ans = answer.lower()
    return any(low_ans in s.lower() or s.lower() in low_ans for s in stacks)


# -------- Step 0: 前置檢查 --------
def pre_check():
    if not SCHEMA_PATH.exists():
        fatal(f"Schema not found: {SCHEMA_PATH}")
    previous_workspace = None
    if CURRENT_WORKSPACE_PATH.exists():
        previous_workspace = CURRENT_WORKSPACE_PATH.read_text(encoding="utf-8").strip()
        if previous_workspace and not force:
            ans = question(
                f'⚠️  CURRENT_WORKSPACE = "{previous_workspace}"；'
                "確定建立新 workspace 並切換？[y/N] "
            )
            if not ans.lower().startswith("y"):
                print("使用者取消。")
                sys.exit(0)
    schema = parse_yaml(SCHEMA_PATH.read_text(encoding="utf-8"))
    available = scan_available_tech_stacks()
    print(f"\n📋 已載入 WORKSPACE_SCHEMA（version: {schema.get('schema_version', 'unknown')}）")
    print(f"📋 已掃描 tech-stacks/（{len(available)} 份可用）")
    if available:
        head = ", ".join(available[:6])
        more = " ..." if len(available) > 6 else ""
        print(f"   可用清單：{head}{more}")
    return schema, available, previous_workspace


# -------- Step 1-5: 逐 schema 區塊問答 --------
def collect_answers(schema, available_tech_stacks, name_override):
    answers = {}
    top_blocks = [
        k for k in schema.keys()
        if k not in ("schema_version", "last_modified", "last_proposal")
    ]

    name = name_override
    if not name:
        while True:
            name = question("\nproject_name [required, snake_case 英文代號]: ").strip()
            if not name:
                print("❌ project_name 必填")
                continue
            if not re.match(r"^[a-z][a-z0-9_]*$", name):
                print("❌ 格式錯誤：須為小寫字母開頭，僅含英數與底線")
                continue
            break
    else:
        if not re.match(r"^[a-z][a-z0-9_]*$", name):
            fatal(f'--name "{name}" 格式錯誤（須 snake_case 英文）')
    answers["PROJECT_CONTEXT.project_name"] = name

    for block in top_blocks:
        block_fields = schema[block]
        if not isinstance(block_fields, dict):
            continue

        # Case 1: 頂層 block 本身為單一 field
        if isinstance(block_fields.get("type"), str):
            print(f"\n=== {block} ===")
            hint = "[required]" if block_fields.get("required") else "[optional]"
            desc = f"\n  （{block_fields['description']}）" if block_fields.get("description") else ""
            ans = question(f"\n{block} {hint}:{desc}\n> ").strip()
            if block_fields.get("required") and not ans:
                fatal(f'required block "{block}" 未填寫；無法繼續')
            answers[block] = ans or "<not_applicable>"
            continue

        print(f"\n=== {block} ===")
        for field, defn in block_fields.items():
            if block == "PROJECT_CONTEXT" and field == "project_name":
                continue
            if isinstance(defn, dict) and defn.get("interactive") is False:
                continue
            is_field_def = isinstance(defn, dict) and "type" in defn
            if not is_field_def:
                print(f"\n  -- {block}.{field}（子區塊；可選）--")
                sub = question(f"  {block}.{field}（輸入 YAML 片段或留白跳過）: ").strip()
                if sub:
                    answers[f"{block}.{field}"] = sub
                continue

            hint = "[required]" if defn.get("required") else "[optional]"
            desc = f"\n  （{defn['description']}）" if defn.get("description") else ""
            ans = question(f"\n{block}.{field} {hint}:{desc}\n> ").strip()

            # TECH_STACK 熔斷檢查
            if (
                block == "TECH_STACK"
                and ans
                and not answer_matches_available_stacks(ans, available_tech_stacks)
            ):
                print(f'⚠️  "{ans}" 無對應 tech-stacks/*.md。')
                choice = question(
                    "  [1] 中止並先產出 tech-stacks 提案 / "
                    "[2] 跳過該技術棧規範（採通用）/ [3] 修改輸入: "
                ).strip()
                if choice == "1":
                    fatal("使用者中止 onboarding（建議先透過 @Retro 產出 tech-stacks 提案）")
                if choice == "3":
                    ans = question(f"{block}.{field} {hint}: ").strip()

            if defn.get("required") and not ans:
                fatal(
                    f'required 欄位 "{block}.{field}" 未填寫；無法繼續'
                    "（依 project-onboarding §Step 1-2）"
                )
            answers[f"{block}.{field}"] = ans or "<not_applicable>"

    apply_auto_populate(schema, answers)
    return name, answers


# -------- Step 6: 預覽 + 寫檔 --------
def preview_and_commit(name: str, answers: dict, previous_workspace):
    ws_file = WORKSPACES_DIR / f"{name}.md"
    ws_dir = WORKSPACES_DIR / name
    proposals_dir = ws_dir / "proposals"

    if ws_file.exists() and not force:
        fatal(f"workspace 已存在：{ws_file}；使用 --force 覆寫")

    content = render_workspace_md(name, answers)
    proposal_index = render_proposal_index_shell(name)

    print("\n📋 將建立以下檔案：")
    print(f"  - {ws_file}")
    print(f"  - {ws_dir}/proposals/active/.gitkeep")
    print(f"  - {ws_dir}/proposals/completed/.gitkeep")
    print(f"  - {ws_dir}/proposals/archived/.gitkeep")
    print(f"  - {ws_dir}/proposals/PROPOSAL_INDEX.md")
    print(f"  - {CURRENT_WORKSPACE_PATH}（寫入「{name}」）")
    print("")
    print("📋 workspace.md 預覽（前 20 行）：")
    print("\n".join("  " + line for line in content.split("\n")[:20]))
    print("  ...")

    if dryRun:
        print("\n[DRY-RUN] 不執行實際寫檔。結束。")
        return {"success": True, "skipped": True}

    if not configPath:
        ok = question("\n確認執行？[y/N] ").strip()
        if not ok.lower().startswith("y"):
            print("使用者取消。")
            return {"success": False, "cancelled": True}
    else:
        print("\n[--config] 非互動模式；跳過最終確認")

    try:
        (proposals_dir / "active").mkdir(parents=True, exist_ok=True)
        (proposals_dir / "completed").mkdir(parents=True, exist_ok=True)
        (proposals_dir / "archived").mkdir(parents=True, exist_ok=True)
        (proposals_dir / "active" / ".gitkeep").write_text("", encoding="utf-8")
        (proposals_dir / "completed" / ".gitkeep").write_text("", encoding="utf-8")
        (proposals_dir / "archived" / ".gitkeep").write_text("", encoding="utf-8")
        (proposals_dir / "PROPOSAL_INDEX.md").write_text(proposal_index, encoding="utf-8")
        ws_file.write_text(content, encoding="utf-8")
        CURRENT_WORKSPACE_PATH.write_text(name + "\n", encoding="utf-8")
        memory_pending_dir = AGENTS_ROOT / "memory" / ".pending"
        memory_pending_dir.mkdir(parents=True, exist_ok=True)
        (memory_pending_dir / ".gitkeep").write_text(
            "# PROPOSAL_502_023 A-1: MCP fallback buffer dir\n", encoding="utf-8"
        )
        # PROPOSAL_502_031 T-3：archive 目錄結構
        rt_archive_dir = AGENTS_ROOT / "archive" / "routing-tickets"
        rt_archive_dir.mkdir(parents=True, exist_ok=True)
        (rt_archive_dir / ".gitkeep").write_text(
            "# PROPOSAL_502_031 T-3: ROUTING_TICKET archive (TKT-YYYYMMDD-NNN.md)\n", encoding="utf-8"
        )
        # PROPOSAL_502_031 v2：reports archive（30 天滾動；@Retro 批次清）
        for cat in ("review", "security", "test"):
            d = AGENTS_ROOT / "archive" / "reports" / cat
            d.mkdir(parents=True, exist_ok=True)
            (d / ".gitkeep").write_text(
                f"# PROPOSAL_502_031 v2: {cat} reports archive（per-dispatch；30 天滾動）\n", encoding="utf-8"
            )
        print("✅ 檔案寫入完成")
    except Exception as e:
        print(f"❌ 寫檔失敗：{e}", file=sys.stderr)
        rollback(name, previous_workspace)
        sys.exit(2)

    # 驗證
    print("\n🔍 執行 workspace-schema-validator...")
    py_validator = AGENTS_ROOT / "tests" / "workspace-schema-validator.py"
    mjs_validator = AGENTS_ROOT / "tests" / "workspace-schema-validator.mjs"
    if py_validator.exists():
        validate_res = subprocess.run(
            ["python3", str(py_validator), "--workspace", name],
        )
    else:
        validate_res = subprocess.run(
            ["node", str(mjs_validator), "--workspace", name],
        )
    if validate_res.returncode == 2:
        print("❌ validator 錯誤；回退變更", file=sys.stderr)
        rollback(name, previous_workspace)
        sys.exit(2)

    update_workspaces_readme(name)
    return {"success": True}


def rollback(name: str, previous_workspace):
    print("↩️  Rolling back...")
    ws_file = WORKSPACES_DIR / f"{name}.md"
    ws_dir = WORKSPACES_DIR / name
    try:
        if ws_file.exists():
            ws_file.unlink()
    except Exception:
        pass
    try:
        if ws_dir.exists():
            shutil.rmtree(ws_dir)
    except Exception:
        pass
    try:
        if previous_workspace:
            CURRENT_WORKSPACE_PATH.write_text(previous_workspace + "\n", encoding="utf-8")
        else:
            if CURRENT_WORKSPACE_PATH.exists():
                CURRENT_WORKSPACE_PATH.unlink()
    except Exception:
        pass
    print("✅ 回退完成")


# -------- Step 6.5: Tech-Stack 選擇性搬運 --------
def update_manifest_installed_flag(manifest_text: str, stack_name: str, installed: bool):
    lines = manifest_text.split("\n")
    in_target = False
    base_indent = None
    modified = False
    for i, line in enumerate(lines):
        trimmed = line.strip()
        indent_m = re.match(r"^(\s*)", line)
        indent = len(indent_m.group(1)) if indent_m else 0
        name_match = re.match(r"^- name:\s*(.+?)\s*(?:#.*)?$", trimmed)
        if name_match:
            this_name = re.sub(r"^[\"']|[\"']$", "", name_match.group(1))
            in_target = (this_name == stack_name)
            base_indent = indent
            continue
        if in_target and trimmed.startswith("- ") and indent <= (base_indent or 0):
            in_target = False
            continue
        if in_target:
            m = re.match(r"^(\s*)installed:\s*(true|false)(.*)$", line)
            if m:
                lines[i] = f"{m.group(1)}installed: {'true' if installed else 'false'}{m.group(3)}"
                modified = True
                in_target = False
    return {"text": "\n".join(lines), "modified": modified}


def restore_stack_from_git(stack_rel_path: str):
    target = f"tech-stacks/{stack_rel_path}"
    log_res = subprocess.run(
        ["git", "log", "--all", "--pretty=format:%H", "--", target],
        cwd=str(AGENTS_ROOT),
        capture_output=True,
        text=True,
    )
    commits = [x.strip() for x in (log_res.stdout or "").split("\n") if x.strip()]
    if not commits:
        return {"ok": False, "reason": "no-history"}
    source_commit = commits[0]
    co = subprocess.run(
        ["git", "checkout", source_commit, "--", target],
        cwd=str(AGENTS_ROOT),
        capture_output=True,
        text=True,
    )
    if co.returncode == 0:
        return {"ok": True, "commit": source_commit}
    return {"ok": False, "reason": co.stderr}


def apply_tech_stack_choices(manifest_text, stacks, selected_names, drop_mode="keep-files"):
    selected_set = set(selected_names)
    by_name = {s["name"]: s for s in stacks}

    def expand_deps(name):
        s = by_name.get(name)
        if not s:
            return
        for d in s.get("depends_on") or []:
            if d not in selected_set:
                selected_set.add(d)
                expand_deps(d)

    for n in list(selected_set):
        expand_deps(n)

    to_activate = [s for s in stacks if s["name"] in selected_set and s.get("installed") is not True]
    to_deactivate = [s for s in stacks if s["name"] not in selected_set and s.get("installed") is True]

    text = manifest_text
    activation_results = []
    for s in to_activate:
        r = update_manifest_installed_flag(text, s["name"], True)
        if r["modified"]:
            text = r["text"]
        rel = s.get("file") or s.get("folder")
        full = (TECH_STACKS_DIR / rel) if rel else None
        file_status = "exists"
        if full is not None and not full.exists():
            restore = restore_stack_from_git(rel)
            file_status = (
                f"restored@{restore['commit'][:10]}"
                if restore.get("ok")
                else f"missing:{restore.get('reason')}"
            )
        activation_results.append({"name": s["name"], "fileStatus": file_status})

    deactivation_results = []
    for s in to_deactivate:
        r = update_manifest_installed_flag(text, s["name"], False)
        if r["modified"]:
            text = r["text"]
        file_action = "kept"
        if drop_mode == "delete-files":
            rel = s.get("file") or s.get("folder")
            full = (TECH_STACKS_DIR / rel) if rel else None
            if full is not None and full.exists():
                is_dir = full.is_dir()
                rm_res = subprocess.run(
                    ["git", "rm", "-r" if is_dir else "-f", f"tech-stacks/{rel}"],
                    cwd=str(AGENTS_ROOT),
                    capture_output=True,
                    text=True,
                )
                if rm_res.returncode != 0:
                    try:
                        if is_dir:
                            shutil.rmtree(full)
                        else:
                            full.unlink()
                        file_action = "force-deleted"
                    except Exception:
                        file_action = "delete-failed"
                else:
                    file_action = "git-rm"
        deactivation_results.append({"name": s["name"], "fileAction": file_action})

    return {"text": text, "toActivate": activation_results, "toDeactivate": deactivation_results}


def derive_tech_stack_answers_from_stacks(stacks, selected_names):
    merged = {}
    for name in selected_names:
        s = next((x for x in stacks if x["name"] == name), None)
        if not s:
            continue
        rel = s.get("file") or s.get("folder")
        if not rel:
            continue
        fp = (TECH_STACKS_DIR / rel / "README.md") if s.get("folder") else (TECH_STACKS_DIR / rel)
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8")
        m = re.search(r"```ya?ml([\s\S]+?)```", text)
        if not m:
            continue
        yaml_block = m.group(1)
        lang_match = re.search(r"^language:\s*(.+?)$", yaml_block, re.MULTILINE)
        if lang_match and "TECH_STACK.language" not in merged:
            merged["TECH_STACK.language"] = lang_match.group(1).strip()
        fw_match = re.search(r"^framework:\s*(.+?)$", yaml_block, re.MULTILINE)
        fv_match = re.search(r'^framework_version(?:_recommended)?:\s*"?(.+?)"?$', yaml_block, re.MULTILINE)
        if fw_match and "TECH_STACK.frontend" not in merged and s.get("category") == "web-frontend":
            value = (
                f"{fw_match.group(1).strip()} {fv_match.group(1).strip()}"
                if fv_match else fw_match.group(1).strip()
            )
            merged["TECH_STACK.frontend"] = value
        if fw_match and "TECH_STACK.backend" not in merged and s.get("category") == "web-backend":
            value = (
                f"{fw_match.group(1).strip()} {fv_match.group(1).strip()}"
                if fv_match else fw_match.group(1).strip()
            )
            merged["TECH_STACK.backend"] = value
    today = datetime.utcnow().strftime("%Y-%m-%d")
    merged["TECH_STACK.last_audit_date"] = today
    merged["TECH_STACK.audit_interval_days"] = "30"
    return merged


def select_tech_stacks(answers):
    manifest_path = TECH_STACKS_DIR / "MANIFEST.yaml"
    if not manifest_path.exists():
        print("ℹ️  tech-stacks/MANIFEST.yaml 不存在；跳過 stack 選擇步驟")
        return {"skipped": True}
    if not sys.stdin.isatty():
        print("ℹ️  非 TTY 輸入；跳過 tech-stack 選擇（保留 MANIFEST 當前狀態）")
        return {"skipped": True}
    stacks = load_manifest_stacks()
    if not stacks:
        print("ℹ️  MANIFEST 無 stack 條目；跳過")
        return {"skipped": True}

    print("\n=== Tech-Stack 選擇（PROPOSAL_017 + 018）===")
    by_cat = {}
    for s in stacks:
        by_cat.setdefault(s.get("category"), []).append(s)
    idx = 1
    index_map = []
    for cat in sorted(by_cat.keys(), key=lambda x: (x is None, x or "")):
        print(f"  [{cat}]")
        for s in by_cat[cat]:
            mark = "✅" if s.get("installed") else "⬜"
            print(f"    {str(idx).rjust(2)}. {mark} {s['name']}")
            index_map.append(s)
            idx += 1
    print(
        "\n請輸入要「保留安裝」的 stack 編號，逗號分隔（例：1,3,5）\n"
        "直接 Enter = **保留全部**（新 User 推薦；稍後可用 `tech-stack-manage audit` 審視）\n"
        "輸入 \"none\" 全不要；\"keep\" 不變更 MANIFEST 狀態"
    )
    raw = question("> ").strip()
    if raw == "keep":
        print("ℹ️  不變更 MANIFEST 安裝狀態")
        return {"skipped": True}
    if raw == "" or raw == "all":
        selected_names = [s["name"] for s in index_map]
    elif raw == "none":
        selected_names = []
    else:
        picks = [x.strip() for x in raw.split(",") if x.strip()]
        selected_names = []
        for p in picks:
            try:
                n = int(p)
                if 1 <= n <= len(index_map):
                    selected_names.append(index_map[n - 1]["name"])
            except ValueError:
                pass

    selected_set = set(selected_names)
    by_name = {s["name"]: s for s in stacks}

    def expand_deps(name):
        s = by_name.get(name)
        if not s:
            return
        for d in s.get("depends_on") or []:
            if d not in selected_set:
                selected_set.add(d)
                expand_deps(d)

    for n in list(selected_set):
        expand_deps(n)
    final_selected = list(selected_set)

    keep = [s for s in stacks if s["name"] in selected_set]
    to_activate = [s for s in keep if not s.get("installed")]
    to_deactivate = [s for s in stacks if s["name"] not in selected_set and s.get("installed")]

    print("\n📋 變更預覽：")
    keep_names = ", ".join(s["name"] for s in keep) or "(無)"
    print(
        f"  保留 / 啟用 ({len(keep)} 個；含 {len(to_activate)} 個新裝): {keep_names}"
    )
    deact_names = ", ".join(s["name"] for s in to_deactivate) or "(無)"
    print(f"  將標記 installed:false ({len(to_deactivate)}): {deact_names}")
    print("")

    mode = "keep-files"
    if to_deactivate:
        mode_in = question(
            "未選擇的 stacks 處置：[1] 刪檔（git rm）+標記 installed:false  "
            "[2] 保留檔案，僅標記 installed:false  [k] 不動作："
        ).strip().lower()
        if mode_in in ("k", "keep"):
            print("ℹ️  不變更")
            return {"skipped": True}
        mode = "delete-files" if mode_in == "1" else "keep-files"

    if dryRun:
        print("[DRY-RUN] 不實際變更 MANIFEST / 不刪檔")
        return {"skipped": True}

    orig_text = manifest_path.read_text(encoding="utf-8")
    result = apply_tech_stack_choices(orig_text, stacks, final_selected, drop_mode=mode)
    manifest_path.write_text(result["text"], encoding="utf-8")
    print("✅ MANIFEST 更新完成")
    if result["toActivate"]:
        details = ", ".join(f"{x['name']}({x['fileStatus']})" for x in result["toActivate"])
        print(f"  啟用：{details}")
    if result["toDeactivate"]:
        details = ", ".join(f"{x['name']}({x['fileAction']})" for x in result["toDeactivate"])
        print(f"  停用：{details}")

    derived = derive_tech_stack_answers_from_stacks(stacks, final_selected)
    for k, v in derived.items():
        if not answers.get(k) or answers.get(k) == "<not_applicable>":
            answers[k] = v

    return {
        "kept": [s["name"] for s in keep],
        "activated": [x["name"] for x in result["toActivate"]],
        "deactivated": [x["name"] for x in result["toDeactivate"]],
        "mode": mode,
    }


# -------- Non-interactive mode: runFromConfig --------
def parse_config_yaml(text: str) -> dict:
    """Parse subset of YAML config (uses PyYAML if available, else minimal parser).

    Schema:
      project_name: my_app
      answers:
        PROJECT_CONTEXT.display_name: "My App"
        TECH_STACK.language: nodejs
      tech_stacks:
        install: [a, b]
        remove: [c, d]
        mode: delete-files
    """
    cfg = {
        "project_name": None,
        "answers": {},
        "tech_stacks": {"install": [], "remove": [], "mode": "keep-files"},
    }
    # Try PyYAML first
    try:
        import yaml  # type: ignore
        loaded = yaml.safe_load(text) or {}
        if isinstance(loaded, dict):
            if loaded.get("project_name"):
                cfg["project_name"] = str(loaded["project_name"]).strip() or None
            if isinstance(loaded.get("answers"), dict):
                cfg["answers"] = {str(k): str(v) for k, v in loaded["answers"].items()}
            ts = loaded.get("tech_stacks") or {}
            if isinstance(ts, dict):
                if isinstance(ts.get("install"), list):
                    cfg["tech_stacks"]["install"] = [str(x) for x in ts["install"]]
                if isinstance(ts.get("remove"), list):
                    cfg["tech_stacks"]["remove"] = [str(x) for x in ts["remove"]]
                if ts.get("mode"):
                    cfg["tech_stacks"]["mode"] = str(ts["mode"])
            return cfg
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: minimal parser mirroring mjs
    lines = text.split("\n")
    section = None
    for raw in lines:
        line = raw.rstrip("\r")
        if not line.strip() or re.match(r"^\s*#", line):
            continue
        indent_m = re.match(r"^(\s*)", line)
        indent = len(indent_m.group(1)) if indent_m else 0
        t = line.strip()
        if indent == 0:
            m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", t)
            if not m:
                continue
            if m.group(1) == "project_name":
                v = re.sub(r'^[\"\']|[\"\']$', "", (m.group(2) or "")).strip()
                cfg["project_name"] = v or None
                section = None
            elif m.group(1) == "answers":
                section = "answers"
            elif m.group(1) == "tech_stacks":
                section = "tech_stacks"
            else:
                section = None
            continue
        if section == "answers" and indent == 2:
            m = re.match(r"^([A-Za-z_][\w.]*)\s*:\s*(.+)$", t)
            if m:
                v = m.group(2).strip()
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                cfg["answers"][m.group(1)] = v
        if section == "tech_stacks" and indent == 2:
            m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", t)
            if m:
                key = m.group(1)
                rest = m.group(2)
                if key == "install":
                    section = "tech_stacks.install"
                    if rest and rest.startswith("[") and rest.endswith("]"):
                        cfg["tech_stacks"]["install"] = [
                            x.strip() for x in rest[1:-1].split(",") if x.strip()
                        ]
                        section = "tech_stacks"
                elif key == "remove":
                    section = "tech_stacks.remove"
                    if rest and rest.startswith("[") and rest.endswith("]"):
                        cfg["tech_stacks"]["remove"] = [
                            x.strip() for x in rest[1:-1].split(",") if x.strip()
                        ]
                        section = "tech_stacks"
                elif key == "mode":
                    cfg["tech_stacks"]["mode"] = re.sub(
                        r'^[\"\']|[\"\']$', "", rest.strip()
                    )
        if section in ("tech_stacks.install", "tech_stacks.remove") and indent == 4:
            m = re.match(r"^-\s*(.+?)\s*$", t)
            if m:
                key = "install" if section == "tech_stacks.install" else "remove"
                cfg["tech_stacks"][key].append(m.group(1))
    return cfg


def run_from_config():
    if not Path(configPath).exists():
        fatal(f"--config 路徑不存在：{configPath}")
    cfg = parse_config_yaml(Path(configPath).read_text(encoding="utf-8"))
    if not cfg["project_name"]:
        fatal("--config 缺 project_name 欄位")
    if not re.match(r"^[a-z][a-z0-9_]*$", cfg["project_name"]):
        fatal(f"project_name 格式錯誤：{cfg['project_name']}")

    if not SCHEMA_PATH.exists():
        fatal(f"Schema not found: {SCHEMA_PATH}")
    previous_workspace = (
        CURRENT_WORKSPACE_PATH.read_text(encoding="utf-8").strip()
        if CURRENT_WORKSPACE_PATH.exists() else None
    )

    print(f"\n📋 Non-interactive mode (--config {configPath})")
    print(f"📋 project_name = \"{cfg['project_name']}\"")

    manifest_path = TECH_STACKS_DIR / "MANIFEST.yaml"
    if manifest_path.exists() and (cfg["tech_stacks"]["install"] or cfg["tech_stacks"]["remove"]):
        stacks = load_manifest_stacks()
        if stacks:
            now_installed = {s["name"] for s in stacks if s.get("installed")}
            for n in cfg["tech_stacks"]["install"]:
                now_installed.add(n)
            for n in cfg["tech_stacks"]["remove"]:
                now_installed.discard(n)
            orig_text = manifest_path.read_text(encoding="utf-8")
            result = apply_tech_stack_choices(
                orig_text, stacks,
                selected_names=list(now_installed),
                drop_mode=cfg["tech_stacks"].get("mode") or "keep-files",
            )
            if not dryRun:
                manifest_path.write_text(result["text"], encoding="utf-8")
            print(
                f"✅ MANIFEST 套用：啟用 {len(result['toActivate'])} / "
                f"停用 {len(result['toDeactivate'])}（mode={cfg['tech_stacks']['mode']}）"
            )
            derived = derive_tech_stack_answers_from_stacks(stacks, list(now_installed))
            for k, v in derived.items():
                if not cfg["answers"].get(k):
                    cfg["answers"][k] = v

    cfg["answers"]["PROJECT_CONTEXT.project_name"] = cfg["project_name"]

    schema = parse_yaml(SCHEMA_PATH.read_text(encoding="utf-8"))
    apply_auto_populate(schema, cfg["answers"])

    result = preview_and_commit(cfg["project_name"], cfg["answers"], previous_workspace)
    if result.get("success") and not result.get("skipped"):
        print_post_guide(
            cfg["project_name"],
            activated=cfg["tech_stacks"]["install"],
            kept_count=len(cfg["answers"]),
        )
        run_mempalace_wakeup(cfg["project_name"])


# -------- Step 7: 更新 workspaces/README.md 表格 --------
def update_workspaces_readme(name: str):
    if not WORKSPACES_README.exists():
        return
    content = WORKSPACES_README.read_text(encoding="utf-8")
    entry_pattern = re.compile(rf"\|\s*`{re.escape(name)}`\s*\|", re.MULTILINE)
    if entry_pattern.search(content):
        print(f'ℹ️  README.md 已含 "{name}" 條目，不重複新增')
        return
    table_marker = re.compile(r"\|\s*`investmentlinenotify`.*Active\s*\|")
    m = table_marker.search(content)
    if m:
        new_row = f"| `{name}` | （由 CLI 建立；待補專案描述）| ✅ Active |"
        updated = content.replace(m.group(0), m.group(0) + "\n" + new_row, 1)
        WORKSPACES_README.write_text(updated, encoding="utf-8")
        print(f'✅ workspaces/README.md 已更新（新增 "{name}" 條目）')
    else:
        print(f'ℹ️  workspaces/README.md 表格格式不符預期；請手動新增 "{name}" 條目')


# -------- 後置指引 --------
def print_post_guide(name: str, activated=None, kept_count=None):
    installed_count = None
    try:
        stacks = load_manifest_stacks()
        if stacks is not None:
            installed_count = sum(1 for s in stacks if s.get("installed"))
    except Exception:
        pass

    extra_line = (
        f"\n📦 tech-stacks 狀態：{installed_count} 個 installed\n"
        if installed_count is not None else ""
    )
    print(f"""
✅ Workspace "{name}" 建立完成

📂 檔案位置：
   - .agents/workspaces/{name}.md（主 workspace 檔）
   - .agents/workspaces/{name}/proposals/（專案 scope 提案目錄）
   - .agents/CURRENT_WORKSPACE（已指向 "{name}"）
{extra_line}
🎯 下一步建議：
   1. 檢視 .agents/workspaces/{name}.md 確認所有欄位
   2. 呼叫 @Lead 派發 @Planner 進入需求階段
   3. 於根目錄建立 PENDING_ACTIONS.md（由 @Assistant 初始化）

💡 定期 audit 提醒（PROPOSAL_20260424_018）：
   30 天後執行以下指令審視 tech-stacks 使用狀況：
       python3 .agents/scripts/tech-stack-manage.py audit
   系統會依引用統計提供初篩建議；刪除需您逐個確認。
   @Assistant P-23 巡邏會在到期時自動提醒。

📖 參考：
   - tasks/project-onboarding-workflow.md（完整 6 步驟 SOP）
   - tasks/agent-onboarding-flow.md（agent 驅動 onboarding；PROPOSAL_018）
   - WORKSPACE_SCHEMA.yaml（欄位契約 SSOT）
""")


# -------- MemPalace wake-up --------
def run_mempalace_wakeup(workspace_name: str):
    if not shutil.which("mempalace"):
        print("\nℹ️  mempalace 不可用；跳過 wake-up（hybrid fallback 模式；ADR-0039）")
        return {"skipped": True, "reason": "mempalace_not_available"}
    probe = subprocess.run(
        ["mempalace", "--version"], capture_output=True, text=True
    )
    if probe.returncode != 0:
        print("\nℹ️  mempalace 不可用；跳過 wake-up（hybrid fallback 模式；ADR-0039）")
        return {"skipped": True, "reason": "mempalace_not_available"}
    print("\n🧠 Memory Palace wake-up（PROPOSAL_502_003 C-3；注入 L0+L1 上下文）...")
    wake = subprocess.run(["mempalace", "wake-up"], capture_output=True, text=True)
    if wake.returncode != 0:
        tail = " | ".join((wake.stderr or "").split("\n")[:2])
        print(f"⚠️  wake-up 失敗（status={wake.returncode}）；{tail}")
        print("   建議手動：mempalace wake-up；或 mempalace status 檢查 palace 狀態")
        return {"skipped": True, "reason": "wake_up_failed"}
    out = (wake.stdout or "").strip()
    if not out:
        print("ℹ️  wake-up 完成但 0 上下文（palace 可能空；建議跑 mempalace mine .agents/memory/）")
    else:
        print("─── wake-up context ───")
        print(out)
        print("───────────────────────")
        print(f'✅ Memory Palace ready；wake-up 結果已注入（workspace="{workspace_name}"）')
    return {"skipped": False}


# -------- CLI entry --------
def main() -> int:
    show_help = parse_cli_args()
    if show_help:
        print_help()
        return 0

    try:
        if configPath:
            run_from_config()
            return 0
        schema, available, previous_workspace = pre_check()
        name, answers = collect_answers(schema, available, nameArg)
        select_tech_stacks(answers)
        result = preview_and_commit(name, answers, previous_workspace)
        if result.get("success") and not result.get("skipped"):
            print_post_guide(name)
            run_mempalace_wakeup(name)
        return 0
    except SystemExit:
        raise
    except Exception as e:
        print(f"❌ 未預期錯誤：{e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
