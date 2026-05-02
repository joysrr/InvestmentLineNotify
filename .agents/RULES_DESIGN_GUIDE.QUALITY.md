---
agent_id: design_guide_quality
agent_name: "Rules Design Guide (QUALITY subset)"
file_type: design_guide_submodule
version: v1.1
last_modified: 2026-04-24
parent: RULES_DESIGN_GUIDE.md
subject: QUALITY
last_proposal: PROPOSAL_20260424_019
audit_baseline: v1.0
trigger: manual
maintained_by: "@Retro"
content_scope: 品質與量化（Token / HITL / DoD / Checklist / 雙向邏輯測試 / 系統參數 / Prior Art Scan / Hotfix）
source_sections: [§二, §四, §七, §八, §十, §十四, §十八, §十九]
---

# RULES_DESIGN_GUIDE (QUALITY) — 品質與量化子檔

> 依 PROPOSAL_20260423_011 從 `RULES_DESIGN_GUIDE.md` 拆分。
> 聚焦「品質與量化」：Token 預算 / HITL / DoD / 新增 Rules Checklist / 系統參數 / Prior Art Scan / Hotfix 三支柱。
> 其他主題見 `RULES_DESIGN_GUIDE.DESIGN.md`（設計形式）/ `RULES_DESIGN_GUIDE.SCOPE.md`（範圍治理 + 提案輕重）。
> 主文件 `RULES_DESIGN_GUIDE.md` 為 orchestrator。

---

## 二、Token 預算規範

### 硬性上限

| 文件類型       | Token 上限   | 超標處理方式         |
| -------------- | ------------ | -------------------- |
| AlwaysOn 文件  | 500 tokens   | 強制精簡，無豁免     |
| 按需載入 Rules | 1,000 tokens | 模板外部化或結構精簡 |
| Skill 文件     | 無上限       | 依實際需求           |

### Token 估算方式

- 中英混合文件：位元組數 × 0.6 ÷ 4 ≈ Token 數
- 純中文文件：字數 × 1.5 ≈ Token 數
- 純英文文件：字數 ÷ 0.75 ≈ Token 數

### 超標時的精簡優先順序

1. 模板外部化（移至 `.agents/skills/`）
2. DoD 條目合併（同語意合為一條）
3. 流程說明壓縮（保留結構，精簡說明文字）
4. 重複語意消除（相同意思只保留一處）

---

</section>

<section id="s03" priority="normal">

## 四、HITL 最低設計要求

### 最低標準（Level 2）

新增任何 Rules 必須達到以下最低 HITL 標準：

- 顯式觸發點 ≥ 4 個
- 數值化終止條件 ≥ 1 個
- 觸發後行動明確定義（停止 / 升級 / 等待指示）

### 建議標準（Level 3）

- 顯式觸發點 ≥ 5 個
- 數值化終止條件 ≥ 2 個
- @Assistant 自動化兜底 ≥ 1 個偵測項目

### HITL 成熟度等級定義

| 等級    | 觸發點 | 數值化終止 | 自動化兜底 | 狀態持久化 |
| ------- | ------ | ---------- | ---------- | ---------- |
| Level 1 | ≤ 3    | 無         | 無         | 無         |
| Level 2 | ≥ 4    | ≥ 1        | 可選       | 可選       |
| Level 3 | ≥ 5    | ≥ 2        | ✅         | 可選       |
| Level 4 | ≥ 6    | ≥ 2        | ✅         | ✅         |

新增 Rules 最低達到 Level 2，建議目標 Level 3。

---

</section>

<section id="s05" priority="normal">

## 七、產出物 DoD 自評規範

每份 Rules 的產出物章節必須包含 3~5 條 DoD 自評條目，供 Agent 在通知 @Lead 前進行自我品質核查。

### DoD 自評格式

```markdown
## 產出物 DoD 自評

在通知 @Lead 前，@[AgentName] 必須確認：

- [ ] [最關鍵的產出物完整性條件]
- [ ] [業務安全條件（若適用）]
- [ ] [外部文件同步條件]
- [ ] [下游 Agent 可消費條件]
```

### DoD 條目設計原則

- 條目數：3~5 條（不超過 8 條）
- 每條必須可被客觀驗證（非「品質良好」等主觀判斷）
- 至少一條涉及業務安全或外部文件同步
- 合併同語意條目（不重複）

---

</section>

<section id="s08" priority="normal">

## 八、新增 Rules 前置審查 Checklist

在正式提交新增 Rules 的 RULE_UPDATE_PROPOSAL 前，設計者必須自行完成以下 Checklist：

### 結構完整性

- [ ] 六個標準章節均已包含
- [ ] 章節順序符合規範

### Token 預算

- [ ] Token 估算 ≤ 1,000（按需載入）
- [ ] 所有模板已外部化至 `.agents/skills/`
- [ ] DoD 條目 ≤ 8 條

### Persona 品質

- [ ] 任務目標包含業務脈絡三層次（What / When / How）
- [ ] 技術棧描述反映 InvestmentLineNotify 實際技術選型

### HITL 設計

- [ ] 顯式觸發點 ≥ 4 個
- [ ] 數值化終止條件 ≥ 1 個
- [ ] 每個觸發點的後續行動已明確定義

### 負面約束

- [ ] 零容忍條款使用「絕對禁止」語言
- [ ] 跨角色邊界有正向定義（遇到 X 呼叫 Y）
- [ ] 業務安全邊界優先於技術規範邊界

### 長程一致性

- [ ] 至少一個外部文件錨定機制
- [ ] 有 @Assistant 自動化兜底或等效機制

---

</section>

<section id="s09" priority="normal">

## 十、雙向邏輯測試準則 (Bidirectional Logic Testing)

> 由 PROPOSAL_20260424_019 F-1 建立（退火 PROPOSAL_20260423_017 Step 6.5 bug）；
> 補齊 §八 前置審查 Checklist 的測試覆蓋要求。

### 鐵律

任何「狀態雙向翻轉」純函式（例：`installed: true ↔ false`、`status: enable ↔ disable`、
`mode: on ↔ off`）**必須**於 `tests/scripts/unit.test.mjs`（或同等單元測試層）
補**雙方向**案例；單向測試視為覆蓋不足。

### 判定標準（機械化）

函式屬於本條約束的條件（滿足任一）：

1. 函式 mutates 一個 boolean 旗標 / enum 狀態；且
2. 呼叫點有「`A → B`」與「`B → A`」兩種業務情境；或
3. 命名含 `toggle` / `flip` / `switch` / `activate` / `deactivate` / `install` / `remove`
   / `enable` / `disable` 等雙向動詞

### 測試最低覆蓋

- 🟢 正方向（如 `false → true`）：1 case
- 🟢 反方向（如 `true → false`）：1 case
- 🟡 不存在 / no-op（如目標不在輸入集）：1 case（確保函式 idempotent + 不擲錯）

### 違規偵測

- `@QA` 代碼審查時對新加入 / 修改的「雙向翻轉」函式強制要求對偶測試
- `@Auditor` 定期 5 維度評分：若發現本條違規 → 「測試覆蓋」維度扣 0.5 分
- `@Assistant` 巡邏 P-24（若未來新增對應巡邏）：PR diff 偵測到雙向翻轉新函式但 unit.test.mjs 無對偶案例 → 🟡 WARN

### 範例

```js
// ❌ 只測 drop 方向
test('applyTechStackChoices: 未選中已安裝 → installed: false', ...);

// ✅ 補對偶
test('applyTechStackChoices: 選中未安裝 → installed: true', ...);
test('applyTechStackChoices: 未選中已安裝 → installed: false', ...);
test('applyTechStackChoices: 目標不存在 → no-op（不擲錯；modified=false）', ...);
```

### 意圖繼承聲明

本條為 PROPOSAL_20260423_006（scripts/ 測試框架 L1 30 cases）的第二階段延伸：

- 第一階段：**建立測試層**（L1 unit + L3 smoke）
- 第二階段：**測試充分性判定**（雙向邏輯必測對偶；本條）

---

## 十四、系統參數配置 (System Thresholds)

> 本章節為系統所有數值門檻的**單一配置點**。
> **實際數值存於** `.agents/SYSTEM_THRESHOLDS.yaml`。
> 本章節保留「參數分類 + 用途說明」；修改數值只需改 YAML，rules 透過 `!ref` 自動讀取。
> 各 rules 文件引用格式：「依 `RULES_DESIGN_GUIDE.md §十四` 之 `REVIEW_CYCLE_LIMIT`」

### 審查與測試循環

| 參數名               | 預設值 | 說明                                   | 引用位置                                                   |
| -------------------- | ------ | -------------------------------------- | ---------------------------------------------------------- |
| `REVIEW_CYCLE_LIMIT` | **2**  | `@Reviewer` + `@Security` 共用複審上限 | `reviewer.md` / `security.md` / `assistant.md` P-01 / P-11 |
| `QA_RETEST_LIMIT`    | **3**  | `@QA` 重測上限                         | `qa.md` / `assistant.md` P-02                              |

### 巡邏與狀態

| 參數名                  | 預設值           | 說明                    | 引用位置                                           |
| ----------------------- | ---------------- | ----------------------- | -------------------------------------------------- |
| `PATROL_CYCLE`          | **3** 個工作對話 | 標準巡邏週期            | `assistant.md` / `retro.md`                        |
| `PATROL_OVERDUE`        | **5** 個工作對話 | 即時觸發（超時保底）    | `assistant.md`                                     |
| `PENDING_YELLOW_EXPIRE` | **3** 對話       | 🟡 PENDING 過期升 🔴    | `assistant.md`                                     |
| `PENDING_RED_EXPIRE`    | **2** 對話       | 🔴 BLOCKED 高優異常過期 | `assistant.md` / `system-prompt.md` 全局阻斷條件二 |
| `PENDING_DONE_EXPIRE`   | **5** 對話       | ✅ DONE 未歸檔提示      | `assistant.md`                                     |

### 豁免與提案

| 參數名                      | 預設值    | 說明                   | 引用位置                        |
| --------------------------- | --------- | ---------------------- | ------------------------------- |
| `EXEMPTION_AUDIT_THRESHOLD` | **5** 筆  | 觸發 `@Retro` 豁免審計 | `lead.md` / `assistant.md` P-10 |
| `PROPOSAL_OPEN_WARN`        | **15** 份 | 提案 OPEN 規模警示     | `retro.md`                      |
| `PROPOSAL_UNARCHIVED_WARN`  | **10** 份 | 完成未歸檔警示         | `retro.md`                      |
| `PROPOSAL_TOTAL_WARN`       | **50** 份 | 目錄總量警示           | `retro.md`                      |

### 輸出與歸檔

| 參數名                    | 預設值           | 說明                                         | 引用位置                         |
| ------------------------- | ---------------- | -------------------------------------------- | -------------------------------- |
| `SUMMARY_STALE_THRESHOLD` | **5** 個工作對話 | 全局摘要過期觸發 P-13                        | `assistant.md §s05 P-13`         |
| `SUMMARY_HISTORY_LIMIT`   | **3** 份         | `docs/Reports/archive/summary/` 保留最新份數 | `assistant.md §s_global_summary` |

### Workspace 與專案注入

| 參數名                       | 預設值     | 說明                                                                        | 引用位置                             |
| ---------------------------- | ---------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `WORKSPACE_DEFAULT_FALLBACK` | `保守升級` | `CURRENT_WORKSPACE` 缺失時的預設行為（其他選項：`阻斷`、`建議 onboarding`） | `lead.md §s01` + `assistant.md P-12` |

### 品質審計

| 參數名                        | 預設值            | 說明                                       | 引用位置                                               |
| ----------------------------- | ----------------- | ------------------------------------------ | ------------------------------------------------------ |
| `AUDIT_INTERVAL`              | **10** 個工作對話 | `@Auditor` 定期派遣週期                    | `auditor.md` / `retro.md §定期 Judge 派遣`             |
| `AUDIT_HISTORY_RETAIN_MONTHS` | **12** 個月       | `AUDIT_HISTORY.md` 保留期                  | `auditor.md` / `.agents/docs/Reports/AUDIT_HISTORY.md` |
| `AUDIT_DIMENSION_MIN_SCORE`   | **3.0**           | 觸發 P-15 `AUDIT_QUALITY` 的單一維度最低分 | `assistant.md §s05 P-15`                               |

### Token 預算（既有，集中引用）

| 參數名                 | 預設值   | 說明                                                                                                    |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `TOKEN_ALWAYSON_LIMIT` | **500**  | AlwaysOn 文件上限（meta tier；ADR-0038 對齊；deprecated 後改用 `rule_token_thresholds.tier.meta.warn`） |
| `TOKEN_ONDEMAND_LIMIT` | **1000** | 按需載入 Rules 上限（**ADR-0038 後 deprecated**；改用 tier-based budget）                               |

#### Tier-based Rule Budget（ADR-0038；2026-05-01 起）

| `rule_category` | warn | block | 適用 file_type                             |
| --------------- | ---- | ----- | ------------------------------------------ |
| `meta`          | 500  | 1000  | always_on                                  |
| `worker`        | 1500 | 2500  | agent_rule（單一職能）                     |
| `orchestrator`  | 1800 | 3000  | agent_rule（跨 Agent 協調 / 多階段 / Hub） |

判定 4 原則（任一滿足即 orchestrator；ADR-0038 §Decision）：

1. Cross-Agent 派發職責
2. 多階段流程管理（≥ 3 階段）
3. 跨時序整合（跨多工作對話 / Sprint 累積分析）
4. Hub 性質（其他 Agent 訊息流的中介點）

不滿足任一 → worker。`file_type=always_on` 自動 meta。

SoT：`SYSTEM_THRESHOLDS.yaml::rule_token_thresholds.tier`；validators 讀此 SoT。

### 變更規範

- **絕對禁止** 直接修改本章節之參數值；任何調整必須透過 `RULE_UPDATE_PROPOSAL` 提案執行
- 調整後 `@Lead` **不必**同步更新引用文件（各文件已採參數名參照，自動套用新值）
- 本章節調整計為 `RULES_DESIGN_GUIDE.md` 的 `minor +1` 版本遞增

<!-- END: 系統參數配置 -->

</section>

<section id="s13" priority="normal">

## 十八、Prior Art Scan 強制程序

本節為 PROPOSAL_20260423_002 核心產物，確立新功能與大型改版前置「套件生態掃描」鐵律，預防「重複造輪子」造成的重工損失。

### A. 觸發條件（機械化判定）

任一條件滿足即觸發 Prior Art Scan（`@Architect` 執行；`@Lead` 派發前驗證）：

| 條件   | 量化門檻                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **C1** | `@Planner` 功能標記為 `feature`（新增）或 `major_enhancement`（User Story AC ≥ 5 條 / 跨 ≥ 3 個 `domains/` 或 `tech-stacks/`） |
| **C2** | `@Architect` 粗估預期 LOC > **500**                                                                                            |
| **C3** | User 指令明示「改版」/「重構」/「refactor」/「redesign」/「major upgrade」                                                     |

**排除條件**（任一滿足即不觸發）：

- `bugfix` / `hotfix` / `style` / `doc` / `typo` / `rename` / `refactor-minor`
- 單檔 < **100 LOC** 異動
- 純文件 / 純測試調整

### B. 執行階段（三階段）

1. **Pre-Plan Hint**（`@Planner`）— User Story 新增 `existing_solution_hint` 欄位；從 `tech-stacks/` + `skills/` 中識別類似問題可能的成熟方案 → 粗篩（不需深掃）
2. **Design Scan**（`@Architect`）— API Spec 產出**前**執行 Prior Art Scan，產出 `PRIOR_ART_REPORT.md`（結構化：候選方案 ≥ 3 含「自建」選項 + 評估矩陣 + 推薦決策 + User 驗證欄位）
3. **User Verification**（強制 HITL）— `@Lead` 於 `PRIOR_ART_REPORT.md` 產出後觸發 HITL 通知；User WebSearch / NPM / PyPI 驗證時效，User 確認前 `@Lead` **不得**派發 `@Backend` / `@Frontend` / `@QA` 實作

### C. 產出物契約

- `PRIOR_ART_REPORT.md` 儲存路徑：`docs/plans/prior-art/<功能名稱>.md`
- 必含 6 章節：**`問題陳述` / `候選方案` / `評估矩陣` / `推薦決策` / `User 驗證` / `決策依據`**
- 格式模板：`.agents/skills/templates/prior-art-report-template.md`
- 方法論與檢索關鍵字：`.agents/skills/checklists/prior-art-scan-checklist.md`

### D. HITL Gate 規範

| 階段                          | @Lead 動作                                                              | HITL 強度                              |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `@Architect` 完成 Design Scan | 發出 `PRIOR_ART_VERIFY_PENDING` 通知                                    | 🔴 **強制**；User 未確認前阻斷實作派發 |
| User 確認                     | 於 `PRIOR_ART_REPORT.md § User 驗證` 欄位填寫結論（採納 / 改選 / 自建） | —                                      |
| User 明示 Bypass              | 允許，但需記錄於 `AUDIT_HISTORY.md §豁免記錄`（對齊 §十三）             | 🟡 豁免追蹤                            |

### E. 違規偵測

| 違規類型                                         | 判定         | 處理                                               |
| ------------------------------------------------ | ------------ | -------------------------------------------------- |
| 觸發條件滿足但無 `PRIOR_ART_REPORT.md`           | 🔴 阻斷      | `@Reviewer` 審查時拒絕合併；退回 `@Architect` 補做 |
| PRIOR_ART_REPORT 候選方案 < 3 且未含「自建」選項 | 🟡 格式不符  | `@Lead` 退回補強                                   |
| User 驗證欄位空白即進入實作                      | 🔴 HITL 違規 | 立即阻斷；記錄 `@Auditor §4.2` HITL 扣分           |
| Bypass 無 AUDIT_HISTORY 豁免記錄                 | 🟡 程序違規  | `@Retro` 觸發根因分析                              |

### F. EVALUATED_PACKAGES 快取使用

- `@Architect` 執行 Prior Art Scan 前，**必須**先讀 `workspaces/<CURRENT_WORKSPACE>.md` 的 `EVALUATED_PACKAGES` 欄位
- 若候選方案已在清單中且決策為 `rejected`，需於 `PRIOR_ART_REPORT.md § 決策依據` 說明「與過去決策一致」或「新情境促成重新評估」
- Scan 完成後：User 最終決策落定 → `@Architect` append 新條目至 `EVALUATED_PACKAGES`（F2 類 workspace 注入；對齊 §十六.F）

### 禁止行為

- **絕對禁止** 觸發條件滿足但跳過 Prior Art Scan 直接進入 API Spec
- **絕對禁止** User 驗證欄位空白即派發 `@Backend` / `@Frontend` / `@QA`
- **絕對禁止** Bypass 無 AUDIT_HISTORY 豁免記錄
- **絕對禁止** 評估矩陣任一維度留白（可填「N/A」但需說明）

### 意圖繼承聲明

- **PROPOSAL_022**（tech-stacks 純淨分離）→ 本節補「選型前評估流程」形成「選型 → 採納 → tech-stacks 文件化 → 未來改版再評估」完整鏈
- **PROPOSAL_20260423_001**（skills/tasks 三態分類）→ 本節搭配的 skills / schema 依 F1 / F2 分類；`EVALUATED_PACKAGES` 為 F2 workspace 引用
- **PROPOSAL_20260422_001**（@Lead 狀態錨點）→ HITL Gate 為 @Lead 狀態轉換新阻斷條件，不改無狀態路由本質

</section>

<section id="s17" priority="normal">

## 十九、Hotfix 診斷強化三支柱

本節為 PROPOSAL_20260423_003 核心產物，補齊現行 Hotfix Fast Lane（`emergency-shutdown-playbook §三`）的三個結構性缺口：診斷單點盲點 / 資安空窗 / 上下文散落。與 §十八 語意對偶：§十八 = 事前預防（避免造 bug）；§十九 = 事後修復（bug 已發生）。

### A. 三支柱總覽

| 支柱                                  | 目標               | 核心機制                                                          | 觸發             |
| ------------------------------------- | ------------------ | ----------------------------------------------------------------- | ---------------- |
| **支柱 1：診斷組（Diagnostic Pair）** | 消除診斷單點盲點   | 事故複雜度達標 → `@Backend` 或 `@Frontend` + `@Reviewer` 雙眼診斷 | §十九.B 條件     |
| **支柱 2：@Security 條件式介入**      | 堵 Hotfix 資安空窗 | 事故涉及 `SC-01~SC-10` → @Security 強制平行介入                   | §十九.C 條件     |
| **支柱 3：@Lead 上下文注入**          | 減少診斷時間       | 派發訊息附結構化上下文包                                          | §十九.D 派發規範 |

### B. 支柱 1 — 診斷組觸發條件

任一條件滿足即強制組診斷組（`@Backend` / `@Frontend` 其一 + `@Reviewer`）：

| 條件   | 量化門檻                                                 |
| ------ | -------------------------------------------------------- |
| **D1** | 事故涉及 ≥ 2 個模組（跨後端 / 前端 / 排程 / 第三方 API） |
| **D2** | 疑似 race condition / memory leak / 併發問題             |
| **D3** | 同一模組 24h 內第 2 次 Hotfix                            |
| **D4** | User 明示「複雜事故」 / 「跨層故障」                     |

**排除條件**（任一滿足 → 維持單人診斷）：

- 事故限單一模組 + 首次發生
- 明確錯誤訊息指向特定函式（diff < 50 LOC 可定位）
- User 明示「簡單事故」

**診斷組協作規範**（見 `skills/diagnostic-playbook.md §三`）：

- 修復實作者（`@Backend` / `@Frontend`）主導，`@Reviewer` 提供「第二雙眼睛」診斷視角
- `@Reviewer` 在診斷階段**不做審查**（避免思維混淆；診斷與審查分離）
- 診斷共識達成後，修復實作者執行；`@Reviewer` 於 Step 2 回歸審查角色
- 職責切換明確：**診斷 → 實作 → 審查** 三段式

### C. 支柱 2 — @Security 條件式介入觸發

若事故涉及以下任一 SC 範疇（對齊 `skills/security-audit.md §1`），`@Lead` 必須於 Step 2 平行派發 `@Security`：

| SC 代碼 | 範疇                | Hotfix 典型情境                       |
| ------- | ------------------- | ------------------------------------- |
| SC-01   | Token 時效          | Session 失效 / Token refresh 故障     |
| SC-02   | 金鑰外洩            | ENV 洩漏 / log 敏感資料               |
| SC-03   | strategyWeight 違規 | 數值異動未授權                        |
| SC-04   | 資料刪除授權        | 刪除流程繞過 HITL                     |
| SC-05   | API 授權            | 端點未驗證 initData / JWT             |
| SC-06   | 初始資料驗證        | Telegram initData / Webhook signature |
| SC-07   | 錯誤訊息洩漏        | 堆疊訊息含路徑 / 敏感 field           |
| SC-08   | 併發原子性          | File-based 寫入無鎖                   |
| SC-09   | 第三方套件          | 依賴套件已知漏洞                      |
| SC-10   | Log 敏感資料        | access log 含 Token / PII             |

**派發時機**：@Lead 接收 Hotfix 指令後，**評估階段**判定 SC 觸發 → 於派發診斷組時**同時**派發 @Security（平行非序列）。

**與 @Reviewer 共用 REVIEW_CYCLE_LIMIT**：Hotfix 模式下 @Security 複審次數依 PROPOSAL-020 §防線 4 規則（與 @Reviewer 共用計數，預設 2 次）。

**Bypass**：若 @Lead 評估 SC 不觸發 → 必須於 `hotfix-checklist.md Step 0` 明文記錄「SC 評估：不觸發 + 理由」（對齊 §十三 豁免記錄；防止事後被追究跳過資安審查）。

### D. 支柱 3 — @Lead 上下文注入規範

**派發前準備**（`@Lead` 於強制升等後、派發診斷組前執行）：

1. **讀取**以下 workspace 欄位打包為「事故上下文包」：

- `CRITICAL_PATHS.*`（事故涉及的關鍵路徑）
- `DEPLOYMENT_CONSTRAINTS.*`（資源限制可能與事故相關）
- `BUSINESS_RULES`（業務規則可能觸發條件）
- `PATHS.source_modules.*`（相關模組原始碼位置）

2. **識別**涉及的 `tech-stacks/*.md`（如 `nodejs-esm-backend` / `vue3-vite` / `telegram-bot` / `file-based-storage`）
3. **附上**至派發訊息（格式見 `skills/diagnostic-playbook.md §四`）

**派發訊息格式擴充**：

```
Next: @Backend (+ @Reviewer 診斷組) (+ @Security 條件式)
Model: opus
Lane: heavy
Hotfix: YES
Incident-Context:
 critical_paths: [<list>]
 relevant_tech_stacks: [<list>]
 business_rules_excerpt: <snippet>
 deployment_constraints: <snippet>
Artifacts: <paths>
SC-Evaluation: <triggered|not_triggered + reason>
```

**規範邊界（符合 stateless-routing）**：

- `@Lead` 讀取 workspace 是**派發職責正常範圍**（派發必先知上下文）
- `@Lead` **不**分析根因 / **不**判斷修復方案（仍由診斷組處理）
- 對齊 PROPOSAL_20260422_001 三鐵律：派發時狀態錨點由 workspace 提供（非 @Lead 自產）

### E. 違規偵測

| 違規類型                            | 判定 | 處理                                            |
| ----------------------------------- | ---- | ----------------------------------------------- |
| 符合 D1-D4 但未組診斷組（單人診斷） | 🟡   | `@Reviewer` 審查時拒絕通過；退回補組診斷組      |
| 涉及 SC-XX 但未派發 @Security       | 🔴   | 立即阻斷；@Retro 根因分析；記錄 `AUDIT_HISTORY` |
| @Lead 派發未附 `Incident-Context`   | 🟡   | `@Assistant` P-19 / P-20 巡邏 🟡 通知           |
| @Lead 未記錄 SC 評估結論            | 🟡   | `hotfix-checklist Step 0` DoD 未達成            |

### F. 意圖繼承聲明

- **PROPOSAL_20260422_020**（@Security + SC-XX）→ 條件式介入從「正常流程第 6.5」擴展至「Hotfix 流程」
- **PROPOSAL_20260422_026**（emergency-shutdown-playbook）→ §三 Hotfix Fast Lane 補 3 支柱
- **PROPOSAL_20260422_001**（無狀態路由）→ 上下文注入屬派發職責；不違反三鐵律
- **PROPOSAL_20260423_001**（skills/tasks 三態分類）→ 新建 `diagnostic-playbook.md` 為 F2 類
- **PROPOSAL_20260423_002**（Prior Art Scan）→ 語意對偶（事前預防 vs 事後修復）
- **PROPOSAL_20260423_009**（Hotfix 輕重分級）→ 修正範圍：依事故複雜度分 light 3 步 / heavy 5 步；保留三支柱於 heavy 路徑

### G. Hotfix 輕重分級

#### G.1 分流決策表

| 事故特徵                                          | Complexity-Tier   | 步驟數 | 路徑引用                             |
| ------------------------------------------------- | ----------------- | ------ | ------------------------------------ |
| SC-01~10 任一觸發                                 | **heavy**（鎖定） | 5      | `emergency-shutdown-playbook §3.2.B` |
| D1-D4 任一觸發                                    | **heavy**         | 5      | 同上                                 |
| 跨 ≥ 2 檔修改                                     | **heavy**         | 5      | 同上                                 |
| 涉及業務邏輯 / state 變更                         | **heavy**         | 5      | 同上                                 |
| 純 typo / 設定常數 / cron 字串 + SC/D 全否 + 單檔 | **light**         | 3      | `emergency-shutdown-playbook §3.2.A` |
| 不確定                                            | **heavy**（保守） | 5      | 同上                                 |

#### G.2 決策順序（防選小路）

1. 先評估 SC-01~10 → 觸發即鎖 heavy
2. 再評估 D1-D4 → 觸發即鎖 heavy
3. 再評估影響範圍 → 跨檔即鎖 heavy
4. 再評估變更性質 → 業務邏輯即鎖 heavy
5. **最後**才可判定 light（須全前 4 項皆否）

**為何此順序**：資安 > 技術複雜度 > 範圍 > 性質；由嚴至寬，防止判定者「先看簡單處而誤入 light」。

#### G.3 禁止行為（鐵律）

- **絕對禁止** 跳過 Step 0 複雜度判定（light 路徑亦需執行）
- **絕對禁止** SC 任一觸發仍派發 `Complexity-Tier: light`
- **絕對禁止** D1-D4 任一觸發仍派發 light
- **絕對禁止** light 路徑中擴充範圍至跨檔（違者必中止並重走 Step 0）

#### G.4 違規偵測

| 違規類型                                         | 判定 | 處理                                  |
| ------------------------------------------------ | ---- | ------------------------------------- |
| Step 0 未記錄 `complexity_tier`                  | 🔴   | @Reviewer 拒絕 Gate Check；退回補判定 |
| SC/D 觸發但 tier=light                           | 🔴   | 立即阻斷；@Retro 根因提案             |
| light 路徑中跨檔修改                             | 🔴   | 立即中止；重走 Step 0 判定為 heavy    |
| light 路徑省略事後補文件（合法豁免）但未明文記錄 | 🟡   | @Lead 補註記                          |

#### G.5 語意恢復說明

本節恢復 PROPOSAL_20260422_026（原 emergency-shutdown-playbook 3 步設計）於 light 路徑；PROPOSAL_20260423_003 三支柱（診斷組 / @Security / 上下文注入）範圍縮至 heavy 路徑；此為**範圍調整**非推翻。

</section>

<section id="s18" priority="normal">

---

## Related Decisions

- [ADR-0003](decisions/0003-agent-drift-simulator.md) — Agent Drift Simulator
- [ADR-0005](decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
- [ADR-0008](decisions/0008-hotfix-dual-track.md) — Hotfix 雙軌流程
- [ADR-0011](decisions/0011-security-conditional-intervention.md) — @Security 條件式介入
- [ADR-0012](decisions/0012-diagnostic-team.md) — 診斷組機制
- [ADR-0013](decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
- [ADR-0014](decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
