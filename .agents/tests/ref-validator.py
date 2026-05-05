#!/usr/bin/env python3
"""ref-validator.py — Port of ref-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證 rules / skills / tasks frontmatter 內 `!ref <file>#<anchor>` 標記：
  1. 目標檔案存在
  2. anchor 實際可定位（標題 / 參數名 / YAML key）
  3. 循環引用偵測（DFS）
  4. body markdown ADR/file links（PROPOSAL_502_018 R-2）

依 PROPOSAL_20260422_029 建立。

退出碼：
  0 = 全部 !ref 有效
  1 = warning（anchor 模糊可能對應）
  2 = error（檔案不存在 / anchor 無法定位 / 循環引用）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
SCAN_DIRS = [AGENTS_ROOT / "rules", AGENTS_ROOT / "skills", AGENTS_ROOT / "tasks"]

errors = 0
warnings = 0
verbose = "--verbose" in sys.argv


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


def walk_md(directory: Path):
    results = []
    if not directory.exists():
        return results
    for entry in sorted(directory.iterdir()):
        if entry.is_dir():
            results.extend(walk_md(entry))
        elif entry.name.endswith(".md"):
            results.append({"path": entry, "name": entry.name})
    return results


def scan_refs():
    refs = []
    fm_re = re.compile(r"^---\n([\s\S]*?)\n---")
    body_link_re = re.compile(
        r"\[(?:ADR-\d+|[^\]]+?)\]\(\.\./decisions/(\d{4}-[a-z0-9-]+\.md)\)"
    )
    ref_re = re.compile(
        r"^\s*([A-Za-z_][\w]*)\s*:\s*!ref\s+([^\s#]+)#(\S+)\s*$",
        re.MULTILINE,
    )
    for d in SCAN_DIRS:
        if not d.exists():
            continue
        for item in walk_md(d):
            path = item["path"]
            name = item["name"]
            content = path.read_text(encoding="utf-8")
            fm_match = fm_re.match(content)
            if not fm_match:
                continue
            fm_text = fm_match.group(1)
            for bm in body_link_re.finditer(content):
                target_file = f"decisions/{bm.group(1)}"
                refs.append({
                    "source": name,
                    "sourcePath": path,
                    "key": "_body_link",
                    "targetFile": target_file,
                    "anchor": "__body_link__",
                    "isBodyLink": True,
                })
            for m in ref_re.finditer(fm_text):
                refs.append({
                    "source": name,
                    "sourcePath": path,
                    "key": m.group(1),
                    "targetFile": m.group(2),
                    "anchor": m.group(3),
                    "isBodyLink": False,
                })
    return refs


def validate_file_exists(ref):
    target_path = (AGENTS_ROOT / ref["targetFile"]).resolve()
    if not target_path.exists():
        err(f"{ref['source']}: target file not found: {ref['targetFile']} (resolved: {target_path})")
        return None
    return target_path


def escape_re(s: str) -> str:
    return re.escape(s)


def validate_anchor(ref, target_path: Path) -> bool:
    content = target_path.read_text(encoding="utf-8")
    anchor = ref["anchor"]

    # 模式 A：章節標題
    chapter_re = re.compile(rf"^##\s+{escape_re(anchor)}[、\s]", re.MULTILINE)
    if chapter_re.search(content):
        vlog(f"{ref['source']}: anchor '{anchor}' matched as chapter heading")
        return True

    # 模式 B：表格參數名 `<anchor>`
    param_re = re.compile(rf"\|\s*`{escape_re(anchor)}`\s*\|")
    if param_re.search(content):
        vlog(f"{ref['source']}: anchor '{anchor}' matched as table parameter")
        return True

    # 模式 C：YAML 頂層 / 巢狀 key
    if ref["targetFile"].endswith(".yaml") or ref["targetFile"].endswith(".yml"):
        yaml_top_re = re.compile(rf"^{escape_re(anchor)}\s*:", re.MULTILINE)
        if yaml_top_re.search(content):
            vlog(f"{ref['source']}: anchor '{anchor}' matched as YAML key")
            return True
        yaml_nested_re = re.compile(rf"^\s{{2,}}{escape_re(anchor)}\s*:", re.MULTILINE)
        if yaml_nested_re.search(content):
            vlog(f"{ref['source']}: anchor '{anchor}' matched as nested YAML key")
            return True

    # 模式 D：模糊匹配
    fuzzy_re = re.compile(rf"`{escape_re(anchor)}`|\*\*{escape_re(anchor)}\*\*")
    if fuzzy_re.search(content):
        warn(f"{ref['source']}: anchor '{anchor}' matched only in body text (not as heading/param/key); verify intent")
        return True

    return False


def detect_cycles(refs):
    graph = {}
    for r in refs:
        src = r["source"]
        tgt = r["targetFile"].lstrip("./")
        # remove leading ../
        while tgt.startswith("../"):
            tgt = tgt[3:]
        tgt = tgt.split("/")[-1]
        if src not in graph:
            graph[src] = set()
        graph[src].add(tgt)

    cycles = []

    def dfs(node, path, visited):
        if node in path:
            cycle_start = path.index(node)
            cycles.append(path[cycle_start:] + [node])
            return
        if node in visited:
            return
        visited.add(node)
        new_path = path + [node]
        neighbors = graph.get(node, set())
        for n in neighbors:
            dfs(n, list(new_path), visited)

    for node in list(graph.keys()):
        dfs(node, [], set())

    return cycles


def main():
    info("Scanning !ref references in frontmatter...")
    refs = scan_refs()
    info(f"Total !ref entries: {len(refs)}")

    if len(refs) == 0:
        info("No !ref found; nothing to validate")
        sys.exit(0)

    by_file = {}
    for r in refs:
        by_file.setdefault(r["source"], []).append(r)
    for file, lst in by_file.items():
        vlog(f"\n{file} ({len(lst)} refs):")
        for r in lst:
            vlog(f"  {r['key']} → {r['targetFile']}#{r['anchor']}")

    print("")
    info("Validating...")
    valid_count = 0
    for r in refs:
        target_path = validate_file_exists(r)
        if not target_path:
            continue
        if r.get("isBodyLink"):
            valid_count += 1
            continue
        if validate_anchor(r, target_path):
            valid_count += 1
        else:
            err(f"{r['source']}: anchor '{r['anchor']}' not found in {r['targetFile']}")
    info(f"Valid refs: {valid_count}/{len(refs)}")

    print("")
    info("Cycle detection (DFS)...")
    cycles = detect_cycles(refs)
    if cycles:
        err(f"Detected {len(cycles)} cycle(s):")
        for c in cycles:
            err("  " + " → ".join(c))
    else:
        info("No cycles detected")

    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
