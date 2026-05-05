#!/usr/bin/env python3
"""gen-proposal-index.test.py — Unit test for parse_proposal_status (PROPOSAL_502_027)."""
import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "gen_proposal_index",
    SCRIPT_DIR.parent / "scripts" / "generators" / "gen-proposal-index.py",
)
_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_module)
parse_proposal_status = _module.parse_proposal_status


class TestParseProposalStatus(unittest.TestCase):
    def test_plain_open(self):
        self.assertEqual(parse_proposal_status("- 狀態：OPEN"), "OPEN")

    def test_plain_done(self):
        self.assertEqual(parse_proposal_status("- 狀態：DONE"), "DONE")

    def test_bold_cancelled(self):
        self.assertEqual(parse_proposal_status("- 狀態：**CANCELLED**（備註）"), "CANCELLED")

    def test_italic_done(self):
        self.assertEqual(parse_proposal_status("- 狀態：_DONE_"), "DONE")

    def test_bold_in_progress(self):
        self.assertEqual(parse_proposal_status("- 狀態：**IN_PROGRESS**"), "IN_PROGRESS")

    def test_halfwidth_colon(self):
        self.assertEqual(parse_proposal_status("- 狀態: OPEN"), "OPEN")

    def test_unknown(self):
        self.assertEqual(parse_proposal_status("no status here"), "UNKNOWN")


if __name__ == "__main__":
    unittest.main(verbosity=2)
