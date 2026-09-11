---
type: report
status: archived
last_updated: 2026-09-10
tags:
  - audit
  - history
wiki_links: []
---

# AI Agent 品質審計歷史紀錄

> 由 PROPOSAL_20260422_008 建立。`@Auditor` 每次執行評審後 append 一行。
> 保留期：12 個月滾動（依 `RULES_DESIGN_GUIDE §十四` 之 `AUDIT_HISTORY_RETAIN_MONTHS`）
> 超過保留期自動歸檔至 `docs/Reports/archive/audit/`

## 評分歷史

| 日期       | 觸發                        | 維度 1 | 維度 2 | 維度 3   | 維度 4 | 維度 5 | 整體     | 關鍵風險                              | 備註                                                                                                                                                                                               |
| ---------- | --------------------------- | ------ | ------ | -------- | ------ | ------ | -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-22 | 手動                        | 4.25   | 4.33   | 3.33     | 4.00   | 2.00   | **3.58** | R1~R10（詳見 §關鍵風險索引）          | 首次評審；PROPOSAL_008~014 配套建立中                                                                                                                                                              |
| 2026-04-22 | 手動（@Auditor 首次）       | 4.67   | 4.67   | 3.90     | 4.67   | 4.17   | **4.42** | R11~R15（新識別）                     | 7 提案執行後驗證；全維度 ≥ 3.90 → 未觸發 P-15                                                                                                                                                      |
| 2026-04-22 | 手動（PROPOSAL_022+023 後） | 4.60   | 4.60   | **3.83** | 4.67   | 4.37   | **4.41** | R16~R22（新識別）                     | 第三次評審；PROPOSAL_022+023 執行後驗證；**子項 3.2 模型分層路由 = 2.8 < 3.0 → 觸發 P-15 🟡 AUDIT_QUALITY**；5 並行子 Agent 派遣完整調用 16/18 Fragment                                            |
| 2026-04-23 | 手動（5 批提案全部完成後）  | 4.80   | 4.58   | **4.50** | 4.67   | 4.53   | **4.62** | R23~R26（新識別，均 🟡 降級保守評估） | 第四次評審；**P-15 AUDIT_QUALITY 🟡 解除**（3.2: 2.8→4.5，Δ+1.7）；全部 10 份提案（024~032+026）執行完成；5 並行子 Agent 派遣調用 18/18 Fragment；2.4 Orchestration + 3.4 Cost Efficiency 首次使用 |

## 細項分數變化（四次評審對比）

| 細項                             | 首次 | 第二次 | 第三次  | **第四次** | Δ(3→4)   | 本次驅動                                                                                                  |
| -------------------------------- | ---- | ------ | ------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
| 1.1 Persona                      | 4.8  | 4.9    | 4.8     | 4.9        | +0.1     | 專案脈絡注入標準化（PROPOSAL_002+006）+ §s_output_strict 機讀角色                                         |
| 1.2 負面約束                     | 4.2  | 4.6    | 4.8     | 4.9        | +0.1     | PROPOSAL_023 scope 禁止 + PROPOSAL_024+032 force_complex 禁止 + PROPOSAL_026 黑板禁止；125 條「絕對禁止」 |
| 1.3 Few-Shot                     | 3.5  | 4.5    | 4.6     | 4.9        | +0.3     | **PROPOSAL_030 執行**：新建 assistant-examples + reviewer-security-examples；11/11 Agent 覆蓋             |
| 1.4 Token 經濟                   | 4.5  | 4.7    | 4.2     | 4.5        | +0.3     | **PROPOSAL_026 執行**：lead/assistant 四大外部化；複合 token -52%                                         |
| 2.1 模組化                       | 4.0  | 4.5    | 4.5     | 4.5        | 0.0      | 維持；五分法穩健                                                                                          |
| 2.2 可觀察性                     | 5.0  | 5.0    | 4.8     | 4.8        | 0.0      | PROPOSAL_028 validator 建立但 CI/CD 未集成；保守維持                                                      |
| 2.3 MCP 符合度                   | 4.0  | 4.5    | 4.5     | 4.5        | 0.0      | PROPOSAL_029 ref-validator 建立但 pre-commit 未集成；!ref 型別系統未升級                                  |
| **2.4 Orchestration Efficiency** | —    | —      | —       | **4.5**    | 新增     | **首次使用**（PROPOSAL_027 新增 Fragment）；Hub-and-Spoke 5 項標準全達成；運行時監測缺失                  |
| 3.1 自我優化                     | 4.0  | 4.2    | 4.5     | 4.5        | 0.0      | Retro/Auditor 雙軌閉環穩定；47→54 提案納管                                                                |
| **3.2 模型分層**                 | 4.0  | 4.0    | **2.8** | **4.5**    | **+1.7** | 🎉 **PROPOSAL_024+032 執行解除 P-15**；MODEL+LANE ROUTING 雙軌                                            |
| 3.3 本地化                       | 2.0  | 3.5    | 4.2     | 4.2        | 0.0      | 維持；concurrency-guard + file-based-storage 穩定                                                         |
| **3.4 Cost Efficiency**          | —    | —      | —       | **4.8**    | 新增     | **首次使用**（PROPOSAL_027 新增 Fragment）；7 項標準幾乎完整覆蓋                                          |
| 4.1 沙盒安全                     | 3.0  | 4.5    | 4.5     | 4.5        | 0.0      | 維持；Ephemeral MicroVM 強制仍缺（非關鍵）                                                                |
| 4.2 HITL 干預                    | 5.0  | 5.0    | 5.0     | **5.0**    | 0.0      | **維持滿分**（exemption-approval-workflow + strategyWeight 零容忍）                                       |
| 4.3 法規隱私                     | 4.0  | 4.5    | 4.5     | 4.5        | 0.0      | R17/R18 User 暫不採納；評分穩定                                                                           |
| 5.1 指令遵循度                   | 3.5  | 4.5    | 4.6     | 4.7        | +0.1     | drift_score 0.957 維持；PROPOSAL_025 Mode A 驗證完整                                                      |
| 5.2 自動化評測                   | 1.5  | 4.2    | 4.5     | 4.6        | +0.1     | 驗證腳本 5→7（PROPOSAL_028+029 擴充）                                                                     |
| 5.3 Judge LLM                    | 1.0  | 3.8    | 4.0     | 4.3        | +0.3     | **PROPOSAL_027 執行**：18 Fragment + AUDIT_DECISION_LOG + validate-auditor-dispatch                       |

**整體四次變化**：3.58 → 4.42 → 4.41 → **4.62**（3→4 Δ **+0.21**）

**關鍵觀察**：

- **P-15 AUDIT_QUALITY 🟡 解除** ✅（3.2: 2.8 → 4.5，Δ +1.7；PROPOSAL_024+032 雙軌路由奏效）
- 整體 +0.21 接近先前預期 +0.24（差異 -0.03 來自 2.4 首次評審保守評分）
- 新 Fragment 2.4 / 3.4 首次使用成效良好（4.5 + 4.8）
- 維度 1 全項提升（+0.1 / +0.1 / +0.3 / +0.3）反映 PROPOSAL_026+030 執行成效
- 維度 4 完全穩定（HITL 維持滿分）

## 本次 5 維度評分明細（2026-04-23 第四次）

| 維度               | 子項分數                                                        | 維度平均 | Baseline (3rd) | Δ                        |
| ------------------ | --------------------------------------------------------------- | -------- | -------------- | ------------------------ |
| 1 — 角色與行為約束 | 1.1=4.9 / 1.2=4.9 / 1.3=4.9 / 1.4=4.5                           | **4.80** | 4.60           | **+0.20**                |
| 2 — 技術架構       | 2.1=4.5 / 2.2=4.8 / 2.3=4.5 / **2.4=4.5**（新）                 | **4.58** | 4.60           | -0.02（因 2.4 保守首評） |
| 3 — 效能優化       | 3.1=4.5 / **3.2=4.5**（P-15 解除）/ 3.3=4.2 / **3.4=4.8**（新） | **4.50** | 3.83           | **+0.67** 🎉             |
| 4 — 安全合規       | 4.1=4.5 / 4.2=**5.0** / 4.3=4.5                                 | **4.67** | 4.67           | 0.00                     |
| 5 — 品質評估       | 5.1=4.7 / 5.2=4.6 / 5.3=4.3                                     | **4.53** | 4.37           | +0.16                    |
| **整體**           | —                                                               | **4.62** | 4.41           | **+0.21**                |

## Alignment Check 結果（依 @Auditor-rubric §2.2）

| 檢查項                             | 結果                | 證據                                                                                                |
| ---------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| agents_count_match                 | ✅                  | 13 rules = agents-overview §2.1（13 行）                                                            |
| patrol_range_match                 | ✅                  | P-01~P-20（20 條）= patrol-notification-catalog                                                     |
| version_index_match                | ✅                  | RULES_VERSION_INDEX v1.5 = 實際 frontmatter                                                         |
| system_thresholds_match            | ✅                  | SYSTEM_THRESHOLDS.yaml v1.2 = §十四 對應（含 complexity_thresholds / MODEL_ROUTING / LANE_ROUTING） |
| workspace_schema_validator         | ✅ exit 0           | 44 fields / 5 required / 0 errors                                                                   |
| tech_stacks_compliance             | ✅ 8/8              | 全含 §專案特化參照 + MACHINE_READABLE anchor                                                        |
| proposal_scope_coverage            | ✅ 54/54            | 全部含 scope: frontmatter（全 framework，零錯置）                                                   |
| proposal_prefix_defined            | ✅                  | workspace `investmentlinenotify.md` 含 `proposal_prefix: ILN`                                       |
| **drift_score**                    | ✅ 0.957            | PROPOSAL_025+026 後維持 baseline（Δ=0.000）                                                         |
| **ref_validator**                  | ✅ 22/22 + 0 cycles | PROPOSAL_029 新增                                                                                   |
| **agents-overview-sync-validator** | ✅ 5/5 aligned      | PROPOSAL_028 新增                                                                                   |
| **AUDIT_DECISION_LOG 稽核**        | ✅ 5 records        | PROPOSAL_027 新增 + 本次第四次再新增 5 筆                                                           |

## 關鍵風險索引

### 首次評審（已解決）

- **R1~R10**（2026-04-22 首次）：全數由 PROPOSAL_008~014 採納執行後解除

### 第二次評審新識別風險（2026-04-22 第二次）

- **R11**：Few-Shot 僅覆蓋 5 個 Agent — ✅ **已解決**（本次驗證 10/10 核心 Agent 均有 examples 檔）
- **R12**：lead.md / assistant.md Token 仍超 1000 上限 — ⚠️ **持續惡化**（演進為 R22；擴張至 4030/3423 tokens）
- **R13**：GDPR 完整性缺 72 小時外洩通知、DPA、跨境轉移 — 🟡 **部分解決**（主項完整於 privacy-compliance.md §六~八；實現深度缺口演進為 R17）
- **R14**：@Auditor 尚未實際調用 18 份 Prompt Fragment — 🟡 **部分解決**（本次完整派遣 5 並行子 Agent + Fragment 直接貼入；但 Fragment 總數為 16/18，演進為 R19）
- **R15**：pre-commit hook 未配置 — ✅ **已解決**（.claude/settings.local.json 已配置 PreToolUse hook）

### 第三次評審新識別風險（2026-04-22 第三次，PROPOSAL_022+023 後）

- **R16** 🔴 **CRITICAL**：**模型分層路由完全缺失**（3.2 = 2.8 < 3.0 → 觸發 P-15）；系統無 Haiku/Sonnet/Opus 分流指令；所有 13 rules 統一 `TOKEN_ONDEMAND_LIMIT`（1000）；成本優化空間 20~40% 未開發。→ 需 @Retro 提案新增 lead.md §「Task Complexity Assessment」與 SYSTEM_THRESHOLDS.yaml MODEL_ROUTING 表
- **R17** 🟡：**靜態加密未啟用**；`privacy-compliance.md §四` 標註靜態加密 ❌ / 傳輸加密 ✅；敏感資料（users.json / strategy_user.json）仍以明文存放依賴 OS 755；GDPR Art.32 合規缺口；升級路徑 AES-256-GCM 已規劃但未執行
- **R18** 🟡：**Langfuse DPA 簽署狀態未確認** + **AI 模型（Gemini/Grok）資料流向 SOP 未定義**；GDPR Art.28（處理者協議）+ Art.5（資料最小化原則）潛在缺口
- **R19** 🟡：**Judge LLM Fragment 完整性追蹤不透明**；auditor-rubric-prompts.md 實際為 16 份 Fragment（維度一 4 份 + 二/三/四/五各 3 份），不及手冊所稱 18 份；無派遣時完整性自動驗證工具
- **R20** 🟡：**CI/CD pipeline 缺口**；驗證僅依賴本地 pre-commit；無 GitHub Actions 遠端自動驗證；PR merge 前無法自動檢查（影響 5.2 從 4.5 升至 5.0 的路徑）
- **R21** 🟡：**Agent 50 步 Prompt Drifting 動態模擬驗證缺失**；5.1 評分基於靜態代碼審查（state anchor / gate check 框架）；無 `agent-drift-simulator.mjs` 等動態驗證工具
- **R22** 🟡：**lead.md / assistant.md 持續 Token 超限**（R12 延續）；PROPOSAL_022+023 新增章節後擴張 +6~7%；lead.md 4030 tokens（超預算 34%）/ assistant.md 3423 tokens（超 14%）；建議模組化拆分

### 觸發通知

- 🟡 **P-15 AUDIT_QUALITY**（第三次評審觸發）：子項 3.2 分數 2.8 < AUDIT_DIMENSION_MIN_SCORE（3.0）→ 通知 `@Lead` 協調 `@Retro` 提案改善模型分層路由機制
- ✅ **P-15 解除**（2026-04-23 第四次評審驗證）：子項 3.2 分數 **4.5**（>= 3.0）；PROPOSAL_024 MODEL_ROUTING + PROPOSAL_032 LANE_ROUTING + PROPOSAL_027 Fragment 完整性三提案合力解除；通知 `@Lead` P-15 狀態由 🟡 WARNING 變更為 ✅ RESOLVED

### 第四次評審新識別風險（2026-04-23，均 🟡 降級保守評估）

- **R23** 🟡：constraints_ref `!ref` 引用 pre-commit 集成缺失；PROPOSAL_029 ref-validator 建立但尚未納入 git hook（僅於 run-all.sh 手動執行）→ 影響 2.1 / 2.3 保守分維持
- **R24** 🟡：agents-overview-sync-validator（PROPOSAL_028 建立）未進 pre-commit hook；派生視圖同步仍半自動化（@Lead Phase E 手動更新）→ 影響 2.2 保守分維持
- **R25** 🟡：Orchestration Efficiency 運行時監測缺失；stateless-routing-pattern 三鐵律靜態檢查通過但無 runtime monitor → 影響 2.4 保守評估（4.5 而非 4.8）
- **R26** 🟡：MCP Schema 型別系統未升級；constraints_ref 無參數型別註解（如 `!ref type:number bounds:[0,100]`）→ 影響 2.3 上限限制（4.5 而非 4.8）

### 第四次評審持續追蹤風險（前次延續）

- **R17**：靜態加密未啟用（User 暫不採納 #4'）→ 4.3 維持 4.5
- **R18**：Langfuse DPA + AI 資料流向 SOP（User 暫不採納 #3'）→ 4.3 維持 4.5
- **R22**：lead.md / assistant.md Token 改善但仍超限（lead 4178 / assistant 3224；已改善 -52% 複合 token）→ 1.4 提升至 4.5

---

## 第四次評審後處置（2026-04-23 User 裁決）

User 指令：「**R24 暫不採納，原因：不導入過多串接，先專注 .agents 自己的改善**」+ 要求識別類似優化並列入不採納。

### 🟢 R23 重新判定：已涵蓋（關閉）

- **原判定**：ref-validator pre-commit 集成缺失
- **重新評估**：`.claude/settings.local.json` PreToolUse hook（PROPOSAL_019 建立）已觸發 `bash run-all.sh`；run-all.sh 於批 2（PROPOSAL_028+029）整合 ref-validator 為第 5 validator
- **結論**：`git commit` → PreToolUse hook → `run-all.sh` → 執行 ref-validator（含 22/22 有效檢查）已完整鏈路；無需獨立 pre-commit hook
- **狀態**：✅ 實質已解決；不需新提案

### 🔴 暫不採納清單（User 2026-04-23 「專注 .agents 自身改善」原則）

| 風險/建議                                               | 類型                        | 暫不採納理由                                                               | 未來重評條件                             |
| ------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| **R24** agents-overview-sync CI/CD 集成                 | 外部遠端 CI/CD              | User 明確「不導入過多串接」；GitHub Actions 屬專案基礎建設                 | 若未來多人協作 / 多專案場景              |
| **R25** stateless-routing-monitor 運行時監測            | 持續背景執行 + runtime hook | 類似 R24 基礎設施需求；agent-drift-simulator Mode A（靜態）已涵蓋大部分    | 若 drift_score 持續下降 < 0.90           |
| **R21** agent-drift-simulator Mode B（動態 LLM）        | 外部 LLM API + session 衝突 | Claude Code 平台不適用（PROPOSAL_025 選項 A 已判定）                       | 若部署至獨立 CI/CD 環境                  |
| **R20** CI/CD Pipeline 遠端驗證                         | 外部 GitHub Actions         | 屬專案基礎建設（非 framework）；依 PROPOSAL_023 §十七 過濾為 project scope | 由 IMN 專案以 `ILN_PROPOSAL_*` 處理      |
| **N1** AgencyBench V2 腳本集成                          | 外部評測框架串接            | 需引入第三方基準；非 .agents 自身改善                                      | 若系統成熟度達業界通用需第三方基準驗證時 |
| **N2** constraints_ref runtime resolver（非靜態驗證）   | runtime hook                | 若僅 schema-validator 靜態驗證則歸 R26 採納範疇；runtime 解析屬過度串接    | 若 !ref 型別錯誤頻率升高                 |
| **N3** Docker / K8s / Ephemeral MicroVM 容器化沙盒      | 外部部署基礎設施            | 屬專案層；非 .agents framework                                             | 由 IMN 專案自行評估                      |
| **第三次 #3'** AI 資料流向 SOP（Langfuse DPA 簽署部分） | 商務運營                    | User 第三次已暫不採納                                                      | 多人使用 / 新 AI 供應商 / 法規升級       |
| **第三次 #4'** 敏感資料加密規範章節                     | 需實作端配套                | User 第三次已暫不採納                                                      | 任一專案啟動加密實作                     |
| **第三次 #12** Token 密度可視化表                       | —                           | User 第三次已暫不採納                                                      | PROPOSAL_026 執行後緊迫性下降            |

### 🟢 純 .agents 自身改善清單（符合 User 原則；未來可選採納）

保留於此供未來 @Retro 產提案參考；優先級低，非阻斷項。

| 建議                                        | 來源             | 純度      | 預期分數影響           | 說明                                                  |
| ------------------------------------------- | ---------------- | --------- | ---------------------- | ----------------------------------------------------- |
| **R26** MCP `!ref` 型別系統升級             | 第四次評審 Dim 2 | 💯 純內部 | 2.3: 4.5 → 4.8（+0.3） | `RULES_METADATA_SCHEMA.md` + `ref-validator.mjs` 擴充 |
| **M1** `CONSTRAINT_CATALOG.md` 統一禁止索引 | Dim 1 建議       | 💯 純內部 | 1.2: 4.9 → 5.0（+0.1） | 125 條「絕對禁止」集中索引；便於新手查詢              |
| **M2** Few-Shot 複雜度分層標註              | Dim 1 建議       | 💯 純內部 | 1.3: 4.9 → 5.0（+0.1） | 各 `*-examples.md` 標註「基礎/中等/高級」             |
| **M3** Token 預警機制 + P-21 巡邏           | Dim 1 建議       | 💯 純內部 | 1.4: 4.5 → 4.7（+0.2） | SYSTEM_THRESHOLDS 新增 TOKEN_DENSITY_THRESHOLDS       |
| **M4** lead.md 預防性二級拆分               | Dim 1 建議       | 💯 純內部 | 1.4: 4.5 → 4.8（+0.3） | 條件觸發（> 2500t）；當前已 4178t 可選                |

### 📌「專注 .agents 自身改善」原則（User 2026-04-23 裁決）

供未來 @Retro 產提案時依循：

- ✅ **優先**：修改 `.agents/` 內部檔案（rules / skills / tasks / tests / domains / workspaces 模板）
- ✅ **允許**：既有 validator 擴充（ref-validator / schema-validator 等）於 `run-all.sh` 內部整合
- ❌ **避免**：外部 CI/CD 遠端串接（GitHub Actions / GitLab CI）
- ❌ **避免**：runtime 持續監測 / 背景 daemon（runtime monitor / observability agent）
- ❌ **避免**：第三方評測 / 基準框架（AgencyBench V2 等）
- ❌ **避免**：外部 LLM 直呼（Mode B Dynamic LLM 等）
- ❌ **避免**：部署基礎設施（Docker / K8s / MicroVM）

**原則對齐**：此與 PROPOSAL_023 §十七 scope 分層治理精神一致（framework scope 應保持 `.agents/` 跨專案搬運純度；外部基礎建設屬 project scope）。

---

## 第三次評審後處置（2026-04-22 User 裁決）

User 指令「過濾掉非 Agents 的優化」+「終極目標是完善 Agents 流程」。所有建議經 PROPOSAL_023 §十七 scope 分層原則重新分類後處置如下：

### ✅ 採納轉提案（8 條 framework scope）

| 提案編號              | 對應建議                                           | 風險來源       | 優先級         |
| --------------------- | -------------------------------------------------- | -------------- | -------------- |
| PROPOSAL_20260422_024 | #1 模型分層路由                                    | R16 🔴         | P0（解 P-15）  |
| PROPOSAL_20260422_025 | #5 Agent Drift Simulator                           | R21            | P1（前置 026） |
| PROPOSAL_20260422_026 | #6 lead/assistant 模組化拆分                       | R22            | P1（依賴 025） |
| PROPOSAL_20260422_027 | #7 Judge Fragment 完整性驗證                       | R19            | P2             |
| PROPOSAL_20260422_028 | #8 agents-overview 自動同步驗證器                  | Dim 2 保守分   | P2             |
| PROPOSAL_20260422_029 | #9 !ref 自動驗證                                   | Dim 2 保守分   | P2             |
| PROPOSAL_20260422_030 | #10 examples 補充（assistant + reviewer-security） | Dim 1 深度缺口 | P2             |
| PROPOSAL_20260422_031 | #11 audit-retro-coordination SOP                   | R3             | P2             |

### 📌 未採納建議追蹤（保留供未來判斷使用）

以下建議經 User 裁決**暫不轉提案**，但保留於本記錄以供未來決策參考；若未來情境變化（如多人協作、上線多專案、合規要求升級）可重新評估：

#### 不採納項目 #3'：AI 資料流向 SOP（privacy-compliance.md §十）

- **建議內容**：擴充 `.agents/domains/privacy-compliance.md §十「AI 資料流向 SOP」`+ `.agents/skills/security-audit.md SC-11` 展開 5-10 項具體 Checklist
- **暫不採納理由**：當前主要使用者為個人；AI 資料送出範圍由使用者自行控制；GDPR 風險於個人專案場景較低
- **未來重評觸發條件**：(1) 系統開放多人使用 / (2) 引入新 AI 供應商 / (3) 法規要求升級 / (4) 第三次以後評審 4.3 持續低於 4.5
- **預期效益（採納時）**：4.3 從 4.5 → 4.7（+0.2）；整體 +0.01
- **參照風險**：R18（AI 部分）

#### 不採納項目 #4'：敏感資料加密規範章節（backend.md）

- **建議內容**：`.agents/rules/backend.md` 新增 §「敏感資料加密規範」（通用要求明文化，不含實作）
- **暫不採納理由**：當前缺乏實作端配套（src/ 加密實作為 project scope，非本框架責任）；先寫規範但無實作可能造成「規範存在但專案未遵守」的審計矛盾
- **未來重評觸發條件**：(1) 任一專案啟動加密實作 / (2) R17 進入 🔴 嚴重級別 / (3) 通過 PROPOSAL_024 模型路由實際驗證後再加碼安全
- **預期效益（採納時）**：4.1 從 4.5 → 4.7（+0.2）；整體 +0.01
- **參照風險**：R17（規範部分）

#### 不採納項目 #12：RULES_DESIGN_GUIDE §十八 Token 密度可視化表

- **建議內容**：RULES_DESIGN_GUIDE 新增 §十八 列舉所有 rules 的當前 token / 上限 / 趨勢
- **暫不採納理由**：PROPOSAL_026 lead/assistant 模組化拆分執行後，主要 Token 超限問題（R22）將解除；屆時可視化表的緊迫性下降
- **未來重評觸發條件**：(1) PROPOSAL_026 執行後仍有其他 rules 觸發 R22 類問題 / (2) Token 預算政策有重大變更 / (3) 新增 ≥ 3 個 Agent 後
- **預期效益（採納時）**：1.4 預防性維持於 4.5+；整體 < +0.01
- **參照風險**：R22 預防

### ❌ 完全過濾（非 Agents 流程，不入本框架）

以下項目經判定屬**非 Agents 流程**範疇，**不轉本框架提案**；若未來需要由 IMN 專案以 `project:investmentlinenotify` scope 提案處理：

| 項目                                    | 過濾理由                                                                        | 處理路徑                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| #2 CI/CD Pipeline（.github/workflows/） | `.github/` 不在 `.agents/` 範疇；遠端 CI 是專案基礎設施，不會隨 `.agents/` 搬運 | 由 IMN 專案以 `ILN_PROPOSAL_*` 處理（PROPOSAL_023 §十七.A） |
| Langfuse DPA 簽署 + 供應商遷移          | 商務合約簽署 / 外部服務選擇屬專案運營決策                                       | User 自行處理或由 IMN 專案處理                              |
| AES-256-GCM 加密實際程式碼              | 修改 `src/modules/` 業務層                                                      | IMN 專案實作（依本框架 #4' 規範若採納）                     |

## drift_score 記錄（依 PROPOSAL_20260422_025 Phase C）

`@Auditor` 執行 5.1 指令遵循度評審時，同步記錄 `drift_score`（由 `.agents/tests/agent-drift-simulator.mjs --mode static` 產出）。

| 日期       | drift_score | persona_stability | instruction_accuracy | boundary_adherence | 備註                                                                                                                                               |
| ---------- | ----------- | ----------------- | -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-22 | 0.957       | 0.962             | 1.000                | 0.862              | PROPOSAL_025 Mode A 首次執行；PASS（≥ 0.85）                                                                                                       |
| 2026-04-22 | 0.957       | 0.962             | 1.000                | 0.862              | PROPOSAL_026 Phase D 回歸驗證；外部化 lead §s07/s08/s11/s12 + assistant §s08 後 drift_score 維持 baseline 不變（Δ=0.000）；PASS（≥ 0.90 容許閾值） |
| 2026-04-23 | 0.957       | 0.962             | 1.000                | 0.862              | 第四次評審 run-all.sh 執行確認；PROPOSAL_027/028/029/030/031 批 1-3 執行後 drift_score 維持 baseline 不變（Δ=0.000）；PASS                         |

**紀錄規範**：

- 執行 `agent-drift-simulator.mjs --mode static` 後 append 一行
- 三項子分數依腳本輸出填寫
- drift_score < 0.70 → 對應 5.1 降分 ≥ 0.5（`@Auditor §2.2` 扣分規則）
- drift_score < 0.85 但 ≥ 0.70 → 視為警告，不直接降分

**Mode B 備註**（依 PROPOSAL_025 §七）：Mode B 動態 LLM 驗證於 Claude Code 平台不適用；本欄位當前僅反映 Mode A 結構穩定性指標，未覆蓋真實 Persona drift 量化。

## 使用規範

- 由 `@Auditor` 寫入，其他 Agent 禁止修改
- 新行格式：`| 日期 | 觸發類型 | 5 維度分數 | 整體分數 | 關鍵風險編號 | 備註 |`
- 觸發類型：`手動` / `定期`（AUDIT_INTERVAL）/ `事件`（任一維度 < 3.0）
- drift_score 記錄表由 `@Retro` 於提案執行 Phase E 補填，`@Auditor` 下次評審時引用
