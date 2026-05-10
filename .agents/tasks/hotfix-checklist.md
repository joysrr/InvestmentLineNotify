---
task_id: hotfix-checklist
file_type: playbook
owner: @Lead + @Backend
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  Hotfix Step 0 五步驟 + A/B 雙路徑（light / heavy）；對齐 ADR-0008
referenced_by:
  - rules/security.md
  - rules/frontend.md
  - rules/lead.md
  - rules/backend.md
  - skills/diagnostic-playbook.md
  - skills/lead-context-mappings.md
---

# Task: Hotfix 緊急修復確認清單

## 適用情境

僅限於生產環境發生嚴重異常、排程停擺、或 User 明確下達「緊急/Hotfix」指令時使用。

## 執行步驟與檢核點 (Checklist)

### Step 0: 複雜度判定 + 上下文注入 + SC/D 評估 (由 @Lead 執行；依 PROPOSAL_20260423_009 分輕重)

- [ ] **Memory Palace 歷史 incident 查詢**（ADR-0039；先於上下文注入）：`mempalace.search "<事故關鍵詞>"` 查 debug_graveyard 同類事故 → 若命中歷史條目 → 列入 Incident-Context.related_incidents（避免重蹈；流程 `skills/memory-operations.md §2.1`）
- [ ] 讀取 workspace 關鍵欄位並打包為 `Incident-Context`：
- [ ] `CRITICAL_PATHS.*`（事故涉及的關鍵路徑）
- [ ] `DEPLOYMENT_CONSTRAINTS.*`（資源限制）
- [ ] `BUSINESS_RULES`（業務規則摘要）
- [ ] `PATHS.source_modules.*`（相關源碼模組）
- [ ] 識別相關 `tech-stacks/*.md`
- [ ] **SC 評估**（`RULES_DESIGN_GUIDE §十九.C`）：SC-01~10 是否觸發？
- [ ] **診斷組評估**（§十九.B）：D1-D4 是否觸發？
- [ ] **複雜度判定**（依 §十九.G 分流決策表；預設 heavy，全例外才 light；PROPOSAL_021 強化 `hotfix_tier` 必填）：

```yaml
hotfix_tier: light | heavy # 必填（PROPOSAL_021）；對應 SYSTEM_THRESHOLDS.force_complex_scenarios.Hotfix heavy/light
complexity_tier: light | heavy # 同 hotfix_tier；保留向後相容
tier_reason: "<一句話>"
sc_triggered: [] # 任一非空 → 強制 hotfix_tier=heavy（自動覆蓋）
d_triggered: [] # 任一非空 → 強制 hotfix_tier=heavy（自動覆蓋）
light_bypass_reason: "<若 light 必填；說明為何豁免診斷組 + 雙簽>" # PROPOSAL_502_023 C-11
token_budget_actual: <int> # 完成後填；統計用（PROPOSAL_502_023 C-9 量化基準收集）
```

**強制檢查**（PROPOSAL_021）：

- 缺 `hotfix_tier` 欄位 → 派發中止；@Assistant P-19 🟡 通知
- `hotfix_tier=light` 但 `sc_triggered` / `d_triggered` 任一非空 → 🔴 違規；必改 heavy
- 派發訊息的 `Complexity-Tier` 必與此 `hotfix_tier` 完全一致

判定規則：

- 任一 SC 觸發 → `heavy`（鎖定；無例外）
- 任一 D 觸發 → `heavy`
- 跨檔 / 業務邏輯 / state 變更 → `heavy`
- 純 typo / 設定常數 / cron 字串 + SC/D 全否 + 單檔 → `light`
- 不確定 → `heavy`（保守）

- [ ] **根據 tier 選擇執行路徑**：
- 🟢 `light` → 跳到 **Step A1**（A 路徑 3 步）
- 🔴 `heavy` → 繼續 **Step 1**（B 路徑 5 步；對齊 PROPOSAL_003 三支柱）
- [ ] 派發訊息含 `Incident-Context` + `SC-Evaluation` + `Complexity-Tier` + `Tier-Reason`

---

## 🟢 A 路徑：輕量路徑 (light；3 步驟；依 §3.2.A)

### Step A1: 修復實作 (由 @Backend / @Frontend 執行)

- [ ] 單檔內修復（嚴禁跨檔；發現需跨檔 / SC/D 觸發 / LOC>200 → 走 `tasks/hotfix-tier-upgrade-sop.md` 5 步驟 SOP；不直接重走 Step 0；PROPOSAL_502_040）
- [ ] 修復說明單行敘述（< 50 字）

### Step A2: @Reviewer 快速審查

- [ ] 確認確實為 typo 級變更
- [ ] 確認無意外牽動其他模組

### Step A3: @Lead Gate Check（3 條件）

- [ ] 修復說明單行敘述已產出
- [ ] @Reviewer 結論「通過」
- [ ] 事後補文件**可免**（light 專屬豁免）

**light 路徑禁止項**：

- ❌ 跳過 Step 0 複雜度判定
- ❌ 用於 SC/D 任一觸發場景
- ❌ 擴充範圍至跨檔 / 業務邏輯（違者必升級 heavy）

**→ light 路徑完成；跳過 B 路徑與下方事後收尾的 `@Retro` 根因入列（僅 D3 觸發才記錄）。**

---

## 🔴 B 路徑：重型路徑 (heavy；5 步驟；對齊 PROPOSAL_20260423_003 三支柱)

### Step 1: 診斷階段 (由 @Backend / @Frontend 執行；D1-D4 觸發時 @Reviewer 加入診斷組；mode-aware：serial 同對話兩視角依序 / parallel Claude Code opt-in 雙 sub-agent)

- [ ] 依 `skills/diagnostic-playbook.md` 五步 SOP 執行：
- [ ] Step 1.1 收集現象（錯誤訊息 / 日誌 / 重現步驟）
- [ ] Step 1.2 最小重現
- [ ] Step 1.3 二分法定位（git log / git bisect）
- [ ] Step 1.4 根因假設驗證（**≥ 2 假設** + 證據比對）
- [ ] Step 1.5 影響範圍評估（同樣根因是否在其他模組 / 是否 SC 敏感）
- [ ] 產出 `docs/plans/diagnosis/<事故名稱>.md`
- [ ] **診斷組共識簽核**（若 D1-D4 觸發）：實作者 + @Reviewer 雙簽（serial mode：同對話內 @Lead 先請實作者出診斷、再請 @Reviewer 複核；parallel mode：Claude Code 可派兩 sub-agent 並行；DoD 等價）
- [ ] 定位問題根因，並確保修復範圍 **最小化**（嚴禁夾帶重構或其他不相關的新功能）

### Step 2: 修復實作 + 審查 (由 @Backend / @Frontend 實作；@Reviewer + 條件式 @Security 審查；mode-aware：serial 同對話依序 / parallel Claude Code opt-in)

- [ ] 依 `DIAGNOSIS_NOTE.md § 六 修復範圍` 執行修復
- [ ] 針對引發錯誤的極端數據或 Edge Case，必須在程式碼中加入 Fallback (防呆) 處理
- [ ] 產出修復說明，提交 PR 或修改
- [ ] **@Reviewer 快速審查**：
- [ ] 檢視修改的程式碼，確認不會引發新的 Memory Leak 或無窮迴圈
- [ ] 確認修復邏輯沒有破壞現有架構的安全性（如 Telegram `initData` 驗證）
- [ ] **@Security 條件式審查**（若 Step 0 判定 SC 觸發，依 `RULES_DESIGN_GUIDE §十九.C`）：
- [ ] 依 `skills/security-audit.md §1` SC-XX 對應範疇執行快速審查
- [ ] 結論「通過」且無 🔴 BLOCKER 才進入 Step 3

### Step 3: 核心路徑回歸 (由 @QA 執行)

- [ ] 不需執行全系統測試。僅針對「被修改的模組」及其「直接相依的核心路徑」進行驗證。
- [ ] 確認錯誤已排除，且應用程式/機器人可正常啟動與回應。

### Step 4: Hotfix Gate Check (由 @Lead 執行；依 PROPOSAL_20260423_003 擴充為 4 條件)

- [ ] 修復說明已產出，範圍已限縮
- [ ] @Reviewer 審查通過
- [ ] @QA 核心路徑驗證通過
- [ ] **若 SC 觸發，@Security 審查通過**（新增條件）

### 🚨 事後收尾 (由 @Lead 追蹤)

- [ ] 任務上線後，必須建立一個 Ticket 標記為 `[Docs Update Pending]`，交由 `@Planner` 與 `@Architect` 在正常工作流中補齊遺失的架構文件更新
- [ ] 若觸發 D3（24h 內同模組第 2 次 Hotfix）→ 通知 `@Retro` 執行根因提案
- [ ] 將 `DIAGNOSIS_NOTE.md` 保留於 `docs/plans/diagnosis/`（永久保留供未來類似事故參考）

---

## Related Decisions

- [ADR-0008](../decisions/0008-hotfix-dual-track.md) — Hotfix 雙軌流程
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
- [ADR-0012](../decisions/0012-diagnostic-team.md) — 診斷組機制（D1-D4）
