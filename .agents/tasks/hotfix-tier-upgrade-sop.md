<!-- MACHINE_READABLE
type: task
category: F1
id: hotfix-tier-upgrade-sop
related_proposals: [PROPOSAL_20260502_040]
related_decisions: [ADR-0008]
load_when: "sub-agent 執行 hotfix-light task 中途發現需升級 heavy 時"
-->

# Task: Hotfix Tier 升級 SOP（light → heavy 中途升級）

> 由 PROPOSAL_502_040 建立。解 Round 2 報告主題 C 的 5 個邊界（觸發者 / in-flight 修改 / autonomy 變更 / pending_group 跨 ticket / telemetry 累計）。
>
> **真實場景**：@Backend 接 hotfix-light task；診斷後發現需跨檔修改 + 觸發 SC-06 TOCTOU → 應升 heavy。

## §1 升級觸發條件（sub-agent 自我偵測）

執行 hotfix-light 期間出現以下任一 → **立即停 + 觸發升級流程**：

1. **SC-01~10 任一觸發**（原 evaluation false 但執行期發現）
   - 例：原以為純 typo；實際牽涉 i18n key 改動 + 影響金融警語顯示
2. **D-Risk（資料破壞性）任一觸發**
3. **跨檔範圍超過 3 檔**（含修改 + 連帶測試檔）
4. **發現需修改 strategyWeight / 金鑰 / Rules / 資料刪除 邏輯**
5. **預估 LOC > 200**（hotfix-light 邊界）

## §2 升級 SOP 5 步驟

### Step 1: Sub-agent 立即停 + telemetry 寫入（GR-C2 in-flight 處理）

Sub-agent **絕對禁止繼續修改**；立即執行：

```yaml
# === RUNTIME_TELEMETRY (append-only; written by @<sub-agent> at <ISO8601>) ===
gitnexus_probe: <值>
gitnexus_used: <bool>
elapsed_ms: <int>
tier_upgrade_required: heavy # GR-C2 觸發升級訊號
tier_upgrade_reason: "<觸發條件 § 編號 + 一句說明>"
in_flight_changes: # in-flight 修改快照（PROPOSAL_502_043 R3-C4 enum 對齊 git；R3-D1 拆雙 revert_safe）
  - file: <path>
    status: working_tree | staged | committed # git unstaged / staged / committed 三態精確
    technical_revert_safe: <bool> # 技術可逆性（git checkout / reset 是否乾淨；1 行 diff = true）
    business_impact_revert_safe: <bool> # 業務影響可逆性（動了會影響其他頁面 / 流程 → false）
    # 任一 false → @Lead 須 user 仲裁；皆 true 才自動 cancel
```

然後 **status: paused**（新狀態 enum；非 completed / cancelled）。

### Step 2: @Lead 接 paused → 評估 + 派新 heavy ticket

**主動偵測 trigger**（PROPOSAL_502_043 R3-D2；P-36 強制；非 optional）：P-36 PAUSED_TICKET_STALE 1h 🟡 / 4h 🔴；@Lead 派發前 batch 加第 5 探測「grep ROUTING_TICKET status=paused」。

@Lead 偵測 paused：

1. Read ticket runtime_telemetry → 看 tier_upgrade_required + reason + in_flight_changes
2. 若 `in_flight_changes` 含 `technical_revert_safe: false` 或 `business_impact_revert_safe: false` 任一 → 暫停派發；發 PENDING `TIER_UPGRADE_REVERT_DECISION` 🔴 等 user 仲裁；**孤兒 PENDING 歸屬**（PROPOSAL_502_043 R3-D4）：寫 `pending_group: GRP-orphan-<舊 ticket_id>-tier-upgrade`；P-31 24h 計時 anchor = paused 寫入 ISO timestamp
3. 全 revert_safe（technical AND business 皆 true）→ 自動 cancel 舊 ticket + 派新 heavy ticket + **必發 🟢 通知 `HOTFIX_TIER_UPGRADED`**（PROPOSAL_502_043 R3-D3；P-37；解 hotfix「事故 user 必知」精神）
4. 新 ticket frontmatter：
   ```yaml
   superseded: <舊 ticket_id> # GR-C3
   pending_group_inherited_from: <舊 ticket pending_group 或 null> # GR-C4 + R3-F1 null 場景
   context_carryover_summary: # PROPOSAL_502_043 R3-D5 改 multi-line block；非 1 行
     prior_changes: "<舊 ticket 已完成的修改摘要>"
     prior_business_impact: "<已動的影響面>"
     prior_revert_status: "<technical_safe + business_safe>"
   ```

### Step 3: autonomy_mode 變更（GR-C3）

新 heavy ticket：

- autonomy_mode = `gate-at-impl`（hotfix-heavy v7.12 default；非舊 step-by-step）
- 派發訊息含 `Context-Carryover-From: <舊 ticket_id>`：1 行摘要舊 ticket 已完成的部分（avoid context stale）

### Step 4: pending_group carry-over（GR-C4）

- 舊 ticket pending_group 內未關 PENDING **不孤兒**：自動 carry 至新 ticket pending_group
- 新 ticket pending_group_inherited_from 欄位記錄來源
- P-31/P-32/P-33 巡邏：偵測 `pending_group_inherited_from` 非空 → 24h 計時從**升級時間點**起算（非舊 ticket 創建時間）

### Step 5: telemetry 跨 ticket 累計（GR-C5）

新 heavy ticket 完成時 telemetry 寫：

```yaml
prior_ticket_telemetry_carryover: true
prior_ticket_id: <舊 ticket_id>
prior_ticket_probe_history: [<舊 telemetry.gitnexus_probe>] # 用於 P-34 連續累計
```

P-34 巡邏：偵測 `prior_ticket_telemetry_carryover: true` → 跨 ticket 連續 probe 失敗計數合併（不歸零）

## §3 status: paused 新狀態定義

加入 `routing-ticket-protocol §schema status enum`：

```
status: dispatched | acknowledged | completed | cancelled | paused | timeout | retried | failed
                                                            ^^^^^^^^
                                                            PROPOSAL_502_040 新增
```

paused 狀態行為：

- @Lead 偵測 paused → 進 §2 Step 2 SOP
- @Assistant 巡邏 P-X（新建可選）：偵測 paused 超 1h 無 @Lead 處理 → 🟡 提醒
- archive 規則：paused 不直接 archive；必先升級為新 ticket（cancel 舊）才 archive

## §4 鐵律

- ❌ **絕對禁止** sub-agent 自行升級 task_class / autonomy_mode（修改既存 ticket）；必走 paused → @Lead 重派
- ❌ **絕對禁止** @Lead 在 in_flight_changes 含 revert_safe=false 時自動 cancel；必先 user 仲裁
- ❌ **絕對禁止** 新 heavy ticket 漏寫 superseded 欄位（破壞 audit trail）
- ✅ pending_group_inherited_from 為 single source of truth；不複製 pending 條目本身

## §5 與既有規範對齊

- `routing-ticket-protocol §schema status enum` 加 `paused`
- `routing-ticket-protocol §五 鐵律` 加：「append-only 例外白名單擴：tier_upgrade_required telemetry append 視為合法」
- `tasks/hotfix-checklist.md` Step 0 末加 cross-link：「執行期發現需升級 → 走 `tasks/hotfix-tier-upgrade-sop.md`」
- `patrol-notification-catalog` P-34 reset 規則 step (c) 已涵蓋跨 ticket carry-over

---

**維護紀錄**：

- 2026-05-07：PROPOSAL_502_040 建立（5 邊界全包）

## Related Decisions

- ADR-0008（Hotfix 雙軌）— 本 SOP 為其運行期升級流程補充
