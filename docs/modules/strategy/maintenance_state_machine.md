---
type: reference
status: current
last_updated: 2026-09-11
related_code:
  - src/modules/strategy/policies/marginPolicy.mjs
  - src/modules/strategy/core/marginStateMachine.mjs
tags:
  - maintenance
  - state-machine
  - automation
wiki_links:
  - [[Strategy Engine]]
---

# 維持率狀態機 4 層重構 — Strategy.json 修改說明

> 對應計畫：`docs/plans/backlog/preplan_features.md` P0【維持率狀態機 4 層重構】  
> 完成日期：2026-04-18 (Batch 3 升級)  
> 影響檔案：`strategyEngine.mjs`、`marginManager.mjs`、`telegramHtmlBuilder.mjs`

---

## ⚠️ 你需要手動修改的外部設定：Strategy.json

由於 `Strategy.json` 儲存於外部環境，請依照以下說明手動新增欄位。

### 新增欄位位置

在 `Strategy.json` 的 `"maintenance"` 物件中，新增 `frozenZone` 與 `marginCallThreshold` 兩個欄位：

```json
"maintenance": {
  "protectTrigger": 160,
  "protectTarget": 180,
  "marginCallThreshold": 135,
  "frozenZone": 145
}
```

### 新增欄位說明

| 欄位                  | 建議值 | 說明                                                                                                                                                     |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marginCallThreshold` | `135`  | 🔴 斷頭危機門檻。低於此值時系統強制發出降槓桿警示，一票否決所有加碼。原本已存在於 Strategy.json 但程式端未對應任何行動，現在已正式接入 4 層狀態機。      |
| `frozenZone`          | `145`  | 🟠 高危凍結門檻（新增）。介於 `marginCallThreshold` 與 `protectTrigger` 之間，觸發時禁止所有新進場（包含 0050 DCA 與 00675L 加碼），強烈通知補足保證金。 |

### 核心計算公式

自 Batch 3 起，維持率計算已統一由 `marginManager.mjs` 處理：

- **公式**：`維持率 = (0050 持股數 × 0050 市價) / 借貸總額`
- **原則**：僅計算擔保品（0050）市值，**不包含 00675L**。

### 既有欄位確認（無需修改）

| 欄位             | 現有值 | 說明                                                                                                         |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `protectTrigger` | `160`  | 🟡 預備金防禦門檻，維持不變。現在升格為 Layer 2，行為略有調整：文案新增「允許 0050 baseline DCA 維持」說明。 |
| `protectTarget`  | `180`  | 補足目標維持率，維持不變。                                                                                   |

---

## 4 層狀態機行為對照

| 層級                  | 維持率範圍 | 觸發欄位              | 行為                                               | Telegram 標示            |
| --------------------- | ---------- | --------------------- | -------------------------------------------------- | ------------------------ |
| 🔴 Layer 0 斷頭危機   | < 135%     | `marginCallThreshold` | 強制市價降槓桿警示，一票否決所有加碼，優先補保證金 | `🔴【斷頭危機】`         |
| 🟠 Layer 1 高危凍結   | 135–145%   | `frozenZone`          | 禁止所有新進場（含 0050 DCA），強烈通知補保證金    | `🟠【高危凍結】`         |
| 🟡 Layer 2 預備金防禦 | 145–160%   | `protectTrigger`      | 暫停 00675L 加碼，允許 0050 DCA，動用預備金        | `🛡️【維持率低於安全線】` |
| 🟢 Layer 3 常態運行   | ≥ 160%     | —                     | 策略引擎完整運作                                   | 依策略正常輸出           |

---

## 單元測試建議情境

建議於 `src/test/` 補充以下測試情境，覆蓋 4 層邊界值：

| 測試情境   | 維持率輸入 | 預期 `maintenanceLayer` | 預期 `marketStatus`      |
| ---------- | ---------- | ----------------------- | ------------------------ |
| 斷頭危機   | 120%       | `'critical'`            | `🔴【斷頭危機】`         |
| 高危邊界下 | 134%       | `'critical'`            | `🔴【斷頭危機】`         |
| 高危凍結   | 140%       | `'frozen'`              | `🟠【高危凍結】`         |
| 解凍邊界下 | 144%       | `'frozen'`              | `🟠【高危凍結】`         |
| 預備金防禦 | 155%       | `'protect'`             | `🛡️【維持率低於安全線】` |
| 常態邊界   | 160%       | `'normal'`              | 依策略正常輸出           |
| 常態健康   | 200%       | `'normal'`              | 依策略正常輸出           |

---

## 回溯相容性說明

若 `Strategy.json` 尚未新增 `marginCallThreshold` 與 `frozenZone`，程式端已設定預設值：

```javascript
const marginCallThreshold = maint.marginCallThreshold ?? 135;
const frozenZone = maint.frozenZone ?? 145;
```

即使外部設定尚未更新，4 層狀態機仍會以預設值正常運作，**不會因欄位缺失而崩潰**。建議盡快補上設定值以確保語意明確。
