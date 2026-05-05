#!/usr/bin/env python3
"""validate-auditor-dispatch.py — Port of validate-auditor-dispatch.mjs (PROPOSAL_502_027 Sprint B).

驗證 @Auditor 派遣 prompt 是否含指定維度所有 Fragment + JSON schema + rationale 字數。
依 PROPOSAL_20260422_027 建立。

使用：
  python3 .agents/tests/validate-auditor-dispatch.py --dispatch-prompt <prompt-file> --dimension <1|2|3|4|5>
  python3 .agents/tests/validate-auditor-dispatch.py --audit                   # 稽核 AUDIT_DECISION_LOG 完整性
  python3 .agents/tests/validate-auditor-dispatch.py --verify-paths --dispatch-prompt <file>

退出碼：
  0 = Fragment 完整 + schema 齊 + rationale ≥ 100 字
  1 = warning（rationale 字數不足 / 非阻斷瑕疵）
  2 = error（Fragment 缺失 / JSON schema 不完整 / AUDIT_DECISION_LOG 記錄斷鏈）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
RUBRIC_PATH = AGENTS_ROOT / "skills/auditor-rubric-prompts.md"
DECISION_LOG_PATH = AGENTS_ROOT / "docs/Reports/AUDIT_DECISION_LOG.md"

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


def load_fragments():
    if not RUBRIC_PATH.exists():
        err(f"Rubric not found: {RUBRIC_PATH}")
        return None
    content = RUBRIC_PATH.read_text(encoding="utf-8")
    fragments: dict[str, list[dict]] = {}
    for m in re.finditer(r"^### (\d+)\.(\d+)\s+(.+)$", content, re.MULTILINE):
        dim = m.group(1)
        sub = m.group(2)
        name = m.group(3).strip()
        fragments.setdefault(dim, []).append(
            {"id": f"{dim}.{sub}", "name": name, "raw": m.group(0)}
        )
    return fragments


def validate_dispatch_prompt(prompt_file: str, target_dimension: str) -> None:
    p = Path(prompt_file)
    if not p.exists():
        err(f"Dispatch prompt file not found: {prompt_file}")
        return
    prompt = p.read_text(encoding="utf-8")
    fragments = load_fragments()
    if not fragments:
        return

    expected = fragments.get(target_dimension)
    if not expected:
        err(f"No fragments found for dimension {target_dimension} in rubric")
        return

    info(f"Dimension {target_dimension} expected fragments: {len(expected)}")

    # 1. 每份 Fragment 的「### X.Y」是否完整出現於 prompt
    missing = []
    for frag in expected:
        needle = f"### {frag['id']}"
        if needle not in prompt:
            missing.append(frag["id"])
    if missing:
        err(f"Missing fragments in dispatch: {', '.join(missing)}")
    else:
        info(f"All {len(expected)} fragments present")

    # 2. JSON 輸出 schema 含必要欄位
    schema_keywords = [
        "dimension",
        "scores",
        "rationales",
        "baseline_comparison",
        "critical_risks",
        "optimization_suggestions",
    ]
    missing_keys = [k for k in schema_keywords if k not in prompt]
    if missing_keys:
        err(f"JSON schema missing required keys: {', '.join(missing_keys)}")
    else:
        info("JSON schema keys complete")

    # 3. rationale 字數要求
    if not re.search(r"rationale.*≥\s*100|rationale.*>=\s*100|rationale.*100\s*字", prompt):
        warn("rationale word count requirement not found (expected: ≥ 100 chars)")


def audit_decision_log() -> None:
    if not DECISION_LOG_PATH.exists():
        warn(f"AUDIT_DECISION_LOG not found: {DECISION_LOG_PATH}")
        warn("  依 PROPOSAL_027 Phase C 應存在；首次執行可忽略（待 @Auditor 首次派遣後填入）")
        return
    content = DECISION_LOG_PATH.read_text(encoding="utf-8")
    if not re.search(r"派遣日期.*評審次數.*維度.*Fragment 清單", content, re.DOTALL):
        err("AUDIT_DECISION_LOG format invalid (missing required columns)")
        return

    lines = content.split("\n")
    record_count = 0
    in_table = False
    after_separator = False
    for line in lines:
        if "派遣日期" in line:
            in_table = True
        if in_table and line.startswith("|---"):
            after_separator = True
        if (
            in_table
            and after_separator
            and line.strip().startswith("|")
            and not line.startswith("|---")
        ):
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if len(cells) >= 4 and not cells[0].startswith("---"):
                record_count += 1
        if line.strip() == "" and after_separator:
            in_table = False

    info(f"AUDIT_DECISION_LOG records: {record_count}")
    if record_count == 0:
        warn("AUDIT_DECISION_LOG has no records yet (expected after first @Auditor dispatch)")


# 已知產物名稱清單；若 dispatch prompt 含這些裸檔名（無 .agents/ 或 docs/ 前綴）→ 🟡 warn
KNOWN_BARE_NAMES = [
    "AUDIT_HISTORY.md",
    "AUDIT_DECISION_LOG.md",
    "PENDING_ACTIONS.md",
    "GLOBAL_STATUS_SUMMARY.md",
    "ROUTING_TICKET.md",
    "PROPOSAL_INDEX.md",
    "RULES_VERSION_INDEX.md",
    "FRAMEWORK_VERSION",
    "CHANGELOG.md",
    "WORKSPACE_SCHEMA.yaml",
    "SYSTEM_THRESHOLDS.yaml",
    "patrol-notification-catalog.md",
    "lead-orchestration-guide.md",
    "retro-analysis-framework.md",
    "assistant-summary-protocol.md",
    "routing-ticket-protocol.md",
    "orchestrator-pattern.md",
    "auditor-rubric-prompts.md",
    "lane-routing-task-classification.md",
    "emergency-shutdown-playbook.md",
    "hotfix-checklist.md",
]


def verify_paths(prompt_file: str) -> None:
    p = Path(prompt_file)
    if not p.exists():
        err(f"Dispatch prompt file not found: {prompt_file}")
        return
    prompt = p.read_text(encoding="utf-8")
    bare_count = 0
    for name in KNOWN_BARE_NAMES:
        # Escape `.`, `+`, `\` (matches JS [.+\\] character class)
        esc_name = re.sub(r"[.+\\]", lambda m: "\\" + m.group(0), name)
        bare_regex = re.compile(rf"(?<![./\w-]){esc_name}(?![./\w-])")
        full_regex = re.compile(rf"\.agents/[\w/.-]*{esc_name}|docs/[\w/.-]*{esc_name}")
        bare_matches = len(bare_regex.findall(prompt))
        full_matches = len(full_regex.findall(prompt))
        truly_bare = max(0, bare_matches - full_matches)
        if truly_bare > 0:
            warn(
                f'裸檔名 "{name}" 出現 {truly_bare} 次未帶 repo-root 前綴；'
                "建議補絕對路徑（依 PROPOSAL_022）"
            )
            bare_count += truly_bare
    if bare_count == 0:
        info("所有已知產物均使用絕對路徑（無裸檔名）")
    else:
        info(f"共偵測 {bare_count} 處裸檔名；建議派遣前補完整路徑以避免 sub-agent 路徑誤解")


def main() -> None:
    args = sys.argv[1:]
    prompt_file = None
    dimension = None
    if "--dispatch-prompt" in args:
        idx = args.index("--dispatch-prompt")
        if idx + 1 < len(args):
            prompt_file = args[idx + 1]
    if "--dimension" in args:
        idx = args.index("--dimension")
        if idx + 1 < len(args):
            dimension = args[idx + 1]
    audit_mode = "--audit" in args
    verify_paths_mode = "--verify-paths" in args

    if audit_mode:
        info("Mode: AUDIT_DECISION_LOG 稽核")
        audit_decision_log()
    elif verify_paths_mode and prompt_file:
        info(f"Mode: --verify-paths 裸檔名偵測 (file={prompt_file}; PROPOSAL_022)")
        verify_paths(prompt_file)
    elif prompt_file and dimension:
        info(f"Mode: 派遣 prompt 驗證 (file={prompt_file}, dimension={dimension})")
        validate_dispatch_prompt(prompt_file, dimension)
    else:
        info("Mode: rubric Fragment 盤點")
        fragments = load_fragments()
        if not fragments:
            print("")
            print(f"Summary: errors={errors}, warnings={warnings}")
            if errors > 0:
                sys.exit(2)
            if warnings > 0:
                sys.exit(1)
            sys.exit(0)
        total = 0
        for dim, lst in sorted(fragments.items()):
            ids = ", ".join(f["id"] for f in lst)
            info(f"  Dimension {dim}: {len(lst)} fragments ({ids})")
            total += len(lst)
        info(f"Total: {total} fragments")
        if total < 18:
            warn(f"Expected 18 fragments, found {total}")

    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
