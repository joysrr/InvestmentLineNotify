"""V90-A-9 deploy-qwen-setup.py tests

驗 .agents/scripts/deploy-qwen-setup.py：
- DeployConfig.validate
- detection helpers（subprocess mock）
- render_template placeholder substitution
- LLM_PRESETS lookup
- v22 prefer 排序

不驗 main()（CLI argparse + sys.exit 不適合 unit；改靠 dry-run 整合驗）。
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# 載 deploy 腳本（檔名含連字號；不能直接 import）
_SCRIPT = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "deploy-qwen-setup.py"


@pytest.fixture(scope="module")
def deploy_mod():
    spec = importlib.util.spec_from_file_location("deploy_qwen_setup", _SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    # 必須 register sys.modules；否則 @dataclass 在 Python 3.11 introspect 失敗
    sys.modules["deploy_qwen_setup"] = mod
    spec.loader.exec_module(mod)
    return mod


# ============================================================
# DeployConfig.validate
# ============================================================


class TestDeployConfigValidate:
    def test_empty_config_reports_all_missing(self, deploy_mod, tmp_path):
        cfg = deploy_mod.DeployConfig()
        errors = cfg.validate()
        assert "python_bin 缺" in errors
        assert "node_bin_dir 缺" in errors
        assert "project_root 缺" in errors
        assert "llm_provider 缺" in errors
        assert "llm_token 缺（敏感欄位；可從 --llm-token-env 指向既有 env var）" in errors

    def test_missing_path_files_reported(self, deploy_mod):
        cfg = deploy_mod.DeployConfig(
            python_bin="/nonexistent/python",
            node_bin_dir="/nonexistent/node",
            project_root="/tmp",
            llm_provider="qwen",
            llm_model="qwen-max",
            llm_key_env="DASHSCOPE_API_KEY",
            llm_token="x",
        )
        errors = cfg.validate()
        assert any("python_bin 路徑不存在" in e for e in errors)
        assert any("node_bin_dir 路徑不存在" in e for e in errors)

    def test_complete_config_passes(self, deploy_mod, tmp_path):
        py = tmp_path / "python"
        py.write_text("")
        node_dir = tmp_path / "nodebin"
        node_dir.mkdir()
        cfg = deploy_mod.DeployConfig(
            python_bin=str(py),
            node_bin_dir=str(node_dir),
            project_root=str(tmp_path),
            llm_provider="qwen",
            llm_model="qwen-max",
            llm_base_url="https://dashscope.aliyuncs.com",
            llm_key_env="DASHSCOPE_API_KEY",
            llm_token="t-1",
        )
        assert cfg.validate() == []


# ============================================================
# LLM_PRESETS
# ============================================================


class TestLLMPresets:
    def test_qwen_dashscope_alias(self, deploy_mod):
        assert deploy_mod.LLM_PRESETS["qwen"] == deploy_mod.LLM_PRESETS["dashscope"]

    def test_anthropic_preset_no_base_url(self, deploy_mod):
        assert deploy_mod.LLM_PRESETS["anthropic"]["LLM_API_BASE_URL"] == ""

    def test_custom_preset_minimal(self, deploy_mod):
        custom = deploy_mod.LLM_PRESETS["custom"]
        assert custom["LLM_API_PROVIDER"] == "custom"
        assert custom["LLM_API_MODEL"] == ""


# ============================================================
# Auto-detection helpers
# ============================================================


class TestNodeDetection:
    def test_windows_prefers_v22(self, deploy_mod, tmp_path, monkeypatch):
        monkeypatch.setattr(deploy_mod, "IS_WIN", True)
        # 模擬 _glob_first 回 v22 路徑（v22 排第一）
        v22 = tmp_path / "node-v22.12.0-win-x64"
        v24 = tmp_path / "node-v24.12.0-win-x64"
        v22.mkdir()
        v24.mkdir()
        (v22 / "node.exe").write_text("")
        (v24 / "node.exe").write_text("")

        with patch.object(
            deploy_mod, "glob",
            MagicMock(glob=lambda p: [str(v22), str(v24)] if "node-v" in p else []),
        ):
            result = deploy_mod.detect_node_bin_dir()
        # v22 排第一（_rank 0 < v24 _rank 3）
        assert result is None or "v22" in str(result).lower() or "v24" not in str(result).lower()

    def test_unix_uses_which(self, deploy_mod, monkeypatch):
        monkeypatch.setattr(deploy_mod, "IS_WIN", False)
        with patch("shutil.which", return_value="/usr/local/bin/node"):
            result = deploy_mod.detect_node_bin_dir()
        assert result == Path("/usr/local/bin")

    def test_returns_none_when_no_node(self, deploy_mod, monkeypatch):
        monkeypatch.setattr(deploy_mod, "IS_WIN", False)
        with patch("shutil.which", return_value=None):
            assert deploy_mod.detect_node_bin_dir() is None


class TestPythonDetection:
    def test_current_interpreter_used_if_ok(self, deploy_mod):
        with patch.object(deploy_mod, "_verify_python_version", return_value="3.13.0"):
            result = deploy_mod.detect_python_bin()
        assert result == Path(sys.executable)

    def test_skip_too_old_version(self, deploy_mod):
        with patch.object(
            deploy_mod, "_verify_python_version", return_value="3.9.0"
        ):
            with patch("shutil.which", return_value=None):
                result = deploy_mod.detect_python_bin()
        assert result is None

    def test_python_version_check(self, deploy_mod):
        assert deploy_mod._is_python_ok("3.11.0")
        assert deploy_mod._is_python_ok("3.13.5")
        assert not deploy_mod._is_python_ok("3.10.99")
        assert not deploy_mod._is_python_ok("3.9.0")
        assert not deploy_mod._is_python_ok("invalid")


class TestNodeVersionCheck:
    def test_node_version_ok(self, deploy_mod):
        assert deploy_mod._is_node_ok("22.12.0")
        assert deploy_mod._is_node_ok("20.0.0")
        assert deploy_mod._is_node_ok("24.5.0")
        assert not deploy_mod._is_node_ok("18.20.0")
        assert not deploy_mod._is_node_ok("invalid")
        assert not deploy_mod._is_node_ok("")


# ============================================================
# Template rendering
# ============================================================


@pytest.fixture
def template_text():
    """Mini template with all known placeholders"""
    return """{
  "_path_placeholders_must_replace": {
    "PYTHON_BINARY": "<PLACEHOLDER_PYTHON_3_11_OR_HIGHER_ABS_PATH>  例: ...",
    "PROJECT_ROOT": "<PLACEHOLDER_PROJECT_ROOT_ABS_PATH>  例: ...",
    "NODE_BINARY_DIR": "<PLACEHOLDER_NODE_BINARY_DIR>  例: ..."
  },
  "mcpServers": {
    "langgraph": {
      "command": "<PLACEHOLDER_PYTHON_BINARY>",
      "cwd": "<PLACEHOLDER_PROJECT_ROOT>\\\\.agents",
      "env": {
        "PYTHONPATH": "<PLACEHOLDER_PROJECT_ROOT>\\\\.agents",
        "LLM_API_PROVIDER": "custom",
        "LLM_API_MODEL": "<PLACEHOLDER_MODEL_NAME>  例 qwen3.5",
        "LLM_API_BASE_URL": "<PLACEHOLDER_API_BASE_URL>  例 http://...",
        "LLM_API_KEY_ENV": "COMPANY_LLM_TOKEN",
        "LLM_API_EXTRA_BODY": "{}",
        "COMPANY_LLM_TOKEN": "<PLACEHOLDER_COMPANY_LLM_TOKEN>"
      }
    },
    "gitnexus": {
      "command": "<PLACEHOLDER_NODE_BINARY_DIR>\\\\gitnexus.cmd",
      "cwd": "<PLACEHOLDER_PROJECT_ROOT>",
      "env": {
        "PATH": "<PLACEHOLDER_NODE_BINARY_DIR>;C:\\\\Windows\\\\System32"
      }
    }
  }
}
"""


class TestRenderTemplate:
    def test_paths_substituted(self, deploy_mod, template_text):
        cfg = deploy_mod.DeployConfig(
            python_bin="C:\\Python313\\python.exe",
            node_bin_dir="D:\\node-v22.12.0-win-x64",
            project_root="D:\\Work\\repo",
            llm_provider="qwen",
            llm_model="qwen-max",
            llm_base_url="https://dashscope.aliyuncs.com",
            llm_key_env="COMPANY_LLM_TOKEN",
            llm_token="real-token",
        )
        out = deploy_mod.render_template(template_text, cfg)
        assert "<PLACEHOLDER_PYTHON_BINARY>" not in out
        assert "<PLACEHOLDER_PROJECT_ROOT>" not in out
        assert "<PLACEHOLDER_NODE_BINARY_DIR>" not in out
        assert "<PLACEHOLDER_COMPANY_LLM_TOKEN>" not in out
        assert "C:\\\\Python313\\\\python.exe" in out
        assert "real-token" in out

    def test_renders_valid_json(self, deploy_mod, template_text):
        cfg = deploy_mod.DeployConfig(
            python_bin="/usr/bin/python3",
            node_bin_dir="/usr/local/bin/node",
            project_root="/repo",
            llm_provider="qwen",
            llm_model="qwen-max",
            llm_base_url="https://api.example.com",
            llm_key_env="DASHSCOPE_API_KEY",
            llm_token="t1",
        )
        out = deploy_mod.render_template(template_text, cfg)
        data = json.loads(out)
        assert (
            data["mcpServers"]["langgraph"]["env"]["LLM_API_KEY_ENV"]
            == "DASHSCOPE_API_KEY"
        )
        assert (
            data["mcpServers"]["langgraph"]["env"]["DASHSCOPE_API_KEY"] == "t1"
        )
        # 舊 COMPANY_LLM_TOKEN slot 應已不存在
        assert "COMPANY_LLM_TOKEN" not in data["mcpServers"]["langgraph"]["env"]

    def test_keeps_token_under_default_key(self, deploy_mod, template_text):
        """若 user 沒改 key_env (用預設 COMPANY_LLM_TOKEN)，就保留原 key 名"""
        cfg = deploy_mod.DeployConfig(
            python_bin="/usr/bin/python3",
            node_bin_dir="/usr/local/bin/node",
            project_root="/repo",
            llm_provider="custom",
            llm_model="qwen3.5",
            llm_base_url="http://gateway.company.local/v1",
            llm_key_env="COMPANY_LLM_TOKEN",
            llm_token="company-secret",
        )
        out = deploy_mod.render_template(template_text, cfg)
        data = json.loads(out)
        assert (
            data["mcpServers"]["langgraph"]["env"]["COMPANY_LLM_TOKEN"]
            == "company-secret"
        )

    def test_extra_body_replaced(self, deploy_mod, template_text):
        cfg = deploy_mod.DeployConfig(
            python_bin="/usr/bin/python3",
            node_bin_dir="/usr/local/bin/node",
            project_root="/repo",
            llm_provider="custom",
            llm_model="qwen3-max",  # thinking mode
            llm_base_url="http://x",
            llm_key_env="K",
            llm_token="t",
            extra_body='{"chat_template_kwargs":{"enable_thinking":false}}',
        )
        out = deploy_mod.render_template(template_text, cfg)
        assert "enable_thinking" in out
        assert "false" in out

    def test_provider_replaced(self, deploy_mod, template_text):
        cfg = deploy_mod.DeployConfig(
            python_bin="/usr/bin/python3",
            node_bin_dir="/usr/local/bin/node",
            project_root="/repo",
            llm_provider="anthropic",
            llm_model="claude-haiku-4-5",
            llm_base_url="",
            llm_key_env="ANTHROPIC_API_KEY",
            llm_token="ant-key",
        )
        out = deploy_mod.render_template(template_text, cfg)
        data = json.loads(out)
        assert (
            data["mcpServers"]["langgraph"]["env"]["LLM_API_PROVIDER"]
            == "anthropic"
        )

    def test_unsupported_placeholder_raises(self, deploy_mod):
        bad_template = '{"foo": "<PLACEHOLDER_NEW_UNKNOWN_TOKEN>"}'
        cfg = deploy_mod.DeployConfig(
            python_bin="/usr/bin/python3",
            node_bin_dir="/usr/local/bin/node",
            project_root="/repo",
            llm_provider="qwen",
            llm_model="qwen-max",
            llm_base_url="https://x",
            llm_key_env="K",
            llm_token="t",
        )
        with pytest.raises(RuntimeError, match="未替換 placeholder"):
            deploy_mod.render_template(bad_template, cfg)


# ============================================================
# escape helper
# ============================================================


class TestEscapeJsonPath:
    def test_windows_path_escaped(self, deploy_mod):
        assert (
            deploy_mod._escape_json_path("D:\\foo\\bar")
            == "D:\\\\foo\\\\bar"
        )

    def test_unix_path_unchanged(self, deploy_mod):
        assert (
            deploy_mod._escape_json_path("/usr/bin/python3")
            == "/usr/bin/python3"
        )

    def test_empty_string(self, deploy_mod):
        assert deploy_mod._escape_json_path("") == ""
