---
task_id: proposal-adoption-workflow
file_type: workflow
owner: "@Lead"
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_017
purpose: |
  User 採納提案後 @Lead 執行 SOP（從 rule-update-proposal-template 抽出獨立 task）。
  解 Sim-C S13「採納流程散在 template 內未抽 task」缺口。
referenced_by:
  - rules/lead.md §s_pre_adoption_check
  - rules/lead.md §s10
  - skills/templates/rule-update-proposal-full-template.md
related_decisions:
  - ADR-0020 # 提案意圖繼承
  - ADR-0021 # 提案生命週期
---

# Task: Proposal Adoption Workflow（提案採納執行 SOP）

> PROPOSAL_502_017 Q-4 補建。
> 對齊 `rules/lead.md §s_pre_adoption_check`（採納前整合性分析）+ `rules/lead.md §s10` Rules 修改唯一例外。

---

## 觸發

User 下令：

- `採納 PROPOSAL_<id>`
- `執行提案 <id>`
- `PROPOSAL_ADOPT <id>`

---

## 6 步 SOP

### Step 1：Pre-adoption 整合性分析（如 OPEN ≥ 2）

依 `rules/lead.md §s_pre_adoption_check` + `tasks/proposal-integration-analysis.md`：

- OPEN=1 直接採；OPEN ≥ 2 必問是否分析；OPEN ≥ 3 強烈建議分析
- 跳過 → §s11 豁免記錄

### Step 2：讀提案 + 確認 scope

```bash
cat .agents/proposals/active/PROPOSAL_<id>.md   # 讀完整提案
grep "scope:" .agents/proposals/active/PROPOSAL_<id>.md   # framework / project:<name>
```

scope=framework → `.agents/proposals/`；scope=`project:<name>` → `.agents/workspaces/<name>/proposals/`。

### Step 3：執行 Phase 對應變更

依提案 §二 執行 Phases 的 commits 規劃：

- 每 commit 對應一個 Phase
- 每個 Phase 後 `python3 .agents/tests/run-all.py` 確認綠
- 寫 ROUTING_TICKET 派發子 agent 變更（如需）

### Step 4：DONE 狀態 + 移目錄

```bash
# 1. 修 frontmatter
sed -i 's/^status: OPEN$/status: DONE/; s/^status: IN_PROGRESS$/status: DONE/' active/PROPOSAL_<id>.md
# 2. 加 done_at
echo "done_at: $(date +%Y-%m-%d)" >> ...   # 或編 frontmatter
# 3. 移 active/ → completed/
git mv active/PROPOSAL_<id>.md completed/
```

### Step 5：版本 bump + indexes 重生

```bash
python3 .agents/scripts/generators/gen-framework-version.py --bump <minor|major> --proposal PROPOSAL_<id> --write
python3 .agents/scripts/generators/gen-proposal-index.py --write
python3 .agents/scripts/generators/gen-rules-version-index.py --write
```

bump 規則：

- Lite tier → minor
- Full tier 結構性改 → minor 或 major（依風險）
- bug fix only → patch（不 bump version；只 CHANGELOG 加 entry）

### Step 6：CHANGELOG + push

- `CHANGELOG.md` 加 v<X.Y> entry（4 區：Added / Changed / Notes + Deprecated 如有）
- 15 validators 全綠 + 0 warnings 確認（PROPOSAL_502_018 R-5；含 scripts）
- `git commit -m "feat: PROPOSAL_<id> DONE — <one-line summary>"`
- `git push -u origin <branch>`

---

## 採納前 Iron-rule 檢查（Step 0）

`rules/lead.md §s10`「Rules 修改唯一例外」：採納流程是 (a) `PROPOSAL_ADOPT` 三情境之一；可修 rules/。

但仍須核對：

- ✅ User 明確下達採納指令（不是模糊「處理一下這提案」）
- ✅ 提案有完整 §二 執行 Phases + §四 驗收條件
- ✅ scope 欄位 + 路徑一致（無 P-18 PROPOSAL_SCOPE_MISCLASSIFIED）
- ✅ 採納前 OPEN 提案數 < 整合分析觸發閾

---

## 禁止行為

- **絕對禁止** 跳 Step 1 採納分析（OPEN ≥ 2 場景）
- **絕對禁止** 跳 Step 5 indexes 重生（造成 INDEX drift）
- **絕對禁止** 提案執行中漏 run-all.sh 確認綠（每 Phase 必驗）
- **絕對禁止** scope 不符卻採納（必 P-18 修正後再採）
- **絕對禁止** Hotfix 中採納非 Hotfix 提案（情境衝突）

---

## Related Decisions

- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承
- [ADR-0021](../decisions/0021-proposal-lifecycle.md) — 提案生命週期
