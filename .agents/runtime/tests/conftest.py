"""pytest conftest — sys.path 注入；解決 .agents/ 無法直接 import 為 package 的問題"""
import sys
from pathlib import Path

# 加入 .agents/ 到 sys.path → 可 `from runtime.state import ...`
AGENTS_DIR = Path(__file__).resolve().parent.parent.parent
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))
