---
task_id: lane-routing-task-classification
file_type: checklist
owner: @Lead
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  20 指標分流 SOP（fast / standard / heavy 車道判定）
referenced_by:
  - skills/examples/reviewer-security-boundary-examples.md
  - skills/consultant-bypass-policy.md
  - skills/lead-orchestration-guide.md
  - decisions/0007-lane-routing.md
  - docs/Reports/AUDIT_DECISION_LOG.md
  - docs/Reports/AUDIT_HISTORY.md
---

# Task: Lane Routing Task Classification（車道分流決策 SOP）

> `@Lead` 於派發子 Agent 前**必須**依本文件 20 項指標進行快車道判定；任一紅燈自動升級車道。

## 使用情境

`@Lead` 收到 User 新指令或 Gate Check 通過後，派發前執行本 task：

1. 依 `lead.md §s_complexity_lane` 三步複雜度評估得出 `simple` / `medium` / `complex`
2. 若 complexity = `simple` 且未觸發 `force_complex_scenarios` → 進入本 task 20 項指標檢核
3. 依檢核結果決定最終 `Lane:` 值（fast / standard / heavy）

## 20 項快車道安全指標 Checklist

### [檔案與依賴層級]

- [ ] **1. 檔案數**：預估修改檔案數 ≤ **3 個**
- [ ] **2. 套件依賴**：不涉及新增、刪除或升級套件依賴（`package.json` / `requirements.txt` / `go.mod` 等）
- [ ] **3. 外部服務**：不新增或修改對外部第三方服務的整合（Telegram API / OpenAI / Slack / 金流等）
- [ ] **4. 目錄結構**：不涉及專案目錄結構重構或引入新設計模式

### [資料與狀態層級]

- [ ] **5. Schema 凍結**：資料庫 / File-based Schema 絕對凍結（無新增資料表 / 欄位 / JSON 結構變更）
- [ ] **6. API 合約**：API Request/Response 合約結構不變
- [ ] **7. 狀態管理**：不修改前端全域狀態管理（Vuex/Pinia）或後端 Cache 機制
- [ ] **8. 客戶端快取**：LocalStorage / Cookie / IndexedDB 資料結構向下相容
- [ ] **9. 資料遷移**：零資料遷移（Data Migration）或排程腳本修改需求

### [系統與資安層級]

- [ ] **10. 身分驗證**：與身分驗證、權限控管、Token 簽發完全無關（對齊 `skills/security-audit.md` SC-01 / SC-02 / SC-05）
- [ ] **11. 環境變數**：無 `.env` 或等效配置檔異動
- [ ] **12. 併發鎖**：非同步、執行緒並發、鎖的邏輯凍結（對齊 `skills/concurrency-guard-pattern.md`）
- [ ] **13. 生命週期**：生命週期鉤子（Lifecycle Hooks）凍結，無初始化序列變更
- [ ] **14. 中介軟體**：不新增或修改中介軟體（Middleware）或路由攔截器（Interceptors）
- [ ] **15. 錯誤處理**：全域錯誤處理、Try-Catch、Log 機制維持不變
- [ ] **16. 演算法複雜度**：核心計算演算法複雜度低（無新增遞迴 / 巢狀迴圈 / 狀態機）
- [ ] **17. CI/CD**：不碰觸 CI/CD（`.github/workflows/` 等）與 Docker 基礎設施

### [純粹性層級]

- [ ] **18. 樣式微調**：僅限 CSS / SCSS 顏色、排版等純表面樣式微調
- [ ] **19. 文案/註解**：僅修正靜態文本、註解、或 i18n 語系字串
- [ ] **20. 測試補齊**：僅補充單元測試覆蓋率，不更動業務邏輯原始碼

## 紅燈觸發升級規則

| 違規項目                                                  | 升級目標 Lane | 理由                                         |
| --------------------------------------------------------- | ------------- | -------------------------------------------- |
| 第 10-12 項（資安 / 環境變數 / 併發）                     | 🚚 `heavy`    | **強制**；安全優先，跳過次要審查風險不可接受 |
| 第 1-9 項（檔案 / 資料 / 依賴 / 外部服務 / Schema / API） | 🚚 `heavy`    | 結構性變更需完整評估                         |
| 第 13 項（Lifecycle）                                     | 🚚 `heavy`    | 初始化序列變更影響全局                       |
| 第 14-17 項（中介軟體 / 錯誤處理 / 演算法 / CI/CD）       | 🚚 `heavy`    | 基礎設施變更需完整審查                       |
| 第 18-20 項輕度偏離                                       | 🚗 `standard` | 低風險但仍建議 @Reviewer 防呆                |
| 多項輕度觸發（非資安）                                    | 🚗 `standard` | 累積風險值得單點審查                         |

## 實際案例對照表

### 🏎️ 快車道（fast）範例 — 5 組

| #   | 任務描述                                              | 20 項全綠理由          |
| --- | ----------------------------------------------------- | ---------------------- |
| 1   | Telegram 推播訊息「Invesment」→「Investment」拼字修正 | 僅第 19 項（文案）     |
| 2   | Vue 儀表板「暫停通知」按鈕藍 → 橘紅                   | 僅第 18 項（CSS）      |
| 3   | 既有價格擷取函數補 `console.log` 時間戳記             | 僅第 19 項（註解類）   |
| 4   | `calculateROI()` 新增邊界值測試（不改原始碼）         | 僅第 20 項（測試）     |
| 5   | 設定檔預設波動閾值 1.5% → 2.0%（非 strategyWeight）   | 僅第 19 項（靜態文本） |

> ⚠️ **注意**：案例 5 若涉及 `strategyWeight` 則強制升 heavy（對齊 workspace `CRITICAL_PATHS.strategyWeight 異動路徑` + `consultant.md §核心禁止條款`）

### 🚗 標準車道（standard）範例 — 5 組

| #   | 任務描述                                                                                              | 觸發項                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 新增 GET API 端點列出追蹤股票清單                                                                     | 第 1（多檔）+ 第 6（API 合約）                                                                                                       |
| 2   | 新增折線圖 Component 並串接 API                                                                       | 第 1-3（多檔 + 套件 + API）                                                                                                          |
| 3   | 通知發送前加「週末且波動 < 5% 跳過」判斷                                                              | 第 16（演算法）                                                                                                                      |
| 4   | 表單正規表達式驗證英數字格式                                                                          | 第 5（Schema 類 rules）                                                                                                              |
| 5   | 過長函數（> 100 行）拆為三個私有函數（Clean Code）                                                    | 第 4（結構重構）+ 第 16（演算法）                                                                                                    |
| 6   | **modify-existing**：既有 endpoint 加 email 驗證 / 修 bug 非 hotfix（PROPOSAL_502_017 Q-2 / 014 N-7） | 第 5（驗證 schema）；ROUTING_TICKET 加 `task_class: modify-existing` → 可從 Stage 4 進；@Architect 條件式更 \_api.md（合約變更才更） |

### 🚚 重裝車道（heavy）範例 — 5 組

| #   | 任務描述                            | 觸發項（任一即強制）             |
| --- | ----------------------------------- | -------------------------------- |
| 1   | JSON 檔 → PostgreSQL 遷移           | 第 5（Schema）+ 第 9（資料遷移） |
| 2   | 加入 OAuth2（Line Login）+ JWT 簽發 | **第 10（身分驗證）強制**        |
| 3   | 訂閱制功能對接第三方金流 API        | 第 3（外部服務）+ 第 10          |
| 4   | 價格排程引擎抽離為獨立服務          | 第 4（架構）+ 第 17（基礎設施）  |
| 5   | 非同步並發佇列重寫（10,000 標的）   | **第 12（併發鎖）強制** + 第 16  |

## 降級防護網（auto_escalation）

對齊 `SYSTEM_THRESHOLDS.LANE_ROUTING.auto_escalation_triggers`：

### 機制 1：編譯 / 執行報錯自動升級

- **觸發**：實作 Agent 完成修改後，linter / `run-all.sh` / 測試套件返回紅燈
- **動作**：任務**強制升級至 `standard`**，喚醒 `@Reviewer` 除錯
- **紀錄**：`PENDING_ACTIONS.md` 寫入 `LANE_ESCALATION_AUTO_COMPILE_FAIL`

### 機制 2：自我懷疑自動升級

- **觸發**：實作 Agent 於執行過程發現需修改 20 項指標外的檔案
- **動作**：
- 擴展檔案 ≤ 5 份且無資安影響 → 升 `standard`
- 含資安敏感路徑（workspace `CRITICAL_PATHS` 或 SC-XX）→ 升 `heavy`
- **紀錄**：`PENDING_ACTIONS.md` 寫入 `LANE_ESCALATION_SELF_DOUBT`

### 機制 3：@Assistant P-20 巡邏事後偵測

- **掃描**：24 小時內同一類任務（same `type` + similar `ref`）觸發升級 ≥ 3 次
- **通知**：🟡 `LANE_ESCALATION` 提報 `@Retro`「20 指標分級可能不當」
- **User 指令**：`調整 20 指標 <具體項目>` 或 `確認保留現行分級 <分析摘要>`

## 人工升級通道（User 介入）

User 可於快車道執行中任意時刻下達：

- `升級標準車道 <任務描述>` → 強制升 `standard`
- `升級重裝車道 <任務描述>` → 強制升 `heavy`

`@Lead` 立即中斷當前快車道執行，重新派發至指定車道。

## 未分類情境的兜底規則

若實際任務**不符合任何車道典型案例**：

- **預設為 `standard`**（非 `fast` 也非 `heavy`）
- `@Lead` 於派發指令附上「未分類任務；預設 standard」註記
- `@Assistant` P-20 累積 24h 同類 ≥ 3 次 → 🟡 提報 `@Retro` 調整 20 指標

## 禁止行為

- **絕對禁止** `@Lead` 跳過 20 項評估直接派發快車道
- **絕對禁止** 開發者或子 Agent 自我宣稱為快車道任務而要求 `@Lead` 跳評估
- **絕對禁止** 觸發紅燈後以「此例特殊」為由強行快車道（違反記錄於 `EXEMPTION_LOG`，且 `@Security` / `@Reviewer` 範疇不接受豁免）
- **絕對禁止** 快車道中的實作 Agent 主動擴展檔案範圍而未觸發機制 2 自我懷疑升級

## 對齊的既有規則

- `lead.md §s_complexity_lane`：三步評估 + 雙軌決策
- `SYSTEM_THRESHOLDS.yaml LANE_ROUTING`：參數單一事實來源
- `skills/concurrency-guard-pattern.md`：第 12 項併發判定依據
- `skills/security-audit.md §1`：第 10 項 SC-01/02/05 判定依據
- `workspaces/<active>.md §CRITICAL_PATHS`：資安敏感路徑清單
- `skills/patrol-notification-catalog.md §A P-20`：事後偵測

## 維護規範

- 本 task 由 `@Retro` 依 PROPOSAL_20260422_032 標準維護；User 可依 P-20 提報建議調整 20 項指標
- 20 項指標調整需透過 RULE_UPDATE_PROPOSAL；本文件不可直接修改
- 案例對照表可隨業務情境擴充（建議 ≥ 5 組 / 車道）

---

## Related Decisions

- [ADR-0007](../decisions/0007-lane-routing.md) — 多車道路由
