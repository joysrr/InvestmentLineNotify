#!/usr/bin/env python3
"""tech-stack-manage.py — Tech-Stacks Catalog 管理 CLI (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of tech-stack-manage.mjs
(PROPOSAL_20260423_017 Phase C + PROPOSAL_20260424_018 Phase C).

指令：
  list                    列出全部 stacks（依 category 分組；顯示 installed/available 狀態）
  info <name>             顯示單一 stack 詳細
  install <name>          標記 installed: true；依賴自動解析提示
  remove <name>           標記 installed: false + git rm 檔案（保留 MANIFEST entry）
  restore <name>          從 git history 取回檔案 + 標記 installed: true
  audit                   依引用統計初篩建議；逐個確認刪除

通用旗標：
  --dry-run    僅預覽不寫檔
  --force      跳過確認
  --help       顯示說明
  --deep       audit 指令深度掃描
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
TECH_STACKS_DIR = AGENTS_ROOT / "tech-stacks"
MANIFEST_PATH = TECH_STACKS_DIR / "MANIFEST.yaml"


# ───────── 極簡 MANIFEST YAML parser ─────────
def parse_scalar(s):
    s = ((s or "")).strip()
    s = re.sub(r"\s*#.*$", "", s).strip()
    if s == "":
        return None
    if s in ("null", "~"):
        return None
    if s == "true":
        return True
    if s == "false":
        return False
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
        parts = s[1:-1].split(",")
        return [v for v in (parse_scalar(x) for x in parts) if v is not None]
    return s


def parse_manifest(text: str) -> dict:
    lines = text.split("\n")
    result = {"version": None, "schema_version": None, "categories": {}, "stacks": []}
    mode = None  # None | 'categories' | 'stacks'
    current_cat = None
    current_stack = None

    for raw in lines:
        line = raw.rstrip("\r")
        if not line.strip() or re.match(r"^\s*#", line):
            continue
        indent_match = re.match(r"^(\s*)", line)
        indent = len(indent_match.group(1)) if indent_match else 0
        stripped = line.strip()

        if indent == 0:
            m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", stripped)
            if not m:
                continue
            key, rest = m.group(1), m.group(2)
            if key == "version":
                result["version"] = parse_scalar(rest)
            elif key == "schema_version":
                result["schema_version"] = parse_scalar(rest)
            elif key == "categories":
                mode = "categories"
                current_cat = None
                current_stack = None
            elif key == "stacks":
                mode = "stacks"
                current_cat = None
                current_stack = None
            continue

        if mode == "categories":
            if indent == 2:
                m = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*$", stripped)
                if m:
                    current_cat = m.group(1)
                    result["categories"][current_cat] = {}
            elif indent == 4 and current_cat:
                m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.+)$", stripped)
                if m:
                    result["categories"][current_cat][m.group(1)] = parse_scalar(m.group(2))
        elif mode == "stacks":
            if indent == 2 and stripped.startswith("- name:"):
                name_part = stripped[len("- name:"):].strip()
                current_stack = {"name": parse_scalar(name_part)}
                result["stacks"].append(current_stack)
            elif indent == 4 and current_stack is not None:
                m = re.match(r"^([A-Za-z_][\w]*)\s*:\s*(.*)$", stripped)
                if m:
                    current_stack[m.group(1)] = parse_scalar(m.group(2))
    return result


# ───────── MANIFEST 寫入（行導向）─────────
def update_installed_field(manifest_text: str, stack_name: str, installed: bool):
    lines = manifest_text.split("\n")
    in_target_stack = False
    base_indent = None
    modified = False
    for i, line in enumerate(lines):
        trimmed = line.strip()
        indent_match = re.match(r"^(\s*)", line)
        indent = len(indent_match.group(1)) if indent_match else 0

        name_match = re.match(r"^- name:\s*(.+?)\s*(?:#.*)?$", trimmed)
        if name_match:
            this_name = re.sub(r"^[\"']|[\"']$", "", name_match.group(1))
            in_target_stack = (this_name == stack_name)
            base_indent = indent
            continue

        if in_target_stack and trimmed.startswith("- ") and indent <= (base_indent or 0):
            in_target_stack = False
            continue

        if in_target_stack:
            m = re.match(r"^(\s*)installed:\s*(true|false)(.*)$", line)
            if m:
                lines[i] = f"{m.group(1)}installed: {'true' if installed else 'false'}{m.group(3)}"
                modified = True
                in_target_stack = False
    return {"text": "\n".join(lines), "modified": modified}


# ───────── 工具：Stack 路徑與 git 操作 ─────────
def stack_path(stack):
    if stack.get("file"):
        return TECH_STACKS_DIR / stack["file"]
    if stack.get("folder"):
        return TECH_STACKS_DIR / stack["folder"]
    return None


def stack_relative_path(stack):
    return stack.get("file") or stack.get("folder")


def run_git(args, quiet=False):
    res = subprocess.run(
        ["git"] + args,
        cwd=str(AGENTS_ROOT),
        capture_output=True,
        text=True,
    )
    if res.returncode != 0 and not quiet:
        print(f"git {' '.join(args)} 失敗：{res.stderr or res.stdout}", file=sys.stderr)
    return res


# ───────── 依賴解析 ─────────
def resolve_dependencies(stacks, target_name):
    by_name = {s["name"]: s for s in stacks}
    resolved = []
    seen = set()
    visiting = set()

    def dfs(n):
        if n in seen:
            return
        if n in visiting:
            raise RuntimeError(f"循環依賴：{n}")
        visiting.add(n)
        s = by_name.get(n)
        if not s:
            raise RuntimeError(f"未知 stack：{n}")
        for dep in (s.get("depends_on") or []):
            dfs(dep)
        visiting.discard(n)
        seen.add(n)
        resolved.append(s)

    dfs(target_name)
    return resolved


# ───────── 互動式確認 ─────────
def confirm_sync(prompt: str) -> bool:
    sys.stdout.write(prompt)
    sys.stdout.flush()
    try:
        ans = sys.stdin.readline()
    except Exception:
        return False
    return ans.strip().lower().startswith("y")


def prompt_sync(text: str) -> str:
    sys.stdout.write(text)
    sys.stdout.flush()
    try:
        ans = sys.stdin.readline()
    except Exception:
        return ""
    return ans.strip().lower()


# ───────── 指令實作 ─────────
def cmd_list(manifest):
    by_cat = {}
    for s in manifest["stacks"]:
        by_cat.setdefault(s.get("category"), []).append(s)
    cats = sorted(
        manifest["categories"].keys(),
        key=lambda c: manifest["categories"][c].get("priority") or 99,
    )
    print(f"\n📦 Tech-Stacks Catalog（MANIFEST v{manifest['version']}）\n")
    for cat in cats:
        desc = manifest["categories"][cat].get("description") or ""
        entries = by_cat.get(cat) or []
        print(f"── {cat} ── {desc}")
        if not entries:
            print("   （無 stack）\n")
            continue
        for s in entries:
            mark = "✅" if s.get("installed") else "⬜"
            mode = "[folder]" if s.get("folder") else "[file]"
            deps_list = s.get("depends_on") or []
            deps = f" ← {', '.join(deps_list)}" if deps_list else ""
            cls = s.get("class") or ""
            print(f"   {mark} {s['name'].ljust(28)} {mode.ljust(9)} {cls}{deps}")
        print("")
    total = len(manifest["stacks"])
    installed = sum(1 for s in manifest["stacks"] if s.get("installed"))
    print(f"合計：{total}（installed: {installed} / available: {total - installed}）")


def cmd_info(manifest, stack_name):
    s = next((x for x in manifest["stacks"] if x["name"] == stack_name), None)
    if not s:
        print(f"❌ 找不到 stack：{stack_name}", file=sys.stderr)
        return 2
    print(f"\n📦 {s['name']}\n")
    print(f"  category       {s.get('category')}")
    print(f"  class          {s.get('class') or '(unset)'}")
    print(f"  mode           {'folder' if s.get('folder') else 'file'}")
    print(f"  path           {stack_relative_path(s)}")
    print(f"  installed      {'✅ true' if s.get('installed') else '⬜ false'}")
    print(f"  depends_on     {', '.join(s.get('depends_on') or []) or '(none)'}")
    print(f"  platforms      {', '.join(s.get('platforms') or []) or '(any)'}")
    if s.get("extends_base"):
        print("  extends_base   true")
    if s.get("vendor_source"):
        print(f"  vendor_source  {s['vendor_source']}")
    if s.get("vendor_last_vetted"):
        print(f"  vendor_vetted  {s['vendor_last_vetted']}")
    fp = stack_path(s)
    if fp and fp.exists():
        print(f"  file_exists    ✅ {fp}")
    elif fp:
        print(f"  file_exists    ⚠️  missing ({fp})")
    return 0


def cmd_install(manifest, stack_name, flags):
    s = next((x for x in manifest["stacks"] if x["name"] == stack_name), None)
    if not s:
        print(f"❌ 找不到 stack：{stack_name}", file=sys.stderr)
        return 2

    chain = resolve_dependencies(manifest["stacks"], stack_name)
    to_install = [x for x in chain if not x.get("installed")]
    if not to_install:
        print(f"ℹ️  {stack_name} 及其依賴皆已 installed。")
        return 0

    print("📦 將標記為 installed（含依賴）：")
    for x in to_install:
        fp = stack_path(x)
        exists = fp and fp.exists()
        print(f"   - {x['name']}{'' if exists else '  ⚠️ 檔案缺失'}")

    if flags["dry_run"]:
        print("\n[DRY-RUN] 不寫檔")
        return 0
    if not flags["force"] and not confirm_sync("確認執行？[y/N] "):
        print("取消。")
        return 0

    text = MANIFEST_PATH.read_text(encoding="utf-8")
    for x in to_install:
        r = update_installed_field(text, x["name"], True)
        if not r["modified"]:
            print(f"⚠️  未能更新 {x['name']} 的 installed 欄位", file=sys.stderr)
        text = r["text"]
    MANIFEST_PATH.write_text(text, encoding="utf-8")
    print("✅ MANIFEST 已更新")

    missing = []
    for x in to_install:
        fp = stack_path(x)
        if not fp or not fp.exists():
            missing.append(x)
    if missing:
        print("\n⚠️  下列 stack 檔案不存在，請考慮：")
        for x in missing:
            print(
                f"   - {x['name']}：執行 `python3 .agents/scripts/tech-stack-manage.py "
                f"restore {x['name']}` 從 git history 取回"
            )
    return 0


def cmd_remove(manifest, stack_name, flags):
    s = next((x for x in manifest["stacks"] if x["name"] == stack_name), None)
    if not s:
        print(f"❌ 找不到 stack：{stack_name}", file=sys.stderr)
        return 2

    dependents = [
        x for x in manifest["stacks"]
        if x.get("installed") and stack_name in (x.get("depends_on") or [])
    ]
    if dependents:
        print("❌ 無法 remove：以下 installed stacks 依賴此 stack：", file=sys.stderr)
        for d in dependents:
            print(f"   - {d['name']}", file=sys.stderr)
        print("請先 remove 依賴方，或使用 --force 強制執行（不建議）", file=sys.stderr)
        if not flags["force"]:
            return 2

    fp = stack_path(s)
    rel = stack_relative_path(s)
    print(f"📦 remove {stack_name}:")
    print("   - MANIFEST: installed: true → false")
    if fp and fp.exists():
        print(f"   - git rm {rel}")
    else:
        print("   - 檔案已不存在（僅更新 MANIFEST）")

    if flags["dry_run"]:
        print("\n[DRY-RUN] 不執行")
        return 0
    if not flags["force"] and not confirm_sync("確認執行？[y/N] "):
        print("取消。")
        return 0

    if fp and fp.exists():
        is_dir = fp.is_dir()
        res = run_git(["rm", "-r" if is_dir else "-f", f"tech-stacks/{rel}"])
        if res.returncode != 0:
            print("⚠️  git rm 失敗；改用直接刪除", file=sys.stderr)
            try:
                if is_dir:
                    shutil.rmtree(fp)
                else:
                    fp.unlink()
            except Exception:
                pass

    text = MANIFEST_PATH.read_text(encoding="utf-8")
    r = update_installed_field(text, stack_name, False)
    if not r["modified"]:
        print(f"⚠️  未能更新 {stack_name} 的 installed 欄位", file=sys.stderr)
    MANIFEST_PATH.write_text(r["text"], encoding="utf-8")
    print("✅ 完成（MANIFEST 保留 entry 以便未來 restore）")
    return 0


def cmd_restore(manifest, stack_name, flags):
    s = next((x for x in manifest["stacks"] if x["name"] == stack_name), None)
    if not s:
        print(f"❌ 找不到 stack：{stack_name}", file=sys.stderr)
        return 2

    rel = stack_relative_path(s)
    target_path = f"tech-stacks/{rel}"
    fp = stack_path(s)

    if fp and fp.exists():
        print(f"ℹ️  檔案已存在：{rel}；僅更新 MANIFEST 狀態")
    else:
        print(f"🔍 搜尋 git history 中的 {target_path} ...")
        log_res = run_git(["log", "--all", "--pretty=format:%H", "--", target_path], quiet=True)
        commits = [x.strip() for x in (log_res.stdout or "").split("\n") if x.strip()]
        if not commits:
            print(f"❌ git history 無此檔案記錄：{target_path}", file=sys.stderr)
            print("   若為 vendor folder 類，請手動從 upstream 取回。", file=sys.stderr)
            return 2
        source_commit = commits[0]
        print(f"   找到最近 commit：{source_commit[:10]}")
        if flags["dry_run"]:
            print("[DRY-RUN] 不取回檔案")
            return 0
        if not flags["force"] and not confirm_sync(f"從 {source_commit[:10]} 取回？[y/N] "):
            print("取消。")
            return 0
        d = fp.parent
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
        checkout_res = run_git(["checkout", source_commit, "--", target_path])
        if checkout_res.returncode != 0:
            print("❌ git checkout 失敗", file=sys.stderr)
            return 2
        print(f"✅ 已從 git history 取回 {rel}")

    text = MANIFEST_PATH.read_text(encoding="utf-8")
    r = update_installed_field(text, stack_name, True)
    if r["modified"]:
        MANIFEST_PATH.write_text(r["text"], encoding="utf-8")
    print("✅ MANIFEST 已標記 installed: true")
    return 0


# ───────── Audit 指令實作 ─────────
TEXT_FILE_RE = re.compile(r"\.(md|mjs|sh|yaml|ts|tsx|js|jsx|cs|axaml|xaml|vue|py)$")


def walk_text_files(d: Path):
    out = []
    if not d.exists():
        return out
    for dirpath, dirnames, filenames in os.walk(d):
        dirnames[:] = [x for x in dirnames if x not in ("node_modules", ".git")]
        for fn in filenames:
            if TEXT_FILE_RE.search(fn):
                out.append(Path(dirpath) / fn)
    return out


def stack_keywords_for(stack):
    name = stack["name"]
    kws = [name]
    if "avalonia" in name:
        kws += ["using Avalonia", "xmlns:semi"]
    if "vue3" in name:
        kws += ["<script setup>", "from 'vue'", "import { ref }"]
    if "nodejs" in name:
        kws += ["import.*from ['\"]node:", '"type": "module"']
    if "telegram" in name:
        kws += ["telegram", "Telegram"]
    if "file-based" in name:
        kws += ["fs.readFileSync", "JSON.parse"]
    return kws


def compute_stack_references(stack, agents_root: Path, workspace_file=None, project_root=None):
    rel = stack.get("file") or stack.get("folder") or ""
    stack_substr = (f"tech-stacks/{rel}").rstrip("/")
    refs = {"refs_in_rules": 0, "refs_in_workspace": 0, "refs_in_code": 0}

    scan_dirs = [agents_root / d for d in ("rules", "skills", "tasks", "docs")]
    for d in scan_dirs:
        for fp in walk_text_files(d):
            try:
                content = fp.read_text(encoding="utf-8")
                refs["refs_in_rules"] += content.count(stack_substr)
            except Exception:
                pass

    if workspace_file and workspace_file.exists():
        try:
            content = workspace_file.read_text(encoding="utf-8")
            refs["refs_in_workspace"] = content.count(stack_substr)
            name_matches = len(re.findall(rf"\b{re.escape(stack['name'])}\b", content))
            refs["refs_in_workspace"] = max(refs["refs_in_workspace"], name_matches)
        except Exception:
            pass

    if project_root and Path(project_root).exists():
        keywords = stack_keywords_for(stack)
        total = 0
        for fp in walk_text_files(Path(project_root)):
            try:
                content = fp.read_text(encoding="utf-8")
                for kw in keywords:
                    if kw in content:
                        total += 1
                        break
            except Exception:
                pass
        refs["refs_in_code"] = total
    return refs


def categorize_usage(refs):
    total = refs["refs_in_rules"] + refs["refs_in_workspace"] + refs["refs_in_code"]
    if total == 0:
        return {"level": "zero-usage", "total": total, "suggestion": "remove-candidate"}
    if total <= 3:
        return {"level": "low-usage", "total": total, "suggestion": "audit-candidate"}
    return {"level": "high-usage", "total": total, "suggestion": "keep"}


def read_current_workspace_audit_fields():
    cw_path = AGENTS_ROOT / "CURRENT_WORKSPACE"
    if not cw_path.exists():
        return None
    ws_name = cw_path.read_text(encoding="utf-8").strip()
    if not ws_name:
        return None
    ws_path = AGENTS_ROOT / "workspaces" / f"{ws_name}.md"
    if not ws_path.exists():
        return {"wsName": ws_name, "path": None}
    content = ws_path.read_text(encoding="utf-8")
    date_match = re.search(r"\*\*last_audit_date\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})", content)
    interval_match = re.search(r"\*\*audit_interval_days\*\*\s*[:：]\s*(\d+)", content)
    return {
        "wsName": ws_name,
        "path": ws_path,
        "last_audit_date": date_match.group(1) if date_match else None,
        "audit_interval_days": int(interval_match.group(1)) if interval_match else 30,
    }


def update_workspace_audit_date(ws_path: Path, new_date: str) -> bool:
    if not ws_path.exists():
        return False
    content = ws_path.read_text(encoding="utf-8")
    pattern = re.compile(r"(\*\*last_audit_date\*\*\s*[:：]\s*)(\d{4}-\d{2}-\d{2}|<not_applicable>|\S*)")
    if pattern.search(content):
        content = pattern.sub(rf"\g<1>{new_date}", content, count=1)
    else:
        # 若不存在該欄位 → 附加於 TECH_STACK section 末
        ts_pattern = re.compile(r"(## TECH_STACK[\s\S]*?)(\n##|\n---|$)")
        m = ts_pattern.search(content)
        if m:
            replacement = f"{m.group(1)}- **last_audit_date**：{new_date}\n{m.group(2)}"
            content = content[:m.start()] + replacement + content[m.end():]
    ws_path.write_text(content, encoding="utf-8")
    return True


def cmd_audit(manifest, flags):
    installed_stacks = [s for s in manifest["stacks"] if s.get("installed")]
    if not installed_stacks:
        print("ℹ️  沒有 installed stacks；無需 audit。")
        return 0

    ws_info = read_current_workspace_audit_fields()
    workspace_file = ws_info.get("path") if ws_info else None
    project_root = None  # Phase C 簡化

    print("\n🔍 Tech-Stack Audit（PROPOSAL_20260424_018）")
    if ws_info:
        print(
            f"   Workspace: {ws_info['wsName']}（last audit: "
            f"{ws_info.get('last_audit_date') or '(never)'}）"
        )
    else:
        print("   ⚠️  無 CURRENT_WORKSPACE；僅依 rules/skills/tasks 計算引用")
    if flags["deep"]:
        print("   [--deep] 深度掃描已啟用（未實作；等同 shallow）")
    print(f"   Installed stacks: {len(installed_stacks)}\n")

    analysis = []
    for s in installed_stacks:
        refs = compute_stack_references(
            s, agents_root=AGENTS_ROOT,
            workspace_file=workspace_file, project_root=project_root,
        )
        cat = categorize_usage(refs)
        analysis.append({"stack": s, "refs": refs, "cat": cat})

    sort_order = {"remove-candidate": 0, "audit-candidate": 1, "keep": 2}
    analysis.sort(key=lambda a: sort_order[a["cat"]["suggestion"]])

    print("─────────────────────────────────────")
    print("  初步篩選（agent 只出建議；刪除需您確認）")
    print("─────────────────────────────────────")
    for entry in analysis:
        s, refs, cat = entry["stack"], entry["refs"], entry["cat"]
        icon = "🔴" if cat["suggestion"] == "remove-candidate" \
            else "🟡" if cat["suggestion"] == "audit-candidate" else "🟢"
        deep_str = f" code={refs['refs_in_code']}" if flags["deep"] else ""
        print(
            f"  {icon} {s['name'].ljust(28)} [{cat['level']}]  "
            f"refs: rules={refs['refs_in_rules']} ws={refs['refs_in_workspace']}{deep_str}"
        )
    print("")

    if flags["dry_run"]:
        print("[DRY-RUN] 不進入互動模式；不執行移除。")
        return 0

    to_remove = []
    text = MANIFEST_PATH.read_text(encoding="utf-8")
    kept = removed = skipped = 0

    for entry in analysis:
        s, refs, cat = entry["stack"], entry["refs"], entry["cat"]
        icon = "🔴" if cat["suggestion"] == "remove-candidate" \
            else "🟡" if cat["suggestion"] == "audit-candidate" else "🟢"
        print(f"┌─ {icon} [{cat['level']}] {s['name']}")
        deep_str = f" | code: {refs['refs_in_code']}" if flags["deep"] else ""
        print(
            f"│  rules: {refs['refs_in_rules']} | workspace: {refs['refs_in_workspace']}{deep_str}"
        )
        suggestion_zh = {
            "remove-candidate": "考慮移除",
            "audit-candidate": "請您審視",
        }.get(cat["suggestion"], "保留")
        print(f"│  建議：{suggestion_zh}")
        ans = prompt_sync("│  [k]eep / [r]emove / [s]kip ? ")
        print("└─")
        if ans in ("r", "remove"):
            dependents = [
                x for x in manifest["stacks"]
                if x.get("installed") and x["name"] != s["name"]
                and s["name"] in (x.get("depends_on") or [])
            ]
            if dependents:
                deps_str = ", ".join(d["name"] for d in dependents)
                print(f"   ⚠️  跳過：{s['name']} 被以下 installed stacks 依賴：{deps_str}")
                print("       需先 remove 這些 dependents 才能移除本 stack。")
                skipped += 1
                continue
            to_remove.append(s)
            removed += 1
        elif ans in ("s", "skip"):
            skipped += 1
        else:
            kept += 1

    if to_remove:
        print(f"\n準備移除 {len(to_remove)} 個 stacks...")
        confirm = prompt_sync("最終確認 [y/N] ? ")
        if confirm not in ("y", "yes"):
            print("使用者取消；不執行任何移除。")
            removed = 0
        else:
            for s in to_remove:
                rel = s.get("file") or s.get("folder")
                full = (TECH_STACKS_DIR / rel) if rel else None
                if full and full.exists():
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
                        except Exception:
                            pass
                r = update_installed_field(text, s["name"], False)
                if r["modified"]:
                    text = r["text"]
            MANIFEST_PATH.write_text(text, encoding="utf-8")
            print(
                f"✅ MANIFEST 已更新；{len(to_remove)} 個 stacks 標記 "
                "installed: false + 檔案 git rm"
            )

    today = datetime.utcnow().strftime("%Y-%m-%d")
    if ws_info and ws_info.get("path"):
        if update_workspace_audit_date(ws_info["path"], today):
            print(f"✅ {ws_info['wsName']}.md last_audit_date → {today}")

    print("\n─────────────────────────────────────")
    print(f"Audit 摘要（{today}）")
    print("─────────────────────────────────────")
    print(f"  保留：{kept}")
    print(f"  移除：{removed}")
    print(f"  跳過：{skipped}")
    print("─────────────────────────────────────")
    return 0


# ───────── 入口 ─────────
def print_help():
    print("""
tech-stack-manage.py — Tech-Stacks Catalog 管理 CLI

USAGE:
  python3 .agents/scripts/tech-stack-manage.py <command> [args] [flags]

COMMANDS:
  list                     列出全部 stacks（依 category 分組）
  info <name>              顯示指定 stack 詳細資訊
  install <name>           將 stack 標記為 installed: true（依賴自動檢查）
  remove <name>            標記 installed: false 並 git rm 檔案
  restore <name>           從 git history 取回檔案並標記 installed: true
  audit                    依引用統計初篩使用狀況；逐個確認移除（PROPOSAL_018 Phase C）

FLAGS:
  --dry-run                僅預覽不寫檔
  --force                  跳過互動確認
  --deep                   audit 指令深度掃描（grep workspace project_root）
  --help, -h               顯示本說明

REFERENCE:
  PROPOSAL_20260423_017 + PROPOSAL_20260424_018 / ADR-0031 + ADR-0032 /
  tech-stacks/MANIFEST.yaml
""")


def main() -> int:
    argv = sys.argv[1:]
    flags = {
        "dry_run": "--dry-run" in argv,
        "force": "--force" in argv,
        "help": "--help" in argv or "-h" in argv,
        "deep": "--deep" in argv,
    }
    positional = [a for a in argv if not a.startswith("--") and a != "-h"]
    cmd = positional[0] if positional else None
    name = positional[1] if len(positional) > 1 else None

    if flags["help"] or not cmd:
        print_help()
        return 0 if cmd else 1

    if not MANIFEST_PATH.exists():
        print(f"❌ MANIFEST 不存在：{MANIFEST_PATH}", file=sys.stderr)
        return 2
    manifest = parse_manifest(MANIFEST_PATH.read_text(encoding="utf-8"))

    if cmd == "list":
        cmd_list(manifest)
        return 0
    if cmd == "info":
        if not name:
            print("❌ info 需指定 <name>", file=sys.stderr)
            return 1
        return cmd_info(manifest, name)
    if cmd == "install":
        if not name:
            print("❌ install 需指定 <name>", file=sys.stderr)
            return 1
        return cmd_install(manifest, name, flags)
    if cmd == "remove":
        if not name:
            print("❌ remove 需指定 <name>", file=sys.stderr)
            return 1
        return cmd_remove(manifest, name, flags)
    if cmd == "restore":
        if not name:
            print("❌ restore 需指定 <name>", file=sys.stderr)
            return 1
        return cmd_restore(manifest, name, flags)
    if cmd == "audit":
        return cmd_audit(manifest, flags)

    print(f"❌ 未知指令：{cmd}", file=sys.stderr)
    print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
