# Task: Periodic Design Review (定期設計檢視)

> `@Retro` 每次定期審計（`retro.md §s02 定期審計觸發條件`）時**必須**執行本檢核表。

## 觸發條件

任一成立即觸發本檢視（與 `retro.md §s02` 共用觸發機制）：

1. 距上次完整審計已超過 **10 個工作對話**
2. 已執行提案累積 **≥ 5 份**
3. 跨功能模式識別週期到（每 3 個功能後）
4. 重大變更後下次對話
5. User 明示「執行設計檢視」

## 檢視兩大目標

### 目標 1：流程繁瑣 / 過度設計檢視

**核心問題**：當前框架是否有過於繁瑣或過度的設計？該如何改善？

**檢視維度**：

| # | 維度 | 警示門檻 | 改善方向 |
|---|------|---------|---------|
| 1 | RULES_DESIGN_GUIDE 章節數 | > 25 章 | 考慮拆檔（design / scope / quality / runtime）|
| 2 | 13 Agent 任一 rules token | > 5000 | 外部化至 skills/tasks |
| 3 | 提案平均 Phase 數 | > 8 | 引入 Lite Proposal（1-2 phase）|
| 4 | run-all.sh validators 數 | > 12 | 評估合併 / 拆模式 |
| 5 | 巡邏規則 P-XX 總數 | > 25 | 評估合併重複偵測 |
| 6 | Hotfix 流程步驟數 | > 5 | 評估按事故等級分輕重 |
| 7 | HITL 強制觸發點 | > 5 處 | 評估合併或自動化部分判斷 |
| 8 | skills/ + tasks/ 檔案數 | > 50 | 評估歸併重複用途 |
| 9 | **SCRIPT_UNDERUSE**：30 天內「stale INDEX 修正 / 忘記跑 generator」commit 次數 | ≥2 次 WARN / ≥5 次 ALERT | 強化 SOP 文件 / 檢視 pre-commit 攔截點是否足夠|

**檢視動作**：
- [ ] 比對當前數值與門檻
- [ ] 任一項超門檻 → 撰寫「過度設計分析報告」附於 retro 回報
- [ ] 必要時提案改善（如 PROPOSAL_009-011 性質）

**#9 SCRIPT_UNDERUSE 詳細偵測**

觸發條件（任一）：
- 近 30 天 git log 出現「stale INDEX 修正 / 忘記跑 generator / INDEX drift」類 commit ≥2 次
- `git commit --no-verify` 使用率 >10% 總 commits
- `pre-commit` hook 攔截 `index_drift` ≥2 次於 30 天內

偵測指令（範例）：
```bash
git log --all --oneline --since="30 days ago" \
 | grep -iE "(stale|drift|INDEX 未同步|忘記跑 generator)" \
 | wc -l
```

處置：
- **≥2 次 / 30 天 → 🟡 WARN**：於 retro 報告提示「LLM 代理需加強 generator 使用習慣」；提示 SOP 文件位置
- **≥5 次 / 30 天 → 🔴 ALERT**：新立的 3 個提案 §七 備註必須說明「如何避免重犯」；`@Auditor` 月度報告新增「Generator 使用率 = (generator --write 成功 / 應執行次數)」指標，目標 >95%

修復手段：
- 加強 `rules/retro.md §s06 Pre/Post-Commit SOP` 明文
- 擴充 `skills/rule-update-proposal-full-template.md 🔧 立案/採納後必跑腳本`
- 若 pre-commit 仍被繞過（`--no-verify`）→ 評估升級為 CI/CD server-side check

### 目標 2：LLM 可被程式取代的作業檢視

**核心問題**：目前是否有作業可以透過程式處理而非 LLM 處理？

**檢視維度**：

| 類別 | 候選範例 | 程式化評估 |
|-----|---------|----------|
| **重複模板生成** | workspace 檔案 / PROPOSAL_INDEX 統計 / CHANGELOG 條目 | ✅ 已大量自動化（PROPOSAL_005 + 007）|
| **明確規則性判斷** | scope 判定 / 文件分層判定 / 觸發條件機械化 | ✅ 已 validators 涵蓋 |
| **狀態機追蹤** | 提案狀態流轉（OPEN→IN_PROGRESS→DONE） | 🟡 部分（git mv 偵測；可進一步）|
| **重複性檔案維護** | RULES_VERSION_INDEX / CHANGELOG / FRAMEWORK_VERSION | ✅ PROPOSAL_007 涵蓋 |
| **DoD Checklist 條件驗證** | 各 Agent DoD 細項 | 🟡 部分（per-Agent validator 待擴）|
| **派生視圖同步** | agents-overview §1.2 目錄樹 | 🟡 sync-validator 偵測；產生待 PROPOSAL_007 後續|

**檢視動作**：
- [ ] 列出當前仍由 LLM 處理但可程式化的作業
- [ ] 估每項程式化的 ROI（投資工時 vs 節省 LLM 操作數）
- [ ] ROI > 3 的項目 → 進入提案候選清單

**❌ 永遠不適合程式化的作業**（不重複檢視；列為共識）：
- 提案內容撰寫
- 根因分析（推理）
- 設計判斷（權衡）
- 業務脈絡理解
- 衝突仲裁
- DoD 自評**質的判斷**（如「程式碼可讀性」）

## 產出物

每次檢視後，`@Retro` 應於 retro 報告中附 **設計檢視附錄**：

```markdown
## 附錄：定期設計檢視（依 tasks/periodic-design-review.md）

### 目標 1：流程繁瑣 / 過度設計
- 各維度當前數值 vs 警示門檻：<填寫>
- 超門檻項：<列出 / 無>
- 改善提案候選：<列出 / 無>

### 目標 2：LLM 可被程式取代
- 新候選作業（過去週期未列）：<列出 / 無>
- 程式化 ROI 評估：<列出>
- 進入提案候選：<列出 / 無>

### 對齐路線
- 已涵蓋於既有提案：<例：007（索引）/ 008（執行模式）>
- 未涵蓋且 ROI 高：<例：DoD per-Agent validator>
```

## 與既有提案的關係

- **PROPOSAL_20260423_007**（索引自動產生器）：已執行的「LLM → 程式」候選代表
- **PROPOSAL_20260423_008**（run-all.sh 並行 + fast）：已執行的「流程繁瑣」改善代表
- **PROPOSAL_20260423_009-011**（規劃中）：本檢視可能催生的後續提案

## 執行頻率

- **預設**：與 `retro.md §s02 定期審計` 同步觸發
- **最低**：每 3 個月一次（防遺漏）
- **手動**：User 明示「執行設計檢視」

## 禁止行為

- **絕對禁止** 跳過本檢視直接撰寫 retro 報告（每次定期審計必須附「設計檢視附錄」）
- **絕對禁止** 將候選改善項列入但不附 ROI 評估（防 backlog 無限膨脹）
- **絕對禁止** 對「永遠不適合程式化」清單中的項目重複提案程式化（共識穩定）

## 溯源

- 建立提案：PROPOSAL_20260423_008 Phase E（合併 User 2026-04-23 指示「列為未來定期檢視的目標」）
- 觸發 Agent：`@Retro`（`.agents/rules/retro.md §s02`）
- 對齐：`RULES_DESIGN_GUIDE §十二` 提案執行義務 + `tasks/audit-retro-coordination.md` 協作 SOP
- 類別：F1（純通用流程；對齐 RULES_DESIGN_GUIDE §十六.F）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

## Related Decisions

- [ADR-0005](../decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
- [ADR-0027](../decisions/0027-script-underuse-prevention.md) — Script 漏用防護機制
