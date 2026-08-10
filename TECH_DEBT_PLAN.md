# 技術債與待辦處理規劃

> 更新時間：2026-08-10  
> 狀態：規劃階段，待優先序確認

---

## 📋 技術債清單

| ID         | 項目                                     | 影響範圍                                     | 風險等級  | 預估工時 | 建議處理時機         |
| ---------- | ---------------------------------------- | -------------------------------------------- | --------- | -------- | -------------------- |
| **TD-001** | KD/MACD 交叉檢查器邏輯不完整             | `scanner.mjs`、`reverseEngine.mjs`、E2E 測試 | 🟡 Medium | 4-6h     | Phase D 前或併同處理 |
| **TD-002** | Vue computed readonly 警告               | `StrategyConfigEditor.vue`、單元測試         | 🟢 Low    | 1-2h     | 下次重構該檔案時     |
| **TD-003** | RSI Solver 極端目標處理                  | `rsiSolver.mjs`、API 整合測試                | 🟡 Medium | 2-3h     | 併入 Phase C 驗收    |
| **TD-004** | MA240 Bias 驗證誤差容忍                  | `analyticalSolvers.mjs`                      | 🟢 Low    | 1h       | 非阻塞，可延後       |
| **TD-005** | 缺乏 reverseEngine 整合測試覆蓋率        | `reverseEngine.test.mjs` (無覆蓋率報告)      | 🟢 Low    | 2h       | 建立覆蓋率門檻時     |
| **TD-006** | E2E 測試脆弱性 (boolean toggle, tooltip) | `strategyConfig.spec.js`                     | 🟢 Low    | 2h       | Playwright 升級時    |

---

## 🎯 待辦功能清單

| ID           | 功能                                    | 依賴                          | 預估工時 | 優先級    | 備註                              |
| ------------ | --------------------------------------- | ----------------------------- | -------- | --------- | --------------------------------- |
| **FEAT-001** | Simulator Phase D: 前端反向推導 UI 完善 | Phase B/C 完成                | 8-12h    | 🔴 High   | 結果展示、參數表單、歷史記錄      |
| **FEAT-002** | Task #15 T-3.4: 參數調優 UI             | T-3.3 完成                    | 12-16h   | 🔴 High   | 批次模擬、敏感度分析、Pareto 前沿 |
| **FEAT-003** | KD/MACD 真正交叉檢測                    | 需 `kdArr`/`macdArr` 歷史資料 | 4-6h     | 🟡 Medium | 併同 TD-001                       |
| **FEAT-004** | 多資產模擬支援 (N-asset)                | DEC-15 完成                   | 16-24h   | 🟢 Low    | 需 Strategy Engine 擴充           |
| **FEAT-005** | 回測排程自動化 (Bull + Redis)           | ADR-002                       | 8-12h    | 🟡 Medium | 生產環境部署前必備                |

---

## 📅 建議執行路徑

### 方案 A：功能優先（推薦給產品導向團隊）

```
Week 1-2: FEAT-001 (Phase D 前端 UI)
Week 3-4: FEAT-002 (T-3.4 參數調優) + TD-001 併同修正
Week 5:   FEAT-005 (排程自動化) / TD-002, TD-003 清理
```

### 方案 B：品質優先（推薦給長期維護團隊）

```
Week 1:   TD-001, TD-002, TD-003 全部清理
Week 2-3: FEAT-001 (Phase D) - 乾淨基礎上開發
Week 4-5: FEAT-002 (T-3.4)
Week 6:   FEAT-005 + 剩餘技術債
```

### 方案 C：最小可行（推薦給快速交付壓力）

```
Week 1-2: FEAT-001 (Phase D) - 僅核心流程，忽略 TD-001
Week 3:   FEAT-002 (T-3.4) - MVP 版本
Week 4:   TD-001, TD-003 修正 + FEAT-005
```

---

## 🔍 詳細技術債分析

### TD-001: KD/MACD 交叉檢查器邏輯不完整

**現況**：`scanner.mjs` 中 `createKDCrossChecker`、`createMACDCrossChecker` 僅檢查當前 K/D、MACD/Signal 大小關係

```javascript
// 現況 - 僅狀態檢查
matched = k > d; // golden cross
```

**問題**：無法檢測「交叉瞬間」（需前一根 K < D，當前 K > D）
**影響**：反向推導 `kdCross`/`macdCross` 目標結果不可信
**修正方案**：

1. `forwardSimulator` 需回傳 `kdArr`、`macdArr` 歷史陣列
2. 檢查器改為：`prev.k < prev.d && curr.k > curr.d`
3. 需確認 `dataAdapter` 提供足夠歷史資料

---

### TD-002: Vue Computed Readonly 警告

**現況**：`StrategyConfigEditor.test.js` 中對 `hasChanges`、`isValid` 等 computed 寫入測試

```javascript
// 測試中直接修改 computed
hasChanges.value = true; // ❌ 警告：computed is readonly
```

**修正方案**：

1. 測試改為透過 `editableConfig` 修改觸發 computed 重新計算
2. 或使用 `vi.spyOn` mock computed getter

---

### TD-003: RSI Solver 極端目標處理

**現況**：`rsiSolver.mjs` ±30% 範圍內無法達成極端 RSI (如 5 或 95) 時回傳 `reachable: false`
**問題**：`reverseEngine` 將 `binary_search_approx` 視為不可達，但前端可能需要「最接近解」
**修正方案**：

1. 區分「完全不可達」vs「近似解」
2. `approx` 時仍回傳 `results` + `note: "近似解"`
3. 前端顯示「最接近達成 RSI 23.75 (目標 5)」

---

### TD-004: MA240 Bias 驗證誤差容忍

**現況**：`analyticalSolvers.mjs` 允許 0.1% 誤差，超過則標記 `analytical_approx`
**風險**：低，MA240 權重 1/240，誤差極小
**處理**：記錄即可，非阻塞

---

### TD-005: 缺乏 Coverage 門檻

**現況**：Simulator 模組有測試但無強制覆蓋率門檻
**建議**：在 `vitest.config.js` 加入：

```js
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80
  }
}
```

---

### TD-006: E2E 測試脆弱性

**現況**：`strategyConfig.spec.js` 中 boolean toggle、tooltip 測試加入「跳過機制」
**風險**：測試不穩定，CI 可能誤判
**修正**：

1. 等待 Playwright 穩定版本升級
2. 或改用 `data-testid` 選擇器替代文字選擇

---

## 📊 決策矩陣

| 維度             | 方案 A (功能優先)       | 方案 B (品質優先)  | 方案 C (最小可行)   |
| ---------------- | ----------------------- | ------------------ | ------------------- |
| **交付速度**     | ⭐⭐⭐                  | ⭐⭐               | ⭐⭐⭐⭐            |
| **長期維護成本** | ⭐⭐                    | ⭐⭐⭐⭐           | ⭐                  |
| **風險暴露**     | TD-001 可能阻礙 Phase D | 最低               | TD-001, TD-003 留存 |
| **團隊士氣**     | 快速見到成果            | 扎實但較慢         | 壓力較大            |
| **推薦場景**     | 產品驗證階段、需 Demo   | 核心系統、長期演進 | 競標、截止日期硬性  |

---

## ✅ 下一步行動

請確認：

1. **偏好方案**：A / B / C 或自訂組合
2. **TD-001 優先級**：是否阻擋 Phase D 開發？（建議：是，併同處理）
3. **資源配置**：單人/雙人並行？（影響並行度）
4. **時間盒**：每個階段的硬性截止日期？

---

_此規劃文件將於開始執行前凍結，執行中發現新問題請更新此文件。_
