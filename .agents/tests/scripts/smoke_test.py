#!/usr/bin/env python3
"""
smoke_test.py — scripts/ E2E 煙霧測試（Python port of smoke.test.sh）
PROPOSAL_502_026 Sprint 1（SCRIPT_MIGRATION_ROADMAP Phase 1）。

13 test cases (對齊原 .sh)：
    1.  init-workspace --help
    2.  init-workspace --dry-run 不寫檔
    3.  init-workspace 完整成功路徑
    4.  rollback 路徑（mkdir fail）
    5.  framework-diff self-diff
    6.  CURRENT_WORKSPACE 保護
    7.  run-all --validator schema 單一模式
    8.  git-diff-detector 函式輸出
    9.  run-all --help
    10. run-all --regenerate-indexes
    11. gen-rules-version-index dry-run 不寫檔
    12. gen-framework-version dry-run 不寫檔
    13. tech-stack-manage audit --dry-run

退出碼：
    0 = 全通過
    1 = 任一失敗
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent.parent  # .agents/

PASS_COUNT = 0
FAIL_COUNT = 0
FAILED_TESTS: list[str] = []
TEMP_DIR: Path | None = None
WORKSPACE_BACKUP: bytes | None = None


# -------- Setup / Cleanup --------
def setup():
    global TEMP_DIR, WORKSPACE_BACKUP
    TEMP_DIR = Path(tempfile.mkdtemp(prefix="agents-scripts-test."))
    cw = AGENTS_ROOT / "CURRENT_WORKSPACE"
    if cw.is_file():
        WORKSPACE_BACKUP = cw.read_bytes()


def cleanup():
    if WORKSPACE_BACKUP is not None:
        (AGENTS_ROOT / "CURRENT_WORKSPACE").write_bytes(WORKSPACE_BACKUP)
    # 清除測試 workspace
    workspaces_dir = AGENTS_ROOT / "workspaces"
    for entry in workspaces_dir.iterdir() if workspaces_dir.is_dir() else []:
        if entry.name.startswith("smoke_"):
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
    # 清除 README.md 內 smoke_* 條目
    readme = workspaces_dir / "README.md"
    if readme.is_file():
        text = readme.read_text(encoding="utf-8")
        text = re.sub(r"^\| `smoke_.*\n", "", text, flags=re.MULTILINE)
        readme.write_text(text, encoding="utf-8")
    if TEMP_DIR and TEMP_DIR.is_dir():
        shutil.rmtree(TEMP_DIR, ignore_errors=True)


def passed(name: str):
    global PASS_COUNT
    print(f"✅ PASS: {name}")
    PASS_COUNT += 1


def failed(name: str, reason: str):
    global FAIL_COUNT
    print(f"❌ FAIL: {name} — {reason}")
    FAIL_COUNT += 1
    FAILED_TESTS.append(name)


# -------- Helpers --------
def generate_minimal_input(display_name: str) -> str:
    """41 行最小輸入序列；對齊 .sh generate_minimal_input。"""
    lines = [
        display_name,    # 1  PROJECT_CONTEXT.display_name
        "示範專案",       # 2  business_domain
        "", "", "",      # 3-5 optional
        "nodejs",        # 6  TECH_STACK.language
        "", "", "", "", "", "",  # 7-12
        "./data",        # 13 PATHS.data_root
        "", "", "", "", "", "", "",  # 14-20
        "", "", "", "", "", "", "", "", "",  # 21-29
        "", "", "",      # 30-32
        "", "",          # 33-34
        "", "", "", "", "", "",  # 35-40
        "y",             # 41 確認執行
    ]
    return "\n".join(lines) + "\n"


def run_node(args: list[str], stdin: str | None = None, timeout: int = 30) -> tuple[int, str]:
    """執行 Python 腳本（保留函式名 run_node 為歷史相容；底層用 python3）"""
    try:
        result = subprocess.run(
            ["python3", *args],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return -1, "TIMEOUT"


def run_bash(args: list[str], timeout: int = 30) -> tuple[int, str]:
    try:
        result = subprocess.run(
            ["bash", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return -1, "TIMEOUT"


# -------- Test cases --------
def test_help():
    rc, out = run_node([str(AGENTS_ROOT / "scripts" / "init-workspace.py"), "--help"])
    if "Interactive workspace initialization" in out:
        passed("init-workspace --help 正常輸出")
    else:
        failed("init-workspace --help", "缺少預期 --help 輸出")


def test_dry_run_no_write():
    name = "smoke_dry_test"
    workspaces_dir = AGENTS_ROOT / "workspaces"
    before = sorted(p.name for p in workspaces_dir.iterdir())
    inp = generate_minimal_input("Demo Project")
    run_node(
        [str(AGENTS_ROOT / "scripts" / "init-workspace.py"),
         "--name", name, "--dry-run", "--force"],
        stdin=inp, timeout=10,
    )
    after = sorted(p.name for p in workspaces_dir.iterdir())
    if before == after:
        passed("init-workspace --dry-run（不寫檔）")
    else:
        failed("init-workspace --dry-run", "workspaces/ 目錄狀態變更")


def test_success_path():
    name = "smoke_success"
    inp = generate_minimal_input("Demo Project")
    rc, _ = run_node(
        [str(AGENTS_ROOT / "scripts" / "init-workspace.py"), "--name", name, "--force"],
        stdin=inp, timeout=15,
    )
    if rc != 0:
        failed("完整成功路徑", f"CLI exit {rc}")
        return
    ws = AGENTS_ROOT / "workspaces" / name
    if not (AGENTS_ROOT / "workspaces" / f"{name}.md").is_file():
        failed("完整成功路徑", f"workspaces/{name}.md 未建立"); return
    for sub in ("active", "completed", "archived"):
        if not (ws / "proposals" / sub).is_dir():
            failed("完整成功路徑", f"proposals/{sub} 未建立"); return
    if not (ws / "proposals" / "PROPOSAL_INDEX.md").is_file():
        failed("完整成功路徑", "proposals/PROPOSAL_INDEX.md 未建立"); return
    cw = (AGENTS_ROOT / "CURRENT_WORKSPACE").read_text().strip()
    if cw != name:
        failed("完整成功路徑", f"CURRENT_WORKSPACE 未更新（current={cw}）"); return
    passed("完整成功路徑（8 檔案/目錄建立 + CURRENT_WORKSPACE 更新）")


def test_rollback_path():
    name = "smoke_rollback"
    placeholder = AGENTS_ROOT / "workspaces" / name
    placeholder.touch()  # 佔位致 mkdir 失敗
    inp = generate_minimal_input("Demo Project")
    run_node(
        [str(AGENTS_ROOT / "scripts" / "init-workspace.py"), "--name", name, "--force"],
        stdin=inp, timeout=15,
    )
    leak1 = (AGENTS_ROOT / "workspaces" / f"{name}.md").is_file()
    leak2 = (AGENTS_ROOT / "workspaces" / name / "proposals").is_dir()
    placeholder.unlink(missing_ok=True)
    if leak1:
        failed("rollback", f"workspaces/{name}.md 未被 rollback 清除"); return
    if leak2:
        failed("rollback", "proposals 子樹未被 rollback 清除"); return
    passed("rollback 路徑（mkdirSync fail → 完整回退）")


def test_framework_diff_self():
    rc, _ = run_node(
        [str(AGENTS_ROOT / "scripts" / "framework-diff.py"), "--target", str(AGENTS_ROOT)]
    )
    if rc == 0:
        passed("framework-diff self-diff exit 0")
    else:
        failed("framework-diff self-diff", f"非零退出碼 {rc}")


def test_current_workspace_guard():
    cw_path = AGENTS_ROOT / "CURRENT_WORKSPACE"
    before = cw_path.read_text() if cw_path.is_file() else ""
    rc, out = run_node(
        [str(AGENTS_ROOT / "scripts" / "init-workspace.py"), "--name", "smoke_cancel"],
        stdin="n\n", timeout=5,
    )
    after = cw_path.read_text() if cw_path.is_file() else ""
    if before == after and "使用者取消" in out:
        passed("CURRENT_WORKSPACE 保護（無 --force + 回 n 正確取消）")
    else:
        failed("CURRENT_WORKSPACE 保護", "取消流程異常")


def run_python(args: list[str], timeout: int = 30) -> tuple[int, str]:
    try:
        result = subprocess.run(
            ["python3", str(AGENTS_ROOT / "tests" / "run-all.py"), *args],
            capture_output=True, text=True, timeout=timeout,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return -1, "TIMEOUT"


def test_run_all_single_mode():
    rc, out = run_python(["--validator", "schema"])
    if "Schema Validator" in out:
        passed("run-all.py --validator schema 單一模式")
    else:
        failed("run-all --validator", "未顯示 schema validator 輸出")


def test_git_diff_detector():
    detector = AGENTS_ROOT / "tests" / "lib" / "git_diff_detector.py"
    if not detector.is_file():
        failed("git-diff-detector 存在性", f"{detector} 不存在"); return
    result = subprocess.run(
        ["python3", str(detector)], capture_output=True, text=True
    )
    if result.stdout.strip():
        passed("git_diff_detector.py detect_relevant_validators 正確輸出")
    else:
        failed("git-diff-detector", "回傳空（應 fallback 跑全部）")


def test_run_all_help():
    rc, out = run_python(["--help"])
    # argparse default --help 輸出含 usage / options
    if "usage:" in out.lower() and "validator" in out.lower():
        passed("run-all.py --help 顯示說明")
    else:
        failed("run-all --help", "未顯示說明文字")


def test_regenerate_indexes():
    rc, out = run_python(["--regenerate-indexes"], timeout=60)
    if "Indexes regenerate 完成" in out:
        passed("run-all.py --regenerate-indexes 模式正確執行")
    else:
        failed("run-all --regenerate-indexes", "未顯示完成標記")


def test_gen_rules_version_index_dry_run():
    target = AGENTS_ROOT / "RULES_VERSION_INDEX.md"
    before = target.stat().st_mtime if target.is_file() else 0
    run_node([str(AGENTS_ROOT / "scripts" / "generators" / "gen-rules-version-index.py")])
    after = target.stat().st_mtime if target.is_file() else 0
    if before == after:
        passed("gen-rules-version-index dry-run 不寫檔")
    else:
        failed("gen-rules-version-index dry-run", "RULES_VERSION_INDEX 被修改")


def test_gen_framework_version_dry_run():
    target = AGENTS_ROOT / "FRAMEWORK_VERSION"
    before = target.stat().st_mtime if target.is_file() else 0
    run_node(
        [str(AGENTS_ROOT / "scripts" / "generators" / "gen-framework-version.py"),
         "--bump", "minor", "--proposal", "TEST_DRY"]
    )
    after = target.stat().st_mtime if target.is_file() else 0
    if before == after:
        passed("gen-framework-version dry-run 不寫檔")
    else:
        failed("gen-framework-version dry-run", "FRAMEWORK_VERSION 被修改")


def test_tech_stack_audit_dry_run():
    manifest = AGENTS_ROOT / "tech-stacks" / "MANIFEST.yaml"
    before = manifest.stat().st_mtime if manifest.is_file() else 0
    rc, out = run_node(
        [str(AGENTS_ROOT / "scripts" / "tech-stack-manage.py"), "audit", "--dry-run"]
    )
    after = manifest.stat().st_mtime if manifest.is_file() else 0
    if "Tech-Stack Audit" not in out:
        failed("tech-stack audit dry-run", "輸出缺 'Tech-Stack Audit' 標題"); return
    if "初步篩選" not in out:
        failed("tech-stack audit dry-run", "輸出缺 '初步篩選'"); return
    if "DRY-RUN" not in out:
        failed("tech-stack audit dry-run", "輸出缺 'DRY-RUN' 標記"); return
    if before != after:
        failed("tech-stack audit dry-run", "MANIFEST 被修改"); return
    passed("tech-stack-manage audit --dry-run 正確（分級輸出 + 不改 MANIFEST）")


# -------- Main --------
def main():
    setup()
    try:
        print("🧪 Running scripts/ smoke tests (PROPOSAL_502_026; Python port)")
        print()
        test_help()
        test_dry_run_no_write()
        test_success_path()
        test_rollback_path()
        test_framework_diff_self()
        test_current_workspace_guard()
        test_run_all_single_mode()
        test_git_diff_detector()
        test_run_all_help()
        test_regenerate_indexes()
        test_gen_rules_version_index_dry_run()
        test_gen_framework_version_dry_run()
        test_tech_stack_audit_dry_run()
    finally:
        cleanup()

    print()
    print("=" * 40)
    print(f"Smoke Tests: {PASS_COUNT} passed / {FAIL_COUNT} failed")
    if FAIL_COUNT > 0:
        print("Failed tests:")
        for t in FAILED_TESTS:
            print(f"  - {t}")
        sys.exit(1)
    print("=" * 40)
    sys.exit(0)


if __name__ == "__main__":
    main()
