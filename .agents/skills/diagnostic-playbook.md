# Skill: Diagnostic Playbook（系統性診斷 SOP）

> 對齊 `RULES_DESIGN_GUIDE §十九` 三支柱之支柱 1（診斷組）。

## 一、適用時機

- **主要場景**：Hotfix Fast Lane 觸發（`emergency-shutdown-playbook §三`）
- **次要場景**：正常流程開發階段遇到難以定位的 bug（@Architect 可選用）
- **不適用**：純功能開發 / 設計階段 / 規則提案討論

## 二、五步診斷 SOP

### Step 1：收集現象（Evidence Gathering）

- [ ] 事故發生時間、觸發條件、受影響範圍
- [ ] 錯誤訊息 / 堆疊追蹤（stack trace）完整複製
- [ ] 相關日誌（系統 log / PM2 log / 應用 log）時間窗口 ±10 min
- [ ] User 回報的重現步驟（若有）

### Step 2：最小重現（Minimal Reproduction）

- [ ] 能在本機 / staging 重現？若不能 → 標示「生產限定」並搜集生產環境差異（環境變數 / 資料量 / 併發量）
- [ ] 縮減重現步驟到最小集合
- [ ] 確認重現穩定性（100% / 間歇性 / 首次）

### Step 3：二分法定位（Bisection）

- [ ] `git log --oneline -30 <涉及檔案>` 找可疑 commit
- [ ] `git bisect` 若必要（適用回歸型 bug）
- [ ] 讀取相關 `tech-stacks/*.md` 確認語言 / 框架行為
- [ ] 讀取相關 `skills/*.md`（如 `concurrency-guard-pattern` 若涉併發）

### Step 4：根因假設驗證（Root Cause Hypothesis）

- [ ] 列出 **≥ 2 個**可能根因假設（避免單一假設誤導）
- [ ] 每個假設標示支持證據 + 反證
- [ ] 選擇證據最強的假設作為主根因
- [ ] 記錄被排除假設（供未來類似事故參考）

### Step 5：影響範圍評估（Impact Scoping）

- [ ] 同樣根因是否存在於其他模組？（grep / 靜態分析）
- [ ] 修復是否需同步調整相關單元測試？
- [ ] 是否涉及資料遷移 / migration？
- [ ] **是否為資安敏感（SC-01~SC-10 任一）→ 觸發 `@Security` 平行介入**（對齊 `RULES_DESIGN_GUIDE §十九.C`）

## 三、診斷組協作規範

**組成**：修復實作者（`@Backend` 或 `@Frontend`）+ `@Reviewer`

**三段式職責切換**：

| 階段 | 實作者角色    | @Reviewer 角色                                 |
| ---- | ------------- | ---------------------------------------------- |
| 診斷 | 主導 Step 1-5 | **第二雙眼睛**：質疑假設、補盲點；**不做審查** |
| 實作 | 修復實作      | 不介入                                         |
| 審查 | 接收審查      | 回歸審查角色（`hotfix-checklist Step 2`）      |

**關鍵分離**：

- 診斷階段 `@Reviewer` 不評判「程式碼品質 / 風格」，只評判「根因假設是否站得住腳」
- 避免思維混淆：診斷 = 探索未知；審查 = 驗證對錯
- 職責切換時 `@Lead` 發 Gate Check 明示：「診斷完成 → 進入實作 → 審查」三個階段轉換點

**共識達成**：診斷組需達成「主根因 + 修復範圍」書面共識，才進入實作。共識未達成 → `@Lead` 升級 User 裁決。

## 四、事故上下文包格式（對齊 `RULES_DESIGN_GUIDE §十九.D`）

`@Lead` 派發診斷組時附以下上下文：

```yaml
incident_context:
  critical_paths: [<workspace.CRITICAL_PATHS.* 相關項>]
  relevant_tech_stacks: [<tech-stacks/*.md 相關項>]
  business_rules_excerpt: <workspace.BUSINESS_RULES 相關節錄>
  deployment_constraints: <workspace.DEPLOYMENT_CONSTRAINTS.* 相關項>
  source_modules: [<workspace.PATHS.source_modules.* 相關項>]
  related_skills: [<skills/*.md 相關方法論，如 concurrency-guard-pattern>]
  sc_evaluation:
  triggered: <true|false>
  sc_codes: [<SC-XX list if triggered>]
  reason: <若 false，說明為何不觸發；若 true，哪些證據指向 SC>
```

診斷組收到後首先驗證上下文包完整性；有缺漏 → 向 `@Lead` 要求補齊（不自行補找，保持 @Lead 派發職責集中）。

## 五、診斷記錄產出

診斷組完成 Step 1-5 後產出 `DIAGNOSIS_NOTE.md`（儲存至 `docs/plans/diagnosis/<事故名稱>.md`）：

```markdown
# DIAGNOSIS_NOTE — <事故名稱>

> 建立日期：<YYYY-MM-DD>
> 診斷組：<@Backend|@Frontend> + @Reviewer
> 上下文來源：@Lead 派發訊息 `Incident-Context`

## 一、現象

<Step 1 產出>

## 二、最小重現

<Step 2 產出>

## 三、二分法定位

<Step 3 產出>

## 四、根因假設

| 假設      | 支持證據 | 反證 | 結論                |
| --------- | -------- | ---- | ------------------- |
| H1：<...> | ...      | ...  | ✅ 主根因 / ❌ 排除 |

## 五、影響範圍

<Step 5 產出>

## 六、修復範圍（由實作者執行）

- 修改檔案：[<list>]
- 修改函式：[<list>]
- 單元測試更新：[<list>]
- 是否 SC 敏感：<true|false + SC 代碼>

## 七、診斷組共識簽核

- `@Backend|@Frontend`：<簽核時間>
- `@Reviewer`：<簽核時間>
```

## 六、禁止行為

- **絕對禁止** 診斷階段 `@Reviewer` 越俎代庖實作修復（實作者職責）
- **絕對禁止** 診斷階段 `@Reviewer` 做程式碼風格審查（思維混淆）
- **絕對禁止** 診斷組共識未達成即進入實作
- **絕對禁止** Step 5 忽略 SC-XX 評估（資安漏洞放大）
- **絕對禁止** `DIAGNOSIS_NOTE.md` 未完成即進入 `hotfix-checklist Step 2`
- **絕對禁止** 單人診斷模式套用於 D1-D4 觸發事故

## 七、溯源

- 建立提案：PROPOSAL_20260423_003
- 對齊：`RULES_DESIGN_GUIDE §十九 Hotfix 診斷強化三支柱`
- 搭配：`tasks/hotfix-checklist.md` / `tasks/emergency-shutdown-playbook.md`
- 觸發條件：`RULES_DESIGN_GUIDE §十九.B` D1-D4
- 類別：**F2**（通用方法論 + workspace 引用；對齊 `RULES_DESIGN_GUIDE §十六.F`）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: diagnostic-playbook
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用診斷方法論**；專案特定關鍵路徑 / tech-stacks / 源碼位置由 workspace 注入（由 @Lead 派發時打包）。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念                   | Workspace 欄位              | Fallback 行為                          |
| -------------------------- | --------------------------- | -------------------------------------- |
| 關鍵路徑（事故涉及）       | `CRITICAL_PATHS.*`          | 阻斷：無關鍵路徑清單禁止啟動診斷       |
| 源碼模組位置               | `PATHS.source_modules.*`    | 警告：使用預設 `src/` 搜尋             |
| 部署約束（資源限制）       | `DEPLOYMENT_CONSTRAINTS.*`  | 略過（若事故非資源相關）               |
| 業務規則（觸發條件參考）   | `BUSINESS_RULES`            | 警告：無業務規則無法驗證根因假設合理性 |
| 資安範疇擴充（SC-XX 補強） | `SECURITY_SCOPE_EXTENSIONS` | 略過（使用 SC-01~SC-10 基礎清單）      |

---

## Related Decisions

- [ADR-0008](../decisions/0008-hotfix-dual-track.md) — Hotfix 雙軌流程
- [ADR-0012](../decisions/0012-diagnostic-team.md) — 診斷組機制（D1-D4）
