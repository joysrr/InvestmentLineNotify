# Skill: 資安審查範疇與 Checklist

> 本檔由 PROPOSAL-020 建立，承擔雙重職責：
> - **§1 資安審查範疇清單** — 供 `@Lead` 判斷第 6.5 階段是否觸發 `@Security`
> - **§2 資安審查 Checklist** — 供 `@Security` 每次觸發時逐項執行
>
> 原 `.agents/tasks/security-review.md` 已廢止，內容遷移至本檔並擴充。

---

## §1 資安審查範疇清單 (Security Audit Scope)

`@Lead` 在第 6 階段（`@Reviewer` 審查）完成後，依本清單判斷本次 PR 是否觸發第 6.5 階段（`@Security` 審查）：

- **涉及任一 SC-XX** → 強制呼叫 `@Security`
- **皆不涉及** → 跳過，但必須於 `REVIEW_REPORT.md` 附註「@Security 評估：無資安範疇，依 `.agents/skills/security-audit.md §1` 判斷」

### 範疇清單

| 代碼 | 範疇名稱 | 偵測關鍵字 / 情境 |
|------|---------|-----------------|
| SC-01 | Token 時效驗證 | Telegram `initData` / JWT / OAuth state / refresh token 等時效性 Token 相關程式碼新增或修改 |
| SC-02 | 金鑰處理 | `process.env` 新增、`.env.example` 變更、任何 API Key / Bot Token / Secret 常數 |
| SC-03 | `strategyWeight` 異動 | `src/data/strategy/*` 讀寫、策略權重欄位變更、任何涉及 `strategyWeight` 的路徑 |
| SC-04 | 資料刪除 | `fs.unlink` / `fs.rm` / `DELETE` SQL / Google Sheets 刪除操作 / 任何現有紀錄的清除 |
| SC-05 | 新增對外 API 端點 | Express / Koa route 新增、Telegram Bot webhook handler 新增、任何可被外部呼叫的路由 |
| SC-06 | 檔案 Lock 競爭 | `fs.openSync` 使用、`runnerLock.mjs` 變更、原子寫入機制設計、TOCTOU 防護 |
| SC-07 | 並發資源 | Cron job 新增、Webhook handler 共享資源存取、多進程資料修改 |
| SC-08 | 錯誤訊息 | `throw new Error` 含內部資訊、`res.status` 回傳 stack trace、Log 輸出敏感路徑或資料 |
| SC-09 | 第三方套件 | `package.json` dependencies 新增或升級、`npm audit` 告警項目 |
| SC-10 | 未知資安範疇 | 本清單未涵蓋的新型資安風險（由 `@Retro` 透過提案新增條目至本清單）|
| SC-11 | 終端使用者個資（PII / GDPR）| 依 `.agents/domains/privacy-compliance.md`：PII 讀寫、資料刪除權請求、保留期 TTL 清理、審計日誌寫入、72h 外洩通知（§六）、DPA 合規（§七）、跨境轉移許可（§八）、加密現狀（§九）|

### 觸發判斷規則

- 任務涉及**單一** SC-XX → 觸發 `@Security` 僅針對該範疇執行 §2 對應分類
- 任務涉及**多個** SC-XX → 觸發 `@Security` 執行 §2 所有對應分類
- 任務**皆不涉及** SC-XX → `@Security` 跳過，`@Lead` 附註判斷依據

### 擴充方式

- 由 `@Retro` 透過 `RULE_UPDATE_PROPOSAL` 提案新增 SC 條目
- 提案必須明文定義：代碼、範疇名稱、偵測關鍵字 / 情境、對應 §2 Checklist 分類

<!-- END: §1 資安審查範疇清單 -->

---

## §2 資安審查 Checklist (Security Audit Checklist)

`@Security` 觸發時，依本 Checklist 逐項執行（依觸發的 SC-XX 範疇取用對應分類）。缺失任一項視為 🔴 `[BLOCKER]` 退件。

### 1. 金鑰與憑證（對應 SC-02 / SC-09）

- [ ] 程式碼中無任何硬寫的 Token、API Key、Secret
- [ ] 所有敏感值均透過 `process.env` 讀取
- [ ] `.env.example` 已更新但不含真實值
- [ ] Git history 中無敏感資訊（確認 `.gitignore` 覆蓋 `.env`）
- [ ] 新增第三方套件已執行 `npm audit`，無未處理的高風險 / 關鍵風險漏洞

### 2. Telegram / Token 時效驗證鐵律（對應 SC-01）

本分類適用於所有時效性驗證字串（`initData` / JWT / OAuth state / API refresh token 等）。

- [ ] 所有來自 Mini App 的請求均有 `initData` HMAC-SHA256 驗證
- [ ] **時間戳解析**：能從 Token 解析出 `auth_date` / `iat` / `nbf` 等時間欄位（不可僅做簽章）
- [ ] **到期時間檢查**：`initData` 24 小時、JWT 依 `exp` 或預設上限；**缺失即為 🔴 BLOCKER，無豁免空間**
- [ ] 驗證失敗時回傳 `401`，**絕對禁止** 執行任何業務邏輯
- [ ] Bot Token / 私鑰未出現在任何前端程式碼或 `docs/` 文件中

### 3. API 端點安全（對應 SC-05）

- [ ] 新增的 API 端點有明確的授權驗證機制
- [ ] 錯誤回應不洩漏系統內部資訊（Stack Trace、檔案路徑等，對應 SC-08）
- [ ] 輸入參數有基本的型別與範圍驗證

### 4. 併發與原子性（對應 SC-06 / SC-07）

- [ ] **絕對禁止** `fs.existsSync()` 檢查後再 `fs.writeFileSync()` 的 TOCTOU 分段寫法（已知漏洞）
- [ ] 檔案 Lock / 共用資源競爭統一使用 `fs.openSync(path, 'wx')` 獨佔模式（依 `.agents/tech-stacks/storage/file-based-storage.md`）
- [ ] Cron job 與 Webhook handler 共享資源時，必須評估並記錄鎖機制（`runnerLock.mjs` 或等效）
- [ ] 批次寫入失敗時有明確的部分成功 / 完全回滾策略

### 5. `strategyWeight` 異動審計（對應 SC-03）

- [ ] 數值變更前有現有值讀取與記錄
- [ ] 變更後有驗證邏輯（數值範圍 / 加總限制）
- [ ] 異動記錄寫入審計日誌
- [ ] 異動行為必須經 `@Consultant` → `@Lead` → `@Backend` 流程（對齊 `consultant.md` §「核心禁止條款」與 `system-prompt.md` §「全局緊急阻斷」條件三）
- [ ] **絕對禁止** 跳過流程自行修改 `strategyWeight` 數值

### 6. 資料刪除零容忍（對應 SC-04）

- [ ] **任何刪除操作**均需 User 明確授權（`@Lead` 無權單獨授權，對齊 `lead.md` §豁免授權邊界第 4 條）
- [ ] 刪除操作有完整審計日誌（時間 / 執行者 / 範圍 / 授權編號 EX-XXX）

<!-- END: §2 資安審查 Checklist -->

---

## 相關文件

- Agent 規則：`.agents/rules/security.md`
- Workflow 觸發規則：`.agents/rules/lead.md` §核心工作流引擎（第 6.5 階段）+ §平行審查與衝突仲裁規則
- 全域參數：`.agents/RULES_DESIGN_GUIDE.md` §十四（`REVIEW_CYCLE_LIMIT`）
- 巡邏兜底：`.agents/rules/assistant.md` P-11 `SECURITY_AUDIT_FAIL`

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: security-audit
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用資安審查流程**（SC-01~SC-11 基礎清單）；專案特定關鍵路徑與範疇擴充由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 專案關鍵路徑（審查強制觸發）| `CRITICAL_PATHS.*` | 阻斷：無關鍵路徑清單禁止資安審查派發 |
| 資安範疇擴充（SC-XX）| `SECURITY_SCOPE_EXTENSIONS` | 略過（使用 SC-01~SC-11 基礎清單） |

---

## Related Decisions

- [ADR-0010](../decisions/0010-parallel-review.md) — 平行審查制度
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
