---
stack_name: file-based-storage
file_type: tech_stack
category: storage
class: F2
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
manifest_entry: file-based-storage
depends_on: []
audience:
  - Backend
referenced_by:
  - rules/backend.md
---

# Tech Stack: File-based Storage

> 純通用技術棧；專案特定路徑 / 儲存容量 / 歸檔實作細節 → 參照 §專案特化參照 對應 workspace 欄位。

## 儲存架構 (Storage Architecture)

1. **無關聯式資料庫的取捨**：
   - 專案以 JSON / CSV 等檔案格式持久化資料於單一資料根目錄中。
   - 優點：零部署依賴、易於版本控管、小型專案成本極低。
   - 限制：無交易語意、無索引、併發寫入需自行防護。

2. **原子寫入與競態防護 (Atomic Write & Race Condition)**：
   - 更新檔案時必須採用 **Atomic 寫入** 或實作 **檔案層級互斥鎖 (Mutex Lock)**，防止多程序 / 排程同時覆寫同一檔案。
   - **絕對禁止**：使用 `fs.existsSync` 檢查後再接續 `fs.writeFileSync` 的分段寫法（此為 TOCTOU 漏洞）。
   - **唯一正確作法**：使用 `fs.openSync(path, 'wx')` 依賴作業系統 Write-Exclusive 原語；檔案存在時直接拋 `EEXIST`，藉此判定搶鎖成功與否。
   - **替代實作**：寫入臨時檔後 `fs.renameSync` 原子替換（POSIX 保證同 inode rename 為原子操作）。

3. **歷史備份與歸檔**：
   - 資料具歷史價值時，必須透過**專案指定的歸檔模組**執行歸檔；不得由各業務模組自行管理備份。
   - 歸檔策略（旋轉 / 壓縮 / 刪除）由 workspace `DEPLOYMENT_CONSTRAINTS.storage_limit` 決定。

## 受限資源環境下的實踐 (Resource-Constrained Practices)

1. **記憶體極簡化**：
   - 處理大量資料時嚴禁一次性載入陣列；應採 **批次處理 (Batching)** 或 **Stream API**（`fs.createReadStream` / `readline`）。
   - 記憶體上限由 workspace `DEPLOYMENT_CONSTRAINTS.memory` 決定；超出時必須切分批次。

2. **運算效能考量**：
   - 新增複雜計算（統計 / 機器學習 / 大量字串處理）必須評估 CPU 時間，避免長期霸佔導致 Watchdog（PM2 / systemd）重啟。
   - 長任務拆分為 **chunked async** 或 **Worker threads**，讓事件迴圈可插入其他任務。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: file-based-storage
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 的具體路徑、容量上限、歸檔模組位置皆由 workspace 注入；請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Tech-stack 概念  | Workspace 欄位                         | Fallback 行為                                       |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| 資料根目錄       | `PATHS.data_root`                      | 缺失 → `@Lead` 阻斷所有寫入任務，要求 User 補填     |
| 儲存模組實作位置 | `PATHS.source_modules.storage`         | 缺失 → `@Lead` 改以「請實作儲存模組」任務升級       |
| 歸檔模組實作位置 | `PATHS.source_modules.archive`         | 缺失 → 允許 warning；歸檔行為降級為 inline 實作     |
| 記憶體上限       | `DEPLOYMENT_CONSTRAINTS.memory`        | 缺失 → 警告；批次大小降級為保守預設（1000 筆/批次） |
| 儲存容量上限     | `DEPLOYMENT_CONSTRAINTS.storage_limit` | 缺失 → 警告；不觸發自動清理                         |

**引用規範**：本 tech-stack 描述**概念與鐵律**；workspace 描述**路徑與數值**。違反此分離原則視為提案意圖回退（對齊 `RULES_DESIGN_GUIDE §十六`）。
