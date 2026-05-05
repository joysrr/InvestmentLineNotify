"""tests/lib/frontmatter.py — Port of frontmatter.mjs (PROPOSAL_502_027)."""
import re

FM_REGEX = re.compile(r"^---\n([\s\S]*?)\n---")
KV_REGEX = re.compile(r"^([A-Za-z_]\w*)\s*:\s*(.*)$")


def extract_frontmatter_text(content: str) -> str | None:
    m = FM_REGEX.match(content)
    return m.group(1) if m else None


def parse_frontmatter(content: str) -> dict | None:
    text = extract_frontmatter_text(content)
    if text is None:
        return None
    fm = {}
    for line in text.split("\n"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        m = KV_REGEX.match(line)
        if m:
            value = m.group(2).strip()
            value = re.sub(r"\s+#.*$", "", value)
            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]
            fm[m.group(1)] = value
    return fm


def extract_frontmatter_scope(content: str) -> str | None:
    fm = parse_frontmatter(content)
    if fm and fm.get("scope"):
        return fm["scope"].lower()
    bullet = re.search(r"^[-*]\s*scope[:：]\s*`?([a-zA-Z_:\-]+)`?", content, re.MULTILINE)
    if bullet:
        return bullet.group(1).strip().lower()
    return None
