#!/usr/bin/env python3
"""
root-artifact-pollution-validator.py — 偵測 project root 散落 artifact + ROUTING_TICKET 變體
PROPOSAL_502_031 T-4（19th validator）。

Root 唯一允許的運行 artifact：
- ROUTING_TICKET.md
- PENDING_ACTIONS.md
- qwen.md / .mcp.json / CLAUDE.md（config）
- README / LICENSE / package.json / 其他專案 src 檔

違規類型：
- 🔴 ROUTING_TICKET_*.md / ROUTING_TICKET-v2.md 等變體（agent 不該自建）
- 🔴 DIAGNOSIS_NOTE*.md / REVIEW_REPORT*.md / SECURITY_REPORT*.md / TEST_REPORT*.md / AUDIT_REPORT*.md（應在 docs/reports/ or docs/plans/）
- 🟡 *.snapshot.* 殘留（commit 後該清；.gitignore 已有但 root 不該見）

退出碼：0 = clean / 1 = warn / 2 = error
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

ERROR_PATTERNS = [
    (re.compile(r"^ROUTING_TICKET_.+\.md$|^ROUTING_TICKET-.+\.md$"),
     "ROUTING_TICKET 變體；同時只能有 1 個 ROUTING_TICKET.md（多 phase 用 PENDING_DISPATCHES queue）"),
    (re.compile(r"^DIAGNOSIS_NOTE.*\.md$"),
     "DIAGNOSIS_NOTE 應放 docs/plans/diagnosis/<事故>.md"),
    (re.compile(r"^REVIEW_REPORT.*\.md$"),
     "REVIEW_REPORT 應放 docs/reports/review/<功能>-<YYYYMMDD>.md"),
    (re.compile(r"^SECURITY_REPORT.*\.md$"),
     "SECURITY_REPORT 應放 docs/reports/security/<功能>-<YYYYMMDD>.md"),
    (re.compile(r"^TEST_REPORT.*\.md$"),
     "TEST_REPORT 應放 docs/reports/test/<功能>-<YYYYMMDD>.md"),
    (re.compile(r"^TEST_SPEC.*\.md$"),
     "TEST_SPEC 應放 docs/plans/test-spec/<功能>.md"),
    (re.compile(r"^AUDIT_REPORT.*\.md$"),
     "AUDIT_REPORT 應 append 至 .agents/docs/Reports/AUDIT_HISTORY.md（不獨立檔）"),
    (re.compile(r"^PRIOR_ART_REPORT.*\.md$"),
     "PRIOR_ART_REPORT 應放 docs/plans/prior-art/<功能>.md"),
]

WARN_PATTERNS = [
    (re.compile(r".+\.snapshot\.\d+$|.+\.snapshot\..+\.md$"),
     "暫存 snapshot 殘留；commit 前應清"),
    (re.compile(r"^.+\.tmp$|^.+\.bak$"),
     "暫存檔殘留"),
]

ALLOWED_ROOT_FILES = {
    # Framework runtime
    "ROUTING_TICKET.md", "PENDING_ACTIONS.md",
    # Framework config
    "qwen.md", "QWEN.md", "AGENTS.md", "CLAUDE.md", ".mcp.json",
    # Project meta
    "README.md", "LICENSE", "LICENSE.md", "CHANGELOG.md",
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "pyproject.toml", "requirements.txt", "Pipfile", "Pipfile.lock",
    "Cargo.toml", "go.mod", "go.sum", "pom.xml", "build.gradle",
    "Dockerfile", "docker-compose.yml", "Makefile",
    ".gitignore", ".gitattributes", ".editorconfig",
    "tsconfig.json", "jsconfig.json", "vite.config.js", "vite.config.ts",
}


def scan():
    errors = []
    warnings = []
    if not REPO_ROOT.is_dir():
        return errors, warnings

    for entry in REPO_ROOT.iterdir():
        if not entry.is_file():
            continue
        name = entry.name
        # 跳 hidden + allowed
        if name.startswith(".") and name not in {".gitignore", ".gitattributes", ".editorconfig", ".mcp.json"}:
            continue
        if name in ALLOWED_ROOT_FILES:
            continue
        # 純 source 檔（非 .md）放行
        if not name.endswith(".md"):
            continue
        for pat, msg in ERROR_PATTERNS:
            if pat.match(name):
                errors.append((name, msg))
                break
        else:
            for pat, msg in WARN_PATTERNS:
                if pat.match(name):
                    warnings.append((name, msg))
                    break
    return errors, warnings


def main():
    print("🔍 Root Artifact Pollution Validator (PROPOSAL_502_031 T-4)")
    print()
    errors, warnings = scan()
    print(f"ℹ️  Scanned project root: {REPO_ROOT}")
    print(f"ℹ️  Allowed root files: {len(ALLOWED_ROOT_FILES)}; error patterns: {len(ERROR_PATTERNS)}; warn patterns: {len(WARN_PATTERNS)}")
    print()

    if not errors and not warnings:
        print("─" * 50)
        print("Summary: 0 errors, 0 warnings")
        print("✅ Root Artifact Pollution Validator: 全 PASS")
        print("─" * 50)
        sys.exit(0)

    if errors:
        print(f"❌ {len(errors)} error(s) — root 散落 artifact：")
        for name, msg in errors:
            print(f"  ❌ {name}")
            print(f"     {msg}")
        print()

    if warnings:
        print(f"⚠️  {len(warnings)} warning(s)：")
        for name, msg in warnings:
            print(f"  ⚠️  {name}")
            print(f"     {msg}")
        print()

    print("─" * 50)
    print(f"Summary: {len(errors)} errors, {len(warnings)} warnings")
    if errors:
        print("❌ Root Artifact Pollution Validator: FAIL")
        sys.exit(2)
    print("⚠️  Root Artifact Pollution Validator: WARN")
    sys.exit(1)


if __name__ == "__main__":
    main()
