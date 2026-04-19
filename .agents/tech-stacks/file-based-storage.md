# Tech Stack: File-based JSON & Resource Constraints

## 儲存架構 (Storage)
1. **無關聯式資料庫**：系統不使用 MySQL 或 PostgreSQL。所有持久化資料以 JSON 格式儲存於 `data/` 目錄中（例如 `Strategy.json`），或透過 `src/modules/storage.mjs` 存取。
2. **防寫衝突 (Write Conflicts)**：
   - 更新 JSON 檔案時，請確保使用 Atomic 寫入或實作基本的讀寫鎖，防止多個 Runner 同時覆寫同一檔案。
   - 若資料具有歷史備份需求，必須透過 `src/modules/data/archiveManager.mjs` 進行歸檔。

## 雲端資源限制 (Oracle VM Free Tier)
1. **記憶體極簡化**：系統運行於受限資源環境。處理大量市場資料（如回測或新聞清洗）時，嚴禁將超大陣列一次性載入記憶體。應使用批次處理 (Batching) 或 Stream API。
2. **運算效能考量**：若新增複雜的量化指標（Indicators）或 AI 提示詞處理，必須評估運算時間，避免長期霸佔 CPU 資源導致 PM2 Watchdog 重啟服務。