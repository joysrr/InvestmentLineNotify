# Framework Integrity Simulation Report — v6.31

> 由 User 2026-05-04 要求「大量模擬全情境，識別斷鏈/傳遞錯誤/設計異常」觸發。
> 6 個並行 Explore agent 跑 24 情境靜態追蹤；本檔為最終統整。

---

## Executive Summary

**整體健康度：⚠️ 結構性良好（六大維度 100%）但執行層存在 5 個 🔴 critical 缺口**

| 層次                                                                       | 評估                          | 來源    |
| -------------------------------------------------------------------------- | ----------------------------- | ------- |
| **靜態結構**（iron-theme / artifact / ADR / workflow stage 雙向一致性）    | ✅ 100%                       | Batch 6 |
| **單 agent dispatch**（cold start / bug fix / doc-sync / config tweak）    | ⚠️ 75%（4 缺口）              | Batch 1 |
| **多 agent workflow**（10 stages / audit / proposal lifecycle / 意圖衝突） | ⚠️ 65%（5 缺口）              | Batch 2 |
| **Hotfix 雙路徑**（light / heavy / SC trigger）                            | ✅ 90%（4 警告）              | Batch 3 |
| **錯誤恢復**（MCP down / weak match / drawer compress / state lost）       | ⚠️ 60%（6 缺口）              | Batch 4 |
| **Mode-aware**（serial vs parallel / cross-harness）                       | ⚠️ DoD 等價性零實證（6 警告） | Batch 5 |

**總計**：5 🔴 critical + 8 🟡 high + 14 🟢 medium = 27 個異常

**結論**：v6.21~v6.31 演進 + 4 個提案（502_019/020/021/022）建立了堅實**結構**；但**執行層**有 5 個阻斷風險（多在 fresh init / fallback / 並發路徑），需 P0 修補。

---

## 一、模擬計畫

### 1.1 範圍

| 批次 | 情境數 | 焦點                                                                              |
| ---- | ------ | --------------------------------------------------------------------------------- |
| 1    | 4      | Cold start + 單 agent dispatch                                                    |
| 2    | 4      | Multi-agent workflow（10 stages / audit / proposal / 意圖衝突）                   |
| 3    | 3      | Hotfix（light / heavy / SC）                                                      |
| 4    | 5      | Error / edge cases（MCP down / weak match / arbitration / compress / state lost） |
| 5    | 4      | Mode-aware + harness fallback                                                     |
| 6    | 4      | 跨情境完整性（iron-theme / artifact / ADR / workflow stages）                     |

**檢查維度**（每情境 5 軸）：傳遞路徑 / 檔案完整性 / handoff 整合 / iron-theme 覆蓋 / token 估算 / 異常識別

### 1.2 執行方式

並行 6 個 Explore subagent，每個 ~250K token / ~4 min；總工時 ~25 min wall-clock；總 token ~700K（讀檔密集）。

---

## 二、各批次摘要

### Batch 1：Cold start + 單 agent dispatch（4 情境）

| 情境                                 | 結論    | 主要缺口                                                                                  |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| 1.1 Cold start                       | ⚠️ 警告 | mempalace 降級時 markdown SoT 讀位置未明文；CONVERSATION_COUNTER 跨 session 持久化脆弱    |
| 1.2 Bug fix（lead→backend→reviewer） | ✅ 完整 | 傳遞鏈無斷；task_class 漏標僅有事後巡邏                                                   |
| 1.3 Doc-sync 模式                    | ⚠️ 警告 | architect-dod-checklist 存在性未驗；Stage 8b Gate 條件未補                                |
| 1.4 單一 config tweak                | ❌ 阻斷 | @Architect 跳過條件未規範；strategyWeight 敏感參數無強制檢查；lane-routing 缺 config 類型 |

**Token**：1.1 ~10K；1.2 ~24K；1.3 ~4K（豁免 @QA）；1.4 應 simple lane 但 strategyWeight 檢查若漏成本不可控

### Batch 2：Multi-agent workflow（4 情境）

| 情境                     | 結論   | 主要缺口                                                                                            |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| 2.1 完整新功能 10 stages | ⚠️ 90% | S3.5 → S4 Prior Art Gate 無主動暫停；S6/6.5 並行 queue 無同步；S8 收斂無 atomic                     |
| 2.2 Audit cycle          | ⚠️ 80% | Step 0 mempalace 無託管失敗 fallback；baseline Δ 無 aggregate 規則                                  |
| 2.3 Proposal lifecycle   | ❌ 75% | PENDING_ACTIONS.md 初始化依賴 @Assistant 首次巡邏（無自修復）；PROPOSAL_TOTAL_WARN(50) 無 P-XX 警示 |
| 2.4 意圖衝突檢測         | ❌ 40% | **PROPOSAL_INDEX.md §🔗 意圖繼承表根本不存在**；ADR-0020 已 Accepted 但未實施                       |

**Token**：2.1 ~208K（M-tier full feature）；2.2 ~38K（serial audit）；2.3-2.4 中等

### Batch 3：Hotfix 雙路徑（3 情境）

| 情境                             | 結論    | 主要缺口                                                               |
| -------------------------------- | ------- | ---------------------------------------------------------------------- |
| 3.1 Light（3 步）                | ✅ 完整 | 判定唯一性高；hotfix_tier YAML 強制；無模糊                            |
| 3.2 Heavy（5 步雙簽 + Security） | ✅ 完整 | mode-aware DoD 等價聲明無實證；@Reviewer 側 REVIEW_QUALITY_FAIL 通知缺 |
| 3.3 SC trigger                   | ✅ 完整 | 通知分級未細化（SC-02 等關鍵觸發是否須 P-15 紅）                       |

**Token**：3.1 ~30K target；3.2 ~100K target（**framework 無量化基準；無法驗證 ±20%**）

**注意**：Hotfix 是設計最完整的子系統；判定樹「由嚴至寬」+ YAML 強制 + 違規偵測規則齊備。

### Batch 4：錯誤 / 邊緣情境（5 情境）

| 情境                             | 結論    | 主要缺口                                                                                                           |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| 4.1 MCP down → .export/ fallback | ❌ 阻斷 | **`.agents/memory/.pending/` 目錄初始化未保證**（init-workspace 未 mkdir）→ MCP fallback 必 crash；replay 無並發鎖 |
| 4.2 weak match（cosine < 0.4）   | 🟡 模糊 | memory_hint 寫入但無 consumer；下游 agent 無差異化行為                                                             |
| 4.3 @Reviewer ↔ @Security 仲裁   | ✅ 大致 | 四層防線完整；@Reviewer 側 REVIEW_QUALITY_FAIL 通知缺                                                              |
| 4.4 drawer count > 5000          | 🟡 警告 | 主流程完整；compress 失敗恢復路徑模糊；向量漂移無監測                                                              |
| 4.5 PENDING_ACTIONS lost         | ❌ 阻斷 | **舊 ROUTING_TICKET 未歸檔**；CONVERSATION_COUNTER 跨 session 累計邏輯缺；audit 週期（每 10 對話）對齊失準         |

**Token**：fallback 路徑成本估計 +20-50%（grep `.export/` ~25K drawers vs MCP search 1500 tokens）

### Batch 5：Mode-aware + harness fallback（4 情境）

| 情境                        | 結論    | 主要缺口                                                                                        |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| 5.1 Audit serial            | ⚠️ 警告 | 「同對話 5 輪」context 累積偏差未驗證；rationale ≥ 100 字僅 10-30 字實際達成                    |
| 5.2 Audit parallel          | ⚠️ 警告 | **從未實測**（CROSS_HARNESS_RESULTS 僅 antigravity_or_custom）；5 sub-agent variance 無計算機制 |
| 5.3 Hotfix dual-sign serial | 🟡 警告 | 「同對話兩視角」共用 LLM priors → 獨立性虛假；parallel 從未量化驗證                             |
| 5.4 Harness fallback chain  | ⚠️ 警告 | C-2/C-3 deferred；Qwen drift_score 零基線；cross-harness-validator DoD 5 項偏技術               |

**Token**：mode-aware token 差距小（serial 38K vs parallel 34K）；主要差距是 wall-time（5x）

### Batch 6：跨情境完整性（4 維度）

| 維度                    | 結果                                           |
| ----------------------- | ---------------------------------------------- |
| 6.1 Iron-theme 雙向一致 | ✅ 13/13 rules × 6 themes 全 PASS              |
| 6.2 Artifact 產銷鏈     | ✅ 20/20 無孤兒                                |
| 6.3 ADR 引用            | ✅ 39/39（3 個低引用：ADR-0023/0024/0032）     |
| 6.4 Workflow stages     | ✅ 12/12（缺 workflow-stage-validator 自動化） |

**結論**：靜態結構 100% 完整；自動化 validator 缺 1 項（workflow-stage）。

---

## 三、異常彙總

### 3.1 🔴 Critical（5 項；阻斷或重大漏洞）

| ID       | 情境      | 描述                                                                                          | 影響                                                                    |
| -------- | --------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **CR-1** | 4.1       | `.agents/memory/.pending/` 目錄初始化未保證                                                   | MCP down 時 sub-agent 寫 buffer → ENOENT crash → 整個 fallback 機制失效 |
| **CR-2** | 4.5 + 2.3 | PENDING_ACTIONS.md fresh init 缺自修復；舊 ROUTING_TICKET 未歸檔；CONVERSATION_COUNTER 累計缺 | sandbox 重啟 / fresh deploy 後 state machine 無法啟動；audit 週期漂移   |
| **CR-3** | 2.4       | PROPOSAL_INDEX.md §🔗 意圖繼承表**根本不存在**                                                | ADR-0020 已 Accepted 但未實施；意圖衝突檢測無法執行                     |
| **CR-4** | 2.1       | S3.5 (Prior Art Gate) → S4 無主動暫停機制                                                     | User 忽視 🔴 通知時無 auto-escalation；可能跳過 Prior Art 進實作        |
| **CR-5** | 2.1       | S6 ↔ 6.5 (Reviewer/Security) 並行無 ROUTING_TICKET queue 同步                                 | @Reviewer 反覆退件時 @Security 派發狀態漂移                             |

### 3.2 🟡 High（8 項；功能性缺口）

| ID   | 情境 | 描述                                                                                    |
| ---- | ---- | --------------------------------------------------------------------------------------- |
| HG-1 | 1.3  | doc-sync 模式 Stage 8b Gate 條件未補；architect-dod-checklist 存在性未驗                |
| HG-2 | 1.4  | @Architect 跳過條件未規範化；strategyWeight 敏感參數無強制檢查入口                      |
| HG-3 | 1.4  | lane-routing 20 項缺 config 常數類型；ROUTING_TICKET task_class 缺 config-adjust enum   |
| HG-4 | 4.3  | @Reviewer 側無等價 REVIEW_QUALITY_FAIL 通知（@Security 有 SECURITY_AUDIT_FAIL；不對稱） |
| HG-5 | 4.4  | Compress 失敗恢復路徑模糊；無 retry vs escalate 決策規則                                |
| HG-6 | 4.1  | .pending/ replay 多並發 sub-agent 寫入無 lock 機制                                      |
| HG-7 | 4.2  | memory_hint='no strong match' 寫入但下游 agent 無差異化行為                             |
| HG-8 | 5.4  | Antigravity / Web / Qwen drift baseline 全未實測（PROPOSAL_502_021 C-2/C-3 deferred）   |

### 3.3 🟢 Medium（14 項；觀察 / 文件化建議）

mode-aware DoD 等價性無實證（C-1/E-1/E-3/E-4）/ mempalace 降級邊界（A-1）/ CONVERSATION_COUNTER 跨 session（A-2）/ §🔗 更新責任鏈（B-6）/ PROPOSAL_TOTAL_WARN(50) 警示（B-10）/ Audit Step 0 mempalace fallback（B-8）/ baseline_comparison Δ aggregate（B-9）/ 成本量化基準（C-2）/ SC trigger 通知分級（C-3）/ Light 豁免記錄（C-4）/ workflow-stage-validator 缺（F-5）/ 低引用 ADR-0023/0024/0032（F-6）/ rationale ≥ 100 字實際 10-30（E-1）/ task_class 派發時實時驗證（A-7）

---

## 四、Token 成本驗證（與 TOKEN_COST_ANALYSIS_REPORT 比對）

| 情境            | 報告估算 | 模擬實算                                                        | 偏差          |
| --------------- | -------- | --------------------------------------------------------------- | ------------- |
| Cold start      | 10,200   | ~2-3K（simple lane）/ ~10K（含 wake-up）                        | ✅ 合理範圍   |
| Single dispatch | 24,500   | ~7K（小型 bug fix）~ 24K（含 ROUTING_TICKET 完整 schema + DoD） | ✅ 合理       |
| Audit serial    | 38,200   | ~38K（5 維度共用 + 整合）                                       | ✅ 對齊       |
| Hotfix heavy    | 102,000  | 框架無量化；無法驗                                              | ⚠️ **缺基準** |
| Large feature   | 208,000  | 模擬未深入估；保留                                              | ⚠️ 待補       |

**結論**：成本估算對齊度高；Hotfix 缺實測基準（已列為 🟢 medium 項）。

---

## 五、優先修復路線圖

### Phase A — 🔴 Critical（建議立即；本 sprint）

| #          | 動作                                                                                                                                                                   | 工時     | 對應 ID |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1          | `init-workspace.mjs` + `session-start-checklist.md` 補 `.agents/memory/.pending/` mkdir 保證                                                                           | 1h       | CR-1    |
| 2          | `tasks/session-start-checklist.md` Step 5 fresh init 補 ROUTING_TICKET auto-archive；CONVERSATION_COUNTER cross-session strategy（git-tracked or wall-clock fallback） | 2-3h     | CR-2    |
| 3          | `gen-proposal-index.mjs` 補 §🔗 意圖繼承表生成邏輯；PROPOSAL_INDEX.md 模板加區塊                                                                                       | 2h       | CR-3    |
| 4          | `lead.md §s06b` Prior Art Gate 加 `🔴 PRIOR_ART_VERIFY_PENDING` 主動暫停 + auto-escalation 巡邏條目                                                                    | 1h       | CR-4    |
| 5          | `lead.md §s_complexity_lane` 補 PENDING_DISPATCHES queue 對 S6/6.5 並行的 child queue 同步                                                                             | 2h       | CR-5    |
| **A 合計** | —                                                                                                                                                                      | **8-9h** | —       |

### Phase B — 🟡 High（下 sprint）

| #          | 動作                                                                                              | 工時                                  |
| ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 6          | `lead.md §s_complexity_lane` 補「skip @Architect 條件 + strategyWeight 強制檢查」                 | 1-2h                                  |
| 7          | `routing-ticket-protocol.md` task_class 加 `config-adjust` enum；lane-routing 20 項補 config 類型 | 1h                                    |
| 8          | `reviewer.md §s05` 補 REVIEW_QUALITY_FAIL 對等通知；對齊 @Security SECURITY_AUDIT_FAIL            | 1h                                    |
| 9          | `memory-operations.md §6.4` 補 compress 失敗 retry vs escalate SOP                                | 1h                                    |
| 10         | `.pending/` replay 加 file-based lock（`.pending/.lock`）+ retry-with-backoff                     | 2h                                    |
| 11         | sub-agent 收 `memory_hint: 'no strong match'` 行為差異化（如強制 prior art scan）                 | 1h                                    |
| 12         | Antigravity / Web / Qwen 補實測（C-2/C-3 deferred；含 drift baseline）                            | User-side（無 Claude Code 環境工時）  |
| **B 合計** | —                                                                                                 | **7-8h（不含 12 的 user-side 部分）** |

### Phase C — 🟢 Medium（觀察期 / 文件化）

14 項；多為文件化或 follow-up 觀察；總工時 **6-10h**；可分批吸收。

### 總工時

- Phase A：8-9h（critical）
- Phase B：7-8h（high）
- Phase C：6-10h（medium；分批）
- **合計：21-27h**（單人 1 週可完）

---

## 六、建議下一步

3 個方向供選：

- **(A) 立 PROPOSAL_502_023 跑 Phase A**（9h；只解 critical 阻斷項）：最高 ROI；解的都是會直接 crash 或失效的點
- **(B) 立 PROPOSAL_502_023 + 024 跑 Phase A+B**（17h；critical + high）：完整健壯化
- **(C) 暫不執行**：先觀察 Plan G + harness-neutral + token 優化（502_020/021/022）在實際使用 1-2 週，看 critical 項是否真的觸發；若 mempalace MCP 穩定且不需 fresh deploy，CR-1/CR-2 影響低

**個人傾向 (A)**：CR-1（.pending/ 缺 mkdir）和 CR-3（§🔗 表不存在）都是「文件聲稱但執行層真的沒做」的 silent failure；CR-2/CR-4/CR-5 是邊緣場景但很容易在 fresh deploy / 真實 sandbox 重啟時觸發。9h 工時投入 vs 風險規避，ROI 高。

---

## 七、附錄

### 7.1 模擬方法論

- 6 並行 Explore subagent；每個處理 1 批次 4-5 情境
- 每情境 5 軸檢查：傳遞路徑 / 檔案完整性 / handoff 整合 / iron-theme / 異常
- 純靜態追蹤（不執行；不修改檔案）
- 總 token ~700K；wall-clock ~25 min

### 7.2 檢查覆蓋範圍

- `rules/*.md`：13 份（全覆蓋）
- `iron-rules/*.md`：6 份（全覆蓋）
- `decisions/000X-*.md`：39 份（全覆蓋）
- `skills/*.md`：核心 ~15 份重點檢查
- `tasks/*.md`：核心 ~10 份重點檢查
- `tests/*.mjs`：16 validators 引用驗證

### 7.3 已知限制

- 靜態追蹤無法驗證「LLM 實際行為」（如 mode-aware DoD 是否真等價）；需 dynamic 模擬
- Antigravity / Qwen / Web 真實環境驗證未做（本文僅基於 Claude CLI 推斷）
- 部分缺口可能因「LLM 自然防護」實際不嚴重（如 fresh init 時 LLM 看到 PENDING_ACTIONS 缺失會主動建立）；保守列為 critical

### 7.4 Related

- `TOKEN_COST_ANALYSIS_REPORT.md`（成本基準）
- `CROSS_HARNESS_REPORT.md`（C-1 baseline）
- `PROPOSAL_502_019/020/021/022`（v6.27 → v6.31 演進歷程）
