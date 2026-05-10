"""
auditor_6dim.py — compat re-export (v8.0.6 V86-A-5/B-1 收斂)

原實作於 v8.0.6 PROPOSAL_502_058 V86-A-5/B-1 合併進 nodes/auditor.py（主 graph 直接接）。
本檔保留為 compat re-export 給既有 tests/integration/test_phase3_governance.py。

新代碼請直接 `from runtime.nodes.auditor import ...`。
"""
from __future__ import annotations

from ..nodes.auditor import (
    _DIM_6_SUBSCORES,
    auditor_aggregate_node,
    auditor_dimension_node,
)

# Compat aliases (test_phase3_governance.py 用)
auditor_dim_node = auditor_dimension_node
auditor_aggregate_6dim_node = auditor_aggregate_node

__all__ = [
    "_DIM_6_SUBSCORES",
    "auditor_dim_node",
    "auditor_dimension_node",
    "auditor_aggregate_node",
    "auditor_aggregate_6dim_node",
]
