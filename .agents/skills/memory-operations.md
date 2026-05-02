---
skill_id: memory-operations
file_type: skill
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_001
purpose: |
  MemPalace MCP tools 的 @Lead / sub-agents 標準操作流程；
  含派發前查、wake-up、新增條目、跨 session 上下文整合 5 個典型情境。
references:
  related_rule: rules/lead.md §s_memory_palace
  related_decision: decisions/0039-mempalace-memory-backend.md
  schema: skills/memory-palace-schema.md v2.0
related_decisions:
  - ADR-0039
  - ADR-0034 # MCP 整合
  - ADR-0001 # stateless routing 補位
---

# Skill: Memory Palace Operations（MemPalace MCP tools 使用流程）

> 由 PROPOSAL_20260502_001 + ADR-0039 建立；MemPalace 29 MCP tools 標準操作。

## 1. MCP Tools 全景（29 tools；分 Core / Advanced）

MemPalace MCP server（`mempalace-mcp` command；`.mcp.json` 已註冊）提供。依 PROPOSAL_502_005 E-3 分 tier（rule 觸發點明確化；KI-004 對應）：

### Core MCP tools（rule 已觸發；必熟）

| Tool                | CLI flag                                             | 用途                                            | 觸發 rule / task                                                                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `palace.search`     | `mempalace search <q> --results N --wing W --room R` | 模糊查詢（vector + bm25）                       | 11/13 rules §使用 Memory Palace；hotfix-checklist Step 0；audit-retro-coordination Step 0 |
| `wake-up`           | `mempalace wake-up`                                  | 跨 session L0+L1 上下文（~600-900 tokens）      | lead.md §s_memory_palace；init-workspace.mjs C-3；retro 定期審計                          |
| `palace.add_drawer` | `mempalace mine <path>`（自動 mine markdown）        | 新增 drawer（emergency；必同步寫 markdown SoT） | 情境 C 路徑 2                                                                             |
| `palace.read`       | （透過 search/wake-up 取）                           | 讀取已知 drawer                                 | lead.md 派發前查                                                                          |

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
  1. 提取需求關鍵詞（如「budget control」「telegram bot」）
  2. MCP call：palace.search(query="<keywords>", limit=5)
  3. 檢視 hits 的 drawer 內容 + cosine score
  4. 若 score ≥ 0.4 → 將相關 drawer ref 寫入 ROUTING_TICKET 的 `touched_files` 與 `relevant_tech_stacks`
  5. 若 score < 0.4（無強相關）→ 標 routing_ticket.memory_hint: 'no strong match'

範例 MCP call：
  tool: palace.search
  args: { query: "budget control daily limit", limit: 5 }
  expected: 5 drawers ranked by cosine + bm25
```

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

### 2.3 情境 C：新增 debug_graveyard 條目（採坑後）

```
觸發：sub-agent 完成踩坑分析（如 @Backend 發現 race condition）
動作（路徑 1：標準）：
  1. @Backend 寫 markdown 條目至 .agents/memory/debug_graveyard/DG-YYYYMMDD-NNN-<slug>.md
  2. 同步更新 INDEX.md
  3. 執行 mempalace mine .agents/memory/  → 增量採礦
  4. git commit（markdown SoT；vector store 自動同步）
  5. 通知 @Lead 完成

動作（路徑 2：emergency）：
  1. MCP call：palace.add_drawer(wing="memory", room="debug_graveyard", content="...")
  2. **必同步**寫對應 markdown（git audit；否則違反 SoT 治理）
```

### 2.4 情境 D：strategy_context 參數變更紀錄

```
觸發：User / @Lead 變更 workspace 敏感配置（strategyWeight / risk_limits / 等）
動作（**對齊 iron-rules/data-deletion-zero-tolerance.md** 流程後）：
  1. @Backend 執行變更後（取得 EXEMPTION_LOG 編號）
  2. 寫 markdown：.agents/workspaces/<ws>/memory/strategy_context/<param-name>.md
     - frontmatter 含 parameter / value_lives_in / related_modules
     - 變更歷史表新增一行（日期 / from→to / 原因 / 提案）
  3. 不存當前值（指針而已；當前值看 config 檔案）
  4. mempalace mine workspace memory
  5. git commit
```

### 2.5 情境 E：MCP server fail → fallback markdown grep（PROPOSAL_502_015 O-5 細化）

**偵測時機**（明文化；解 Sim-D S15）：

- A. 派發前 **probe**：`mempalace status` 1 sec timeout；失敗 → 直接走 fallback（不嘗試 search）
- B. 呼叫中 **fail-fast**：mempalace.search / wake-up 任一失敗 → 立即降級（不 retry）
- C. 持續 health-check：每 10 工作對話一次 status probe；自動偵測復活

**偵測流程**：

```
觸發：mempalace MCP tool 呼叫失敗（連線拒絕 / timeout / version mismatch）
動作：
  1. @Lead 偵測：MCP tool unreachable（probe / call fail）
  2. 通知 User：「Memory Palace MCP server 失聯；切換 markdown filesystem fallback」
  3. 退化為 grep markdown INDEX：
     - grep -r "<keyword>" .agents/memory/
     - grep -r "<keyword>" .agents/workspaces/<ws>/memory/
  4. ROUTING_TICKET 標：memory_mode: filesystem_fallback（PROPOSAL_502_013 M-4 schema）
  5. @Retro 後續審計觸發根因（每次 fallback 必審）
```

### 2.6 情境 F：Sub-agent 收 memory_mode: filesystem_fallback 行為（PROPOSAL_502_015 O-6 解 Sim-D S15）

sub-agent 接派發 ticket 含 `memory_mode: filesystem_fallback`：

| 動作                  | 行為                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| 派發前查 architecture | grep `.agents/memory/architecture/INDEX.md` 替代 mempalace.search                    |
| 查歷史踩坑            | grep `.agents/memory/debug_graveyard/INDEX.md` 替代                                  |
| 查 strategy_context   | grep `.agents/workspaces/<ws>/memory/strategy_context/` 替代                         |
| 寫新條目              | 仍寫 markdown SoT（同原流程；不依賴 MCP）；後續 mempalace mine 由復活後 auto-mine 補 |
| 自評                  | DoD 標 `memory_mode: filesystem_fallback`；@Retro 審計時納入                         |

**復活切回**（@Lead 偵測 mempalace status 恢復）：

1. 通知 User：「Memory Palace MCP server 已恢復；切回 mcp 模式」
2. ROUTING_TICKET 下一張 `memory_mode: mcp`
3. 觸發 `mempalace mine .agents/memory/` 補採礦 fallback 期間新增條目
4. 不需 retry 之前的 fallback 任務（已用 grep 替代成功）

## 3. 操作邊界

### 3.1 何時用 MemPalace（vs 手讀 markdown）

| 情境              | 推薦                       |
| ----------------- | -------------------------- |
| 派發前查模糊概念  | MemPalace search（vector） |
| 跨 session 上下文 | MemPalace wake-up          |
| 確切知檔名 / ID   | Read tool 直讀 markdown    |
| Git history 審計  | Read tool 讀 markdown SoT  |
| MCP server down   | filesystem fallback grep   |

### 3.2 治理原則

- **Markdown 是 SoT**：所有條目必有 markdown 檔案 + git commit
- **MemPalace 是查詢層**：自動 mine；不直接 API 寫（emergency 除外）
- **INDEX.md 仍維護**：人讀導航 + git diff 友善
- **vector embedding 黑箱**：不依賴內容可被 git review；改用 markdown diff

## 4. 絕對禁止

- **絕對禁止** 派發前未查 memory（MCP 或 fallback grep 必擇一）
- **絕對禁止** MCP server down 不通知 User 即靜默跳過 memory 查詢
- **絕對禁止** 透過 MCP API 寫 drawer 但不同步 markdown SoT（破壞 git audit）
- **絕對禁止** 修改 ChromaDB binary 檔案（資料庫崩潰）
- **絕對禁止** strategy_context 寫入當前數值（語意違反；指針 only）

## 5. 驗證

```bash
# 安裝確認
mempalace --version           # ≥ 3.3.4
which mempalace-mcp           # /usr/local/bin/mempalace-mcp

# Status
mempalace status              # 顯示 wings / rooms / drawers count

# 採礦
mempalace mine .agents/memory/
mempalace mine .agents/workspaces/<ws>/memory/

# 查詢測試
mempalace search "<keywords>" --results 5

# Wake-up
mempalace wake-up

# Validator（PROPOSAL_502_001 Phase A-7 待建）
node .agents/tests/memory-palace-validator.mjs
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
node .agents/tests/memory-palace-validator.mjs   # 應 0 errors / 0 warnings
```

### 6.3 AAAK Dialect 特性（壓縮基礎）

- **30x 密度**：將自然語言 drawer 壓成 AAAK 符號 token
- **語意保留**：壓縮後 vector embedding 保持 cosine 接近度（≥ 0.85）
- **不可逆**：壓縮 drawer 無法回復原文 → **markdown SoT 必保留**（git audit 仍可讀原文）
- **延遲攝取**：壓縮後首次查詢可能 +50-100ms（需重建 cache）

### 6.4 驗證 + 禁止

- ✅ 壓縮前 baseline + 壓縮後抽樣比對為**強制**步驟（任一缺失視為流程不完整）
- ✅ 壓縮失敗 → 立即 `mempalace reconnect` 並回報 @Retro
- ❌ **絕對禁止** 壓縮 markdown SoT 檔案（只壓 vector store 內部 drawer；markdown 永保原文）
- ❌ **絕對禁止** drawer count > 5000 仍持續派發新工作（先 compress 再派發）

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
