---
type: plan
status: archived
last_updated: 2026-09-11
tags:
  - archived
  - historical
wiki_links: []
---

# 執行計畫：方案 A + TD-001 阻擋 + 單人

> 執行模式：循序單人，技術債優先清除再開發新功能
> 開始時間：2026-08-10
> 預估總工時：~50h (6 個工作天)

---

## ⏱ 時間盒分配

| 階段        | 任務                               | 時間盒           | 起迄日期   | 驗收標準                                  |
| ----------- | ---------------------------------- | ---------------- | ---------- | ----------------------------------------- |
| **Phase 0** | TD-001 KD/MACD 真正交叉檢測        | **8h** (1 天)    | Day 1      | 反向推導 kdCross/macdCross 回傳真實交叉點 |
|             | TD-002 Vue computed 警告修正       | **2h**           | Day 1 下午 | 測試零警告                                |
|             | TD-003 RSI 極端目標近似解          | **3h**           | Day 2 上午 | approx 回傳 results + note                |
|             | TD-005 Coverage 門檻建立           | **1h**           | Day 2 上午 | vitest.config.js 門檻生效                 |
| **Phase 1** | Simulator Phase D: 前端反向推導 UI | **16h** (2 天)   | Day 3-4    | E2E 通過、結果展示完整                    |
| **Phase 2** | Task #15 T-3.4: 參數調優 UI        | **20h** (2.5 天) | Day 5-7    | 批次模擬、敏感度分析可用                  |
| **Phase 3** | 收尾與部署準備                     | **4h**           | Day 7 下午 | 全測試通過、文件更新                      |

---

## 📅 逐日執行細節

### Day 1 (今日)：TD-001, TD-002

- [ ] 09:00-13:00 **TD-001 核心修正** (4h)
  - `forwardSimulator.mjs` 回傳 `kdArr`/`macdArr`
  - `dataAdapter.mjs` 確保提供足夠歷史資料
  - `scanner.mjs` 改為檢測「交叉瞬間」
  - `reverseEngine.mjs` 路由驗證
- [ ] 14:00-16:00 **TD-002 Vue computed 警告** (2h)
  - `StrategyConfigEditor.test.js` 改用 `editableConfig` 觸發 computed
- [ ] 16:00-17:00 **驗收**：全測試通過、scanner.test.mjs 新增交叉測試案例

### Day 2：TD-003, TD-005, 整合驗收

- [ ] 09:00-12:00 **TD-003 RSI 極端目標** (3h)
  - `rsiSolver.mjs` approx 時回傳 results + note
  - `reverseEngine.mjs` 接收 approx 不視為不可達
- [ ] 13:00-14:00 **TD-005 Coverage 門檻** (1h)
  - `vitest.config.js` 設定 thresholds
- [ ] 14:00-17:00 **整合測試驗收** (3h)
  - `npm test` 全通過
  - `simulateRoute.test.mjs` 反向推導全類型驗證
  - E2E simulator.spec.js 反向推導測試補完

### Day 3-4：Phase D 前端 UI

- [ ] SimulatorView 反向推導 Tab 完善
- [ ] 結果卡片：達成價格、迭代次數、掃描範圍、假設條件
- [ ] 歷史記錄、參數預設值、錯誤狀態處理
- [ ] E2E 測試新增：反向推導完整流程

### Day 5-7：T-3.4 參數調優 UI

- [ ] 批次模擬介面
- [ ] 敏感度分析圖表
- [ ] Pareto 前沿視覺化
- [ ] 匯出 CSV/JSON

---

## 🛑 閘門條件

| 閘門                | 條件                              | 未通過處理             |
| ------------------- | --------------------------------- | ---------------------- |
| **G0 (Day 1 結束)** | TD-001, TD-002 完成、所有測試通過 | 延後 Phase D，優先修復 |
| **G1 (Day 2 結束)** | TD-003, TD-005 完成、整合測試全綠 | 不進入 Phase D         |
| **G2 (Day 4 結束)** | Phase D E2E 10+ 測試通過          | 延長 1 天修復          |
| **G3 (Day 7 結束)** | T-3.4 核心功能可用、全測試綠      | 移交下一輪迭代         |

---

## 📝 執行日誌

> 由執行者即時更新

| 日期       | 階段       | 完成項目 | 遇到問題 | 決策/解決       |
| ---------- | ---------- | -------- | -------- | --------------- |
| 2026-08-10 | Day 1 開始 | -        | -        | 開始執行 TD-001 |

---

## 🔧 當前狀態

**執行中：Day 1 - TD-001 KD/MACD 真正交叉檢測**

下一步：修改 `forwardSimulator.mjs` 回傳 `kdArr`/`macdArr`
