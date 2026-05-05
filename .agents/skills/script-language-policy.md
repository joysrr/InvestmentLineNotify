# Skill: Script Language Policy（撰寫腳本時的語言選擇）

> 由 PROPOSAL_502_025 Sprint C T-4 建立。對齊 ADR-0040。
> 本 skill 為快速決策手冊；完整理由 ADR-0040；遷移計畫 `docs/SCRIPT_MIGRATION_ROADMAP.md`。

## §1 三層策略

| Tier          | 語言            | 何時用                              |
| ------------- | --------------- | ----------------------------------- |
| 🟢 Primary    | **Python 3.9+** | 任何**新建** script                 |
| 🟡 Legacy     | Node.js `.mjs`  | 既有；不主動遷；大改時順手 port     |
| 🔴 Deprecated | Bash `.sh`      | **絕對不新增**；既有逐步遷至 Python |

## §2 為什麼 Python

1. mempalace 已要求 Python 3.9+ runtime → **不增加新依賴**
2. Cross-platform 100%（Windows native cmd 也能 `python script.py`）
3. LLM agent 環境 Bash tool / run_command 100% 支援
4. 標準函式庫足夠（`subprocess` / `pathlib` / `re` / `json`）

## §3 Decision Tree

```
要寫 script？
├─ 完全新建 → 🟢 Python（無例外）
├─ 修既有 .mjs
│   ├─ 小改（< 50% LOC）→ 維持 .mjs
│   └─ 大改（≥ 50% LOC）→ 🟢 趁機 port Python
├─ 修既有 .sh
│   ├─ 小改 → 評估直接 port Python（多數 .sh 不大）
│   └─ 大改 → 🟢 必 port Python
└─ 純 unit test runner（既有 node:test）→ 維持 .mjs（保留測試框架）
```

## §4 Python 撰寫規範（簡）

### 4.1 Boilerplate

```python
#!/usr/bin/env python3
"""
<script-name>.py — <一句話描述>
PROPOSAL_502_NNN <task-id>。

使用：
    python3 .agents/path/to/script.py [flags]

退出碼：
    0 = success
    1 = warning
    2 = error
"""
import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # 視位置調整


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # ... logic ...

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### 4.2 標準函式庫優先

| 需求       | 用                                       |
| ---------- | ---------------------------------------- |
| 跑外部命令 | `subprocess.run(...)`                    |
| 路徑操作   | `pathlib.Path`                           |
| Regex      | `re`                                     |
| JSON       | `json`                                   |
| YAML       | `yaml`（pyyaml；mempalace 已裝）         |
| 並行       | `concurrent.futures.ProcessPoolExecutor` |
| CLI        | `argparse`                               |

避免不必要的第三方依賴（`requests` / `click` 等）；如需新依賴 → 立 lite proposal。

### 4.3 跨平台陷阱

- ✅ 用 `Path / pathlib`；不要 hardcode `/` 或 `\`
- ✅ 用 `shutil.which(cmd)` 檢查命令；不要 hardcode `/usr/bin/...`
- ✅ Subprocess 用 list `["cmd", "arg"]`；避免 `shell=True`（注入風險 + Windows 行為差異）
- ❌ 避免 Unix-only utilities（`grep` / `find`）；Python 內建即可

### 4.4 Exit codes 對齊 framework

- 0 = 成功
- 1 = warning（不阻斷 commit）
- 2 = error（阻斷 commit）

## §5 何時可破例

僅 2 種情境合理用 .mjs / .sh：

1. **既有 unit test runner**（node:test）→ 維持 .mjs
2. **臨時 prototype**（< 50 LOC；不入 framework）→ 任何語言；commit 前 port Python

## §6 違反偵測

- run-all.py 會跑既有 `tests/user-execution-language-validator.py`
- 後續可加 `script-language-policy-validator.py`（檢查新增 .sh 自動阻斷；roadmap）

## Related

- `decisions/0040-script-language-policy.md`
- `docs/SCRIPT_MIGRATION_ROADMAP.md`
- `INSTALL.md §0`（Windows 用戶 bootstrap）

## Related Decisions

ADR-0040（本 skill 為其執行手冊）/ ADR-0024（local-first；Python 屬 local runtime） — 在 `decisions/`。
