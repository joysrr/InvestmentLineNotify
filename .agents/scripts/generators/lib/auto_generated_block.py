"""
auto_generated_block.py — AUTO-GENERATED 區塊工具
PROPOSAL_502_027 Sprint A（port of auto-generated-block.mjs）。

標記：
    <!-- AUTO-GENERATED:BEGIN <block_name> -->
    ...
    <!-- AUTO-GENERATED:END <block_name> -->
"""
import re


def build_block_regex(block_name: str) -> re.Pattern:
    escaped = re.escape(block_name)
    return re.compile(
        r"(<!--\s*AUTO-GENERATED:BEGIN\s+" + escaped + r"\s*-->)"
        r"([\s\S]*?)"
        r"(<!--\s*AUTO-GENERATED:END\s+" + escaped + r"\s*-->)",
        re.MULTILINE,
    )


def has_block(file_content: str, block_name: str) -> bool:
    return bool(build_block_regex(block_name).search(file_content))


def extract_block_body(file_content: str, block_name: str) -> str | None:
    m = build_block_regex(block_name).search(file_content)
    if not m:
        return None
    body = m.group(2)
    return body.lstrip("\n").rstrip("\n")


def replace_block(file_content: str, block_name: str, new_body: str) -> str:
    if not has_block(file_content, block_name):
        raise ValueError(f'AUTO-GENERATED block marker not found: "{block_name}"')
    body = str(new_body).lstrip("\n").rstrip("\n")
    return build_block_regex(block_name).sub(
        lambda m: f"{m.group(1)}\n{body}\n{m.group(3)}",
        file_content,
    )


def check_drift(file_content: str, block_name: str, expected_body: str) -> dict:
    current = extract_block_body(file_content, block_name)
    if current is None:
        return {
            "drift": True, "reason": "MISSING_MARKER",
            "current": None, "expected": expected_body,
        }
    normalize = lambda s: str(s).replace("\r\n", "\n").strip()
    drift = normalize(current) != normalize(expected_body)
    return {
        "drift": drift,
        "reason": "CONTENT_DIFFERS" if drift else "IN_SYNC",
        "current": current,
        "expected": expected_body,
    }
