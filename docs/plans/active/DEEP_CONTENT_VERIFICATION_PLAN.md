---
type: plan
status: in-progress
last_updated: 2026-09-11
progress: 0%
tags:
  - verification
  - deep-validation
  - documentation
wiki_links:
  - [[Documentation]]
  - [[Strategy Engine]]
---

# 模組文件內容深度驗證計畫

> **目標**: 逐一驗證每個模組文件的描述與實際代碼邏輯是否一致  
> **範圍**: 核心模組優先（Strategy, AI News, Presentation, Infrastructure）  
> **預估時間**: 8-12h（分批執行）

---

## 📊 驗證範圍

### 優先級分類

| 優先級 | 模組           | 文件數 | 預估時間 | 原因         |
| ------ | -------------- | ------ | -------- | ------------ |
| **P0** | Strategy       | 6      | 4h       | 核心投資邏輯 |
| **P0** | AI News        | 11     | 3h       | 新聞分析管線 |
| **P1** | Presentation   | 5      | 2h       | 使用者界面   |
| **P1** | Infrastructure | 3      | 1h       | 資料管理     |
| **P2** | Operations     | 2      | 1h       | 運維配置     |

---

## 🔍 驗證方法

### 對每個文件執行：

1. **讀取文件描述**
   - 提取宣稱的功能
   - 提取關鍵參數/常數
   - 提取流程圖/演算法

2. **讀取對應代碼**
   - 驗證函數存在性
   - 驗證參數/常數值
   - 驗證邏輯流程

3. **比對差異**
   - 記錄不一致處
   - 分類嚴重程度（Critical/Medium/Low）
   - 建議修正方向

4. **測試覆蓋檢查**
   - 確認關鍵邏輯有測試
   - 標記測試缺口

---

## 📋 驗證清單

### P0 - Strategy 模組（6 個文件）

#### 1. ✅ BUDGET_PRIORITY_DESIGN.md + budgetLimitPolicy.mjs

- **狀態**: 已驗證（2026-09-11）
- **結果**: ✅ 核心邏輯一致，2 個次要差異已修正
- **報告**: docs/verification/STRATEGY_LOGIC_VERIFICATION_REPORT.md

#### 2. ⬜ strategy_engine.md + strategyEngine.mjs

- **關鍵功能**:
  - Decision Chain 決策鏈
  - Signal 生成邏輯
  - Target allocation 計算
- **驗證項目**:
  - [ ] Decision Rules 執行順序
  - [ ] Signal weightScore 計算
  - [ ] cooldownStatus 冷卻期邏輯
  - [ ] targetAllocation 配置計算

#### 3. ⬜ lifecycle_engine.md + lifecycleEngine.mjs

- **關鍵功能**:
  - 生命週期階段判斷
  - 槓桿上限調整
  - 退休倒數計算
- **驗證項目**:
  - [ ] 階段定義（GROWTH/MATURE/PRE_RETIRE）
  - [ ] 年齡/目標退休年齡計算
  - [ ] 槓桿係數調整邏輯

#### 4. ⬜ maintenance_state_machine.md + marginStateMachine.mjs

- **關鍵功能**:
  - 維持率 4 層狀態機
  - 狀態轉換條件
  - Layer 3/2/1/0 行為
- **驗證項目**:
  - [ ] Layer 門檻值（180%/160%/145%/135%）
  - [ ] 狀態轉換邏輯
  - [ ] 各層級操作限制

#### 5. ⬜ regime_policy.md + regimePolicy.mjs

- **關鍵功能**:
  - 市場狀態判斷（BULL/BEAR/NEUTRAL）
  - Regime 轉換條件
  - 策略參數調整
- **驗證項目**:
  - [ ] 狀態判斷指標
  - [ ] 轉換門檻
  - [ ] 參數覆寫邏輯

#### 6. ⬜ providers.md + newsFetcher.mjs

- **關鍵功能**:
  - 資料來源管理
  - Provider 介面
  - 錯誤處理與 fallback
- **驗證項目**:
  - [ ] Provider 列表
  - [ ] 介面契約
  - [ ] 容錯機制

---

### P0 - AI News 模組（11 個文件）

#### 1. ⬜ ai_pipeline.md + aiClient.mjs

- **關鍵功能**:
  - AI 呼叫流程
  - Retry 機制
  - Langfuse 追蹤
- **驗證項目**:
  - [ ] callAI 函數簽名
  - [ ] Retry 策略（次數/延遲）
  - [ ] Langfuse 整合點

#### 2. ⬜ keyword_config.md + keywordConfig.mjs

- **關鍵功能**:
  - 靜態關鍵字載入
  - 動態關鍵字更新
  - 黑名單過濾
- **驗證項目**:
  - [ ] 關鍵字檔案路徑
  - [ ] 動態詞更新邏輯
  - [ ] 黑名單規則

#### 3. ⬜ news_fetcher.md + newsFetcher.mjs

- **關鍵功能**:
  - Google News RSS 抓取
  - 物理層過濾
  - 去重邏輯
- **驗證項目**:
  - [ ] RSS 查詢格式
  - [ ] 過濾規則
  - [ ] 去重演算法

#### 4-11. ⬜ 其他 AI News 文件

- news_fetcher.md
- integrations/langfuse_*.md (5 個)
- integrations/agent_prompts.md
- integrations/ai_coach_checklist.md

---

### P1 - Presentation 模組（5 個文件）

#### 1. ⬜ bot.md + bot.mjs

- **關鍵功能**:
  - Telegram 指令處理
  - 權限驗證
  - 指令路由
- **驗證項目**:
  - [ ] 指令列表（/daily, /news 等）
  - [ ] authMiddleware 邏輯
  - [ ] 錯誤處理

#### 2. ⬜ notifications.md + telegramHtmlBuilder.mjs

- **關鍵功能**:
  - HTML 模板生成
  - 卡片樣式
  - Markdown 轉換
- **驗證項目**:
  - [ ] 模板種類
  - [ ] 樣式定義
  - [ ] 特殊字元處理

#### 3-5. ⬜ API 文件

- portfolio_health_api.md
- report_signals_contract.md
- _index.md

---

## 🎯 執行策略

### 批次執行（避免 context 溢出）

**Batch 1**: Strategy 核心（2-4h）

- strategy_engine.md
- lifecycle_engine.md
- maintenance_state_machine.md

**Batch 2**: Strategy 延伸 + AI Pipeline（2-3h）

- regime_policy.md
- providers.md
- ai_pipeline.md
- keyword_config.md

**Batch 3**: AI News 整合（2-3h）

- news_fetcher.md
- langfuse 整合文件
- agent prompts

**Batch 4**: Presentation + Infrastructure（2h）

- bot.md
- notifications.md
- API 文件
- Infrastructure 文件

---

## 📊 驗證報告格式

對每個文件產出：

```markdown
## [模組名] / [文件名]

### 驗證結果

- ✅/⚠️/❌ 整體一致性

### 詳細比對

| 功能/參數 | 文件描述 | 代碼實作 | 一致性 | 備註 |
| --------- | -------- | -------- | ------ | ---- |
| xxx       | ...      | ...      | ✅/❌  | ...  |

### 發現的問題

1. [Critical/Medium/Low] 問題描述
   - 影響: ...
   - 建議: ...

### 測試覆蓋

- ✅/❌ 單元測試
- ✅/❌ 整合測試
- 缺口: ...
```

---

## ⏱️ 時間分配

- Batch 1: 3-4h
- Batch 2: 3-4h
- Batch 3: 2-3h
- Batch 4: 2h
- **總計**: 10-13h

**預計完成**: 分 2-3 個工作階段執行

---

## 🚀 開始執行

**當前狀態**: 等待執行指令  
**建議**: 先執行 Batch 1（Strategy 核心），產出報告後再決定後續批次

**執行指令範例**:

- "開始 Batch 1 驗證"
- "驗證 strategy_engine.md"
- "繼續下一個文件"
