#!/usr/bin/env python3
"""proposal-scope-validator.py — Port (PROPOSAL_502_027)."""
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import extract_frontmatter_scope  # noqa

AGENTS_ROOT = SCRIPT_DIR.parent
FRAMEWORK_PROPOSALS = AGENTS_ROOT / "proposals"
WORKSPACES_DIR = AGENTS_ROOT / "workspaces"


def scan_dir(d: Path) -> list[Path]:
    if not d.is_dir():
        return []
    out = []
    for f in d.iterdir():
        if not f.is_file() or f.suffix != ".md":
            continue
        if f.name in ("PROPOSAL_INDEX.md", "README.md") or f.name.startswith("SUMMARY_"):
            continue
        out.append(f)
    return out


def walk_workspace_proposals(workspaces_dir: Path):
    if not workspaces_dir.is_dir():
        return
    for ws in workspaces_dir.iterdir():
        if not ws.is_dir():
            continue
        proposals = ws / "proposals"
        if not proposals.is_dir():
            continue
        for sub in ("active", "completed", "archived"):
            for f in scan_dir(proposals / sub):
                yield f, ws.name


def validate_framework(base: Path) -> list[dict]:
    errors = []
    for sub in ("active", "completed", "archived"):
        for f in scan_dir(base / sub):
            scope = extract_frontmatter_scope(f.read_text(encoding="utf-8"))
            if scope is None:
                errors.append({"file": f, "issue": "NO_SCOPE_FIELD", "expected": "framework", "actual": None})
            elif scope != "framework":
                errors.append({"file": f, "issue": "WRONG_SCOPE", "actual": scope, "expected": "framework"})
    return errors


def validate_workspace(workspaces_dir: Path) -> list[dict]:
    errors = []
    for f, ws in walk_workspace_proposals(workspaces_dir):
        scope = extract_frontmatter_scope(f.read_text(encoding="utf-8"))
        if scope is None:
            errors.append({"file": f, "issue": "NO_SCOPE_FIELD", "expected": "project", "workspace": ws, "actual": None})
        elif scope != "project":
            errors.append({"file": f, "issue": "WRONG_SCOPE", "actual": scope, "expected": "project", "workspace": ws})
    return errors


def main():
    print("🔍 Proposal Scope Validator (PROPOSAL_20260423_015; Python port)")

    fw_errors = validate_framework(FRAMEWORK_PROPOSALS)
    proj_errors = validate_workspace(WORKSPACES_DIR)
    total = 0

    print("\n→ Framework area (.agents/proposals/)")
    if not fw_errors:
        count = sum(len(scan_dir(FRAMEWORK_PROPOSALS / s)) for s in ("active", "completed", "archived"))
        print(f"  ✅ {count} proposals IN_SYNC (all scope: framework)")
    else:
        for e in fw_errors:
            rel = e["file"].relative_to(AGENTS_ROOT).as_posix()
            print(f"  ❌ {rel}: {e['issue']} (actual={e['actual'] or 'missing'}, expected={e['expected']})", file=sys.stderr)
            total += 1

    print("\n→ Workspace area (.agents/workspaces/*/proposals/)")
    ws_count = sum(1 for _ in walk_workspace_proposals(WORKSPACES_DIR))
    if not proj_errors:
        print(f"  ✅ {ws_count} proposals IN_SYNC (all scope: project)")
    else:
        for e in proj_errors:
            rel = e["file"].relative_to(AGENTS_ROOT).as_posix()
            print(f"  ❌ [{e['workspace']}] {rel}: {e['issue']} (actual={e['actual'] or 'missing'}, expected={e['expected']})", file=sys.stderr)
            total += 1

    print()
    if total == 0:
        print("✅ Proposal Scope Validator: all proposals correctly classified")
        sys.exit(0)
    print(f"❌ Proposal Scope Validator: {total} violations")
    sys.exit(1)


if __name__ == "__main__":
    main()
