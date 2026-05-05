#!/usr/bin/env python3
"""agent-drift-simulator.py — Agent Drift Simulator (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of agent-drift-simulator.mjs (PROPOSAL_20260422_025).

兩模式設計：
  Mode A（--mode static，預設）：靜態 rules 結構穩定性評分，無 LLM 呼叫
  Mode B（--mode dynamic）：動態 LLM 50 步對話驗證（未實作）

退出碼：
  0 = drift_score >= 0.85（通過）
  1 = 0.70 <= drift_score < 0.85（警告）
  2 = drift_score < 0.70（錯誤）
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
RULES_DIR = AGENTS_ROOT / "rules"
IRON_RULES_DIR = AGENTS_ROOT / "iron-rules"

# Allow tests/lib import
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from frontmatter import parse_frontmatter  # noqa: E402


def parse_args(argv):
    mode = "static"
    steps = 50
    verbose = False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--mode" and i + 1 < len(argv):
            mode = argv[i + 1]
            i += 2
            continue
        if a == "--steps" and i + 1 < len(argv):
            try:
                steps = int(argv[i + 1])
            except ValueError:
                pass
            i += 2
            continue
        if a == "--verbose":
            verbose = True
        if a in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        i += 1
    return mode, steps, verbose


def load_all_rules():
    rules = []
    if not RULES_DIR.exists():
        return rules
    for f in sorted(RULES_DIR.iterdir()):
        if f.is_file() and f.name.endswith(".md"):
            content = f.read_text(encoding="utf-8")
            rules.append({"file": f.name, "content": content, "fm": parse_frontmatter(content) or {}})
    return rules


def load_iron_themes():
    themes = []
    if not IRON_RULES_DIR.exists():
        return themes
    for f in sorted(IRON_RULES_DIR.iterdir()):
        if f.is_file() and f.name.endswith(".md") and f.name != "README.md":
            themes.append({"file": f.name, "content": f.read_text(encoding="utf-8")})
    return themes


def score_persona_stability(rules, vlog):
    scores = []
    for r in rules:
        s = 0.0
        fm = r["fm"] or {}
        if fm.get("agent_name"):
            s += 0.25
        if fm.get("default_model_tier"):
            s += 0.25
        if re.search(r'<section id="s01"', r["content"]) or re.search(r"^## 任務目標", r["content"], re.MULTILINE):
            s += 0.25
        if re.search(r"你是.+[，。]", r["content"]):
            s += 0.25
        scores.append({"file": r["file"], "score": s})
        vlog(f"  [persona] {r['file']}: {s:.2f}")
    avg = sum(x["score"] for x in scores) / len(scores) if scores else 0.0
    return {"avg": avg, "scores": scores, "metric": "persona_stability"}


def score_instruction_accuracy(rules, vlog):
    lead_rule = next((r for r in rules if r["file"] == "lead.md"), None)
    if not lead_rule:
        return {"avg": 0.0, "metric": "instruction_accuracy", "error": "lead.md not found"}

    mentions = set()
    pattern = re.compile(r"@(Planner|Consultant|Architect|QA|Frontend|Backend|Reviewer|Security|Retro|Assistant|Auditor|Lead)")
    for m in pattern.finditer(lead_rule["content"]):
        mentions.add(m.group(1))

    expected_files = set()
    for name in mentions:
        if name == "Lead":
            expected_files.add("lead.md")
        else:
            expected_files.add(name.lower() + ".md")

    found = 0
    rule_files = {r["file"] for r in rules}
    for f in expected_files:
        if f in rule_files:
            found += 1
    agent_coverage = (found / len(expected_files)) if expected_files else 0.0

    has_state_anchor = bool(re.search(r'<section id="s_state_anchor"', lead_rule["content"]))
    iron_themes_content = "\n".join(t["content"] for t in load_iron_themes())
    has_three_iron = bool(
        re.search(r"強制狀態讀取|禁止文本合併|ROUTING_TICKET 機讀化|短指令交接", lead_rule["content"] + iron_themes_content)
    )
    has_complexity_lane = bool(re.search(r'<section id="s_complexity_lane"', lead_rule["content"]))

    checkpoints = [
        {"name": "agent_coverage", "value": agent_coverage, "weight": 0.4},
        {"name": "state_anchor", "value": 1 if has_state_anchor else 0, "weight": 0.2},
        {"name": "three_iron_rules", "value": 1 if has_three_iron else 0, "weight": 0.2},
        {"name": "complexity_lane_section", "value": 1 if has_complexity_lane else 0, "weight": 0.2},
    ]
    avg = sum(c["value"] * c["weight"] for c in checkpoints)
    vlog(
        f"  [instruction] agent_coverage={agent_coverage:.2f} state_anchor={has_state_anchor} "
        f"three_iron={has_three_iron} complexity_lane={has_complexity_lane}"
    )
    return {"avg": avg, "metric": "instruction_accuracy", "checkpoints": checkpoints}


def score_boundary_adherence(rules, vlog):
    CRITICAL = {"security.md", "reviewer.md", "backend.md", "consultant.md", "lead.md", "auditor.md"}
    by_file = []
    total = 0
    all_pass = 0

    iron_themes = load_iron_themes()
    theme_map = {}
    for t in iron_themes:
        m = re.search(r"^theme_id:\s*(\S+)", t["content"], re.MULTILINE)
        if m:
            theme_map[m.group(1)] = t["content"]

    for r in rules:
        own_count = len(re.findall(r"絕對禁止", r["content"]))
        # Match block: applies_iron_themes:\n  - id\n  - id\n
        block_match = re.search(r"^applies_iron_themes:\s*\n((?:\s+-\s+\S.*\n?)+)", r["content"], re.MULTILINE)
        theme_ids = []
        if block_match:
            for line in block_match.group(1).split("\n"):
                lm = re.match(r"^\s+-\s+(\S+)", line)
                if lm:
                    theme_ids.append(lm.group(1))
        theme_count = 0
        for tid in theme_ids:
            if tid in theme_map:
                theme_count += len(re.findall(r"絕對禁止", theme_map[tid]))
        count = own_count + theme_count
        total += count
        by_file.append(
            {"file": r["file"], "count": count, "ownCount": own_count, "themeCount": theme_count, "themeIds": theme_ids}
        )
        expected = 5 if r["file"] in CRITICAL else 3
        if count >= expected:
            all_pass += 1
        vlog(
            f"  [boundary] {r['file']}: {count} (own={own_count} + themes={theme_count} via "
            f"{','.join(theme_ids) or '-'}) (expect >= {expected})"
        )

    pass_ratio = all_pass / len(rules) if rules else 0.0
    avg_per_file = total / len(rules) if rules else 0.0
    density_score = min(1.0, avg_per_file / 3) if avg_per_file else 0.0
    avg = pass_ratio * 0.6 + density_score * 0.4
    vlog(
        f"  [boundary] total={total}, avg_per_file={avg_per_file:.1f}, "
        f"pass_ratio={pass_ratio:.2f}, density_score={density_score:.2f}"
    )
    return {
        "avg": avg,
        "metric": "boundary_adherence",
        "byFile": by_file,
        "total": total,
        "avgPerFile": avg_per_file,
        "passRatio": pass_ratio,
        "densityScore": density_score,
    }


def simulate_steps(rules, persona_scores, n_steps):
    agent_rules = [r for r in rules if (r["fm"] or {}).get("agent_id")]
    if not agent_rules:
        return {"stability": 0.0}
    stable = 0
    x = 42  # seed
    score_by_file = {s["file"]: s["score"] for s in persona_scores["scores"]}
    for _ in range(n_steps):
        # LCG (truncate to 31-bit)
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        idx = x % len(agent_rules)
        chosen = agent_rules[idx]
        p_score = score_by_file.get(chosen["file"], 0.0)
        if p_score >= 0.8:
            stable += 1
    return {
        "stability": stable / n_steps if n_steps else 0.0,
        "totalSteps": n_steps,
        "stableSteps": stable,
    }


def main():
    mode, steps, verbose = parse_args(sys.argv[1:])

    def vlog(msg):
        if verbose:
            print(msg)

    print("🔍 Agent Drift Simulator (Mode A — static)")
    print(f"   steps={steps}  mode={mode}")
    print("")

    if mode == "dynamic":
        print("⚠️  Mode B (dynamic LLM validation) 尚未實作")
        print("   依 PROPOSAL_20260422_025 §七 備註：Mode B 為未來延伸，需 ANTHROPIC_API_KEY 配置")
        print("   當前環境僅支援 Mode A")
        sys.exit(1)

    if not RULES_DIR.exists():
        print(f"❌ Rules directory not found: {RULES_DIR}", file=sys.stderr)
        sys.exit(2)

    rules = load_all_rules()
    print(f"📂 Loaded {len(rules)} rules files")
    print("")

    print("📊 Scoring...")
    persona = score_persona_stability(rules, vlog)
    print(f"   persona_stability:     {persona['avg']:.3f}")
    instruction = score_instruction_accuracy(rules, vlog)
    print(f"   instruction_accuracy:  {instruction['avg']:.3f}")
    boundary = score_boundary_adherence(rules, vlog)
    print(f"   boundary_adherence:    {boundary['avg']:.3f}")
    print("")

    print(f"🎲 Simulating {steps} task steps (deterministic LCG, seed=42)...")
    sim = simulate_steps(rules, persona, steps)
    print(
        f"   stable_steps: {sim.get('stableSteps', 0)}/{sim.get('totalSteps', 0)} "
        f"({sim.get('stability', 0.0) * 100:.1f}%)"
    )
    print("")

    drift_score = persona["avg"] * 0.4 + instruction["avg"] * 0.4 + boundary["avg"] * 0.2
    print("─────────────────────────────")
    print(f"📈 drift_score = {drift_score:.3f}")
    print("   formula: persona*0.4 + instruction*0.4 + boundary*0.2")
    print("─────────────────────────────")

    if drift_score >= 0.85:
        print("✅ PASS (drift_score ≥ 0.85)")
        sys.exit(0)
    elif drift_score >= 0.70:
        print("⚠️  WARN (0.70 ≤ drift_score < 0.85)")
        sys.exit(1)
    else:
        print("❌ FAIL (drift_score < 0.70)")
        sys.exit(2)


if __name__ == "__main__":
    main()
