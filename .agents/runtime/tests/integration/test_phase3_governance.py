"""Phase 3 Governance tests (PROPOSAL_502_052)"""
from __future__ import annotations

import pytest

from runtime.state import create_initial_state  # type: ignore


class TestAuditor6Dim:
    """auditor_6dim subgraph dim 6 凍結門檻"""

    def test_dim6_below_2_blocks_freeze(self):
        from runtime.subgraphs.auditor_6dim import auditor_aggregate_6dim_node  # type: ignore

        async def run():
            s = create_initial_state(request="test")
            s["dim_1_avg"] = 4.5
            s["dim_2_avg"] = 4.5
            s["dim_3_avg"] = 4.5
            s["dim_4_avg"] = 4.5
            s["dim_5_avg"] = 4.5
            s["dim_6_avg"] = 1.5  # 低於 2.0
            return await auditor_aggregate_6dim_node(s)

        import asyncio
        result = asyncio.run(run())
        assert result["_dim6_can_freeze"] is False
        assert result["_dim6_needs_p15"] is True

    def test_dim6_above_3_freeze_ok(self):
        from runtime.subgraphs.auditor_6dim import auditor_aggregate_6dim_node  # type: ignore

        async def run():
            s = create_initial_state(request="test")
            s["dim_1_avg"] = 4.5
            s["dim_6_avg"] = 4.0
            return await auditor_aggregate_6dim_node(s)

        import asyncio
        result = asyncio.run(run())
        assert result["_dim6_can_freeze"] is True
        assert result["_dim6_needs_p15"] is False


class TestGovernanceHealth:
    """G-2 governance health dashboard generator"""

    def test_dashboard_can_run(self):
        import subprocess
        result = subprocess.run(
            ["python3", ".agents/scripts/governance-health.py"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd="/home/user/201013",
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        assert "✅" in result.stdout
