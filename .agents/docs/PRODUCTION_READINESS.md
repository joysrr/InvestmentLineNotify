# Production Readiness Checklist

> **文件分層**：framework（跨專案通用 on-call 文件）
> **類別**：framework-docs（`.agents/docs/` 層）
> **維護者**：`@Retro`（透過 RULE_UPDATE_PROPOSAL）
> **對齊**：`RULES_DESIGN_GUIDE §二十 文件分層三原則`
> **歷史範例**：本檔提及 `strategyWeight`（IMN 專案歷史敏感配置；其他專案請對應自身敏感配置如 `trading_policy` / `risk_limits`；參 workspaces 對應欄位）

由 PROPOSAL_20260501_004 Phase 6 建立。agents 框架上線前必逐項確認；on-call 文件用於緊急事件處理。

---

## 1. 上線前必檢清單（Pre-Launch Checklist）

### 1.1 Validator 健康（15 validators 必全綠；PROPOSAL_502_018 R-5 校準）

```bash
bash .agents/tests/run-all.sh
# 期望：✅ All validation passed (15 validators 全 0)
# 例外：rule_token 可有 ≤ 1 warning（data-deletion-zero-tolerance 696 > warn 600；KI-001 allowlist 後計 0；可接受）
```

15 validators 包含（PROPOSAL_502_018 R-5 校準；原 14 少算 scripts）：
schema / intent / workspace / drift / ref / sync / loc / index_drift / proposal_scope / tech_stack / rule_token / routing_ticket / iron_theme / **memory_palace** / **scripts**（L1 unit + L3 smoke）。

### 1.2 Drift Score（≥ 0.85）

```bash
node .agents/tests/agent-drift-simulator.mjs
# 期望：drift_score ≥ 0.85（baseline 0.883）
# 三項分數：
#   persona_stability ≥ 0.70
#   instruction_accuracy ≥ 0.80
#   boundary_adherence ≥ 0.85
```

### 1.3 Iron Theme 雙向一致

```bash
node .agents/tests/iron-theme-validator.mjs
# 期望：0 errors / 0 warnings（6 themes × applies_to 全對）
```

### 1.4 ADR 完整性

```bash
ls .agents/decisions/00*.md | wc -l   # 期望 ≥ 38
node .agents/tests/adr-validator.mjs    # warning mode；非 BLOCKER
```

### 1.5 Memory Palace 健康（MemPalace primary backend；ADR-0039）

```bash
node .agents/tests/memory-palace-validator.mjs
# 期望：0 errors / 0 warnings
# 驗證項：
#   - mempalace ≥ 3.3.4 已安裝
#   - mempalace-mcp 命令可達
#   - palace 已 init + 至少 1 drawer
#   - .mcp.json 含 mempalace server 註冊
#   - markdown SoT 結構完整（debug_graveyard/INDEX.md）
#   - workspace memory rooms + INDEX（若 active；4 rooms per Wing）

# 採礦狀態：
mempalace status         # 期望：≥ 25 drawers（debug_graveyard 16 + general 9）
mempalace search "test"  # 期望：返回 hits
mempalace wake-up        # 期望：~600-900 tokens 上下文
```

**MemPalace down 時 fallback**：

- 退化讀 markdown filesystem：`.agents/memory/` + `workspaces/<ws>/memory/` INDEX.md
- 通知 User + ROUTING_TICKET 標 `memory_mode: filesystem_fallback`

### 1.6 PENDING_ACTIONS.md 健康

- [ ] 檔案存在 + YAML 合 schema
- [ ] §🎯 [CURRENT_STAGE] 5 欄位齊全
- [ ] 🔴 區塊為空（或計數合理）
- [ ] 已寫入最新 .bak（@Assistant 巡邏自動）

### 1.7 ROUTING_TICKET 流程

- [ ] 派發前必先寫 ROUTING_TICKET.md（lead-state-anchor.md 鐵律 3）
- [ ] schema validator 通過
- [ ] 無多筆同時開（單一活躍 ticket）

### 1.8 Pre-commit Hook（選用）

- [ ] `.claude/settings.local.json` 已 cp 自 .example（若啟用）
- [ ] hook command 經 stdin/jq 路徑（B-8 修正後合約）
- [ ] 測試一次 git commit 驗 fast 模式觸發

### 1.9 Workspace（若已配對專案）

- [ ] `.agents/CURRENT_WORKSPACE` 內容指向有效 workspace
- [ ] workspace 檔 schema 合 PROPOSAL_20260422_002
- [ ] TECH_STACK / PROJECT_CONTEXT / FUNCTIONAL_DOMAINS / CRITICAL_PATHS 完整

### 1.10 ADR-0038 Tier 一致

- [ ] 13 rules 全有 `rule_category` 欄位
- [ ] 0 rule 含 `token_budget_exception`（已廢止）
- [ ] SYSTEM_THRESHOLDS.yaml `rule_token_thresholds.tier` 三層 + iron_theme 完整

---

## 2. 上線後 First 100 Conversations 風險清單

依 first conversations 高機率出現的 issue 預警：

| 風險                              | 觸發                                         | 緩解                                                                                                                          |
| --------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| @Lead 直接寫程式                  | 模糊指令；lead.md §s10 規範未執行            | system-prompt §唯一鐵律阻斷；違反 → 立刻向 User 說明角色限制                                                                  |
| ROUTING_TICKET 未寫即派發         | 三鐵律 #3 未守                               | routing-ticket-validator 偵測；@Lead 三鐵律累 ≥ 3 觸阻斷條件一                                                                |
| PENDING_ACTIONS.md 損毀           | 編輯競態 / 編輯器中斷                        | tasks/pending-actions-recovery.md 三策略                                                                                      |
| Sub-agent 越界（@Reviewer 審 SC） | 平行審查邊界違反                             | iron-rules/parallel-review-boundary 防線 1；@Lead 判定無效                                                                    |
| 派發訊息含 ticket 以外細節        | 三鐵律 #3 衍生                               | 無自動偵測；reviewer 提醒；retro 巡邏                                                                                         |
| 非 5 級符號出現於通知             | 自創 emoji                                   | 對齊 ADR-0030；reviewer 退件                                                                                                  |
| Hotfix bypass 4 零容忍            | 緊急情境想跳 User 確認                       | iron-rules/data-deletion-zero-tolerance + system-prompt §條件 3 「Hotfix 不豁免」                                             |
| @Lead 連續派發失敗                | sub-agent 無回應 / 規格矛盾                  | system-prompt §條件 1 阻斷；Hotfix 豁免重試 1 次                                                                              |
| 單次 sub-agent timeout / 無回應   | API 抖動 / 模型超時（< ≥3 累積；非全局阻斷） | @Lead **重試 1 次** → 仍失敗 → 升級 User 說明（與 ≥3 累積 dispatch failure 全局阻斷分離）；SLA：5 min（PROPOSAL_502_009 I-3） |

---

## 3. Monitoring Dashboard 設計（建議）

### 3.1 即時健康指標

| 指標                | 來源                    | 健康閾值                    |
| ------------------- | ----------------------- | --------------------------- |
| drift_score         | agent-drift-simulator   | ≥ 0.85                      |
| schema_warnings     | schema-validator        | ≤ 1                         |
| pending_red_count   | PENDING_ACTIONS.md grep | ≤ `PENDING_RED_EXPIRE` (2)  |
| 最近巡邏時間        | @Assistant log          | < `PATROL_OVERDUE` (5 對話) |
| iron-theme 雙向一致 | iron-theme-validator    | 0 errors                    |

### 3.2 累積指標（每週）

| 指標                  | 來源                        | 警示閾值                                |
| --------------------- | --------------------------- | --------------------------------------- |
| token_budget warnings | rule-token-budget-validator | > 3 連續週 → 立 lite proposal 重評 tier |
| 提案 OPEN 數          | proposals/active count      | ≥ `PROPOSAL_OPEN_WARN` (15)             |
| 反覆問題（@Retro）    | retro.md §s04 第 3 次警告   | ≥ 1 → 暫停 + User 介入                  |

### 3.3 災後審計指標

| 指標                     | 來源                   | 目標                   |
| ------------------------ | ---------------------- | ---------------------- |
| EXEMPTION_LOG 條目       | AUDIT_HISTORY.md       | 每月 ≤ 3（避免常態化） |
| 全局緊急阻斷觸發次數     | system-prompt 觸發 log | 每月 ≤ 1               |
| PENDING_ACTIONS recovery | recovery task 觸發     | 每月 ≤ 1（罕見事件）   |

---

## 4. 災後 Recovery Playbook

### 4.1 Validator Fail Recovery

**症狀**：pre-commit hook 阻斷 commit（exit 2）

```
Step 1: bash .agents/tests/run-all.sh                  # 確認哪 validator fail
Step 2: bash .agents/tests/run-all.sh --validator <X>  # 單獨跑該 validator 看細節
Step 3: 修復對應檔案
Step 4: 重跑 validator 確認綠
Step 5: 重 commit
```

**緊急 bypass**（僅 Hotfix）：`git commit --no-verify`（會被 PROPOSAL_20260423_012 §s06 SCRIPT_UNDERUSE 警示）

### 4.2 Drift Score Drop Recovery

**症狀**：`agent-drift-simulator` drift_score < 0.85

```
Step 1: --verbose 看 3 項分數
Step 2: 找 boundary_adherence < 0.85（最常見原因）
Step 3: grep "絕對禁止" 確認 rules + iron-rules 數量未減
Step 4: 對比 git log 找最近 commit；revert 候選
Step 5: 若無法快速找根因 → 派 @Retro 任務 RETRO_DRIFT
```

### 4.3 PENDING_ACTIONS.md Corruption Recovery

依 `tasks/pending-actions-recovery.md` 三策略：

- **A** .bak 還原（首選；< 1 工作對話）
- **B** ROUTING_TICKET 重建（部分歷史損失）
- **C** 完全重建（重大事件；@Retro 必審）

### 4.4 Multi-Agent Deadlock Recovery

**症狀**：@Reviewer + @Security 反覆退件達 REVIEW_CYCLE_LIMIT

```
Step 1: iron-rules/parallel-review-boundary §4 防死鎖
Step 2: 達上限 → 強制阻斷審交流程 + 產 REVIEW_QUALITY 🔴
Step 3: 決策權交還 User（不再自動仲裁）
Step 4: User 決策後重啟（可能：放寬規格 / 縮減需求 / 重新設計）
```

### 4.5 MemPalace ChromaDB Corruption Recovery（ADR-0039）

**症狀**：`mempalace status` / `search` 失敗；ChromaDB binary 損毀

```
Step 1: 切換 hybrid fallback
  - @Lead 通知 User：「Memory Palace MCP 失聯；切換 markdown filesystem mode」
  - ROUTING_TICKET 標 memory_mode: filesystem_fallback

Step 2: 嘗試 repair
  - mempalace repair                     # 重建 vector index（legacy mode）
  - mempalace repair --mode max-seq-id   # un-poison max_seq_id rows

Step 3: 若 repair 失敗 → 完全 re-init
  - 備份 ~/.mempalace/palace/ → /tmp/palace-corrupted-backup/
  - rm -rf ~/.mempalace/palace/
  - mempalace init .agents/memory --no-llm --yes --auto-mine
  - mempalace mine .agents/workspaces/<ws>/memory/

Step 4: 驗證
  - node .agents/tests/memory-palace-validator.mjs   # 應 PASS
  - mempalace search "<關鍵詞>"                       # 應命中已採礦條目

Step 5: @Retro 後續審計
  - 標 P-XX MEMORY_PALACE_CORRUPTED 通知
  - 強制根因分析（ChromaDB 故障 / 磁碟壞 / version mismatch / etc）
```

**預防措施**：

- 定期 `cp -r ~/.mempalace/palace /backup/palace-$(date +%Y%m%d)`（每週）
- markdown SoT 完整保留（worst case 從零 re-mine）

### 4.6 全局緊急阻斷觸發 Recovery

**症狀**：system-prompt §條件 1/2/3 觸發

```
條件 1（@Lead 派發失敗 ≥ 3）:
  - Hotfix 豁免：重置計數一次重試
  - 若再失敗 → User 直接介入

條件 2（PENDING_ACTIONS 🔴 過期）:
  - Hotfix 豁免：旁路 + EXEMPTION_LOG + 24h 補處理
  - 損毀情境 → 走 4.3

條件 3（4 零容忍）:
  - Hotfix 不豁免
  - 必逐項取 User 字面授權再執行
```

恢復共通動作：

1. blocking-notification-schema.md type 4 格式輸出狀態摘要
2. 等 User 明確指令「系統恢復」/「繼續執行」
3. EXEMPTION_LOG 記一條（即使非豁免；災後審計）
4. @Retro 後續審計觸發根因（每次必）

---

## 5. Hotfix Scenario Walkthroughs（3 典型情境）

### 5.1 情境 A：API Webhook 簽章漏洞（SC-06 / Heavy）

```
T+0 User 通報：webhook 收到無效 signature 仍處理
   ↓
T+1 @Lead 派發 Hotfix:YES + Complexity-Tier=heavy + Tier-Reason=SC-06 + Incident-Context (YAML)
   ↓
T+5 @Backend + @Reviewer 診斷組（雙簽 5 步）→ DIAGNOSIS_NOTE.md
   ↓
T+15 @Backend 修復 → @Reviewer + @Security 平行審查（SC-06 觸發 6.5）
   ↓
T+25 兩審通過 → @QA 核心路徑驗證 → 24h 內補完整 TEST_REPORT
   ↓
T+30 @Lead Hotfix Gate Check（4 條件）→ 完成
   ↓
T+24h 內：@Assistant 巡邏 P-21 檢查 light 誤用 → 補處理舊 🔴
```

### 5.2 情境 B：strategyWeight 緊急回滾（光是觸發條件 3）

User 發現 strategyWeight 異動造成生產問題；需立即回滾：

```
T+0 User 字面授權：「授權執行 strategyWeight 回滾至 commit X」
   ↓ （條件 3 觸發；Hotfix 不豁免；逐項取授權）
T+1 @Lead 派發 Hotfix:YES + 含完整 Incident-Context
   ↓
T+5 @Consultant 跳過（已 User 授權）；@Lead → @Backend 直接執行
   ↓
T+10 @Backend git revert <hash>；EXEMPTION_LOG 記錄
   ↓
T+15 schema-validator + drift 重跑 → 確認無退化
   ↓
T+20 @Reviewer + @Security（SC-03 觸發）平行審
   ↓
T+30 完成 → 24h 內 @Retro 根因分析（強制）
```

### 5.3 情境 C：PENDING_ACTIONS.md 編輯器中斷損毀（恢復路徑）

```
T+0 @Lead 第一動作讀 PENDING_ACTIONS.md → 解析失敗
   ↓
T+1 偵測 .bak 存在（時間戳 5 分鐘前）
   ↓
T+2 提示 User：「PENDING_ACTIONS 損毀；建議從 .bak 還原」
   ↓
T+3 User 確認 → cp .bak PENDING_ACTIONS.md
   ↓
T+5 @Lead 重讀 §🎯 [CURRENT_STAGE] → 恢復 Workflow
   ↓
T+10 @Assistant 寫新 .bak
   ↓
T+15 @Retro 標 P-XX RECOVERY_DONE 通知
```

---

## 6. 上線確認簽核

| 角色                | 簽核 | 日期 |
| ------------------- | ---- | ---- |
| User                | 待簽 | —    |
| @Architect 設計確認 | 待簽 | —    |
| @QA 上線測試確認    | 待簽 | —    |
| @Security 安全簽核  | 待簽 | —    |

> 全 6 維度（1.1-1.10）達標 + 所有簽核完成 → agents 框架可上線。

---

## 7. 上線後監測週期

- **Day 1**：每 1 工作對話 review（高頻 first impressions）
- **Day 2-7**：每 3 工作對話 review（穩定期觀察）
- **Week 2-4**：@Auditor 每 `AUDIT_INTERVAL` (10) 評分 + @Retro 週期審計
- **Month 1**：first formal retrospective + drift trend 檢視

## 8. Related Decisions

ADR-0001 / 0005 / 0006 / 0007 / 0008 / 0010 / 0011 / 0013 / 0014 / 0030 / 0036 / 0037 / 0038 — 全在 `.agents/decisions/`。

PROPOSAL_20260501_004 為本 checklist 建立依據。
