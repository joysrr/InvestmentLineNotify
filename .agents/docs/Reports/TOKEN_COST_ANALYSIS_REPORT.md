# Token Cost Analysis Report — Framework v6.30

> 由 User 詢問「自用企業 LLM 在大量呼叫下的負擔/延遲」觸發；2026-05-04 撰寫。
> 文件分層：framework（PROPOSAL_502_021 後 cross-harness baseline 之延伸分析）

---

## 一、靜態 baseline（每次必載）

### 1.1 Rules + Iron-themes（系統 prompt 級；全 13+6 載入時）

| 類別                 | 檔案                                                                             | tokens                 |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------- |
| meta                 | system-prompt.md                                                                 | 494                    |
| central_orchestrator | lead.md                                                                          | 1981                   |
| 4 orchestrators      | assistant / planner / qa / retro                                                 | 1363~1699（avg ~1512） |
| 7 workers            | architect / auditor / backend / consultant / frontend / reviewer / security      | 770~1406（avg ~1230）  |
| 6 iron-themes        | data-deletion / hci / rubric / state-anchor / machine-readable / parallel-review | 313~697（avg ~500）    |

**全載 baseline ≈ 20,178 tokens**

> ⚠️ 但實際運作不會「全載」；@Lead 派發時只注入相關 agent 的 rule（見 §三）。

### 1.2 Workspace context（每次 dispatch 必載）

| 檔案                                                | tokens |
| --------------------------------------------------- | ------ |
| `.agents/workspaces/<active>.md`（agent_framework） | ~2,119 |
| `.agents/CURRENT_WORKSPACE`                         | <10    |

### 1.3 mempalace state（每次 wake-up）

- 25 drawers indexed；avg ~1KB / drawer
- `wake-up` 回傳 L0+L1 ~600-900 tokens
- `search(results=5)` 回傳 5 drawers verbatim ≈ 1,500 tokens

---

## 二、Per-scenario 成本模擬（5 情境）

### 情境 1：Cold start（新 session 開啟）

```
Input:  system-prompt(494) + 6 iron-themes(3,000) + lead.md(1,981)
       + workspace(2,119) + mempalace.wake-up(800) + PENDING_ACTIONS(1,000)
       = ~9,400 tokens
Output: 5 步 cold-start checklist 摘要 = ~800 tokens
```

**單次成本：~10,200 tokens**

### 情境 2：單一小型派發（@Backend bug fix）

```
@Lead 解析 + 派發：
  Input:  lead.md(1,981) + 6 iron-themes(3,000) + workspace(2,119)
         + mempalace.search(1,500) + PENDING(1,000) + ROUTING_TICKET 撰寫
         = ~10,000 tokens
  Output: ROUTING_TICKET = ~500 tokens

@Backend 接收 + 實作：
  Input:  backend.md(1,406) + 6 iron-themes(3,000) + workspace(2,119)
         + ROUTING_TICKET(500) + memory-operations.md §相關段(2,000)
         + mempalace.search(1,500)
         = ~10,500 tokens
  Output: 程式碼 patch + DoD = ~3,000 tokens
```

**單次成本：~24,500 tokens / 1 dispatch**

### 情境 3：@Auditor 5 維度評估（serial vs parallel）

#### Serial mode（PROPOSAL_502_021 Sprint A 後 default；通用 harness）

```
每維度 1 輪：
  Input:  auditor.md(882) + 6 iron-themes(3,000)
         + auditor-rubric-prompts.md §1 fragment(~458)
         + AUDIT_HISTORY 前次紀錄(800) + KNOWN_ISSUES(500)
         = ~5,640 tokens / dim
  Output: JSON + rationale ≥ 100 字 = ~1,000 tokens / dim

5 維度總計：5 × 5,640 = 28,200 input + 5,000 output = 33,200
+ 整合報告：3,000 input + 2,000 output = 5,000

總計：~38,200 tokens
```

#### Parallel mode（Claude Code opt-in；Antigravity / Qwen 不適用）

```
5 個並行 sub-agent，每個獨立載 system-prompt + 全 iron-themes：
  Per agent: system-prompt(494) + 6 iron(3,000) + auditor.md(882) + fragment(458)
            = ~4,834 input + 1,000 output
  5 × 5,834 = 29,170 tokens
+ 整合：5,000

總計：~34,170 tokens（**parallel 不省 token；省 wall time ~5x**）
```

> ⚠️ **發現**：parallel 與 serial token 差距僅 **~12%**（serial 38K / parallel 34K）；parallel 主要優勢是**延遲**而非成本

### 情境 4：Hotfix heavy（5 步驟 + 雙簽 + Security）

```
Step 0 判定（@Lead）：~12K
Step 1 診斷（@Backend + @Reviewer 雙簽）：~26K
Step 2 修復（@Backend）：~14K
       審查（@Reviewer）：~12K
       安全（@Security 條件式）：~14K
Step 3 QA 回歸（@QA）：~14K
Step 4 Gate（@Lead）：~10K

總計：~102,000 tokens / hotfix heavy
```

### 情境 5：Large feature（M-tier；workflow 10 stages）

| Stage         | Agent                             | Tokens         |
| ------------- | --------------------------------- | -------------- |
| 1. 需求       | @Planner                          | ~10K           |
| 2. 規劃       | @Planner + @Architect             | ~24K           |
| 3. 設計       | @Architect（含 Prior Art Scan）   | ~28K           |
| 3.5 Test Spec | @QA                               | ~14K           |
| 4. 實作       | @Backend / @Frontend × 1-3 子任務 | ~24K × 2 = 48K |
| 5. 自評       | @Backend                          | ~10K           |
| 6. Review     | @Reviewer                         | ~14K           |
| 6.5 Security  | @Security（條件）                 | ~14K           |
| 7. QA 執行    | @QA                               | ~16K           |
| 8. Retro      | @Retro                            | ~18K           |
| 9. Phase E    | @Lead + @Assistant                | ~12K           |

**總計：~208,000 tokens / 1 個 M-tier feature**

---

## 三、日常 + 月度負荷預估（heavy 使用情境）

### 3.1 典型開發者每日

```
1 cold start                  =  10K
8 single dispatches × 24K     = 192K
1 audit（serial mode）         =  38K
0.3 hotfix（每 3 天 1 次）     =  30K
1 cold export 觸發             =   5K（mempalace + script；無 LLM 成本）
─────────────────────────────────────
日 input + output 合計         ≈ 275K tokens / 開發者 / 工作日
```

### 3.2 每月（22 工作日）

```
單人月：~6.0M tokens
含 1-2 個 large feature：+ 416K
─────
月總：~6.4M tokens / 開發者
```

### 3.3 5 人團隊 / 月

```
~32M tokens / 月
```

---

## 四、自用企業 LLM 負擔分析

### 4.1 對 Qwen 自架（典型 Qwen2.5-72B-Instruct on 4×A100）

| 項目                    | 數值                                 |
| ----------------------- | ------------------------------------ |
| Context window          | 128K（夠所有情境）                   |
| Throughput              | ~80-150 tok/s（4×A100 vLLM batch=1） |
| 24K dispatch 處理時間   | ~3-5 分鐘                            |
| 102K hotfix heavy       | ~12-20 分鐘                          |
| 208K large feature      | ~25-45 分鐘                          |
| **日吞吐 / 1 GPU 節點** | ~9-12M tokens（單併發；24h 滿載）    |
| **5 人 32M / 月**       | 單節點足夠（10-15% 利用率）          |

### 4.2 對小型 Qwen（Qwen2.5-7B；單卡）

| 項目                                                                                                                      | 數值           |
| ------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Throughput                                                                                                                | ~150-300 tok/s |
| 24K dispatch 時間                                                                                                         | ~1.5-3 分鐘    |
| **延遲體感**：每 dispatch 等 2 分鐘 → 1 天 8 dispatches × 2 min = 16 分鐘等候時間                                         |
| **品質**：7B persona drift 風險高（drift_score 可能 < 0.70；framework 自評可能失準；參 PROPOSAL_502_021 Sprint C 觀察點） |

### 4.3 對 Anthropic / OpenAI 公開 API（成本參考）

| 模型            | Input $/1M tok | Output $/1M tok | 日成本 / 開發者 | 月成本 / 5 人 |
| --------------- | -------------- | --------------- | --------------- | ------------- |
| Claude Sonnet 4 | $3             | $15             | ~$0.83          | ~$91          |
| Claude Opus 4   | $15            | $75             | ~$4.17          | ~$459         |
| Claude Haiku 4  | $0.80          | $4              | ~$0.22          | ~$24          |
| GPT-4o          | $2.5           | $10             | ~$0.69          | ~$76          |

> 假設 80% input / 20% output；實際比例可能更傾向 input（rule 注入大）。

---

## 五、成本/功能平衡判定

### 5.1 哪些情境**合理**（成本與功能對等）

| 情境                | 成本                                        | 評估                             |
| ------------------- | ------------------------------------------- | -------------------------------- |
| Cold start ~10K     | 必要（建立 framework context）              | ✅ 合理                          |
| 單一 dispatch ~24K  | rule + workspace + memory + ticket 都是必要 | ✅ 合理                          |
| Hotfix heavy ~102K  | 跨 5 agent 雙簽診斷；必要的工程紀律         | ✅ 合理（事故處理）              |
| Large feature ~208K | 涵蓋 10 stages 完整工作流                   | ✅ 合理（M-tier 應有的工程投入） |

### 5.2 哪些情境**邊際過高**（可優化）

| 情境                                     | 問題                               | 優化空間         |
| ---------------------------------------- | ---------------------------------- | ---------------- |
| Audit serial 38K                         | 5 維度各重複載 iron-themes(3K)     | -10K             |
| 6 iron-themes 全載每次                   | 部分 agent 不需全 6 個             | -1.5K / dispatch |
| lead-orchestration-guide.md 8,280 tokens | 大型 skill；任何 dispatch 觸發都載 | -5K（按需）      |
| workspace.md 2,119 tokens                | 全文載；frontmatter 即足           | -1.5K（拆檔）    |
| mempalace.search results=5               | 預設 5；前 3 通常已夠              | -600 / 查詢      |

**潛在節省**：每 dispatch 可省 5-10K（20-40%）；audit 可省 25%；月度可省 ~25-35%

---

## 六、優化建議（依 ROI 排序）

### 🟢 高 ROI（建議立即執行）

#### O-1：Iron-themes per-agent 載入（vs 全載）

**現況**：6 iron-themes（~3K tokens）每次 dispatch 全載
**問題**：每個 worker 只強相關 1-2 個 iron-theme（如 @Auditor 只需 auditor-rubric-iron）
**優化**：在 rule frontmatter 加 `applies_iron_themes: [...]`（已有此欄位；現未被消費）；framework loader 只載相關
**節省**：每 dispatch ~1.5-2K（約 6-8%）；月度 ~1.6M tokens
**工時**：4-6h（loader 改寫 + validator 確認）

#### O-2：Skill 按需載入（不預載 lead-orchestration-guide）

**現況**：lead.md §38 註明「操作細則 = lead-orchestration-guide.md（手冊）」；但實務上 LLM 常被注入該 skill 全文（8,280 tokens）
**優化**：明確改寫 lead.md：「需查 §六 工作流時才開 lead-orchestration-guide」；rule 內加「lazy-load」標記
**節省**：每 cold start + 每 lead dispatch ~5-8K（20-30%）
**工時**：2-3h（rule 修改 + 文件對齊）

#### O-3：mempalace.search 預設 results=3

**現況**：預設 5 results
**問題**：前 3 命中通常已夠決策；第 4-5 cosine 已 < 0.5
**優化**：rule 改 default `results=3`；只在 score 不足時 follow-up 查 5
**節省**：每查詢 ~600-1,000 tokens；每 dispatch 1-2 次查 → ~1.2K
**工時**：1h（5 高頻 rules 改 default + memory-operations §1 對照表更新）

### 🟡 中 ROI（觀察後再決定）

#### O-4：Workspace 拆 frontmatter + body

**現況**：workspace 全載 ~2,100 tokens
**優化**：拆「meta（frontmatter only ~500）」+「body（按需）」
**節省**：每 dispatch ~1.5K；月度 ~1.2M
**工時**：6-10h（schema 改 + init-workspace 改 + 既有 workspace 遷移 + validator 改）
**風險**：影響 workspace 治理；需評估

#### O-5：Audit serial mode 共用 system 上下文

**現況**：serial 5 輪每輪重載 iron-themes
**優化**：改「1 個 session 5 輪」共用 system；只更換 fragment + dimension
**節省**：~10K / audit；月 ~30K
**工時**：2-3h（auditor.md 改寫；驗證 DoD）

### 🔴 低 ROI（不建議現在做）

#### O-6：Rule 進一步拆 tier

ADR-0038 已分 4 tier；再拆會破壞模組性；節省有限。

#### O-7：Mempalace embedding cache

當前 25 drawers retrieval 已 < 100ms；不是瓶頸。

---

## 七、結論 + 建議方向

### 7.1 整體判定

**框架成本/功能平衡：合理偏優化空間**

- ✅ baseline 設計（rules tiering / mode-aware dispatch / hybrid mempalace）對成本意識足
- ✅ Plan G mempalace 單寫設計大幅減少雙寫成本（PROPOSAL_502_020）
- ✅ Sprint A serial mode 通用使 token 成本與 parallel 相當（差 12%）；不增成本
- ⚠️ 三個明顯可優化點：iron-themes 全載 / skill 預載 / mempalace search results

### 7.2 對自用企業 LLM 的具體建議

| 規模                           | 建議                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **Qwen2.5-72B**（4×A100 等級） | ✅ 完全可承載；32M tokens/月 / 5 人僅佔 10-15% 容量；無延遲問題                 |
| **Qwen2.5-32B**（單 A100）     | 🟡 可承載但延遲明顯（每 dispatch 3-5 min）；建議優先做 O-1+O-2+O-3（省 25-35%） |
| **Qwen2.5-7B / 14B**（單卡）   | ⚠️ 延遲嚴重 + drift 風險；不建議生產用；可作開發測試環境                        |
| **公開 API**（Claude Sonnet）  | ✅ ~$91/月 / 5 人；對企業可接受                                                 |

### 7.3 立即建議

3 個高 ROI 優化（O-1 + O-2 + O-3）合計：

- **節省**：每 dispatch ~25-35%；月度 ~10M tokens（5 人團隊）
- **工時**：~7-10h
- **風險**：低（純配置/載入策略；不動 rules 邏輯）

要不要立 PROPOSAL_502_022 執行 O-1+O-2+O-3？或先觀察實際使用 1-2 週看是否真的延遲不可忍？

### 7.4 不建議的方向

- ❌ 大幅瘦身 rules（已調過 ADR-0038 tier budget；再瘦會犧牲 persona stability）
- ❌ 移除 mempalace search（會犧牲 ADR-0039 派發前查上下文鐵律）
- ❌ 跳過 iron-themes（鐵律不可豁免）

---

## 八、附錄：成本分析方法論

- **Token 估算**：中文 ~3.5 chars/token；英文 ~4 chars/token；frontmatter 與 markdown 結構保守 ÷ 4
- **Dispatch 模擬**：以 lead → 1 worker 雙跳為基準；包含 ROUTING_TICKET write/read
- **未計入**：Claude Code system 內建 prompt（不可控）；tool result token（變動大）；user 對話 token
- **保守原則**：估算偏高；實際可能少 10-20%

---

## Related

- PROPOSAL_502_021 Sprint A：mode-aware dispatch（serial / parallel）
- PROPOSAL_502_020 Plan G：mempalace single-write（已減 50% memory write 成本）
- ADR-0038：Tier-based rule budget（已限 rules 上限）
- ADR-0039：MemPalace primary backend（hybrid fallback）
- PROPOSAL_502_019：4 harness × 12 capability 對照
