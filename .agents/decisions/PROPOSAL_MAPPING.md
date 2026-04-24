# PROPOSAL ↔ ADR Mapping

> 依 PROPOSAL_20260423_016 建立。記錄歷史 proposals/ 對應 ADR 的關係表，供搬運 / 審計 / 回溯使用。
> Batch 3 完成（2026-04-24）填入完整對照；未來新提案若產 ADR 於其 frontmatter `generates_adr` 欄位標記並同步本表。

---

## 對照表（PROPOSAL → ADR）

| PROPOSAL ID | 提案主題 | 產生 ADR | 備註 |
|-------------|---------|---------|------|
| PROPOSAL_20260422_001 | @Lead 狀態錨點與無狀態路由限制 | ADR-0001 | 三鐵律 |
| PROPOSAL_20260422_002 | workspaces/ 架構 + project-onboarding | ADR-0002 | workspace 注入 |
| PROPOSAL_20260422_003 | 審查類 Agent 機讀產出物強制規範 | —（併入 ADR-0013）| DoD 自評納入 |
| PROPOSAL_20260422_004 | @Assistant HCI 全局摘要機制 | ADR-0029 | 巡邏目錄擴充 |
| PROPOSAL_20260422_005 | assistant.md Token 縮減 | — | 純 token 優化 |
| PROPOSAL_20260422_006 | PROPOSAL-011 意圖繼承修補 | ADR-0020 | §🔗 意圖繼承 |
| PROPOSAL_20260422_007 | 提案整合性分析機制 | ADR-0020 | 設計意圖衝突偵測 |
| PROPOSAL_20260422_008 | @Auditor + 定期 5 維度評分 | ADR-0005 | Auditor 外視機制 |
| PROPOSAL_20260422_009 | Agent 行為自動化驗收框架 | —（併入 ADR-0013 / 0022）| schema-validator 納入 |
| PROPOSAL_20260422_010 | File-based 並行防護 + PM2 身份 | ADR-0004 | 並行防護 |
| PROPOSAL_20260422_011 | 隱私 + strategyWeight 流程治理 | —（併入 ADR-0011）| SC-03 strategyWeight |
| PROPOSAL_20260422_012 | DoD 自評統一化 + Gate Check Auto-Audit | ADR-0013 | DoD 框架 |
| PROPOSAL_20260422_013 | Token 優化 + Few-Shot 補齊 | — | 執行型優化 |
| PROPOSAL_20260422_014 | 系統參數 YAML 化 + P-14 機械化 | —（併入 ADR-0022 / 0029）| SYSTEM_THRESHOLDS + P-14 |
| PROPOSAL_20260422_016 | stateless-routing-pattern skill 外部化 | ADR-0001 | 三鐵律外部化 |
| PROPOSAL_20260422_021 | Rules 結構標準化（YAML+XML）| ADR-0022 | frontmatter + section |
| PROPOSAL_20260422_022 | tech-stacks 純淨分離 + WORKSPACE_SCHEMA | ADR-0015 | tech-stacks 三分法 |
| PROPOSAL_20260422_023 | 提案 Scope 分層治理 | ADR-0019 | framework/project |
| PROPOSAL_20260422_024 | 模型分層路由 | ADR-0006 | haiku/sonnet/opus |
| PROPOSAL_20260422_025 | Agent Drift Simulator | ADR-0003 | drift_score |
| PROPOSAL_20260422_026 | emergency-shutdown-playbook（初版 3 步）| ADR-0008 | Hotfix light 路徑 |
| PROPOSAL_20260422_027 | Judge Fragment 完整性驗證 | —（併入 ADR-0005）| Auditor fragments 16→18 |
| PROPOSAL_20260422_028 | agents-overview 自動同步驗證器 | —（併入 ADR-0029）| sync validator 擴充 |
| PROPOSAL_20260422_029 | !ref 自動驗證 | —（併入 ADR-0029）| ref-validator 擴充 |
| PROPOSAL_20260422_030 | examples 補充（11/11 Agent）| —（併入 ADR-0029）| Few-Shot 補齊 |
| PROPOSAL_20260422_031 | audit-retro-coordination SOP | —（併入 ADR-0005）| Auditor + Retro 協作 |
| PROPOSAL_20260422_032 | 多車道路由架構 | ADR-0007 | fast/standard/heavy |
| PROPOSAL_20260421_017 | @Assistant 通知分級統一 | ADR-0030 | 5 級符號 |
| PROPOSAL_20260421_019 | Rules 版本控制機制 | —（併入 ADR-0022）| 版本標頭 |
| PROPOSAL_20260421_020 | @Security 角色 + 系統參數單點配置 | ADR-0010 + ADR-0011 | 平行審查 + SC-01~10 |
| PROPOSAL_20260421_021 | Rules 結構標準化（YAML + XML；方案 C+F）| ADR-0022 | 同 PROPOSAL_20260422_021 |
| PROPOSAL_20260421_012 | DoD 自評機制補充 | ADR-0013 | DoD 初版 |
| PROPOSAL_20260423_001 | skills/tasks 專案特化參照 + 框架版本治理 | ADR-0016 + ADR-0023 | F1/F2/F3 + FRAMEWORK_VERSION |
| PROPOSAL_20260423_002 | Prior Art Scan 強制程序 | ADR-0014 | A+B+C 階段 |
| PROPOSAL_20260423_003 | Hotfix 診斷強化三支柱 | ADR-0011 + ADR-0012 | SC 介入 + 診斷組 |
| PROPOSAL_20260423_004 | 文件分層三原則 | ADR-0017 | .agents/docs/ vs docs/ |
| PROPOSAL_20260423_005 | 互動式 CLI 初始化工具 | —（併入 ADR-0002）| init-workspace.mjs |
| PROPOSAL_20260423_006 | scripts/ 測試框架 | —（併入 ADR-0026）| node:test + Bash |
| PROPOSAL_20260423_007 | 索引自動產生器（4 generators）| ADR-0025 | AUTO-GENERATED 基礎 |
| PROPOSAL_20260423_008 | run-all.sh 並行 + 三模式 | ADR-0026 | 並行 validator |
| PROPOSAL_20260423_009 | Hotfix 流程分輕重 | ADR-0008 | light/heavy 分軌 |
| PROPOSAL_20260423_010 | Lite Proposal 流程 | ADR-0009 | Full/Lite 分級 |
| PROPOSAL_20260423_011 | RULES_DESIGN_GUIDE 拆檔 | ADR-0018 | DESIGN/SCOPE/QUALITY |
| PROPOSAL_20260423_012 | Script 漏用防護機制 | ADR-0027 | 四道防線 |
| PROPOSAL_20260423_013 | FRAMEWORK_REQUIREMENTS runtime 規範 | ADR-0024 | Node.js + Bash + 零依賴 |
| PROPOSAL_20260423_014 | RULES_METADATA_SCHEMA frontmatter 補齊 | —（併入 ADR-0022）| schema 補齊 |
| PROPOSAL_20260423_015 | Framework/Project 分層執行 + 歷史摘要 | ADR-0019 + ADR-0028 | scope 強制 + summaries |
| PROPOSAL_20260423_016 | ADR Pattern 完整導入 | — | 本提案產生此目錄 |

---

## 對照表（ADR → 來源 PROPOSALs）

| ADR ID | 主要來源提案 | 狀態 |
|--------|------------|------|
| ADR-0001 | PROPOSAL_20260422_001 + 016 | Accepted |
| ADR-0002 | PROPOSAL_20260422_002 + 006 + 20260423_005 | Accepted |
| ADR-0003 | PROPOSAL_20260422_025 | Accepted |
| ADR-0004 | PROPOSAL_20260422_010 | Accepted |
| ADR-0005 | PROPOSAL_20260422_008 + 027 + 031 | Accepted |
| ADR-0006 | PROPOSAL_20260422_024 | Accepted |
| ADR-0007 | PROPOSAL_20260422_032 | Accepted |
| ADR-0008 | PROPOSAL_20260422_026 + 20260423_003 + 009 | Accepted |
| ADR-0009 | PROPOSAL_20260422_021 + 20260423_010 | Accepted |
| ADR-0010 | PROPOSAL_20260421_020 | Accepted |
| ADR-0011 | PROPOSAL_20260421_020 + 20260423_003 + 20260422_011 | Accepted |
| ADR-0012 | PROPOSAL_20260423_003 | Accepted |
| ADR-0013 | PROPOSAL_20260421_012 + 20260422_003 + 009 + 012 | Accepted |
| ADR-0014 | PROPOSAL_20260423_002 | Accepted |
| ADR-0015 | PROPOSAL_20260422_022 | Accepted |
| ADR-0016 | PROPOSAL_20260423_001 | Accepted |
| ADR-0017 | PROPOSAL_20260423_004 | Accepted |
| ADR-0018 | PROPOSAL_20260423_011 | Accepted |
| ADR-0019 | PROPOSAL_20260422_023 + 20260423_015 | Accepted |
| ADR-0020 | PROPOSAL_20260422_006 + 007 | Accepted |
| ADR-0021 | PROPOSAL-016 | Accepted |
| ADR-0022 | PROPOSAL_20260421_019 + 021 + 20260422_014 + 20260423_014 | Accepted |
| ADR-0023 | PROPOSAL_20260423_001 | Accepted |
| ADR-0024 | PROPOSAL_20260423_013 | Accepted |
| ADR-0025 | PROPOSAL_20260423_007 + 012 | Accepted |
| ADR-0026 | PROPOSAL_20260422_019 + 20260423_006 + 008 | Accepted |
| ADR-0027 | PROPOSAL_20260423_012 | Accepted |
| ADR-0028 | PROPOSAL_20260423_015 | Accepted |
| ADR-0029 | PROPOSAL_20260422_004 + 028 + 029 + 030 + 20260423_008 + 015 | Accepted |
| ADR-0030 | PROPOSAL_20260421_017 | Accepted |

---

## 未對應提案（不產 ADR）

以下歷史提案屬**單次修補 / 執行操作 / 純優化**性質，不適合抽象為 ADR：

| PROPOSAL ID | 性質 | 為何不轉 ADR |
|-------------|-----|-------------|
| PROPOSAL_20260421_001 ~ 016 | PROPOSAL-016 規範建立期各類初始化提案 | 初期實作；決策已併入 ADR-0001~0022 |
| PROPOSAL_20260420_001 / 002 | 併發防禦 / 測試覆蓋 | 單次修補型 |
| PROPOSAL_20260422_005 | assistant.md Token 縮減 | 純 token 優化 |
| PROPOSAL_20260422_013 | Token 優化 + Few-Shot 補齊 | 純優化 |
| PROPOSAL_20260422_015 ~ 019 | R11~R15 改善循環 | 執行型操作 |
| PROPOSAL_20260423_005 / 006 | CLI 工具 / 測試框架 | 已併入 ADR-0002 / 0026 |
| PROPOSAL_20260423_014 | METADATA_SCHEMA frontmatter（Lite）| 併入 ADR-0022 |
| PROPOSAL_20260422_020 | docs/agents-overview.md 同步 | 已 CANCELLED |
| PROPOSAL_20260423_016 | ADR Pattern 導入（本提案）| 本提案自身為工具建置；未來 ADR-0031 可記錄此機制 |

---

## 分類規則（新提案判定用）

### 產生 ADR

- 跨 Agent 行為影響（狀態錨點 / 無狀態路由）
- 重大架構抉擇（workspace 分層 / 文件分層）
- 流程分輕重（Hotfix light/heavy / Full/Lite proposal）
- 標準化規範（DoD / HITL / 通知分級）

### 不產 ADR

- Bug 修復（如 `**CANCELLED**` regex）
- 版本微調（token budget -5%）
- 文件 typo / 註記調整
- 索引維護 / 執行型操作

---

## 維護原則

- 新提案 frontmatter 若產 ADR → `generates_adr: ADR-XXXX`
- 本表可透過 Batch 6 新增 validator 驗證連結完整性
- ADR supersede 關係記錄於 ADR frontmatter `supersedes` / `superseded_by`，非本表
