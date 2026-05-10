#!/usr/bin/env python3
"""routing-ticket-validator.py — Port of routing-ticket-validator.mjs (PROPOSAL_502_027 Sprint B).

驗證專案根層 ROUTING_TICKET.md 的 schema 完整性 + Lane/Model 對應一致性。
依 PROPOSAL_20260424_023 Phase E。

使用：python3 .agents/tests/routing-ticket-validator.py [--verbose]

退出碼：
  0 = 通過（ticket 缺失或合法）
  1 = warnings（schema_version 缺 / hotfix 欄位部分缺）
  2 = errors（必填欄位缺 / Lane↔Model 不對應 / hotfix.enabled=true 但 sc_evaluation 缺）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa: E402

AGENTS_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = AGENTS_ROOT.parent
TICKET_PATH = PROJECT_ROOT / "ROUTING_TICKET.md"

verbose = "--verbose" in sys.argv
errors = 0
warnings = 0


def err(msg):
    global errors
    print(f"❌ [ERROR] {msg}", file=sys.stderr)
    errors += 1


def warn(msg):
    global warnings
    print(f"⚠️  [WARN]  {msg}")
    warnings += 1


def info(msg):
    if verbose:
        print(f"ℹ️  {msg}")


REQUIRED_TOP = [
    "schema_version", "ticket_id", "created_at", "created_by", "status",
    "original_request", "assigned_lane", "model_tier", "complexity_tier", "tier_reason",
    "target_agent", "sibling_agents", "touched_files", "artifact_paths", "tech_stacks",
]

VALID_PAIRS = {
    "fast": ["haiku"],
    "standard": ["sonnet"],
    "heavy": ["opus"],
}


def has_hotfix_enabled(text: str) -> bool:
    return bool(re.search(r"^hotfix:\s*\n\s+enabled:\s*true", text, re.MULTILINE))


def has_sc_evaluation(text: str) -> bool:
    return "sc_evaluation:" in text


def summary():
    print("")
    print(f"Summary: errors={errors}, warnings={warnings}")
    if errors > 0:
        sys.exit(2)
    if warnings > 0:
        sys.exit(1)
    sys.exit(0)


def main():
    print("🔍 Running routing-ticket-validator (PROPOSAL_20260424_023 Phase E)")

    if not TICKET_PATH.exists():
        info(f"ROUTING_TICKET.md 不存在於 {TICKET_PATH}（運行時 artifact；非派發中為合法）")
        print("")
        print("Summary: errors=0, warnings=0 (no ticket present)")
        sys.exit(0)

    text = TICKET_PATH.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    if not fm:
        err("ROUTING_TICKET.md 缺 YAML frontmatter（--- 包圍）")
        summary()
        return

    for k in REQUIRED_TOP:
        if k not in fm or fm.get(k) in ("", "[]", None):
            if k not in fm:
                err(f"必填欄位缺失: {k}")
            elif k in ("original_request", "tier_reason", "target_agent", "ticket_id", "created_at") and fm.get(k) == "":
                err(f"必填欄位 {k} 為空字串")

    info(f"schema_version: {fm.get('schema_version', '<missing>')}")
    if fm.get("schema_version") and fm["schema_version"] != "v1":
        warn(f'schema_version "{fm["schema_version"]}" 非 v1（當前 protocol 唯一支援版本）')

    lane = fm.get("assigned_lane")
    model = fm.get("model_tier")
    if lane and model and lane in VALID_PAIRS and model not in VALID_PAIRS[lane]:
        err(
            f"assigned_lane={lane} 與 model_tier={model} 不對應；合法對應 {lane}→{'|'.join(VALID_PAIRS[lane])}"
        )

    valid_status = ["dispatched", "acknowledged", "completing", "completed", "cancelled",
                    "paused", "timeout", "retried", "failed"]  # PROPOSAL_502_043 R3-B5 加 completing
    if fm.get("status") and fm["status"] not in valid_status:
        err(f'status="{fm["status"]}" 不在合法值 [{"|".join(valid_status)}]')

    valid_task_class = ["feature", "modify-existing", "doc-sync", "hotfix", "config-adjust", "onboarding"]
    if fm.get("task_class") and fm["task_class"] not in valid_task_class:
        err(
            f'task_class="{fm["task_class"]}" 不在合法值 [{"|".join(valid_task_class)}]；對應 lead.md §s05 任務分類例外（PROPOSAL_502_035 加 onboarding）'
        )

    valid_memory_mode = ["mcp", "filesystem_fallback"]
    if fm.get("memory_mode") and fm["memory_mode"] not in valid_memory_mode:
        err(
            f'memory_mode="{fm["memory_mode"]}" 不在合法值 [{"|".join(valid_memory_mode)}]；ADR-0039 hybrid fallback 規範'
        )

    valid_autonomy_mode = ["auto", "step-by-step", "gate-at-design", "gate-at-impl"]
    if fm.get("autonomy_mode") and fm["autonomy_mode"] not in valid_autonomy_mode:
        err(
            f'autonomy_mode="{fm["autonomy_mode"]}" 不在合法值 [{"|".join(valid_autonomy_mode)}]；PROPOSAL_502_032'
        )

    # PROPOSAL_502_044/045 + ADR-0042 v2: task_class_source enum (5 值)
    valid_source = ["explicit", "structural", "keyword", "llm_classifier", "llm_failed_fallback"]
    if fm.get("task_class_source") and fm["task_class_source"] not in valid_source:
        err(f'task_class_source="{fm["task_class_source"]}" 不在合法值 [{"|".join(valid_source)}]；ADR-0042 三層判定')

    # PROPOSAL_502_036: gitnexus_hint + runtime_telemetry schema validation
    valid_gitnexus_triggers = ["cross-stack", "large-file", "refactor-keyword", "frontend-backend-pair", "onboarding-scenario"]
    gh = fm.get("gitnexus_hint")
    if isinstance(gh, dict):
        triggers = gh.get("triggered_by", [])
        if not isinstance(triggers, list):
            triggers = [triggers] if triggers else []
        for t in triggers:
            if t not in valid_gitnexus_triggers:
                err(f'gitnexus_hint.triggered_by="{t}" 不在合法值 [{"|".join(valid_gitnexus_triggers)}]；ADR-0041 v2 + PROPOSAL_502_035')
        if "optional" in gh and not isinstance(gh["optional"], bool):
            err(f'gitnexus_hint.optional 必為 bool；當前 type={type(gh["optional"]).__name__}')

    valid_probe = ["ok", "disabled", "crash", "no-index", "timeout"]
    valid_tier_upgrade = ["none", "heavy"]
    rt = fm.get("runtime_telemetry")
    if isinstance(rt, dict):
        if rt.get("gitnexus_probe") and rt["gitnexus_probe"] not in valid_probe:
            err(f'runtime_telemetry.gitnexus_probe="{rt["gitnexus_probe"]}" 不在合法值 [{"|".join(valid_probe)}]；PROPOSAL_502_036 解 G-G1')
        if rt.get("tier_upgrade_required") and rt["tier_upgrade_required"] not in valid_tier_upgrade:
            err(f'runtime_telemetry.tier_upgrade_required="{rt["tier_upgrade_required"]}" 不在合法值 [{"|".join(valid_tier_upgrade)}]；PROPOSAL_502_040')

    # PROPOSAL_502_039 GR-B1: telemetry block mandate（status=completed AND task_class ≠ hotfix-light → telemetry 必填）
    is_hotfix_light = fm.get("task_class") == "hotfix" and "hotfix_tier: light" in text
    if fm.get("status") == "completed" and not is_hotfix_light and not rt:
        err("status=completed 但缺 runtime_telemetry block（PROPOSAL_502_039 §3.6 強制；hotfix-light 例外）")

    # PROPOSAL_502_041 GR-G3: pending_group conditional mandate（sibling_agents 非空 → pending_group 必填）
    siblings = fm.get("sibling_agents", [])
    if siblings and not fm.get("pending_group"):
        err("sibling_agents 非空但缺 pending_group（PROPOSAL_502_041 GR-G3；多 sibling 派發必填以共享 24h 計時 + 廣播確認）")

    # PROPOSAL_502_043 R3-B9: superseded → prior_ticket_id 強制繼承
    if fm.get("superseded") and rt and not rt.get("prior_ticket_id"):
        err("frontmatter superseded 非空但 runtime_telemetry.prior_ticket_id 缺（PROPOSAL_502_043 R3-B9 §3.2 step 4.5；hotfix tier 升級鏈必繼承）")

    if has_hotfix_enabled(text) and not has_sc_evaluation(text):
        err("hotfix.enabled=true 但缺 sc_evaluation 區塊")

    # PROPOSAL_502_046 R5-3 hotfix_tier schema 補修：hotfix.enabled=true → 必填 hotfix_tier ∈ {light, heavy}
    if has_hotfix_enabled(text):
        import re as _re
        m = _re.search(r"^\s*hotfix_tier:\s*(\w+)", text, _re.MULTILINE)
        if not m:
            err("hotfix.enabled=true 但缺 hotfix_tier 欄位（PROPOSAL_502_046 R5-3 補修；5 輪累積 schema gap）")
        elif m.group(1) not in ("light", "heavy"):
            err(f"hotfix_tier='{m.group(1)}' 不在 [light|heavy]（PROPOSAL_502_046 R5-3）")

    # PROPOSAL_502_047 T-1 解 R6-2: retry_of 條文-實作 drift 修補
    # routing-ticket-protocol §3.6 step 7 規定「validator 驗 retry_of != null AND prior status=failed」
    retry_of = fm.get("retry_of")
    if retry_of:
        from pathlib import Path as _Path
        archive_dir = _Path(".agents/archive/routing-tickets/")
        if archive_dir.is_dir():
            # 找 retry_of 對應 archive ticket
            prior_path = archive_dir / f"{retry_of}.md"
            if prior_path.exists():
                prior_text = prior_path.read_text(encoding="utf-8")
                # 驗 prior status=failed
                if not _re.search(r"^\s*status:\s*failed\b", prior_text, _re.MULTILINE):
                    err(f"retry_of='{retry_of}' 指向 archive ticket 但 prior status≠failed（PROPOSAL_502_047 T-1 R6-2 解條文-實作 drift；retry chain 必接 failed ticket；非 superseded）")
            else:
                err(f"retry_of='{retry_of}' archive ticket 不存在（PROPOSAL_502_047 T-1 R6-2）")
        # archive 不存在則跳過（不是錯）

    summary()


if __name__ == "__main__":
    main()
