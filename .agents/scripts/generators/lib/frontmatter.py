"""
frontmatter.py — YAML frontmatter 解析（Python port of frontmatter.mjs）
PROPOSAL_502_027 Sprint A。

Generators 共用。任何 frontmatter parsing 變更必先改本檔。
"""
import re

FM_REGEX = re.compile(r"^---\n([\s\S]*?)\n---")
KV_REGEX = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)(\s+#.*)?$")


def extract_frontmatter_text(content: str) -> str | None:
    m = FM_REGEX.match(content)
    return m.group(1) if m else None


def parse_frontmatter_text(text: str) -> dict[str, str]:
    if not text:
        return {}
    fm = {}
    for line in text.split("\n"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        m = KV_REGEX.match(line)
        if m:
            value = m.group(2).strip()
            # 去頭尾引號（單或雙）
            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]
            fm[m.group(1)] = value
    return fm


def parse_frontmatter(content: str) -> dict[str, str]:
    text = extract_frontmatter_text(content)
    return parse_frontmatter_text(text) if text else {}
