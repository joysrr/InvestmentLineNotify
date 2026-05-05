#!/usr/bin/env python3
"""cross-harness-validator.py — Cross-harness deployment health (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of cross-harness-validator.mjs (PROPOSAL_502_021 Sprint C-4).

用途：在任一 harness 部署 framework 後跑此 script，產生「實測達成率」報告。
  每個 harness 跑一次；輸出累積到 .agents/docs/Reports/CROSS_HARNESS_RESULTS.json。

使用：
  python3 .agents/scripts/cross-harness-validator.py                # 跑當前環境完整檢測
  python3 .agents/scripts/cross-harness-validator.py --append       # append 至 results.json
  python3 .agents/scripts/cross-harness-validator.py --report       # 產 markdown 摘要
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
RESULTS_PATH = REPO_ROOT / ".agents" / "docs" / "Reports" / "CROSS_HARNESS_RESULTS.json"
REPORT_PATH = REPO_ROOT / ".agents" / "docs" / "Reports" / "CROSS_HARNESS_REPORT.md"


def now_iso() -> str:
    n = datetime.now(timezone.utc)
    return n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond // 1000:03d}Z"


def run_json(cmd, timeout=60):
    try:
        res = subprocess.run(
            cmd, shell=True, cwd=str(REPO_ROOT), capture_output=True,
            text=True, timeout=timeout,
        )
        return json.loads(res.stdout or "")
    except Exception as e:
        return {"error": str(e)}


def run_text(cmd, timeout=120):
    try:
        res = subprocess.run(
            cmd, shell=True, cwd=str(REPO_ROOT), capture_output=True,
            text=True, timeout=timeout,
        )
        if res.returncode == 0:
            return res.stdout or ""
        return {"stdout": res.stdout or "", "stderr": res.stderr or "", "code": res.returncode}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "code": -1}


def compute_dod(res):
    cap = (res.get("platform") or {}).get("capabilities") or {}
    dod = {
        "drift_pass": res.get("drift_score") is not None and res.get("drift_score", 0) >= 0.85,
        "validators_pass": res.get("validator_errors") == 0,
        "mempalace_functional": bool(cap.get("mempalace_mcp") or cap.get("mempalace_cli")),
        "harness_detected": bool(
            (res.get("platform") or {}).get("harness")
            and (res.get("platform") or {}).get("harness") != "unknown"
        ),
        "fs_writable": cap.get("fs_writable") is True,
    }
    passed = sum(1 for v in dod.values() if v)
    total = len(dod)
    return {"dod": dod, "score": f"{passed}/{total}", "pct": round(passed / total * 100)}


def main() -> int:
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print(__doc__)
        return 0
    append_mode = "--append" in args
    want_report = "--report" in args

    print("🔍 Cross-Harness Validator (PROPOSAL_502_021 Sprint C-4)")
    print("")

    # 1. Platform detect
    print("[1/3] Running platform-detect...")
    # Prefer python detector if exists; else fall back to mjs
    if (REPO_ROOT / ".agents" / "scripts" / "platform-detect.py").exists():
        platform = run_json("python3 .agents/scripts/platform-detect.py --json")
    else:
        platform = run_json("node .agents/scripts/platform-detect.mjs --json")

    # 2. Drift simulator
    print("[2/3] Running drift simulator (50 steps; static)...")
    if (REPO_ROOT / ".agents" / "tests" / "agent-drift-simulator.py").exists():
        drift_out = run_text("python3 .agents/tests/agent-drift-simulator.py")
    else:
        drift_out = run_text("node .agents/tests/agent-drift-simulator.mjs")
    drift_text = drift_out if isinstance(drift_out, str) else (drift_out.get("stdout") or "")
    drift_match = re.search(r"drift_score\s*=\s*([\d.]+)", drift_text)
    drift_score = float(drift_match.group(1)) if drift_match else None

    # 3. Validators
    print("[3/3] Running validators...")
    if (REPO_ROOT / ".agents" / "tests" / "run-all.py").exists():
        val_out = run_text("python3 .agents/tests/run-all.py")
    else:
        val_out = run_text("bash .agents/tests/run-all.sh")
    val_text = val_out if isinstance(val_out, str) else (val_out.get("stdout") or "")
    validator_warnings_match = re.search(r"has warnings", val_text)
    validator_pass_match = re.search(r"All validation passed", val_text)
    if validator_pass_match:
        validator_errors = 0
    else:
        validator_errors = 1 if re.search(r"❌|errors=([1-9])", val_text) else 0

    result = {
        "timestamp": now_iso(),
        "framework_version": (platform or {}).get("framework_version", "unknown"),
        "harness": (platform or {}).get("harness", "unknown"),
        "confidence": (platform or {}).get("confidence", "unknown"),
        "platform": platform,
        "drift_score": drift_score,
        "drift_passed": drift_score is not None and drift_score >= 0.85,
        "validator_errors": validator_errors,
        "validator_has_warnings": bool(validator_warnings_match),
    }
    result["dod"] = compute_dod(result)

    print("")
    print("─────────────────────────────")
    print("Result:")
    print(f"  harness:           {result['harness']} ({result['confidence']})")
    drift_disp = result['drift_score']
    print(f"  drift_score:       {drift_disp} {'✅' if result['drift_passed'] else '❌'}")
    warn_str = " (with warnings)" if result["validator_has_warnings"] else ""
    print(f"  validators:        errors={result['validator_errors']}{warn_str}")
    print(f"  DoD:               {result['dod']['score']} ({result['dod']['pct']}%)")
    print(f"  framework:         {result['framework_version']}")
    print("─────────────────────────────")

    # 累積結果
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    results = []
    if append_mode and RESULTS_PATH.exists():
        try:
            results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
            if not isinstance(results, list):
                results = []
        except Exception:
            results = []
    results.append(result)
    RESULTS_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n📄 Results: {RESULTS_PATH} ({len(results)} run(s))")

    if want_report:
        md = []
        md.append("# Cross-Harness Validation Report (PROPOSAL_502_021 Sprint C)")
        md.append("")
        md.append(f"Generated: {now_iso()}")
        md.append("")
        md.append("## Summary")
        md.append("")
        md.append("| Run | Timestamp | Harness | Confidence | drift_score | DoD | Validators |")
        md.append("|-----|-----------|---------|-----------|-------------|-----|-----------|")
        for idx, r in enumerate(results):
            ts = r["timestamp"][:16] + "Z"
            ds = r["drift_score"] if r["drift_score"] is not None else "N/A"
            dpass = "✅" if r["drift_passed"] else "❌"
            wstr = " (warn)" if r["validator_has_warnings"] else ""
            md.append(
                f"| {idx + 1} | {ts} | {r['harness']} | {r['confidence']} | {ds} {dpass} "
                f"| {r['dod']['score']} ({r['dod']['pct']}%) | errors={r['validator_errors']}{wstr} |"
            )
        md.append("")
        md.append("## Detailed runs")
        md.append("")
        for idx, r in enumerate(results):
            md.append(f"### Run {idx + 1}：{r['harness']}")
            md.append("")
            md.append(f"- Timestamp: {r['timestamp']}")
            md.append(f"- framework_version: {r['framework_version']}")
            md.append(f"- harness: {r['harness']} ({r['confidence']})")
            dpass_full = "✅ ≥ 0.85" if r["drift_passed"] else "❌ < 0.85"
            md.append(f"- drift_score: {r['drift_score']} {dpass_full}")
            warn_yn = "yes" if r["validator_has_warnings"] else "no"
            md.append(
                f"- validators: errors={r['validator_errors']}; warnings={warn_yn}"
            )
            md.append(f"- DoD: {r['dod']['score']}")
            for k, v in r["dod"]["dod"].items():
                md.append(f"  - {k}: {'✅' if v else '❌'}")
            plat_warnings = ((r.get("platform") or {}).get("warnings") or [])
            if plat_warnings:
                md.append("- platform warnings:")
                for w in plat_warnings:
                    md.append(f"  - {w}")
            md.append("")
        REPORT_PATH.write_text("\n".join(md), encoding="utf-8")
        print(f"📄 Report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
