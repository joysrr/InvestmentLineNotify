---
skill_id: memory-operations
file_type: skill
version: v2.0
last_modified: 2026-05-04
last_proposal: PROPOSAL_20260502_020
purpose: |
  MemPalace MCP tools 的 @Lead / sub-agents 標準操作流程；
  Plan G v2 後：mempalace = primary write target（單寫）；markdown = cold export artifact。
  含派發前查、wake-up、MCP-direct 寫、cold export、跨 session 上下文整合 7 個典型情境。
references:
  related_rule: rules/lead.md §s_memory_palace
  related_decision: decisions/0039-mempalace-memory-backend.md
  schema: skills/memory-palace-schema.md v2.0
  cold_export: scripts/mempalace-export.mjs
related_decisions:
  - ADR-0039 # v2 amended (Plan G)
  - ADR-0034 # MCP 整合
  - ADR-0001 # stateless routing 補位
---

# Skill: Memory Palace Operations（MemPalace MCP tools 使用流程）

> 由 PROPOSAL_20260502_001 + ADR-0039 建立；PROPOSAL_502_020 v2 amended（Plan G）。
> v2 重點：rules 直呼 `mcp__mempalace__add_drawer` 為**唯一寫路徑**；cold export 透過 `scripts/mempalace-export.mjs`。

## 1. MCP Tools 全景（29 tools；分 Core / Advanced）

MemPalace MCP server（`mempalace-mcp` command；`.mcp.json` 已註冊）提供。依 PROPOSAL_502_005 E-3 分 tier（rule 觸發點明確化；KI-004 對應）：

### Core MCP tools（rule 已觸發；必熟；v2 Plan G 後寫路徑變更）

| Tool（MCP function name）                                       | CLI flag                                             | 用途                               | 觸發 rule / task                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `mcp__mempalace__mempalace_search`                              | `mempalace search <q> --results N --wing W --room R` | 模糊查詢（vector + bm25）          | 11/13 rules §使用 Memory Palace；hotfix-checklist Step 0；audit-retro-coordination Step 0 |
| `mcp__mempalace__mempalace_status`                              | `mempalace status`                                   | 健康 probe / drawer count          | §3 治理 §4 阻斷                                                                           |
| **`mcp__mempalace__mempalace_add_drawer`**                      | （無 CLI；MCP only）                                 | **新增 drawer（v2 後唯一寫路徑）** | 5 高頻 rules（lead/architect/backend/qa/retro）；情境 C/D                                 |
| **`mcp__mempalace__mempalace_update_drawer`**                   | （無 CLI）                                           | 更新既有 drawer                    | 情境 C 修正路徑                                                                           |
| **`mcp__mempalace__mempalace_delete_drawer`**                   | （無 CLI）                                           | 刪除過時 drawer                    | 情境 C 退役路徑（罕用）                                                                   |
| `mcp__mempalace__mempalace_get_drawer`                          | （透過 search 取後）                                 | 讀取已知 drawer 完整內容           | lead.md 派發前查；export script                                                           |
| `mcp__mempalace__mempalace_list_drawers`                        | `mempalace mcp ...`                                  | 分頁列舉 drawer（含 metadata）     | export script                                                                             |
| `mcp__mempalace__mempalace_list_wings` / `mempalace_list_rooms` | —                                                    | 結構導航                           | export script                                                                             |

> **CLI flag 重要對照**（PROPOSAL_502_013 M-3 修正）：MemPalace CLI 用 `--results N` 取結果數（**不是** `--limit N`；後者會 unrecognized arguments error）。MCP API 內部 `palace.search(query=, limit=)` 仍用 `limit` 參數（非 CLI）。

CLI 對等命令：`mempalace search` / `mempalace wake-up` / `mempalace mine` / `mempalace status` / `mempalace compress` / `mempalace reconnect`。

### Advanced MCP tools（暫無 rule 觸發；未來擴展用；KI-004 觀察）

| Tool                                                                                   | 用途                   |
| -------------------------------------------------------------------------------------- | ---------------------- |
| `list_wings` / `wing.read`                                                             | wing 細粒度導航        |
| `drawer.list` / `drawer.read`                                                          | drawer 直讀            |
| `list_rooms`                                                                           | room 列舉              |
| `kg.query` / `kg.add_edge` / `kg.invalidate` / `kg.timeline` / `kg.stats`              | knowledge graph        |
| `log.read` / `log.write`                                                               | 操作審計 log           |
| `find_tunnels` / `follow_tunnels` / `create_tunnel` / `delete_tunnel` / `list_tunnels` | tunnel（跨 wing 連結） |
| `diary.read` / `diary.write`                                                           | 日記層                 |
| `traverse` / `graph_stats`                                                             | 圖譜走訪               |
| `check_duplicate`                                                                      | 去重檢查               |
| `get_aaak_spec` / `get_taxonomy` / `hook_settings`                                     | 元資訊                 |

> **解除 advanced 標記條件**：任一 tool 進 rule 觸發點 → 移到 Core 表並更新 KI-004 條目。

完整列表：`mempalace mcp` 或 `mempalace-mcp --help` 查官方。

## 2. 5 個典型情境

### 2.1 情境 A：@Lead 派發前查上下文（最常用）

```
觸發：User 下達需求 → @Lead 解析 → 進入 ROUTING_TICKET 撰寫前
動作：
  0. 【PROPOSAL_502_028 O-3】先檢 task_class：若 ∈ {doc-sync, config-adjust} 且
     無 strategyWeight / 敏感參數命中 → skip_memory_search=true；跳本 §2.1 全段；
     ROUTING_TICKET 標 memory_hint: 'skipped (simple lane)'
  1. 提取需求關鍵詞（如「budget control」「telegram bot」）
  2. MCP call：palace.search(query="<keywords>", limit=1)   # PROPOSAL_502_028 O-4：default 1 足以決策；單檔通常已足
  3. 檢視 top-1 drawer 內容 + cosine score
  4. 若 score ≥ 0.4 → 將該 drawer ref 寫入 ROUTING_TICKET；結束
  5. 若 score < 0.4 或無命中 → follow-up `limit=3`；仍 < 0.4 → follow-up `limit=5`；仍無 → 標 memory_hint: 'no strong match'

範例 MCP call（兩階段 fallback）：
  tool: palace.search
  args: { query: "budget control daily limit", limit: 1 }
  expected: top-1 drawer；cosine 充分時即用，不足時自動升級 limit=3
```

**Latency 設計理由**（O-4）：limit=1 比 limit=3 平均省 200-400ms（embedding 計算 + serialization）。實測 80% 案例 top-1 cosine 已 ≥ 0.4；只 20% 需 follow-up；總體 latency 預期 -30%。

**Sub-agent 收 `memory_hint: 'no strong match'` 行為差異化**（PROPOSAL_502_023 B-6 / HG-7）：

- 派發前查 architecture：強制走 Prior Art Scan（即使 LOC < 500；ADR-0014 觸發放寬）
- 自評 DoD：標明「無歷史相關上下文；高警覺度」
- @Reviewer 審查重點上調：邊界條件 / Edge case / 異常路徑加倍檢查
- 完成後若該領域為新 → 必寫 debug_graveyard / architecture drawer（未來作 baseline）

### 2.2 情境 B：跨 session wake-up（每次新對話開始）

```
觸發：新 Claude Code session 開啟 + @Lead 第一動作
動作：
  1. MCP call：wake-up
  2. 收到 ~600-900 tokens 的 L0+L1 上下文（最近活動 + 重要 entities）
  3. 整合進 @Lead 對需求的初步判斷

注意：wake-up 不取代 PENDING_ACTIONS.md 的 §🎯 [CURRENT_STAGE] 讀取！兩者並用：
  - PENDING_ACTIONS = workflow 狀態錨點（短期；當前任務）
  - mempalace wake-up = 知識上下文（長期；歷史脈絡）
```

### 2.3 情境 C：新增 debug_graveyard 條目（v2 Plan G 標準路徑）

```
觸發：sub-agent 完成踩坑分析（如 @Backend 發現 race condition）
動作（v2 唯一路徑：MCP-direct）：
  1. 構造 drawer 內容（含 frontmatter：incident_id / date / category / severity / agents_involved / related_proposal / related_files / fix_commit）
  2. MCP call：
     mcp__mempalace__mempalace_add_drawer(
       wing="memory",
       room="debug_graveyard",
       content="<frontmatter + 症狀/根因/修法/教訓>",
       source_file="(optional)"
     )
  3. 收 drawer_id 後在後續 ROUTING_TICKET / 自評帶上參照
  4. （定期 / commit hook）執行 python3 .agents/scripts/mempalace-export.py → 同步 .export/
  5. git commit（涵 .export/ 新檔；確保 zip 帶走）

注意：
- v2 後**不再寫 .agents/memory/debug_graveyard/*.md**（既有檔案保留為 seed；新條目走 MCP）
- INDEX.md 也不再活躍維護（mempalace search 取代「人讀導航」）
- `.agents/memory/.export/` 由 mempalace-export.mjs 自動產生；**不要手寫**
```

### 2.4 情境 D：strategy_context 參數變更紀錄（v2 Plan G）

```
觸發：User / @Lead 變更 workspace 敏感配置（strategyWeight / risk_limits / 等）
動作（**對齊 iron-rules/data-deletion-zero-tolerance.md** 流程後）：
  1. @Backend 執行變更後（取得 EXEMPTION_LOG 編號）
  2. MCP call：
     mcp__mempalace__mempalace_add_drawer(
       wing="<workspace_wing>",       # workspace-specific wing；如 "ws_<name>"
       room="strategy_context",
       content="<frontmatter: parameter/value_lives_in/related_modules + 變更歷史單列>"
     )
  3. **不存當前值**（指針而已；當前值看 config 檔案）
  4. （commit hook）跑 mempalace-export.mjs 同步 .export/
  5. git commit
```

### 2.5 情境 E：Cold export（v2 新增；Plan G 核心）

```
觸發：
  - 高頻 MCP 寫入後（lead/architect/backend/qa/retro rule 觸發點）
  - 每次 git commit 前（建議 git pre-commit hook 自動跑）
  - 手動同步（cold backup 確認）

動作：
  1. 執行 python3 .agents/scripts/mempalace-export.py（無 flag 即 export 全部 wings）
     - 可選 --wing <name> 限定範圍
     - --dry-run 預覽不寫
     - --verbose RPC trace
  2. 輸出：.agents/memory/.export/<wing>/<room>/<drawer_id>.md
     - 每 drawer 一檔；frontmatter 含 metadata；body 含 verbatim
  3. git add .agents/memory/.export/  → 確保進 git；zip 帶走
  4. git commit

成本：1 MCP RPC + 25 drawers ~ <2 sec；可頻繁執行。
```

### 2.6 情境 F：MCP server fail → fallback `.export/` grep（v2 Plan G）

**偵測時機**（明文化；解 Sim-D S15）：

- A. 派發前 **probe**：`mcp__mempalace__mempalace_status` 1 sec timeout；失敗 → 直接走 fallback（不嘗試 search）
- B. 呼叫中 **fail-fast**：search / wake-up / add_drawer 任一失敗 → 立即降級（不 retry）
- C. 持續 health-check：每 10 工作對話一次 status probe；自動偵測復活

**偵測流程**（v2：fallback 對象從 `.agents/memory/*.md` 改為 `.agents/memory/.export/`）：

```
觸發：mempalace MCP tool 呼叫失敗（連線拒絕 / timeout / version mismatch）
動作：
  1. @Lead 偵測：MCP tool unreachable（probe / call fail）
  2. 通知 User：「Memory Palace MCP server 失聯；切換 .export/ filesystem fallback」
  3. 退化為 grep .export/：
     - grep -r "<keyword>" .agents/memory/.export/
     （seed docs 在 .agents/memory/*.md 也可補查；但 .export/ 為主）
  4. ROUTING_TICKET 標：memory_mode: filesystem_fallback（PROPOSAL_502_013 M-4 schema）
  5. **新寫入暫存**：fallback 期間 sub-agent 寫條目走「buffer 機制」—
     **前置（PROPOSAL_502_023 A-1 / B-5）**：寫前 `mkdir -p .agents/memory/.pending`（idempotent；防 ENOENT）
     **lock**：取 `.pending/.lock`（O_EXCL）；不到 lock 重試 3 次（500ms / 1s / 2s backoff）；仍失敗 → 回報 @Lead
     寫到 .agents/memory/.pending/<timestamp>-<uuid>.md（structured frontmatter）；
     釋放 lock（刪 `.lock` 檔）
     復活後由 @Lead 批次 replay 至 mempalace 並刪 buffer
  6. @Retro 後續審計觸發根因（每次 fallback 必審）
```

### 2.7 情境 G：Sub-agent 收 memory_mode: filesystem_fallback 行為（v2 Plan G）

sub-agent 接派發 ticket 含 `memory_mode: filesystem_fallback`：

| 動作                  | 行為（v2）                                                                   |
| --------------------- | ---------------------------------------------------------------------------- |
| 派發前查 architecture | grep `.agents/memory/.export/<wing>/architecture/` 替代 mempalace.search     |
| 查歷史踩坑            | grep `.agents/memory/.export/<wing>/debug_graveyard/` 替代                   |
| 查 strategy_context   | grep `.agents/memory/.export/<wing>/strategy_context/` 替代                  |
| 寫新條目              | 寫到 `.agents/memory/.pending/<timestamp>-<uuid>.md`（buffer；不直接寫 MCP） |
| 自評                  | DoD 標 `memory_mode: filesystem_fallback`；列出 .pending/ 新增檔案           |

**復活切回**（@Lead 偵測 mempalace status 恢復）：

1. 通知 User：「Memory Palace MCP server 已恢復；切回 mcp 模式」
2. ROUTING_TICKET 下一張 `memory_mode: mcp`
3. **批次 replay**：對 `.agents/memory/.pending/*.md` 每檔呼叫 `mcp__mempalace__mempalace_add_drawer` → 成功則刪 buffer 檔
4. 跑 `python3 .agents/scripts/mempalace-export.py` 同步 .export/
5. 不需 retry 之前的 fallback 任務（已用 grep 替代成功）

## 3. 操作邊界（v2 Plan G）

### 3.1 何時用 MemPalace（vs 手讀 markdown）

| 情境              | 推薦（v2）                                                     |
| ----------------- | -------------------------------------------------------------- |
| 派發前查模糊概念  | MemPalace search（vector）                                     |
| 跨 session 上下文 | MemPalace wake-up                                              |
| 確切知 drawer_id  | `mempalace_get_drawer`                                         |
| Git history 審計  | 讀檔工具 讀 `.agents/memory/.export/<wing>/<room>/<drawer>.md` |
| MCP server down   | `.export/` filesystem fallback grep + `.pending/` buffer 寫    |

### 3.2 治理原則（v2：SoT 反轉）

- **MemPalace 是 SoT**：所有寫入走 `mcp__mempalace__add_drawer`；無雙寫
- **`.export/` 是 cold artifact**：由 `scripts/mempalace-export.mjs` 自動產生；commit 進 git；zip 帶走
- **`.agents/memory/*.md` 是 seed**：cold-start `mempalace mine .agents/memory/.export/` 重建用；不再活躍維護
- **vector embedding 黑箱**：透過 `.export/` 取得 diff-friendly 視圖（每 drawer 一檔）
- **Cold export 頻率**：高頻寫入 rule 觸發後 + 每 commit 前；自動化（hooks）優於人為

## 4. 絕對禁止（v2 更新）

- **絕對禁止** 派發前未查 memory（MCP 或 `.export/` fallback grep 必擇一）
- **絕對禁止** MCP server down 不通知 User 即靜默跳過 memory 查詢
- **絕對禁止** 手寫 `.agents/memory/.export/`（必由 mempalace-export.mjs 產生；否則漂移）
- **絕對禁止** MCP 寫入後從不跑 export（會導致 zip 帶走丟資料；至少 commit 前必跑）
- **絕對禁止** 修改 ChromaDB binary 檔案（資料庫崩潰）
- **絕對禁止** strategy_context 寫入當前數值（語意違反；指針 only）
- **絕對禁止** filesystem_fallback 期間 sub-agent 不走 `.pending/` buffer 直接寫死檔（會與 MCP 復活後狀態漂移）

## 5. 驗證

```bash
# 安裝確認
mempalace --version           # ≥ 3.3.4
which mempalace-mcp           # /usr/local/bin/mempalace-mcp

# Status（probe 健康）
mempalace status              # 顯示 wings / rooms / drawers count

# Cold-start re-mine（v2：來源從 .agents/memory/ 改 .agents/memory/.export/）
mempalace mine .agents/memory/.export/

# 查詢測試（default 3；不夠時 follow-up --results 5）
mempalace search "<keywords>" --results 1   # PROPOSAL_502_028 O-4：default 1；不足才 follow-up --results 3

# Wake-up
mempalace wake-up

# Cold export（v2 新增；驗證 .export/ 同步）
python3 .agents/scripts/mempalace-export.py --dry-run --verbose
python3 .agents/scripts/mempalace-export.py

# Validator
python3 .agents/tests/memory-palace-validator.py
```

## 6. Compress 流程（drawer count 防護；PROPOSAL_502_003 C-2）

長期累積後 drawer count 過大會拖慢 retrieval；MemPalace 提供 `mempalace compress` 將舊 drawer 以 **AAAK Dialect 30x** 高密度壓縮。

> **drawer count SoT**（PROPOSAL_502_016 P-3 明文化解 Sim-F S25）：唯一 SoT = `mempalace status` 報的數字；filesystem markdown 數為 SoT backup（每 markdown 條目可能被 mempalace mine 切多 drawer chunks；ratio 通常 1:2~5）。`memory-palace-validator §7` 偵測 drift（ratio >10x 過度 mining；ratio <0.5x 漏 mine）；範圍內視為健康。

### 6.1 何時呼叫

| drawer count | 動作                                                  | 觸發者                            |
| ------------ | ----------------------------------------------------- | --------------------------------- |
| ≤ 1000       | 不需 compress                                         | —                                 |
| 1000 ~ 5000  | 🟡 建議 compress（memory-palace-validator WARN）      | @Lead 季度檢視；或 retro 定期審計 |
| > 5000       | 🔴 必 compress（validator ERROR；阻斷新派發直到完成） | @Lead 立即執行                    |

memory-palace-validator.mjs 自動檢測；retro.md §s_root_cause 列入根因比對來源。

### 6.2 標準流程

```bash
# Step 1：壓縮前 baseline
mempalace status                          # 記錄 drawer count（壓縮前）
mempalace search "<key>" --results 5 > before.txt   # 抽樣查詢（驗證壓縮無損）

# Step 2：執行壓縮
mempalace compress --dry-run              # 先預覽（顯示候選 drawers）
mempalace compress --yes                  # 正式壓縮（AAAK Dialect 30x）

# Step 3：壓縮後驗證
mempalace status                          # 確認 drawer count 下降
mempalace search "<key>" --results 5 > after.txt
diff before.txt after.txt                 # 同關鍵詞應仍能命中（語意保留）
python3 .agents/tests/memory-palace-validator.py   # 應 0 errors / 0 warnings
```

### 6.3 AAAK Dialect 特性（壓縮基礎）

- **30x 密度**：將自然語言 drawer 壓成 AAAK 符號 token
- **語意保留**：壓縮後 vector embedding 保持 cosine 接近度（≥ 0.85）
- **不可逆**：壓縮 drawer 無法回復原文 → **markdown SoT 必保留**（git audit 仍可讀原文）
- **延遲攝取**：壓縮後首次查詢可能 +50-100ms（需重建 cache）

### 6.4 驗證 + 禁止 + 失敗恢復（PROPOSAL_502_023 B-4 / HG-5）

- ✅ 壓縮前 baseline + 壓縮後抽樣比對為**強制**步驟（任一缺失視為流程不完整）
- ✅ 壓縮失敗恢復 SOP：
  1. 第 1 次失敗 → `mempalace reconnect` + retry 1 次（30s backoff）
  2. 第 2 次失敗 → 標 🟡 `MEMPALACE_COMPRESS_DEGRADED`；繼續阻斷新派發；通知 @Retro 起草根因分析
  3. 第 3 次失敗 → 升 🔴 `MEMPALACE_COMPRESS_FAIL`；@Lead 升級 User；可選人工 fallback（mempalace export → 重建 palace）
- ✅ 向量品質監測：壓縮後抽樣查詢 cosine 應 ≥ 0.85（§6.3）；< 0.85 視為品質漂移 → 標 🟡 警告 + @Retro 審計
- ❌ **絕對禁止** 壓縮 markdown SoT 檔案（只壓 vector store 內部 drawer；markdown 永保原文）
- ❌ **絕對禁止** drawer count > 5000 仍持續派發新工作（先 compress 再派發）
- ❌ **絕對禁止** 連續 3 次 compress 失敗仍不升級 User（必走 §6.4 SOP 第 3 步）

### 6.5 @Lead dispatch 阻斷整合（PROPOSAL_502_004 D-2 + 502_008 H-1 移入）

`rules/lead.md §s_memory_palace` 規則層強制條款（細節集中此處）：

- `mempalace status` drawer count > `COMPRESS_ERROR_THRESHOLD` (5000) → @Lead **暫停派發**（即使任務 ready）
  1. 先呼叫 `mempalace compress`（依 §6.2 標準流程）
  2. 完成後恢復派發
  3. 同步通知 @Assistant 寫 P-XX 提示
- > 1000 → 🟡 排程 compress（不阻斷派發；@Lead 季度檢視；retro 定期審計列入根因比對）
- 對應 validator：`memory-palace-validator.mjs` 自動偵測（>5000 ERROR / >1000 WARN）
- 對應 KNOWN_ISSUES：drawer count 過大為 KI 候選（解除條件 = compress 完成）

「絕對禁止」清單（含於 lead.md §s_memory_palace）：

- drawer count > 5000 仍續派新工作（必先 compress）
- 派發前未查 architecture / strategy_context 寫入當前數值 / debug_graveyard 漏 category/severity
- MCP server down 未通知 User 即靜默跳過 memory 查詢

## 7. Related Decisions

ADR-0001（Stateless Routing；wake-up 補位）/ ADR-0034（MCP 整合）/ ADR-0039（MemPalace primary backend；本 skill 為其執行手冊）— 在 `decisions/`。
