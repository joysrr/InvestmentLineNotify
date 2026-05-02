---
task_id: proposal-integration-analysis
file_type: workflow
owner: @Retro
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  ≥ 2 OPEN 提案時整合分析 5 階段（範圍 / 文件依賴 / 並行衝突 / 風險 / 報告）
referenced_by:
  - rules/lead.md
  - skills/lead-context-mappings.md
  - skills/templates/proposal-integration-analysis-template.md
  - skills/retro-analysis-framework.md
  - skills/lead-orchestration-guide.md
  - decisions/0020-proposal-intent-inheritance.md
---

# Task: Proposal Integration Analysis (提案整合性分析)

> 本任務由 PROPOSAL_20260422_007 建立。當 User 於 `active/` OPEN 提案 ≥ 2 份時下達「採納提案」指令，`@Lead` 執行本 task 前必須先詢問 User 是否執行本分析。
> 分析流程對應模板位於 `.agents/skills/templates/proposal-integration-analysis-template.md`。

---

## 觸發時機

| 條件                       | `@Lead` 動作                                       |
| -------------------------- | -------------------------------------------------- |
| `active/` OPEN 提案 = 1 份 | 直接執行採納，無需整合性分析                       |
| `active/` OPEN 提案 ≥ 2 份 | **必須**向 User 提問：「是否執行提案整合性分析？」 |
| `active/` OPEN 提案 ≥ 3 份 | **強烈建議**執行分析（`@Lead` 於提問中明示建議）   |

User 明確表示「已審閱，直接採納」時：`@Lead` 記錄跳過豁免於 `PENDING_ACTIONS.md §豁免記錄`。

## 5 階段分析流程

### Stage 0：Memory Palace 反覆問題查詢（ADR-0039；新增）

- `mempalace.search "<提案關鍵詞 + 涉及 Agent>"` 查 strategy_context（歷史決策脈絡）+ debug_graveyard（相關 incident）
- 比對是否與 `PROPOSAL_INDEX.md §🔗` 既有意圖衝突（ADR-0020）
- 若命中歷史 → 將 drawer ref 列入分析報告

### Stage 1：範圍界定

- 列出本次 User 指令涉及的採納提案清單
- 列出所有其他 active/ 中 OPEN 提案（是否一併納入分析？）
- 確認分析範圍（單純本次採納 vs 全部 OPEN 池）

### Stage 2：文件依賴盤點

- 掃描每份提案的「預計影響範圍」章節
- 建立「檔案 × 提案」矩陣（列出哪些檔案被哪些提案同時修改）
- 標記高風險檔案（被 ≥ 2 份提案修改）

### Stage 2a：派生視圖影響檢查

對每個待採納提案，檢查是否影響以下派生視圖清單：

- `.agents/docs/agents-overview.md`：Agent / 巡邏 P-XX / 產出物 / 系統參數 / Workflow 階段變更
- （未來可擴充其他派生視圖，例如 `docs/architecture.md` 框架部分）

**檢查項**：

1. 提案 §三 提案內容 是否觸發 `RULES_DESIGN_GUIDE §三 派生視圖同步義務` 的觸發條件？
2. 提案 §五 執行計畫 的 Phase E 是否包含「agents-overview 同步檢查」？
3. 若未涉及 → 是否於 §六 驗收標準明文「agents-overview 無需同步」？

**影響判定**：

- 觸發且 Phase E 缺同步項 → 於分析報告標注 🟡 建議補齊
- 觸發且未明文「無需同步」 → 視為驗收標準不完整，要求修訂 Phase E
- 未觸發 → 無需處理

### Stage 3：並行衝突分析（派遣子 Agent）

- 對每個高風險檔案，派遣獨立 Explore 子 Agent 執行深度檢查
- 子 Agent 依 `skills/templates/proposal-integration-analysis-template.md §子 Agent 提示詞模板` 執行
- 子 Agent 回報 5 項檢查結果：

1.  章節插入位置是否碰撞
2.  語意設計是否衝突
3.  執行順序敏感性
4.  Token 預算累積影響
5.  與既有 DONE 提案的意圖回退風險（對齊 `PROPOSAL_INDEX.md §🔗`）

### Stage 4：風險彙整

- 整合所有子 Agent 回報
- 按嚴重度分類：🔴 高 / 🟡 中 / 🟢 低
- 標記每項風險的處理建議：修訂現有 OPEN 提案 / 建立新補強提案 / 接受風險繼續採納

### Stage 5：報告輸出

- 依 `skills/templates/proposal-integration-analysis-template.md §報告模板` 產出分析報告
- 於對話中呈現給 User
- 等待 User 決策（修訂 / 新增提案 / 繼續採納 / 暫緩）

## DoD 自評（`@Lead` 執行本 task 前確認）

- [ ] 已列出本次採納範圍與全 OPEN 提案清單
- [ ] 已建立「檔案 × 提案」矩陣
- [ ] 對所有高風險檔案（≥ 2 提案修改）派遣了獨立子 Agent
- [ ] 所有子 Agent 已回報並完成風險彙整
- [ ] 報告依標準模板產出
- [ ] User 已收到報告並做出決策

## 禁止行為

- **絕對禁止** 在 OPEN ≥ 2 份時直接執行採納，未詢問 User 是否做整合性分析
- **絕對禁止** 子 Agent 回報結果未彙整即向 User 產報告
- **絕對禁止** 以「時間緊迫」為由跳過分析（如需緊急，使用 Hotfix 通道而非本提案採納流程）

## 與其他提案的協同

- **預防 + 修補雙軌**：本 task（預防）+ PROPOSAL_20260422_006 建立的 `PROPOSAL_INDEX.md §🔗 意圖繼承表`（修補）形成閉環
- **P-14 兜底**：若新提案執行後未標注意圖繼承，`@Assistant` 巡邏 P-14 產 🔴 `PROPOSAL_INTENT_REGRESSION`

---

## Related Decisions

- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承機制
