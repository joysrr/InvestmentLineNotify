# Routing Ticket (RT-20260503-003)

## 📌 任務基本資訊

- **建立時間**：2026-05-03
- **任務名稱**：完善策略介面 UI 與 ConfigMeta 擴充
- **分配給**：`@Coder`
- **緊急程度**：Normal
- **上下文依賴**：`implementation_plan.md`

## 🎯 任務目標

1. 擴寫 `data/config/ConfigMeta.json`，涵蓋 `Strategy.json` 中所有的重點參數設定。
2. 重構前端 `webapp/src/components/StrategyConfigPanel.vue`，將 JSON 陣列攤平渲染轉換為卡片式 (Card List) 顯示，並加上對應的說明與單位。

## 📝 執行準則

- `@Coder` 注意：Vue template 裡若是 Array of Objects，請勿直接呼叫 JSON.stringify，應該走 v-for 將內部 key/value 展現。
- 若物件中存在 key 等於 `note` 或 `comment` 或 `label`，應以特殊字體或顏色呈現。
