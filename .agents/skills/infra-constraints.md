# Skill: Infrastructure Constraints
# 基礎設施限制手冊（通用）

> 本文件定義**通用**的外部服務 API 限制與反向代理使用原則。
> 專案特定的資源上限（CPU / 記憶體 / 儲存 / 網路）、PM2 命名、Nginx 設定檔位置 → 參照 workspace `DEPLOYMENT_CONSTRAINTS` 欄位。
>
> 依 PROPOSAL_20260422_022 Phase C 從原 Oracle 特定內容拆分為通用形式。

---

## PM2 使用規範（通用原則）

1. **Process 命名規範**：
 - 統一採用 **專案前綴 + 功能簡稱** 格式（例：`<project_prefix>-<role>`）。
 - 實際前綴由 workspace `DEPLOYMENT_CONSTRAINTS.process_naming` 定義。
 - 禁止使用無前綴的通用名稱（例：`api` / `worker`），避免與其他專案衝突。

2. **重啟策略 (max_memory_restart)**：
 - 必須設定 `max_memory_restart`，數值依 workspace `DEPLOYMENT_CONSTRAINTS.memory` 決定（通常為總記憶體的 30–50%）。
 - 避免單一 process 記憶體洩漏累積導致 OOM。

3. **Log 管理**：
 - 搭配 `pm2-logrotate` 模組；建議單檔上限 **20 MB**，保留最近 **10 個檔案**。
 - 日誌統一輸出為結構化 JSON（`--log-date-format` + JSON formatter）便於後續分析。

4. **Cluster 模式條件**：
 - 僅在 CPU ≥ 4 cores 且各 process 記憶體需求明確下啟用。
 - 單機 File-based 儲存架構**原則上不建議 cluster**（多進程寫入易產生鎖競爭）。

---

## Nginx 反向代理角色定義（通用）

1. **職責邊界**：
 - ✅ 反向代理（轉發至應用層 PM2 / 應用伺服器）
 - ✅ SSL 終止（Let's Encrypt / Certbot）
 - ✅ 靜態資源服務（`dist/` 等 SPA 產物）
 - ✅ Rate limiting（基於 IP 或 header）

2. **禁止事項**：
 - ❌ 在 Nginx 層執行任何業務邏輯判斷（條件分支 / 認證解析）
 - ❌ 以 Lua / JS module 執行商業規則
 - ❌ 存取資料庫或檔案儲存

3. **設定檔位置**：
 - 由 workspace `DEPLOYMENT_CONSTRAINTS.nginx_config_path` 決定；本 skill 不硬編碼路徑。

---

## Telegram Bot API 限制（通用）

1. **訊息發送頻率**：
 - 同一 Bot 對**同一聊天室** ≤ **1 則/秒**
 - 同一 Bot **全域** ≤ **30 則/秒**
 - 超速觸發 HTTP 429 → 必須實作 **Exponential Backoff**，不可直接丟棄訊息

2. **訊息長度上限**：
 - 純文字訊息 ≤ **4,096 字元**
 - Caption（圖片/影片說明）≤ **1,024 字元**
 - 超長訊息必須自動切分或改為檔案附件

3. **Webhook 規範**：
 - Webhook endpoint 必須使用 **HTTPS**（HTTP 會被 Telegram 拒絕）
 - 每次 Webhook 回應必須在 **60 秒內完成**，超時 Telegram 會重試
 - **絕對禁止** 在 Webhook handler 內執行長時間運算；應立即回應 200 再非同步處理（Queue / Worker）

4. **錯誤處理**：
 - HTTP 429 → Exponential Backoff 重試
 - HTTP 403（用戶封鎖 Bot）→ 標記為 unreachable，下次不再嘗試推送
 - HTTP 400（格式錯誤）→ 記錄並丟棄，不重試

---

## 外部 API 存取的通用防護

1. **Timeout 強制**：
 - 所有外部 API 呼叫必須配置 **AbortController** 或統一封裝的 `fetchWithTimeout`
 - Timeout 上限 **30 秒**（對齊 `tech-stacks/web-backend/nodejs-esm-backend.md`）

2. **Rate Limiting 遵守**：
 - 所有外部 API 的官方 Rate Limit 必須記錄於 workspace `TECH_STACK.external_dependency` 或相應欄位
 - 實作時採用 Token Bucket 或 Sliding Window 演算法確保不超速

3. **失效降級**：
 - 外部 API 失效時必須有**降級行為**（例：使用快取 / 跳過非關鍵流程）
 - 降級策略由 workspace `BUSINESS_RULES` 或對應欄位定義

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: infra-constraints
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用約束**；專案特定資源上限由 workspace 注入。請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Skill 概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| CPU 核心數 | `DEPLOYMENT_CONSTRAINTS.cpu` | 缺失 → 假設單核；禁用 cluster 模式 |
| 記憶體上限 | `DEPLOYMENT_CONSTRAINTS.memory` | 缺失 → 假設 512 MB；`max_memory_restart` 預設 256 MB |
| 儲存容量 | `DEPLOYMENT_CONSTRAINTS.storage_limit` | 缺失 → 警告；不觸發自動清理 |
| 網路流量限制 | `DEPLOYMENT_CONSTRAINTS.network_limit` | 缺失 → 警告；不限制 Polling 架構 |
| PM2 程序命名前綴 | `DEPLOYMENT_CONSTRAINTS.process_naming` | 缺失 → `@Lead` 阻斷 PM2 相關任務，要求補填 |
| Nginx 設定檔位置 | `DEPLOYMENT_CONSTRAINTS.nginx_config_path` | 缺失 → 警告；Nginx 相關任務改為 User 裁決 |
| 部署目標平台 | `DEPLOYMENT_CONSTRAINTS.target` | 缺失 → 警告；無法套用平台特定優化（ARM 相容性等）|

**引用規範**：本 skill 描述**通用 API 限制與反向代理原則**；workspace 描述**資源上限與命名規範**。

---

## 擴充說明

<!--
 維護說明：當 Telegram / 外部 API 官方調整限制時，
 由 @Backend 或 @Architect 提案更新此文件（通用部分），
 並通知 @Lead 更新 Skills Mapping。
-->

---

## Related Decisions

- [ADR-0004](../decisions/0004-file-based-concurrency-protection.md) — File-based 並行防護 + PM2
- [ADR-0015](../decisions/0015-tech-stacks-purity.md) — Tech-Stacks 純淨原則
