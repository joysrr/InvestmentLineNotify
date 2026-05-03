# Routing Ticket (RT-20260503-004)

## 📌 任務基本資訊

- **建立時間**：2026-05-03
- **任務名稱**：進階策略介面 UI 與 ConfigMeta 補齊
- **分配給**：`@Coder`
- **緊急程度**：Normal
- **上下文依賴**：`implementation_plan.md`

## 🎯 任務目標

1. 補齊 `data/config/ConfigMeta.json` 中所有遺漏的技術指標與進階參數的中文說明。同時為大區塊 (如 `buy`, `sell`) 補上 Label。
2. 重構前端 `webapp/src/components/StrategyConfigPanel.vue`，將原本攤平的屬性改為依照第一層 Key 進行區塊折疊。
3. 實作搜尋列，支援依照 `label`, `path`, `desc` 進行模糊搜尋，搜尋時自動展開相關區塊。

## 📝 執行準則

- Vue 組件中需要重新調整 `flattenConfig` 的邏輯，或是修改上層 `v-for` 的走訪方式。目前 API 回傳的是 `{ strategy: { content: {...} } }`，應取 `content` 的第一層 Key 作為 Block 區塊。
- 搜尋時的展開狀態應該由計算屬性 (computed) 或 watch 處理，確保使用者體驗流暢。
