"""
parser.py — v7.22 文件層 markdown parser (PROPOSAL_502_050 F-2)

核心職責：把 v7.22 文件層 (.agents/rules/*.md / skills/*.md / decisions/*.md) 解析為
LangGraph node 可用的 system prompt + behavior config。

v7.22 文件層 = ground truth (Q3' A)；本 parser 不 hardcode 任何規則。

支援：
- frontmatter (YAML metadata)
- MACHINE_READABLE block (HTML comment 內含 YAML)
- 結構化 sections (## / ### header 階層)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


# v7.22 既有 rules 用 !ref 等 custom YAML tags（如 lead.md frontmatter constraints_ref）；
# 用 SafeLoader + constructor 忽略未知 tag，避免 ConstructorError。
class _IgnoreUnknownTagsLoader(yaml.SafeLoader):
    pass


def _ignore_unknown_tag(loader, tag_suffix, node):
    """忽略未知 YAML tag；保留 raw 字串值"""
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None


_IgnoreUnknownTagsLoader.add_multi_constructor("!", _ignore_unknown_tag)
_IgnoreUnknownTagsLoader.add_multi_constructor("tag:", _ignore_unknown_tag)


def _yaml_load(text: str) -> dict:
    try:
        result = yaml.load(text, Loader=_IgnoreUnknownTagsLoader)
        return result if isinstance(result, dict) else {}
    except yaml.YAMLError:
        return {}


AGENTS_ROOT = Path(__file__).resolve().parent.parent  # .agents/
RULES_DIR = AGENTS_ROOT / "rules"
SKILLS_DIR = AGENTS_ROOT / "skills"
TASKS_DIR = AGENTS_ROOT / "tasks"
DECISIONS_DIR = AGENTS_ROOT / "decisions"
IRON_RULES_DIR = AGENTS_ROOT / "iron-rules"


# ============================================================
# Data classes
# ============================================================


@dataclass
class ParsedDocument:
    """單一 markdown 文件解析結果"""
    path: Path
    frontmatter: dict = field(default_factory=dict)
    machine_readable: dict = field(default_factory=dict)
    sections: dict[str, str] = field(default_factory=dict)  # section_id → content
    raw_text: str = ""

    def get_section(self, section_id: str, default: str = "") -> str:
        """取 section 內容；section_id 例 's01' / 's_complexity_lane'"""
        return self.sections.get(section_id, default)


@dataclass
class AgentBehavior:
    """agent node 用的 behavior config（從 rule + skill 抽出）"""
    agent_id: str  # 'lead' / 'architect' / ...
    system_prompt: str  # rule 全文（去 frontmatter）作為 system prompt
    iron_themes: list[str] = field(default_factory=list)
    related_skills: list[Path] = field(default_factory=list)
    extras: dict = field(default_factory=dict)  # 各 agent 特有 config


# ============================================================
# Parser core
# ============================================================


_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_MR_BLOCK_RE = re.compile(r"<!--\s*MACHINE_READABLE\s*\n(.*?)\n\s*-->", re.DOTALL)
_SECTION_RE = re.compile(r'<section\s+id="([^"]+)"[^>]*>(.*?)</section>', re.DOTALL)


def parse_markdown(path: Path) -> ParsedDocument:
    """解析單一 markdown 檔；不抛 → 回 empty doc 容錯"""
    if not path.exists():
        return ParsedDocument(path=path)

    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return ParsedDocument(path=path)

    doc = ParsedDocument(path=path, raw_text=text)

    # frontmatter（用容錯 loader；忽略 !ref 等 custom tag）
    if m := _FRONTMATTER_RE.match(text):
        doc.frontmatter = _yaml_load(m.group(1))

    # MACHINE_READABLE block
    if m := _MR_BLOCK_RE.search(text):
        doc.machine_readable = _yaml_load(m.group(1))

    # sections（rules 用 <section> 包；skills/tasks 用 ## header）
    for m in _SECTION_RE.finditer(text):
        sid = m.group(1)
        content = m.group(2).strip()
        doc.sections[sid] = content

    # 若無 <section>，用 ## header 切（skills/tasks 慣用）
    if not doc.sections:
        doc.sections = _split_by_header(text)

    return doc


def _split_by_header(text: str) -> dict[str, str]:
    """以 ## / ### header 切 sections；header 文字作 key（清標點）"""
    sections: dict[str, str] = {}
    current_key: Optional[str] = None
    current_buf: list[str] = []

    for line in text.splitlines():
        if m := re.match(r"^(#{2,4})\s+(.+)$", line):
            if current_key:
                sections[current_key] = "\n".join(current_buf).strip()
            # normalize key: 去標點 + 空白變 _
            key = re.sub(r"[^\w]+", "_", m.group(2)).strip("_").lower()
            current_key = key
            current_buf = []
        elif current_key:
            current_buf.append(line)

    if current_key:
        sections[current_key] = "\n".join(current_buf).strip()

    return sections


# ============================================================
# Agent behavior loader (高階 API)
# ============================================================


# 11 agent 對應 rule file（v7.22 既有命名）
AGENT_RULES = {
    "lead": "lead.md",
    "planner": "planner.md",
    "consultant": "consultant.md",
    "architect": "architect.md",
    "qa": "qa.md",
    "backend": "backend.md",
    "frontend": "frontend.md",
    "reviewer": "reviewer.md",
    "security": "security.md",
    "retro": "retro.md",
    "assistant": "assistant.md",
    "auditor": "auditor.md",  # 橫切
}


def load_agent_behavior(agent_id: str) -> AgentBehavior:
    """讀 v7.22 文件層 → AgentBehavior

    流程：
    1. 讀 .agents/rules/<agent_id>.md → frontmatter + 全文 (system prompt)
    2. frontmatter applies_iron_themes → 讀 iron-rules/*.md 補進 system prompt（鐵律不可變）
    3. frontmatter references → 讀 skills/*.md 摘要（避免 token 爆炸；只取 §導讀）
    4. 組合為 AgentBehavior
    """
    if agent_id not in AGENT_RULES:
        raise ValueError(f"Unknown agent_id: {agent_id}")

    rule_path = RULES_DIR / AGENT_RULES[agent_id]
    rule_doc = parse_markdown(rule_path)

    if not rule_doc.raw_text:
        raise FileNotFoundError(f"Agent rule not found: {rule_path}")

    # System prompt = rule 全文（去 frontmatter；保 sections）
    system_prompt = _strip_frontmatter(rule_doc.raw_text)

    # 加 iron-rules
    iron_themes = rule_doc.frontmatter.get("applies_iron_themes", []) or []
    iron_text = _load_iron_themes(iron_themes)
    if iron_text:
        system_prompt = f"{system_prompt}\n\n## 適用鐵律（不可違反）\n\n{iron_text}"

    # 加 skills 摘要（只 frontmatter description，不全文；避免 token 爆炸）
    references = rule_doc.frontmatter.get("references", {}) or {}
    related_skills_paths = []
    skills_summary = []
    for ref_key, ref_path in references.items():
        if ref_path.startswith("skills/"):
            sp = AGENTS_ROOT / ref_path
            related_skills_paths.append(sp)
            sk_doc = parse_markdown(sp)
            if sk_doc.frontmatter.get("description"):
                skills_summary.append(f"- `{ref_key}` ({ref_path}): {sk_doc.frontmatter['description']}")
            elif sk_doc.machine_readable.get("load_when"):
                skills_summary.append(f"- `{ref_key}` ({ref_path}): load when {sk_doc.machine_readable['load_when']}")

    if skills_summary:
        system_prompt += "\n\n## 相關 skills（按需 load）\n\n" + "\n".join(skills_summary)

    return AgentBehavior(
        agent_id=agent_id,
        system_prompt=system_prompt,
        iron_themes=iron_themes,
        related_skills=related_skills_paths,
        extras={
            "rule_frontmatter": rule_doc.frontmatter,
            "produces": rule_doc.frontmatter.get("produces", []),
            "interacts_with": rule_doc.frontmatter.get("interacts_with", []),
            "default_model_tier": rule_doc.frontmatter.get("default_model_tier"),
        },
    )


def _strip_frontmatter(text: str) -> str:
    """去 YAML frontmatter；保留之後內容"""
    return _FRONTMATTER_RE.sub("", text, count=1)


def _load_iron_themes(theme_ids: list[str]) -> str:
    """讀 iron-rules/*.md 對應主題；組合為 system prompt 補丁"""
    parts: list[str] = []
    for tid in theme_ids:
        p = IRON_RULES_DIR / f"{tid}.md"
        if not p.exists():
            continue
        text = _strip_frontmatter(p.read_text(encoding="utf-8"))
        parts.append(f"### Iron Theme: {tid}\n\n{text}")
    return "\n\n".join(parts)


# ============================================================
# Skill 載入（用於 supervisor 內細項判定如 hybrid classifier / hotfix tier）
# ============================================================


def load_skill(skill_name: str) -> ParsedDocument:
    """讀 skill；caller 需自行抽 sections / MR block

    例：
        skill = load_skill("routing-ticket-protocol")
        schema_section = skill.get_section("__schema_")
    """
    p = SKILLS_DIR / f"{skill_name}.md"
    return parse_markdown(p)


def load_decision(adr_id: str) -> ParsedDocument:
    """讀 decisions/*.md (ADR)；adr_id 例 'ADR-0042'"""
    # 對應檔名如 0042-hybrid-llm-intent-classifier.md
    num = adr_id.replace("ADR-", "").lstrip("0") or "0"
    matches = list(DECISIONS_DIR.glob(f"{int(num):04d}-*.md"))
    if not matches:
        raise FileNotFoundError(f"ADR not found: {adr_id}")
    return parse_markdown(matches[0])


# ============================================================
# Public API for supervisor / dispatcher
# ============================================================


def load_hybrid_classifier_config() -> dict:
    """讀 ADR-0042 → 抽 layer 1+2+3 結構訊號 + keyword priority + LLM prompt 模板"""
    adr = load_decision("ADR-0042")
    config = {
        "structural_signals": [],  # layer 1
        "keyword_priority": [],  # layer 2
        "llm_prompt_template": "",  # layer 3
    }

    # 從 sections / raw_text 抽（v7.22 既有 ADR-0042 結構）
    text = adr.raw_text

    # Layer 1 結構訊號表（"### 結構訊號（層 1）規則表"）
    if m := re.search(r"###\s+結構訊號.*?規則表(.*?)(?=\n###|\Z)", text, re.DOTALL):
        config["structural_signals_raw"] = m.group(1).strip()

    # Layer 3 LLM prompt 模板
    if m := re.search(r"### LLM Prompt 模板.*?```\s*\n(.*?)\n```", text, re.DOTALL):
        config["llm_prompt_template"] = m.group(1).strip()

    return config


def load_hotfix_tier_rules() -> dict:
    """讀 lead.md §s07 + tasks/hotfix-tier-upgrade-sop.md 抽 hotfix 三機制全關鐵律"""
    lead_doc = parse_markdown(RULES_DIR / "lead.md")
    sop_doc = parse_markdown(TASKS_DIR / "hotfix-tier-upgrade-sop.md")
    return {
        "lead_s07": lead_doc.get_section("s07"),
        "tier_upgrade_sop_text": sop_doc.raw_text,
    }


def load_autonomy_mode_defaults() -> dict[str, str]:
    """讀 routing-ticket-protocol §3.4 抽 autonomy smart default per task_class"""
    skill = load_skill("routing-ticket-protocol")
    text = skill.raw_text

    defaults = {}
    # 從 §schema 註解抽（既有寫於 # auto / # step-by-step / # gate-at-design / # gate-at-impl）
    patterns = [
        (r"#\s*auto\s+.*?smart default for task_class\s*∈\s*\{([^}]+)\}", "auto"),
        (r"#\s*step-by-step\s+.*?smart default for task_class[=]?([\w-]+)", "step-by-step"),
        (r"#\s*gate-at-design\s+.*?smart default for task_class\s*∈\s*\{([^}]+)\}", "gate-at-design"),
        (r"#\s*gate-at-impl\s+.*?smart default for task_class\s*∈\s*\{([^}]+)\}", "gate-at-impl"),
    ]
    for pat, mode in patterns:
        if m := re.search(pat, text, re.IGNORECASE):
            classes = re.findall(r"[\w-]+", m.group(1))
            for cls in classes:
                if cls.strip() in {"feature", "modify-existing", "doc-sync", "hotfix", "config-adjust", "onboarding", "hotfix-light", "hotfix-heavy"}:
                    defaults[cls.strip()] = mode

    return defaults


def load_b1_trigger_conditions() -> dict:
    """讀 code-graph-exploration §C.5 抽 B-1 5 觸發條件"""
    skill = load_skill("code-graph-exploration")
    return {
        "raw_section": skill.get_section("__c_5_b_1____lead_md_auto_hint__4_1____", ""),
        "skill_text": skill.raw_text,
    }


# ============================================================
# 啟動時驗證（fail-fast）
# ============================================================


def validate_v722_ground_truth() -> list[str]:
    """啟動時驗 v7.22 文件層 完整性；缺檔即 fail-fast

    回傳 errors（empty list = 全綠）
    """
    errors = []
    for aid, fname in AGENT_RULES.items():
        p = RULES_DIR / fname
        if not p.exists():
            errors.append(f"Agent rule missing: {p}")
            continue
        doc = parse_markdown(p)
        if not doc.frontmatter:
            errors.append(f"Agent rule {aid} 缺 frontmatter: {p}")

    # 關鍵 ADR 檢查
    for adr in ["ADR-0001", "ADR-0027", "ADR-0042", "ADR-0043", "ADR-0044", "ADR-0045", "ADR-0046"]:
        try:
            load_decision(adr)
        except FileNotFoundError:
            errors.append(f"Critical ADR missing: {adr}")

    # 關鍵 skill 檢查
    for skill in ["routing-ticket-protocol", "lead-orchestration-guide", "code-graph-exploration"]:
        p = SKILLS_DIR / f"{skill}.md"
        if not p.exists():
            errors.append(f"Critical skill missing: {p}")

    return errors
