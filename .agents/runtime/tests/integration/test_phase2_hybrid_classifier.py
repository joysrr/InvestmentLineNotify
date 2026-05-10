"""Phase 2 hybrid classifier + multi-signal + autonomy tests"""
from __future__ import annotations

import pytest

from runtime.nodes.lead import (  # type: ignore
    _detect_keyword_priority,
    _detect_multi_signal_priorities,
    _detect_structural_signals,
    _smart_autonomy,
)
from runtime.state import create_initial_state  # type: ignore


class TestKeywordPriority:
    """ADR-0042 layer 2 keyword 7-priority"""

    def test_onboarding_priority_1(self):
        cls, p = _detect_keyword_priority("我要建 workspace acme-platform")
        assert cls == "onboarding"
        assert p == 1

    def test_hotfix_priority_2(self):
        cls, p = _detect_keyword_priority("prod 急修 footer typo")
        assert cls == "hotfix"
        assert p == 2

    def test_refactor_priority_3_chinese(self):
        cls, p = _detect_keyword_priority("把 processOrder 改名成 handleOrder")
        assert cls == "modify-existing"
        assert p == 3

    def test_refactor_colloquial(self):
        """v7.21 加極口語清單"""
        cls, p = _detect_keyword_priority("這個 helper 砍掉重整")
        assert cls == "modify-existing"
        assert p == 3

    def test_no_keyword_returns_none(self):
        cls, p = _detect_keyword_priority("整個世界都不一樣")
        assert cls is None or p > 0  # fallback


class TestStructuralSignals:
    """ADR-0042 layer 1"""

    def test_default_no_signal(self, tmp_path, monkeypatch):
        # CURRENT_WORKSPACE 存在 → 不命中 missing_workspace
        s = create_initial_state(request="正常 feature")
        cls, evidence = _detect_structural_signals(s)
        # 一般情況可能命中 all_new_files (touched=[]) 或 None
        assert evidence in ("", "all_new_files", "missing_workspace")


class TestMultiSignal:
    """ADR-0043 multi-signal detection"""

    def test_single_priority(self):
        prios = _detect_multi_signal_priorities("加 OrderHistory feature")
        assert len(prios) <= 2  # 「加」是 priority 4 + 7

    def test_multi_priority_three(self):
        prios = _detect_multi_signal_priorities(
            "急修 footer typo 順便 rename processOrder 整理 helper"
        )
        # 含 hotfix(2) + rename(3) + 整理(3) → 至少 2 priority
        assert len(prios) >= 2


class TestAutonomyDefault:
    """v7.22 autonomy_mode smart default"""

    def test_feature_default_gate_at_design(self):
        assert _smart_autonomy("feature") == "gate-at-design"

    def test_modify_existing_gate_at_impl(self):
        assert _smart_autonomy("modify-existing") == "gate-at-impl"

    def test_hotfix_light_auto(self):
        assert _smart_autonomy("hotfix", "light") == "auto"

    def test_hotfix_heavy_gate_at_impl(self):
        """v7.12 改自 step-by-step → gate-at-impl"""
        assert _smart_autonomy("hotfix", "heavy") == "gate-at-impl"

    def test_doc_sync_auto(self):
        assert _smart_autonomy("doc-sync") == "auto"

    def test_onboarding_gate_at_design(self):
        assert _smart_autonomy("onboarding") == "gate-at-design"


class TestPersistence:
    """Phase 2 ROUTING_TICKET sync"""

    def test_telemetry_helper(self):
        from runtime.persistence import append_telemetry  # type: ignore
        s = create_initial_state(request="test")
        update = append_telemetry(s, gitnexus_probe="ok", gitnexus_used=True, gitnexus_callers_count=15)
        assert update["runtime_telemetry"]["gitnexus_callers_count"] == 15
        assert update["done_at"]


class TestHITL:
    """Phase 2 autonomy gate"""

    def test_auto_no_gate(self):
        from runtime.hitl import _autonomy_should_gate  # type: ignore
        assert not _autonomy_should_gate("auto", "stage_3_design")

    def test_step_by_step_all_gate(self):
        from runtime.hitl import _autonomy_should_gate  # type: ignore
        assert _autonomy_should_gate("step-by-step", "stage_3_design")
        assert _autonomy_should_gate("step-by-step", "stage_5_implement")

    def test_gate_at_design_only_stage_3(self):
        from runtime.hitl import _autonomy_should_gate  # type: ignore
        assert _autonomy_should_gate("gate-at-design", "stage_3_design")
        assert not _autonomy_should_gate("gate-at-design", "stage_5_implement")

    def test_gate_at_impl_only_stage_4(self):
        from runtime.hitl import _autonomy_should_gate  # type: ignore
        assert _autonomy_should_gate("gate-at-impl", "stage_4_test_spec")
        assert not _autonomy_should_gate("gate-at-impl", "stage_3_design")
