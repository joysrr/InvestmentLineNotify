---
skill_id: consultant-bypass-rules
file_type: policy
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Consultant 戰略審查 Bypass 三步判斷流程 + 4 類允許 + 5 類禁止
referenced_by:
  - rules/lead.md
  - rules/consultant.md
  - docs/agents-overview.md
---

# Skill: Consultant Bypass Rules（戰略審查 Bypass 判定規則）

> `@Lead` 派發前判定任務是否可跳過 `@Consultant` 戰略審查（第 2 階段）的標準清單。

---

## 一、判斷流程（三步）

```
任務描述 → 步驟 1：是否完全符合「允許 Bypass」清單？
 ↓ 否
 步驟 2：是否觸及「禁止 Bypass 反例」任一項？
 ↓ 否（且步驟 1 也否）
 步驟 3：歸類為「無法歸類」→ 暫停並升級 User
```

---

## 二、✅ 允許 Bypass（任一符合即可跳過 @Consultant）

| 類別               | 具體範疇                                           |
| ------------------ | -------------------------------------------------- |
| **純 UI 視覺調整** | 顏色、排版、間距、字型、陰影、邊框等純視覺屬性變更 |
| **純文案修改**     | 按鈕文字、標題、說明、提示訊息、i18n 語系字串      |
| **基礎設施操作**   | Nginx、PM2、SSL 憑證、反向代理、Load Balancer 設定 |
| **純開發工具調整** | ESLint、Vite、測試腳本重構、CI 配置、Linter 規則   |

**判定規則**：

- 必須**完全**符合上述類別之一
- 若變更「延伸到業務邏輯」（如改 CSS 但順便重構 Vue 元件邏輯）→ 不可 Bypass
- 對齊 `tasks/lane-routing-task-classification.md` 第 18-20 項「純粹性層級」指標

---

## 三、🚨 禁止 Bypass 反例（即使看似簡單）

以下場景**絕對禁止**跳過 @Consultant，必須走完整戰略審查：

| 反例                                       | 理由                                             |
| ------------------------------------------ | ------------------------------------------------ |
| 通知觸發條件（如 RSI 閾值、MACD 金叉判定） | 交易邏輯；涉及業務風險                           |
| 通知格式或內容計算（如漲跌幅 % 計算）      | 數學運算；錯誤計算可能誤導決策                   |
| 排程頻率或執行時間變更                     | 訊號時效；影響使用者行為                         |
| 資料來源（API Provider）新增 / 移除        | 資料可靠性；涉及可用性與合規                     |
| 使用者資產配置參數（如 `strategyWeight`）  | 核心金融邏輯；對齊 `consultant.md §核心禁止條款` |

**強化連結**：

- `strategyWeight` 異動觸發 **PROPOSAL_024 `force_complex_scenarios`** → 強制 `Model: opus + Lane: heavy`
- 以上反例任一符合時，`@Lead` 必須完整派發 @Consultant + 走完 10 階段

---

## 四、專案特定 Bypass 擴充（workspace 注入）

本 skill 描述**通用** Bypass 判定原則；專案特定的 Bypass 例外需寫入 workspace：

- 於 `workspaces/<CURRENT_WORKSPACE>.md §BUSINESS_RULES` 新增 `戰略審查 Bypass 例外` 條目
- `@Lead` 派發時依 workspace 注入決策
- **絕對禁止** 於本 skill 檔案新增專案特定 Bypass 規則（違反 PROPOSAL_022 三分法純淨原則）

---

## 五、無法歸類情境的處理流程

遇到無法歸類（既不符合允許 Bypass，也不觸及禁止反例）的情境：

1. **暫停**派發
2. `@Lead` 向 User 說明：「尚未定義 Bypass 規則，無法判斷 <任務描述>」
3. User 決策：

- 「Bypass」→ 本次跳過 @Consultant
- 「不 Bypass」→ 派發 @Consultant 走完整流程

4. 任務結束時：`@Retro` 提案新增 Bypass 規則條目（經 User 採納後納入本 skill）

---

## 六、禁止行為

- **絕對禁止** `@Lead` 未經 User 授權擴大 Bypass 範圍
- **絕對禁止** 以「專案習慣」為由跳過 @Consultant（必須寫入 workspace `BUSINESS_RULES` 正式化）
- **絕對禁止** 於 Bypass 決策中引用舊提案作為依據（應查 workspace + 本 skill）
- **絕對禁止** 禁止 Bypass 反例任一項走 Fast Lane（依 PROPOSAL_032 第 18-20 項輕度偏離規則，此類應升 standard 或 heavy）

---

## 七、與其他規則對齊

- `consultant.md §核心禁止條款`：@Consultant 角色禁止越界
- `tasks/lane-routing-task-classification.md §3.4`：20 項指標之「純粹性層級」對應 Bypass 判定
- `PROPOSAL_024` `force_complex_scenarios`：`strategyWeight` / 資安 / Hotfix 強制 complex
- `workspaces/<active>.md §BUSINESS_RULES`：專案特定 Bypass 擴充位置

---

## 八、溯源

本檔案抽出自：`lead.md §s12 戰略審查 Bypass 規則`

**修訂方式**：透過 RULE_UPDATE_PROPOSAL；User 可於單一任務授權暫時性 Bypass（走 §五 無法歸類流程），事後由 @Retro 正式化。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: consultant-bypass-rules
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用 Bypass 判定鐵律**；專案特定 Bypass 例外擴充由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念             | Workspace 欄位                                  | Fallback 行為        |
| -------------------- | ----------------------------------------------- | -------------------- |
| 專案 Bypass 例外清單 | `BUSINESS_RULES`（§戰略審查 Bypass 擴充子區塊） | 略過（使用通用清單） |

---

## Related Decisions

- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 靜態注入
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
