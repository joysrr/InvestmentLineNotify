# Tech Stack: Node.js (ESM Strict)

> 純通用技術棧；專案特定的排程器清單 / 併發鎖模組位置 / Bot 事件邊界 → 參照 §專案特化參照 對應 workspace 欄位。

## 模組與語法標準 (Module & Syntax)

1. **純 ESM 環境**：
   - 必須使用 `import` / `export`；**絕對禁止** `require()` / `module.exports`。
   - 本地檔案引入時路徑必須明確含副檔名（例：`import x from './utils.mjs'`）；ESM 不做副檔名推斷。
   - `package.json` 設定 `"type": "module"` 使 `.js` 檔案預設為 ESM；需 CommonJS 時使用 `.cjs`。

2. **非同步處理 (Async/Await)**：
   - 全面使用 Async/Await 取代 `.then()` / `.catch()` 鏈。
   - 每個 `await` 呼叫必須在適當層級包覆 `try/catch`；禁止裸 `await` 未處理異常。
   - 避免 **Unhandled Promise Rejection**：頂層 async 函式啟動時需 `.catch()` 兜底。

## 並行與執行緒安全 (Concurrency)

1. **鎖定機制 (Locking)**：
   - 多排程器 / 多 worker 同時啟動時，所有**狀態變更類任務**必須透過**專案指定的併發鎖模組**序列化；不得由業務模組自行實作。
   - 併發鎖實作策略：File-based（`fs.openSync wx`）、Memory-based（Node 單程序）或 Distributed（Redis / DB）三選一；本 tech-stack 不規範實作選擇。

2. **無狀態 (Stateless) 執行**：
   - 排程腳本設計為無狀態；每次啟動讀取 → 執行 → 寫入 → 結束。
   - 禁止將長期狀態保留於全域變數 / 模組級閉包；長駐狀態應寫入儲存層。

## 網路連線與防錯誤 (Network & Error Handling)

1. **全面禁用無 Timeout 原生 Fetch**：
   - **絕對禁止**直接使用 `await fetch(url)`；必須統一使用專案封裝版本或強制配置 `AbortController`。
   - Timeout 上限 **30 秒**（超出需工程師豁免並記錄於 `docs/exemptions/`）。

2. **重試機制 (Retry Mechanism)**：
   - Retry 白名單必須納入 Node.js 底層網路異常：`ETIMEDOUT` / `ECONNRESET` / `fetch failed` / `EAI_AGAIN` / `ECONNREFUSED`。
   - 非網路異常（HTTP 4xx / 業務錯誤）不觸發重試；除非 workspace `BUSINESS_RULES` 明確列為可重試語意。
   - 重試次數上限 **3 次**，採 **exponential backoff**（2s / 4s / 8s）。

3. **並發防護 (Concurrency Pattern)**：
   - `Promise.all` 僅適用於「需全部成功」情境；允許部分失敗時**強制改用** `Promise.allSettled()` 以阻斷骨牌效應。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: nodejs-esm-backend
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 的具體排程清單、併發鎖位置、網路逾時值皆由 workspace 注入；請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Tech-stack 概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 併發鎖實作位置 | `PATHS.source_modules.concurrency` | 缺失 → `@Lead` 阻斷所有狀態變更任務，要求先建立鎖模組 |
| 排程任務清單 | `PATHS.schedulers` | 缺失 → 視為無排程；僅允許一次性執行任務 |
| 網路逾時上限 | `DEPLOYMENT_CONSTRAINTS.network_limit` | 缺失 → 預設 30 秒（本 tech-stack 硬上限）|
| Runtime 版本 | `DEPLOYMENT_CONSTRAINTS.runtime` | 缺失 → 警告；`@Lead` 預設假設 Node.js LTS |
| 背景程序監控 | `DEPLOYMENT_CONSTRAINTS.watchdog` | 缺失 → 警告；不觸發 PM2 / systemd 特定規範 |

**引用規範**：本 tech-stack 描述**語法與鐵律**；workspace 描述**具體模組與排程**。
