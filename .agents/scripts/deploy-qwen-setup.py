#!/usr/bin/env python3
"""
deploy-qwen-setup.py — Quick-deploy `.qwen/settings.json` for new machine
(PROPOSAL_502_062 V90-A-9).

把 `.qwen/settings.json.example` 的 `<PLACEHOLDER_*>` 替換成實機路徑 / LLM 配置
產出可用的 `.qwen/settings.json`。

3 種觸發方式：
  1. **Auto**（推薦）：自動偵測 Node / Python 路徑；只需指定 LLM 配置
       python .agents/scripts/deploy-qwen-setup.py --auto \\
         --llm-provider qwen --llm-token-env DASHSCOPE_API_KEY
  2. **Custom**：完全手動指定（非互動；CI / agent 用）
       python .agents/scripts/deploy-qwen-setup.py --custom \\
         --node-bin-dir 'D:\\node-v22.12.0-win-x64' \\
         --python-bin   'C:\\Python313\\python.exe' \\
         --llm-provider custom --llm-model qwen3.5 \\
         --llm-base-url 'http://gateway.company.local/v1' \\
         --llm-key-env COMPANY_LLM_TOKEN \\
         --llm-token-env COMPANY_LLM_TOKEN
  3. **Interactive**（default；TTY 偵測）：對話 prompt 一步步問
       python .agents/scripts/deploy-qwen-setup.py

LLM provider preset（auto mode）：
  - qwen / dashscope → DashScope（公網）
  - anthropic        → Claude API
  - openai           → OpenAI 公網
  - custom           → 自訂 base_url（公司內網閘道；需 --llm-base-url）

Agent triggerable：agent 用 Bash tool 直接呼；非 TTY 環境 + 缺 LLM 必填 → fail-fast
列印 usage + exit。

V90-A-7 / V90-A-8 對齊：Node v22 LTS preferred（v24 缺 ladybugdb prebuild）；
GitNexus mandatory health probe 由 mcp_server 啟動驗。
"""
from __future__ import annotations

import argparse
import getpass
import glob
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE = PROJECT_ROOT / ".qwen" / "settings.json.example"
TARGET = PROJECT_ROOT / ".qwen" / "settings.json"
IS_WIN = platform.system() == "Windows"


# ============================================================
# LLM provider presets
# ============================================================


LLM_PRESETS: dict[str, dict[str, str]] = {
    "qwen": {
        "LLM_API_PROVIDER": "qwen",
        "LLM_API_MODEL": "qwen-max",
        "LLM_API_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "LLM_API_KEY_ENV": "DASHSCOPE_API_KEY",
    },
    "dashscope": {  # alias
        "LLM_API_PROVIDER": "qwen",
        "LLM_API_MODEL": "qwen-max",
        "LLM_API_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "LLM_API_KEY_ENV": "DASHSCOPE_API_KEY",
    },
    "anthropic": {
        "LLM_API_PROVIDER": "anthropic",
        "LLM_API_MODEL": "claude-haiku-4-5",
        "LLM_API_BASE_URL": "",  # SDK 內建
        "LLM_API_KEY_ENV": "ANTHROPIC_API_KEY",
    },
    "openai": {
        "LLM_API_PROVIDER": "openai",
        "LLM_API_MODEL": "gpt-4",
        "LLM_API_BASE_URL": "https://api.openai.com/v1",
        "LLM_API_KEY_ENV": "OPENAI_API_KEY",
    },
    "custom": {  # 公司內網閘道；用 --llm-* 全自訂
        "LLM_API_PROVIDER": "custom",
        "LLM_API_MODEL": "",
        "LLM_API_BASE_URL": "",
        "LLM_API_KEY_ENV": "COMPANY_LLM_TOKEN",
    },
}


@dataclass
class DeployConfig:
    """所有要替換進 template 的值"""
    python_bin: str = ""
    node_bin_dir: str = ""
    project_root: str = ""
    llm_provider: str = ""
    llm_model: str = ""
    llm_base_url: str = ""
    llm_key_env: str = ""
    llm_token: str = ""  # 真實 token（敏感；不寫 log）
    extra_body: str = ""  # Qwen3 thinking-disable 等

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.python_bin:
            errors.append("python_bin 缺")
        elif not Path(self.python_bin).exists():
            errors.append(f"python_bin 路徑不存在: {self.python_bin}")
        if not self.node_bin_dir:
            errors.append("node_bin_dir 缺")
        elif not Path(self.node_bin_dir).exists():
            errors.append(f"node_bin_dir 路徑不存在: {self.node_bin_dir}")
        if not self.project_root:
            errors.append("project_root 缺")
        if not self.llm_provider:
            errors.append("llm_provider 缺")
        if not self.llm_model:
            errors.append("llm_model 缺")
        if not self.llm_key_env:
            errors.append("llm_key_env 缺")
        if not self.llm_token:
            errors.append("llm_token 缺（敏感欄位；可從 --llm-token-env 指向既有 env var）")
        return errors


# ============================================================
# Auto-detection
# ============================================================


def _glob_first(patterns: list[str]) -> Optional[Path]:
    """回第一個存在 + 排版本最高的 path"""
    matches: list[Path] = []
    for pattern in patterns:
        for p in glob.glob(pattern):
            matches.append(Path(p))
    if not matches:
        return None
    # 排序：v22 優先（V90-A-7 v24 ladybugdb prebuild fail）；其餘版本由高到低
    def _rank(p: Path) -> tuple[int, str]:
        name = p.name.lower()
        # v22 最優；v20 / v22 一般；v24 殿後（v24 知名問題）
        if "v22" in name:
            return (0, name)
        if "v20" in name:
            return (1, name)
        if "v24" in name:
            return (3, name)  # 故意排尾
        return (2, name)
    matches.sort(key=_rank)
    return matches[0]


def detect_node_bin_dir() -> Optional[Path]:
    """偵測 Node v20+ binary 目錄；prefer v22 LTS。"""
    if IS_WIN:
        candidate = _glob_first([
            "D:\\node-v22*-win-x64",
            "D:\\node-v20*-win-x64",
            "D:\\node-v*-win-x64",
            "C:\\node-v22*-win-x64",
            "C:\\node-v*-win-x64",
        ])
        if candidate and (candidate / "node.exe").exists():
            return candidate
        # Program Files fallback
        pf = Path(r"C:\Program Files\nodejs")
        if (pf / "node.exe").exists():
            return pf
        return None

    node = shutil.which("node")
    return Path(node).parent if node else None


def detect_python_bin() -> Optional[Path]:
    """偵測 Python ≥ 3.11；prefer current interpreter 若符合。"""
    candidates: list[str] = [sys.executable]
    if IS_WIN:
        user = os.environ.get("USERNAME") or os.environ.get("USER", "")
        for ver in ("313", "312", "311"):
            candidates.append(
                f"C:\\Users\\{user}\\AppData\\Local\\Programs\\Python\\Python{ver}\\python.exe"
            )
            candidates.append(f"D:\\python-3.{ver[1:]}\\python.exe")
    else:
        for cmd in ("python3.13", "python3.12", "python3.11", "python3"):
            p = shutil.which(cmd)
            if p:
                candidates.append(p)

    seen: set[str] = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        p = Path(c)
        if not p.exists():
            continue
        ver = _verify_python_version(p)
        if ver and _is_python_ok(ver):
            return p
    return None


def _verify_python_version(python_bin: Path) -> Optional[str]:
    try:
        result = subprocess.run(
            [str(python_bin), "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, OSError):
        pass
    return None


def _is_python_ok(ver: str) -> bool:
    """≥ 3.11"""
    try:
        major, minor = ver.split(".")[:2]
        return int(major) == 3 and int(minor) >= 11
    except ValueError:
        return False


def verify_node_version(node_bin_dir: Path) -> Optional[str]:
    """跑 node --version 驗 ≥ v20"""
    node_exe = node_bin_dir / ("node.exe" if IS_WIN else "node")
    if not node_exe.exists():
        return None
    try:
        result = subprocess.run(
            [str(node_exe), "--version"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip().lstrip("v")
    except (subprocess.TimeoutExpired, OSError):
        pass
    return None


def _is_node_ok(ver: str) -> bool:
    """≥ v20"""
    try:
        return int(ver.split(".")[0]) >= 20
    except (ValueError, IndexError):
        return False


# ============================================================
# Modes
# ============================================================


def run_auto(args: argparse.Namespace) -> DeployConfig:
    """auto-detect 路徑 + LLM 走 preset"""
    cfg = DeployConfig()

    cfg.project_root = str(PROJECT_ROOT)

    py = detect_python_bin()
    if not py:
        sys.exit("❌ auto detect Python 3.11+ 失敗；改 --custom --python-bin <path>")
    cfg.python_bin = str(py)

    node = detect_node_bin_dir()
    if not node:
        sys.exit("❌ auto detect Node v20+ 失敗；改 --custom --node-bin-dir <path>")
    cfg.node_bin_dir = str(node)

    _populate_llm(cfg, args)
    return cfg


def run_custom(args: argparse.Namespace) -> DeployConfig:
    """完全 CLI flag 指定；不互動"""
    cfg = DeployConfig(
        python_bin=args.python_bin or "",
        node_bin_dir=args.node_bin_dir or "",
        project_root=args.project_root or str(PROJECT_ROOT),
    )
    _populate_llm(cfg, args)
    return cfg


def run_interactive(args: argparse.Namespace) -> DeployConfig:
    """逐步 prompt；auto-detect 為 default 值"""
    print("=" * 60)
    print("🚀 deploy-qwen-setup — interactive mode")
    print("=" * 60)
    print()

    cfg = DeployConfig()
    cfg.project_root = str(PROJECT_ROOT)

    # Python
    auto_py = detect_python_bin()
    default_py = str(auto_py) if auto_py else ""
    cfg.python_bin = _prompt(
        f"Python ≥ 3.11 binary 絕對路徑 [{default_py}]: ", default_py
    )
    ver = _verify_python_version(Path(cfg.python_bin))
    if ver:
        print(f"  ✓ Python {ver}")
    else:
        print(f"  ⚠ 驗版本失敗（路徑可能錯）")

    # Node
    auto_node = detect_node_bin_dir()
    default_node = str(auto_node) if auto_node else ""
    cfg.node_bin_dir = _prompt(
        f"Node v20+ binary 目錄（**v22 LTS preferred**；v24 缺 ladybugdb prebuild）[{default_node}]: ",
        default_node,
    )
    nver = verify_node_version(Path(cfg.node_bin_dir))
    if nver:
        ok_mark = "✓" if _is_node_ok(nver) else "⚠"
        print(f"  {ok_mark} Node v{nver}")

    # LLM provider
    print()
    print("LLM provider 選項：")
    for k in ("qwen", "anthropic", "openai", "custom"):
        preset = LLM_PRESETS[k]
        print(f"  - {k}: {preset.get('LLM_API_MODEL') or '(自訂)'}")
    cfg.llm_provider = _prompt("選 provider [custom]: ", "custom")
    if cfg.llm_provider not in LLM_PRESETS:
        sys.exit(f"❌ 未知 provider: {cfg.llm_provider}")
    preset = LLM_PRESETS[cfg.llm_provider]

    # Model / URL
    cfg.llm_model = _prompt(
        f"LLM model [{preset['LLM_API_MODEL']}]: ", preset["LLM_API_MODEL"]
    )
    if cfg.llm_provider in ("custom", "openai"):
        cfg.llm_base_url = _prompt(
            f"API base_url [{preset['LLM_API_BASE_URL']}]: ", preset["LLM_API_BASE_URL"]
        )
    else:
        cfg.llm_base_url = preset["LLM_API_BASE_URL"]

    # Key env name
    cfg.llm_key_env = _prompt(
        f"LLM_API_KEY_ENV (env var 名字) [{preset['LLM_API_KEY_ENV']}]: ",
        preset["LLM_API_KEY_ENV"],
    )

    # Token（敏感；getpass）
    existing = os.environ.get(cfg.llm_key_env, "")
    if existing:
        use_existing = _prompt(
            f"偵測到 ${cfg.llm_key_env} 已設；用既有值？ [Y/n]: ", "Y"
        )
        if use_existing.lower() in ("y", "yes", ""):
            cfg.llm_token = existing
    if not cfg.llm_token:
        cfg.llm_token = getpass.getpass(f"輸入 {cfg.llm_key_env} token (隱藏輸入): ").strip()

    # Extra body (Qwen3 thinking)
    if "qwen3" in cfg.llm_model.lower() or "r1" in cfg.llm_model.lower():
        print(f"  ⚠ 偵測到 thinking-mode 模型（{cfg.llm_model}）；自動加 LLM_API_EXTRA_BODY 關 thinking")
        cfg.extra_body = '{"chat_template_kwargs":{"enable_thinking":false}}'

    return cfg


def _prompt(text: str, default: str = "") -> str:
    """input wrapper；空回 default"""
    val = input(text).strip()
    return val if val else default


def _populate_llm(cfg: DeployConfig, args: argparse.Namespace) -> None:
    """從 CLI args + preset 填 LLM 欄位"""
    provider = args.llm_provider or "custom"
    if provider not in LLM_PRESETS:
        sys.exit(f"❌ 未知 provider: {provider}; 可選 {list(LLM_PRESETS)}")
    preset = LLM_PRESETS[provider]

    cfg.llm_provider = preset["LLM_API_PROVIDER"]
    cfg.llm_model = args.llm_model or preset["LLM_API_MODEL"]
    cfg.llm_base_url = args.llm_base_url or preset["LLM_API_BASE_URL"]
    cfg.llm_key_env = args.llm_key_env or preset["LLM_API_KEY_ENV"]

    # Token：優先 --llm-token-env（讀既存 env）；其次 --llm-token（CLI 直給）
    if args.llm_token_env:
        cfg.llm_token = os.environ.get(args.llm_token_env, "")
        if not cfg.llm_token:
            sys.exit(
                f"❌ --llm-token-env={args.llm_token_env} 但該 env var 為空 / 未設"
            )
    elif args.llm_token:
        cfg.llm_token = args.llm_token

    # Qwen3 / R1 thinking-disable auto
    if "qwen3" in cfg.llm_model.lower() or "r1" in cfg.llm_model.lower():
        cfg.extra_body = '{"chat_template_kwargs":{"enable_thinking":false}}'


# ============================================================
# Template rendering
# ============================================================


def render_template(template_text: str, cfg: DeployConfig) -> str:
    """全域字串替換；不解析 JSON（保留 _comment 等註解；保留人類可讀格式）"""
    # 路徑類：直接替換（含 escape）
    text = template_text
    text = text.replace("<PLACEHOLDER_PYTHON_BINARY>", _escape_json_path(cfg.python_bin))
    text = text.replace("<PLACEHOLDER_PROJECT_ROOT>", _escape_json_path(cfg.project_root))
    text = text.replace("<PLACEHOLDER_NODE_BINARY_DIR>", _escape_json_path(cfg.node_bin_dir))

    # 文件區範例（doc-only；不影響 MCP）
    text = text.replace(
        "<PLACEHOLDER_PYTHON_3_11_OR_HIGHER_ABS_PATH>",
        _escape_json_path(cfg.python_bin),
    )
    text = text.replace(
        "<PLACEHOLDER_PROJECT_ROOT_ABS_PATH>", _escape_json_path(cfg.project_root)
    )

    # LLM 配置：PLACEHOLDER 加例文一起替換成乾淨值
    text = re.sub(
        r'"<PLACEHOLDER_MODEL_NAME>[^"]*"',
        json.dumps(cfg.llm_model),
        text,
    )
    text = re.sub(
        r'"<PLACEHOLDER_API_BASE_URL>[^"]*"',
        json.dumps(cfg.llm_base_url),
        text,
    )

    # 換 LLM_API_KEY_ENV (template 預設 COMPANY_LLM_TOKEN；user 可改名)
    if cfg.llm_key_env != "COMPANY_LLM_TOKEN":
        text = text.replace(
            '"LLM_API_KEY_ENV": "COMPANY_LLM_TOKEN"',
            f'"LLM_API_KEY_ENV": {json.dumps(cfg.llm_key_env)}',
        )
        # 同時 token slot 也改名（COMPANY_LLM_TOKEN → user 自訂 env name）
        text = text.replace(
            '"COMPANY_LLM_TOKEN": "<PLACEHOLDER_COMPANY_LLM_TOKEN>"',
            f'"{cfg.llm_key_env}": {json.dumps(cfg.llm_token)}',
        )
    else:
        text = text.replace(
            '"<PLACEHOLDER_COMPANY_LLM_TOKEN>"', json.dumps(cfg.llm_token)
        )

    # extra_body（Qwen3 / R1 思考關閉）
    if cfg.extra_body:
        # 已存在於 template？ 替舊 default
        text = re.sub(
            r'"LLM_API_EXTRA_BODY"\s*:\s*"[^"]*"',
            f'"LLM_API_EXTRA_BODY": {json.dumps(cfg.extra_body)}',
            text,
        )

    # provider 也對齊（template 預設 "custom"）
    if cfg.llm_provider != "custom":
        text = text.replace(
            '"LLM_API_PROVIDER": "custom"',
            f'"LLM_API_PROVIDER": {json.dumps(cfg.llm_provider)}',
        )

    # 兜底：仍剩 <PLACEHOLDER_*> → fail-fast（防漏替換）
    leftover = re.findall(r"<PLACEHOLDER_[A-Z_0-9]+>", text)
    if leftover:
        # 但 _for_dashscope / _for_anthropic 範例 block 內的可接受（comment-only）
        critical = [p for p in leftover if "DASHSCOPE_KEY" not in p and "ANTHROPIC_KEY" not in p]
        if critical:
            raise RuntimeError(
                f"render 後仍有未替換 placeholder: {set(critical)}；"
                f"檢查 template 是否新增了未支援的 placeholder"
            )

    return text


def _escape_json_path(p: str) -> str:
    """Windows 路徑反斜線在 JSON 字串需要 escape"""
    if not p:
        return ""
    return p.replace("\\", "\\\\")


# ============================================================
# Main
# ============================================================


def main() -> int:
    parser = argparse.ArgumentParser(
        description="deploy-qwen-setup — auto/custom/interactive .qwen/settings.json deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--auto", action="store_true",
                      help="auto-detect Node/Python；只需 --llm-* args")
    mode.add_argument("--custom", action="store_true",
                      help="完全手動指定（CI / agent 用）")
    mode.add_argument("--interactive", action="store_true",
                      help="互動 prompt（TTY default）")

    # 路徑（custom mode）
    parser.add_argument("--python-bin", help="Python ≥3.11 絕對路徑")
    parser.add_argument("--node-bin-dir", help="Node ≥v20 binary 目錄（preferred v22 LTS）")
    parser.add_argument("--project-root", help="repo 根目錄（default: 當前 .agents 父目錄）")

    # LLM
    parser.add_argument("--llm-provider", choices=list(LLM_PRESETS.keys()),
                        help="LLM provider preset；qwen/dashscope/anthropic/openai/custom")
    parser.add_argument("--llm-model", help="model 名（覆寫 preset）")
    parser.add_argument("--llm-base-url", help="API base_url（custom/openai 必填）")
    parser.add_argument("--llm-key-env", help="env var 名字（如 COMPANY_LLM_TOKEN；覆寫 preset）")
    parser.add_argument("--llm-token", help="LLM token 直接給（不安全；推薦 --llm-token-env）")
    parser.add_argument("--llm-token-env", help="env var 名（從中讀 token；推薦）")

    # 控制
    parser.add_argument("--dry-run", action="store_true",
                        help="只 print 不寫檔；驗 render 是否正確")
    parser.add_argument("--force", action="store_true",
                        help="覆寫既存 .qwen/settings.json")

    args = parser.parse_args()

    # 模式判定
    is_tty = sys.stdin.isatty() and sys.stdout.isatty()
    if args.auto:
        cfg = run_auto(args)
    elif args.custom:
        cfg = run_custom(args)
    elif args.interactive or is_tty:
        cfg = run_interactive(args)
    else:
        # 非 TTY + 沒指定 mode → fail-fast 給 agent 明示
        parser.error(
            "non-TTY 環境必須指定 --auto / --custom / --interactive；"
            "agent 推薦 --auto + --llm-provider X --llm-token-env Y"
        )

    # 驗 config 完整
    errors = cfg.validate()
    if errors:
        print("❌ DeployConfig 驗證失敗:")
        for e in errors:
            print(f"  - {e}")
        return 1

    # 驗版本（warning only；不阻寫）
    nver = verify_node_version(Path(cfg.node_bin_dir))
    if nver:
        if not _is_node_ok(nver):
            print(f"⚠ Node v{nver} < v20；GitNexus 可能不可用")
        elif "v24" in cfg.node_bin_dir.lower():
            print(f"⚠ Node v{nver} (v24)；ladybugdb-core 可能 prebuild fail；建議 v22 LTS")

    pver = _verify_python_version(Path(cfg.python_bin))
    if pver and not _is_python_ok(pver):
        print(f"⚠ Python {pver} < 3.11；LangGraph runtime 不支援")

    # Render
    try:
        rendered = render_template(TEMPLATE.read_text(encoding="utf-8"), cfg)
    except RuntimeError as e:
        print(f"❌ {e}")
        return 1

    if args.dry_run:
        print("=" * 60)
        print("DRY RUN — 不寫檔；以下為 render output：")
        print("=" * 60)
        print(rendered)
        return 0

    # Write
    if TARGET.exists() and not args.force:
        print(f"❌ {TARGET} 已存在；用 --force 覆寫，或先備份 / 刪除")
        return 1

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(rendered, encoding="utf-8")
    print(f"✅ 寫入 {TARGET}")

    # 後續驗證提示
    print()
    print("─" * 60)
    print("✓ Deploy 完成；下一步:")
    print("─" * 60)
    print(f"  1. 重啟 Qwen Code 載新 .qwen/settings.json")
    print(f"  2. 對話框驗 mcp__langgraph__dispatch tool 出現")
    print(f"  3. 跑 health check:")
    print(f"       {cfg.python_bin} -c \"import langgraph, mcp; print('OK')\"")
    print(f"  4. （V90-A-8）GitNexus mandatory：")
    print(f"       {cfg.node_bin_dir}{os.sep}gitnexus.cmd --version")
    print(f"     缺則: {cfg.node_bin_dir}{os.sep}npm.cmd install -g gitnexus")
    return 0


if __name__ == "__main__":
    sys.exit(main())
