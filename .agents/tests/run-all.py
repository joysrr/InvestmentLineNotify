#!/usr/bin/env python3
"""
run-all.py — Framework validators 統一入口（Python port of run-all.sh）
PROPOSAL_502_025 Sprint B。

Modes：
    full     全部 validators 並行（default）
    fast     依 git diff 偵測相關 validators
    single   只跑指定 validator（--validator <name>）
    regen    呼叫 generators 重生 indexes

使用：
    python3 .agents/tests/run-all.py
    python3 .agents/tests/run-all.py --fast
    python3 .agents/tests/run-all.py --validator memory_palace
    python3 .agents/tests/run-all.py --regenerate-indexes

退出碼：
    0 = 全通過 / 僅警告（不 block）
    1 = warning level（不阻斷 commit）
    2 = error level（阻斷 commit）
"""
import argparse
import shlex
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from git_diff_detector import ALL_VALIDATORS, detect_relevant_validators  # noqa


VALIDATOR_CMD = {
    "schema": f"python3 {SCRIPT_DIR / 'schema-validator.py'}",
    "intent": f"python3 {SCRIPT_DIR / 'proposal-intent-consistency.py'}",
    "workspace": f"python3 {SCRIPT_DIR / 'workspace-schema-validator.py'}",
    "drift": f"python3 {SCRIPT_DIR / 'agent-drift-simulator.py'} --mode static",
    "ref": f"python3 {SCRIPT_DIR / 'ref-validator.py'}",
    "sync": f"python3 {SCRIPT_DIR / 'agents-overview-sync-validator.py'}",
    "loc": f"python3 {SCRIPT_DIR / 'docs-location-validator.py'}",
    "index_drift": f"python3 {SCRIPT_DIR / 'index-drift-validator.py'}",
    "proposal_scope": f"python3 {SCRIPT_DIR / 'proposal-scope-validator.py'}",
    "tech_stack": f"python3 {SCRIPT_DIR / 'tech-stack-validator.py'}",
    "rule_token": f"python3 {SCRIPT_DIR / 'rule-token-budget-validator.py'}",
    "routing_ticket": f"python3 {SCRIPT_DIR / 'routing-ticket-validator.py'}",
    "iron_theme": f"python3 {SCRIPT_DIR / 'iron-theme-validator.py'}",
    "memory_palace": f"python3 {SCRIPT_DIR / 'memory-palace-validator.py'}",
    "sub_agent_dispatch": f"python3 {SCRIPT_DIR / 'sub-agent-dispatch-validator.py'}",
    "workflow_stage": f"python3 {SCRIPT_DIR / 'workflow-stage-validator.py'}",
    "user_execution_language": f"python3 {SCRIPT_DIR / 'user-execution-language-validator.py'}",
    "root_artifact_pollution": f"python3 {SCRIPT_DIR / 'root-artifact-pollution-validator.py'}",
    "condition_claim": f"python3 {SCRIPT_DIR / 'condition-claim-validator.py'}",
    "schema_completeness": f"python3 {SCRIPT_DIR / 'schema-completeness-validator.py'}",
}

VALIDATOR_TITLE = {
    "schema": "Schema Validator",
    "intent": "Proposal Intent Consistency",
    "workspace": "Workspace Schema Validator",
    "drift": "Agent Drift Simulator (Mode A, static)",
    "ref": "!ref Validator",
    "sync": "agents-overview Sync Validator",
    "loc": "docs Location Validator",
    "index_drift": "INDEX Drift Validator (PROPOSAL_502_025; Python port)",
    "proposal_scope": "Proposal Scope Validator",
    "tech_stack": "Tech-Stack Validator",
    "rule_token": "Rule Token Budget Validator",
    "routing_ticket": "ROUTING_TICKET Validator",
    "iron_theme": "Iron Theme Validator",
    "memory_palace": "Memory Palace Validator",
    "sub_agent_dispatch": "Sub-agent Dispatch Validator",
    "workflow_stage": "Workflow Stage Validator",
    "user_execution_language": "User Execution Language Validator (PROPOSAL_502_025; Python)",
    "root_artifact_pollution": "Root Artifact Pollution Validator (PROPOSAL_502_031 T-4)",
    "condition_claim": "Condition-Claim Meta-Validator (PROPOSAL_502_047 C-1)",
    "schema_completeness": "Schema Completeness Meta-Validator (PROPOSAL_502_047 C-2)",
}


def _run(name: str) -> tuple[str, int, str]:
    """Run one validator; return (name, exit_code, output)."""
    cmd = VALIDATOR_CMD[name]
    result = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    return name, result.returncode, result.stdout + result.stderr


def run_parallel(names: list[str]) -> dict[str, int]:
    """Run validators in parallel; print outputs in order; return code map."""
    results = {}
    outputs = {}

    with ProcessPoolExecutor(max_workers=min(len(names), 8)) as ex:
        futures = {ex.submit(_run, name): name for name in names}
        for fut in as_completed(futures):
            name, code, output = fut.result()
            results[name] = code
            outputs[name] = output

    # Print in original order to keep deterministic output
    for name in names:
        print()
        print(f"🔍 Running {VALIDATOR_TITLE[name]}...")
        print(outputs[name].rstrip())

    return results


def run_scripts_tests() -> int:
    print()
    print("🔍 Running scripts/ Tests (PROPOSAL_20260423_006; serial)...")
    runner_py = SCRIPT_DIR / "scripts" / "run.py"
    runner_sh = SCRIPT_DIR / "scripts" / "run.sh"
    if runner_py.exists():
        result = subprocess.run(["python3", str(runner_py)], capture_output=True, text=True)
    else:
        result = subprocess.run(["bash", str(runner_sh)], capture_output=True, text=True)
    if result.returncode == 0:
        print("ℹ️  scripts/ tests: ✅ 全通過（L1 單元 + L3 smoke）")
    else:
        print("⚠️  scripts/ tests: ❌ 部分失敗（詳見 python3 .agents/tests/scripts/run.py）")
    return result.returncode


def regen_indexes() -> int:
    generators_dir = SCRIPT_DIR.parent / "scripts" / "generators"
    print("🔧 Regenerating indexes...")
    print()
    failures = []
    for gen, label in [
        ("gen-rules-version-index", "RULES_VERSION_INDEX"),
        ("gen-proposal-index", "PROPOSAL_INDEX"),
        ("gen-adr-index", "ADR_INDEX"),
    ]:
        print(f"→ {gen}.py --write")
        rc = subprocess.run(
            ["python3", str(generators_dir / f"{gen}.py"), "--write"]
        ).returncode
        if rc != 0:
            failures.append(gen)
        print()

    print("ℹ️  手動觸發（需 --proposal 參數）：")
    print("    python3 .agents/scripts/generators/gen-changelog.py --proposal <path> --write")
    print("    python3 .agents/scripts/generators/gen-framework-version.py --bump minor --proposal <id> --write")

    if failures:
        print(f"❌ Regenerate 部分失敗：{', '.join(failures)}")
        return 2
    print("✅ Indexes regenerate 完成")
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fast", action="store_true", help="Run only validators relevant to git diff")
    parser.add_argument("--validator", type=str, default=None, help="Run single validator by name")
    parser.add_argument("--regenerate-indexes", action="store_true", help="Regenerate auto-generated indexes")
    parser.add_argument("--help-validators", action="store_true", help="List available validator names")
    args = parser.parse_args()

    if args.help_validators:
        print("Available validators:", " ".join(VALIDATOR_CMD.keys()), "scripts")
        return 0

    if args.regenerate_indexes:
        return regen_indexes()

    # Single mode
    if args.validator:
        if args.validator == "scripts":
            return run_scripts_tests()
        if args.validator not in VALIDATOR_CMD:
            print(f"❌ Unknown validator: '{args.validator}'")
            print("Available:", " ".join(VALIDATOR_CMD.keys()), "scripts")
            return 2
        print(f"🔍 Running {VALIDATOR_TITLE[args.validator]} (single mode)...")
        return subprocess.run(shlex.split(VALIDATOR_CMD[args.validator])).returncode

    # Determine which validators to run
    relevant_scripts = False
    if args.fast:
        relevant = detect_relevant_validators()
        if not relevant:
            print("ℹ️  Fast mode: 無 framework 變更；跳過所有 validators")
            return 0
        print(f"ℹ️  Fast mode: 偵測到相關 validators: {' '.join(relevant)}")
        validators = [v for v in relevant if v != "scripts"]
        relevant_scripts = "scripts" in relevant
    else:
        validators = ALL_VALIDATORS
        relevant_scripts = True

    print(f"🚀 Running {len(validators)} validators in parallel: {' '.join(validators)}")
    results = run_parallel(validators)

    if relevant_scripts:
        results["scripts"] = run_scripts_tests()

    # Policy 判斷
    has_error = any(c == 2 for c in results.values())
    has_warn = any(c == 1 for c in results.values())
    summary = ", ".join(f"{k}={v}" for k, v in sorted(results.items()))

    print()
    if has_error:
        print(f"❌ Validation FAILED ({summary}) — commit blocked")
        return 2
    if has_warn:
        print(f"⚠️  Validation has warnings ({summary}) — commit allowed")
        print("    Review warnings above; fix when possible")
        return 0
    print(f"✅ All validation passed ({summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
