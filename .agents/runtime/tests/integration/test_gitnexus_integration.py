"""V90-A-8 GitNexus state-level integration tests

驗 gitnexus_helper subprocess wrappers + state-level integration:
- _resolve_cli_path / is_available
- _run_cli error handling (timeout / OSError / non-JSON output)
- prefetch_for_* composite helpers
- format_context_for_prompt formatting
- mcp_server.validate_runtime_environment health probe

Subprocess 全 mock；不依賴實機 gitnexus 安裝。
"""
from __future__ import annotations

import os
import subprocess
from unittest.mock import patch, MagicMock

import pytest

from runtime import gitnexus_helper  # type: ignore


# ============================================================
# CLI 路徑解析
# ============================================================


class TestResolveCliPath:
    def test_env_override_takes_priority(self, tmp_path):
        fake_cli = tmp_path / "gitnexus.cmd"
        fake_cli.write_text("")  # 模擬存在
        with patch.dict(os.environ, {"GITNEXUS_CMD": str(fake_cli)}):
            assert gitnexus_helper._resolve_cli_path() == str(fake_cli)

    def test_env_var_invalid_falls_through(self):
        with patch.dict(os.environ, {"GITNEXUS_CMD": "/nonexistent/path"}):
            with patch("runtime.gitnexus_helper.shutil.which", return_value=None):
                assert gitnexus_helper._resolve_cli_path() is None

    def test_path_resolution_when_env_unset(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GITNEXUS_CMD", None)
            with patch(
                "runtime.gitnexus_helper.shutil.which",
                return_value="/usr/local/bin/gitnexus",
            ):
                assert gitnexus_helper._resolve_cli_path() == "/usr/local/bin/gitnexus"

    def test_is_available_reflects_resolution(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/somepath",
        ):
            assert gitnexus_helper.is_available() is True
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value=None,
        ):
            assert gitnexus_helper.is_available() is False


# ============================================================
# _run_cli 錯誤路徑
# ============================================================


class TestRunCliErrorPaths:
    def test_returns_none_when_cli_missing(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path", return_value=None
        ):
            assert gitnexus_helper._run_cli(["query", "foo"]) is None

    def test_returns_none_on_timeout(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/fake/gitnexus",
        ):
            with patch(
                "runtime.gitnexus_helper.subprocess.run",
                side_effect=subprocess.TimeoutExpired(cmd="gn", timeout=15),
            ):
                assert gitnexus_helper._run_cli(["query", "foo"]) is None

    def test_returns_none_on_oserror(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/fake/gitnexus",
        ):
            with patch(
                "runtime.gitnexus_helper.subprocess.run",
                side_effect=OSError("no exec perm"),
            ):
                assert gitnexus_helper._run_cli(["query", "foo"]) is None

    def test_returns_none_on_nonzero_rc(self):
        mock_result = MagicMock(returncode=1, stdout="", stderr="unknown command")
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/fake/gitnexus",
        ):
            with patch(
                "runtime.gitnexus_helper.subprocess.run", return_value=mock_result
            ):
                assert gitnexus_helper._run_cli(["badcmd"]) is None

    def test_wraps_non_json_output_as_raw(self):
        mock_result = MagicMock(returncode=0, stdout="plain text output", stderr="")
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/fake/gitnexus",
        ):
            with patch(
                "runtime.gitnexus_helper.subprocess.run", return_value=mock_result
            ):
                result = gitnexus_helper._run_cli(["query", "foo"])
                assert result == {"_raw": "plain text output", "_format": "text"}

    def test_parses_json_output(self):
        mock_result = MagicMock(
            returncode=0, stdout='{"entity_name": "foo", "kind": "func"}', stderr=""
        )
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path",
            return_value="/fake/gitnexus",
        ):
            with patch(
                "runtime.gitnexus_helper.subprocess.run", return_value=mock_result
            ):
                result = gitnexus_helper._run_cli(["query", "foo"])
                assert result == {"entity_name": "foo", "kind": "func"}


# ============================================================
# Stage-specific composite helpers
# ============================================================


class TestPrefetchHelpers:
    def setup_method(self):
        gitnexus_helper._reset_session_cache()

    def test_prefetch_for_lead_returns_dict_even_when_cli_unavailable(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path", return_value=None
        ):
            ctx = gitnexus_helper.prefetch_for_lead(
                ["src/foo.py", "src/bar.py"], repo_root="/tmp"
            )
            assert ctx["stage"] == "lead"
            assert "touched_files_impact" in ctx
            assert ctx["touched_files_impact"]["src/foo.py"] is None
            assert "indexed_at" in ctx

    def test_prefetch_for_lead_caps_at_10_files(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path", return_value=None
        ):
            many = [f"src/f{i}.py" for i in range(20)]
            ctx = gitnexus_helper.prefetch_for_lead(many, repo_root="/tmp")
            assert len(ctx["touched_files_impact"]) == 10  # 上限

    def test_prefetch_for_implementer_separates_callers_callees(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path", return_value=None
        ):
            ctx = gitnexus_helper.prefetch_for_implementer(
                [], target_entities=["FuncA", "ClassB"], repo_root="/tmp"
            )
            assert ctx["stage"] == "implementer"
            assert "callers_per_entity" in ctx
            assert "callees_per_entity" in ctx
            assert "FuncA" in ctx["callers_per_entity"]

    def test_prefetch_for_reviewer_uses_15_file_cap(self):
        with patch(
            "runtime.gitnexus_helper._resolve_cli_path", return_value=None
        ):
            many = [f"src/f{i}.py" for i in range(20)]
            ctx = gitnexus_helper.prefetch_for_reviewer(many, repo_root="/tmp")
            assert len(ctx["cross_file_impact"]) == 15

    def test_prefetch_handles_empty_input(self):
        ctx = gitnexus_helper.prefetch_for_architect([], repo_root="/tmp")
        assert ctx["stage"] == "architect"
        assert ctx["module_deps"] == {}
        assert ctx["entity_definitions"] == {}


# ============================================================
# format_context_for_prompt
# ============================================================


class TestFormatContextForPrompt:
    def test_empty_context_returns_empty_string(self):
        assert gitnexus_helper.format_context_for_prompt({}) == ""
        assert gitnexus_helper.format_context_for_prompt(None) == ""

    def test_skips_stage_only_context(self):
        ctx = {"stage": "lead", "indexed_at": "2026-05-10T00:00:00"}
        assert gitnexus_helper.format_context_for_prompt(ctx) == ""

    def test_skips_empty_inner_dicts(self):
        ctx = {"stage": "lead", "touched_files_impact": {"f.py": None, "g.py": None}}
        assert gitnexus_helper.format_context_for_prompt(ctx) == ""

    def test_formats_callers_summary(self):
        ctx = {
            "stage": "implementer",
            "callers_per_entity": {
                "FuncA": {
                    "callers": [
                        {"caller_name": "main", "file": "src/m.py"},
                        {"caller_name": "wrapper", "file": "src/w.py"},
                    ]
                }
            },
        }
        out = gitnexus_helper.format_context_for_prompt(ctx)
        assert "stage=implementer" in out
        assert "callers_per_entity" in out
        assert "FuncA" in out
        assert "2 callers" in out

    def test_formats_impact_summary(self):
        ctx = {
            "stage": "reviewer",
            "cross_file_impact": {
                "src/foo.py": {
                    "impacts": [{"file": "src/bar.py"}, {"file": "src/baz.py"}]
                }
            },
        }
        out = gitnexus_helper.format_context_for_prompt(ctx)
        assert "2 impacts" in out
        assert "src/bar.py" in out


# ============================================================
# Cache staleness session 一次
# ============================================================


class TestCacheStaleness:
    def setup_method(self):
        gitnexus_helper._reset_session_cache()

    def test_ensure_index_fresh_skips_after_first_call(self, tmp_path):
        # 模擬 .git 存在 → 觸發 detect_changes
        (tmp_path / ".git").mkdir()
        with patch("runtime.gitnexus_helper._run_cli") as mock_run:
            mock_run.return_value = {"changed": False}
            gitnexus_helper.ensure_index_fresh(str(tmp_path))
            gitnexus_helper.ensure_index_fresh(str(tmp_path))
            # 第二次直接命中 _STALE_CHECK_DONE；不再呼 _run_cli
            assert mock_run.call_count == 1

    def test_ensure_index_fresh_skips_when_no_git(self, tmp_path):
        # 無 .git → 不呼 detect_changes
        with patch("runtime.gitnexus_helper._run_cli") as mock_run:
            assert gitnexus_helper.ensure_index_fresh(str(tmp_path)) is True
            mock_run.assert_not_called()


# ============================================================
# mcp_server.validate_runtime_environment health probe
# ============================================================


class TestRuntimeEnvProbe:
    def test_validation_passes_when_gitnexus_available(self):
        from runtime import mcp_server  # type: ignore

        with patch(
            "runtime.gitnexus_helper.is_available", return_value=True
        ):
            errors = mcp_server.validate_runtime_environment()
            assert errors == []

    def test_validation_fails_when_gitnexus_missing(self):
        from runtime import mcp_server  # type: ignore

        # 強制 mandatory mode（測試獨立於 env GITNEXUS_OPTIONAL）
        with patch.object(mcp_server, "_GITNEXUS_MANDATORY", True):
            with patch(
                "runtime.gitnexus_helper.is_available", return_value=False
            ):
                errors = mcp_server.validate_runtime_environment()
                assert len(errors) == 1
                assert "GitNexus CLI 不可達" in errors[0]
                assert "v22" in errors[0]  # 提示正確 Node 版本

    def test_validation_passes_when_optional_flag_set(self):
        from runtime import mcp_server  # type: ignore

        with patch.object(mcp_server, "_GITNEXUS_MANDATORY", False):
            with patch(
                "runtime.gitnexus_helper.is_available", return_value=False
            ):
                errors = mcp_server.validate_runtime_environment()
                assert errors == []
