<!-- MACHINE_READABLE
type: task
category: F1
id: integration-walkthrough-protocol
related_proposals: [PROPOSAL_20260502_048]
related_decisions: [ADR-0044]
load_when: "proposal 採納總數達 5 倍數時 / ADR 重大變更 / user 明示跑 walkthrough"
-->

# Task: Integration Walkthrough Protocol（每 N proposals 跨提案交互回歸驗證）

> 由 PROPOSAL_502_048 + ADR-0044 建立；F1 類（純通用流程）。
> v7.7-v7.20 八輪 stabilization 經驗證明：每 3-5 proposals 累積後跨提案交互盲點浮現；本 SOP 把「整合 walkthrough」從 ad-hoc 升為 framework governance。

## §1 觸發條件（@Assistant 巡邏 P-40 偵測）

| 觸發           | 條件                                          | 通知級別     |
| -------------- | --------------------------------------------- | ------------ |
| Proposal 累積  | `proposals/PROPOSAL_INDEX.md` total 達 5 倍數 | P-40 🟡      |
| ADR amend 既有 | 任 ADR `amends` 既有 ADR 且涉鐵律             | P-40 🔴 強制 |
| Schema 變更    | routing-ticket-protocol §schema 加新欄位      | P-40 🟡      |
| User 明示      | 「跑 walkthrough / regression / 整合驗證」    | 立即         |

**User 啟動指令範例**（PROPOSAL_502_049 gov-2 補；任一即觸發）：

- 「請對 v<X> 跑一次完整 integration walkthrough」
- 「我們做幾輪 stabilization 了，跑 regression 看狀態」
- 「整合驗證一下；用調整參數模擬」
- 「跑 simulation 確認 v<X> 是否達凍結門檻」
- 「依 ADR-0044 跑下一輪 walkthrough」

## §2 執行 SOP（4 步驟）

### Step 1: 情境選擇

選 8 個典型 dispatch 情境（A-H）：

- A: Cross-stack feature（新 endpoint + 新元件）
- B: 千行檔 cross-stack refactor（rename 跨多檔）
- C: Hotfix typo（單檔 < 200 LOC + SC/D 全否）
- D: Onboarding 新 codebase（multi-module）
- E: Cross-file impact debug（mempalace ↔ GitNexus 衝突）
- F: 持久化共寫（refactor 完成後寫 drawer）
- G: GitNexus disabled / unavailable fallback（4 失敗模式）
- H: autonomy + GitNexus + mempalace 三機制交互

**參數調整鐵律**（避免 closed-list 寫死判斷）：

- 每輪情境細節**參數調整**（不同 stack / 不同關鍵字 / 不同 LOC 邊界）
- 用中英混合 + 口語化指令測試 keyword 覆蓋
- 用 business-domain 命名（Acme.Accounting）測試 path 白名單

### Step 2: 派 4 並行 agents

每 agent 跑 2 情境（A+B / C+D / E+F / G+H）；prompt 規格：

- 自帶背景（agents 沒看本對話；需自包含 context）
- 列必讀文件（v_current 最新）
- 列驗證重點（既有修補 GR 是否真生效）
- 要求結構化輸出 markdown
- **不要真執行 workflow**；只走概念層追蹤

### Step 3: 產出報告

整合 4 agent reports 為單一 markdown：

- 路徑：`.agents/docs/Reports/SIMULATION_<topic>_<date>.md`
- 結構：
  - §1 GR 趨勢（vs 上輪）
  - §2 GR 分主題彙整
  - §3 修補有效性
  - §4 凍結門檻評估
  - §5 推薦行動（必修 / 建議修 / 觀察）
  - §6 結論

### Step 4: 後續行動

- GR 高嚴重 ≥1 → 起 stabilization PROPOSAL；循環
- GR 全 中/低 + < 5 + 高 = 0 → 凍結為 milestone vN
- 結構性 SPOF → 重大決策通知 user（如 Round 3 closed-list paradigm 觸 ADR-0042 hybrid LLM）

## §3 凍結門檻（達門檻才凍結；PROPOSAL_502_049 v2 軟化機械門檻；保結構硬指標）

| 門檻            | 類別   | 標準                         |
| --------------- | ------ | ---------------------------- |
| 高嚴重度        | **硬** | = 0                          |
| 結構性 SPOF     | **硬** | = 0                          |
| 總 GR           | 軟     | ≤ 5（含中/低）               |
| 條文-實作 drift | 軟     | C-1 真信號 ≤ 3（noise 不計） |
| Schema gap      | 軟     | C-2 真信號 ≤ 3（noise 不計） |

### 「真信號」判定 SOP（PROPOSAL_502_049 解 R7 軟化）

C-1 warn 真 vs noise：

- ✅ **真信號**：條文寫的 validator/patrol claim 但 grep `tests/*.py` 無對應實作（drift）
- ❌ **noise**：ADR frontmatter `supersedes` 等屬欄位非 validator claim；regex 誤命中

C-2 warn 真 vs noise：

- ✅ **真信號**：ROUTING_TICKET schema 欄位被 framework 引用但 schema 未定義（如 R5-3 hotfix_tier 案）
- ❌ **noise**：其他 yaml block（agent rule frontmatter / ADR frontmatter / patrol catalog 等）被 grep 命中

達門檻 → CHANGELOG 標 `🏁 stabilization milestone vN`；FRAMEWORK*VERSION 標 + 寫 `docs/Reports/STABILIZATION_MILESTONE_V<N>*<date>.md` 凍結報告。

## §4 與既有機制協同

- **C-1 condition-claim validator**（PROPOSAL_502_047）：commit hook 跑；本 protocol 補語意層
- **C-2 schema-completeness validator**（PROPOSAL_502_047）：同上；本 protocol 補跨提案交互
- **@Auditor design audit dim 6**（PROPOSAL_502_048 + ADR-0045）：定期跑；本 protocol 為觸發點之一
- **ADR-0042 Hybrid LLM Classifier**：解 closed-list SPOF；本 protocol 用 LLM agents 跑 walkthrough

## §5 鐵律

- ❌ **絕對禁止** simulation agent 真執行 workflow（修檔 / Edit / Write 任何 framework 檔案）；只做設計層追蹤
- ❌ **絕對禁止** 跳過 GR 報告直接凍結；門檻必達
- ❌ **絕對禁止** GR 報告靠 keyword grep 評；必設計層走過每階段機制
- ✅ 鼓勵每輪參數調整避免 closed-list 寫死判斷

## §6 歷史紀錄

| Round | 框架版本 | 觸發           | GR 數  | 高嚴重 | 結果                     |
| ----- | -------- | -------------- | ------ | ------ | ------------------------ |
| 1     | v7.7     | initial        | 48     | 15     | 起 502_035-038           |
| 2     | v7.11    | 502_035-038 後 | 32     | 9      | 起 502_039-042           |
| 3     | v7.15    | 502_039-042 後 | 33     | 13     | 觸結構性 SPOF → ADR-0042 |
| 4     | v7.17    | 502_043-044 後 | ~25    | 3      | 收斂；起 502_045         |
| 5     | v7.18    | 502_045 後     | 7      | 2      | 邊緣未達；起 502_046     |
| 6     | v7.19    | 502_046 後     | 4      | 1      | 高嚴重未達；起 502_047   |
| 7     | v7.21    | 502_047-048 後 | (待跑) | (待跑) | 預期凍結 milestone v2    |

---

**維護紀錄**：

- 2026-05-07：PROPOSAL_502_048 + ADR-0044 建立（governance C-3）

## Related Decisions

- [ADR-0044](../decisions/0044-integration-walkthrough-protocol.md) — 本 SOP 之決策依據
- [ADR-0042](../decisions/0042-hybrid-llm-intent-classifier.md) — Hybrid LLM；本 protocol 用 LLM agents
- [ADR-0045](../decisions/0045-design-audit-dimension.md) — Design Audit；協同
