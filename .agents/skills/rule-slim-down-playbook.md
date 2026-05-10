---
skill_id: rule-slim-down-playbook
file_type: playbook
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_001
purpose: |
  Rule slim-down 工作的完整手冊；subagent 執行單一 rule 瘦身時必讀。
  套用 ADR-0036 的 4 patterns + 決策矩陣 + 自驗收三層。
referenced_by:
  - rules/lead.md # 試點
  - decisions/0036-rule-decomposition-patterns.md
related_decisions:
  - ADR-0036
  - ADR-0022 # rules frontmatter（不得改）
---

# Skill: Rule Slim-down Playbook

> 本檔為 subagent 執行 PROPOSAL_20260501_001 Phase B-D 的工作手冊。**先讀完整檔再開工**。

---

## 一、先決條件（讀完才有資格動手）

1. ADR-0036 — 4 patterns + 決策矩陣
2. ADR-0022 — rules frontmatter schema（不可改）
3. 目標 rule 當前內容（讀完整檔；prefer 一次讀完不分批）
4. `tests/schema-validator.mjs` budget：agent_rule=1000 / always_on=500
5. 當前 drift_score（不可退化）：`node tests/agent-drift-simulator.mjs`

## 二、工作流（5 步驟）

### Step 1：量測 + 規劃

```bash
# 取得當前 token / 行數
wc -c rules/<target>.md
node tests/schema-validator.mjs --file rules/<target>.md
```

計算需削減量 = 當前 token - 目標 budget（agent_rule=1000）。

**規劃表**（subagent 必填，存於 commit message 或 PR body）：

| § ID              | 當前行數 | 性質            | Pattern   | 流向           | 預估削減   |
| ----------------- | -------- | --------------- | --------- | -------------- | ---------- |
| s01               | 12       | 身份宣告        | 保留      | rule           | 0          |
| s_complexity_lane | 24       | 流程細節 + 鐵律 | P-1 + P-3 | skill + 表格化 | -800 bytes |
| ...               |          |                 |           |                |            |

合計預估削減 ≥ 需削減量 + 20% 安全邊際。

### Step 2：套 Patterns（依 ADR-0036）

依規劃表執行：

#### P-1（Reference Pull-up）執行手序

1. 確認接收 skill 是否存在；無則新建（命名：`skills/<agent>-<topic>.md`）
2. 將 rule 內細節整段複製到 skill 對應 § 或新 §
3. rule 內保留：§ 標題 + 1 行入口（"完整 X：skills/Y.md §Z"）+ 鐵律
4. 跑 `ref-validator` 確認新 ref 可解

#### P-2（Skeleton/Flesh Split）執行手序

1. 找出「為何 / 歷史 / 範例」段落（含「曾經」「設計時」「例如」「歷史上」字眼）
2. 「為何」段 → 對應 ADR `## Notes` 段落
3. 「歷史」段 → `memory/Strategy_Context_Room.md` 新增條目（依 schema）
4. 「範例」段 → `skills/<agent>-examples.md`（無則新建）
5. **自足性測試**：刪除後讀 rule 是否仍能完成任務？否 → 不抽

#### P-3（Iron Rule Compression）執行手序

1. 找 ≥ 5 條「絕對禁止」/「鐵律」清單
2. 表格化（| Type | Trigger | Penalty |）
3. 重複前綴消除（同前綴合併）
4. **immutable section** 必須**保留原文不改詞**（僅換成表格 = 不允許；保留 list 形式）

#### P-4（Cross-Reference Deduplication）執行手序

1. grep 重複 `decisions/` / `RULES_DESIGN_GUIDE §`
2. 出現 ≥ 3 次 → 收斂至 footer `## Related Decisions`
3. inline ref 改短形（`ADR-0010` 不重複完整路徑）
4. critical / immutable section 保留 inline ref（讀者必須現場知依據）

### Step 3：自驗收三層（必通過才能 commit）

#### 3.1 靜態驗收

```bash
node tests/schema-validator.mjs --file rules/<target>.md
# 期望：0 warnings（token ≤ 1000）

node tests/rule-token-budget-validator.mjs
# 期望：本檔不在 warning list

bash tests/run-all.sh --validator ref
# 期望：通過（所有 ref 可解）
```

#### 3.2 動態驗收（drift 測試）

```bash
node tests/agent-drift-simulator.mjs --verbose
# 期望：drift_score ≥ 0.85；persona_stability 不退化
# 若 drift_score < 0.85 → 還原該 commit（git reset --hard HEAD）
```

#### 3.3 自足性測試（人工或 subagent 自證）

1. 假設讀者**沒讀任何 skill / ADR**
2. 只看 slimmed rule 能否：
   - 知道自己是誰（身份）
   - 知道何時派工 / 何時禁止
   - 知道遇 violation 該做什麼
3. 若 ≥ 1 點不滿足 → 抽走的段落是骨架；回填

### Step 4：immutable diff 檢查

```bash
git diff HEAD~1 rules/<target>.md | grep -A 5 'immutable="true"'
```

若 immutable section 內容有 diff（除 metadata 如 `## Related Decisions` ref 變動）→ 違反 ADR-0036；還原。

### Step 5：commit + push

```
fix(rules): <agent> slim-down — <before>→<after> tokens (-X%)

Patterns:
- P-1: <什麼下沉至 skill X>
- P-2: <什麼移至 ADR/memory>
- P-3: <鐵律清單表格化>
- P-4: <ref 收斂>

Validation:
- schema-validator: PASS (token=<N>/1000)
- rule-token-budget: PASS
- drift_score: <X>.XXX (was 0.872)
- self-sufficiency: PASS（自足性問題無）
```

---

## 三、禁區 + 例外

### 絕對禁止

1. 改 immutable section 文字
2. 刪「絕對禁止」鐵律（可表格化、不可刪）
3. 改 frontmatter 任何欄位（schema 衝突；ADR-0022）— **僅允許更新 version/last_modified/last_proposal**（ADR-0038 後 `token_budget_exception` flag 已廢止；改套 `rule_category` tier 機制：meta/worker/orchestrator）
4. 抽走後讀者無法執行任務（破壞自足性）
5. 跑完三層驗收前 commit
6. **刪除任何 section**（PROPOSAL_20260501_001 Phase B 教訓；subagent 違反此項導致 assistant.md 從 17→11 sections）— section count 為**結構不變量**，必相等

### 結構不變量（subagent 必驗）

```bash
# Before / After section 數必相等
git show HEAD:.agents/rules/<file>.md | grep -c '<section id='
grep -c '<section id=' .agents/rules/<file>.md
# 兩數字必相等；不等 → 撤回
```

每個 section ID 都必保留（不可改名 / 不可合併）。內容可壓縮、可下沉至 skill，但 `<section id="X" priority="Y">...</section>` 標記必在原處。

### 並行寫衝突防護（Phase B 教訓）

並行 subagent 各寫各檔；但實務發現 subagent 處理慢時 race condition 可能發生（File has been modified 錯）。緩解：

- 主檔案（rules/X.md）原則上單一 subagent 持有
- 跨 subagent 共用 skill（如 lead-orchestration-guide.md）只允許 append；不允許重寫既有段
- 完成後**立即 commit + push**（鎖定狀態）；不要讓檔案處於「subagent 已完成但未 commit」狀態

### Atomic write 範本（避免 race）

當主流程的 Edit 因 race 失敗時：

```bash
# 1. 寫入暫存
cat > /tmp/<rule>-slim.md << 'EOF'
<完整新內容>
EOF

# 2. 驗證暫存
python3 .agents/tests/schema-validator.py --file /tmp/<rule>-slim.md

# 3. Atomic move
mv /tmp/<rule>-slim.md .agents/rules/<rule>.md

# 4. 立即 commit + push 鎖定
```

### 例外處理（ADR-0038 後路徑）

`token_budget_exception` flag **已於 PROPOSAL_20260501_003 + ADR-0038 廢止**。新流程：

若依 ADR-0036 4 patterns + 自足性測試後仍超 budget：

1. **先確認 `rule_category` 是否正確**（meta=500/1000；worker=1500/2500；orchestrator=1800/3000）
2. **判定 4 原則**（任一滿足即 orchestrator；ADR-0038 §4 條原則）：
   - Cross-Agent 派發職責
   - 多階段流程管理（≥ 3 階段）
   - 跨時序整合
   - Hub 性質
3. 若 worker 應升 orchestrator → 改 `rule_category: orchestrator`
4. 若已是 orchestrator 仍超 1800 → 立 lite proposal 評估 tier 值或進一步抽 skills

**禁止**：使用 `token_budget_exception` 欄位（schema 已移除）；以 exception 名義繞過 tier 判定。

PROPOSAL_20260501_001 完成時若有 ≥ 1 例外 → 該提案 §Notes 必註記。

---

## 四、Phase B-D Subagent 任務模板

### 任務指派 prompt（給 subagent）

```
你是 rule-slim-down subagent。讀完以下檔案後執行：

1. .agents/decisions/0036-rule-decomposition-patterns.md（必讀）
2. .agents/skills/rule-slim-down-playbook.md（本檔；必讀）
3. .agents/rules/<target>.md（目標檔）
4. .agents/skills/<agent>-orchestration-guide.md（接收 skill；若存在）

任務：將 rules/<target>.md 從 <X> tokens 降至 ≤ 1000 tokens。

執行：
- 套 ADR-0036 4 patterns（有規劃表）
- 通過 playbook §Step 3 三層驗收
- 不違反 §禁區（5 條絕對禁止）
- commit message 依 §Step 5 模板

回報：
- 規劃表（§Step 1）
- 削減結果（before / after / pattern 套用清單）
- drift_score 前後對比
- 是否需調整 `rule_category`（ADR-0038；如 worker→orchestrator）

絕對禁止：
- 跳 §Step 3 三層驗收
- 改 immutable section 內容
- 改 frontmatter（除 version/last_modified/last_proposal/rule_category）
- 認為「自足性測試」可以省略
- **使用已廢止的 `token_budget_exception` flag**（ADR-0038 後）
```

### Phase 拆分

| Phase | Rule                                    | 預估 token 削減 | 觸發 subagent 數    |
| ----- | --------------------------------------- | --------------- | ------------------- |
| B     | assistant.md / retro.md                 | -900 / -800     | 2                   |
| C-1   | qa.md / planner.md                      | -600 / -600     | 2                   |
| C-2   | backend.md / architect.md               | -600 / -600     | 2                   |
| C-3   | security.md / frontend.md / reviewer.md | -550 × 3        | 3                   |
| D     | consultant.md / system-prompt.md        | -100 / -50      | 1（合併；邊緣微調） |

並行度建議：每批 ≤ 3 subagents（避免 git 衝突）；批次間驗收後再啟下批。

---

## 五、品質 Gate（@Lead 親驗）

每 subagent commit 後 @Lead 必執行：

```bash
# 1. 完整 validator（不跑只跑單檔）
python3 .agents/tests/run-all.py

# 2. drift 對比
python3 .agents/tests/agent-drift-simulator.py --verbose
# 與 baseline 0.872 比對；< 0.87 → 警報；< 0.85 → 回滾

# 3. immutable diff 檢查
git log -1 --stat
git diff HEAD~1 -- rules/ | grep -E '^[+-].*immutable="true"'
# 期望：無內容性 diff（只能改 ## Related Decisions footer）

# 4. 自足性抽查（隨機 1-2 條 rule）
# 人工讀 slimmed rule，是否能執行任務？
```

任何 gate 失敗 → 立即 `git revert <commit>` + 回 subagent 修正。

---

## 六、版本與更新

- 本 playbook 為 PROPOSAL_20260501_001 配套；提案結束後保留作未來 rule 維護準則
- 4 patterns 之外若發現新模式（≥ 2 次重複出現）→ 升級 ADR-0036 + 本 playbook
