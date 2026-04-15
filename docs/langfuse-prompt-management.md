# Langfuse Prompt Management

本文件說明 InvestmentLineNotify 所有 AI prompt 在 Langfuse 的管理方式與設定規範。

---

## 架構概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Langfuse Prompt Management               │
│                                                             │
│  promptName (key)    │ messages[]          │ config{}        │
│  ─────────────────── │ ─────────────────── │ ─────────────── │
│  GenerateSearchQ...  │ system + user       │ temp/mime/token │
│  FilterAndCateg...   │ system + user       │ temp/mime/think │
│  AnalyzeMacroNews    │ system + user       │ temp/mime/think │
│  InvestmentAdvice    │ system + user       │ temp/mime/think │
│  RuleOptimizer       │ system + user       │ temp/mime/token │
│  PeriodReport        │ system + user       │ temp/mime/think │
│  JudgeActionability  │ system + user       │ temp/mime/token │
│  JudgeToneEmpathy    │ system + user       │ temp/mime/token │
└─────────────────────────────────────────────────────────────┘
                              │
                    Langfuse SDK getPrompt()
                    type: 'chat'
                              │
┌─────────────────────────────┴───────────────────────────────┐
│  aiClient.mjs :: resolveChatPrompt()                        │
│                                                             │
│  messages[role=system].compile(vars) → systemInstruction    │
│  messages[role=user].compile(vars)   → resolvedUserPrompt   │
│  prompt.config                       → langfuseConfig       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│  prompts.mjs :: LANGFUSE_PROMPT_CONFIGS                     │
│  (code-side schema + fallback config)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Prompt 格式規範（Langfuse UI 設定）

### 類型：`chat`

所有 prompt 統一使用 **chat** 格式（非 text 格式），包含：
- `role: system` — System Prompt（角色定義、規則、框架）
- `role: user` — User Prompt Template（含 `{{variable}}` 插值佔位符）

### Config JSON

在 Langfuse prompt 的 `config` 欄位填入 JSON，例如：

```json
{
  "responseMimeType": "application/json",
  "temperature": 0.3,
  "maxOutputTokens": 65536,
  "thinkingConfig": {
    "thinkingLevel": "HIGH"
  }
}
```

---

## 各 Prompt 說明與插值變數

### GenerateSearchQueries

**功能**：根據市場狀態生成 Google News 動態搜尋關鍵字

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{dateStr}}` | 今天日期，例如 `2026/04/15` |
| `{{marketStatus}}` | 台股市場狀態，例如 `中性偏空` |
| `{{vix}}` | VIX 指數數值 |
| `{{staticPoolText}}` | 靜態關鍵字池文字（可為空） |

**Config**：`temperature: 0.3`, `responseMimeType: application/json`, `maxOutputTokens: 65536`

---

### FilterAndCategorizeNews

**功能**：從新聞列表中過濾並分類重要財經新聞

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{newsListText}}` | 原始新聞列表文字 |

**User Template 範例**：
```
請分析以下新聞，並依重要性排序輸出最具影響力的新聞：
<News_List>{{newsListText}}</News_List>
```

**Config**：`temperature: 0.1`, `thinkingConfig.thinkingLevel: HIGH`, `maxOutputTokens: 65536`

---

### AnalyzeMacroNews

**功能**：對過濾後的新聞進行總經多空對決分析

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{dateStr}}` | 今天日期 |
| `{{newsText}}` | 已過濾並標記的新聞文字 |

**User Template 範例**：
```
今天是 {{dateStr}}，請分析市場新聞，並輸出多空對決報告：
<News_Context>{{newsText}}</News_Context>
```

**Config**：`temperature: 0.2`, `thinkingConfig.thinkingLevel: HIGH`, `maxOutputTokens: 65536`

---

### InvestmentAdvice

**功能**：戰報教練，根據量化資料與總經分析給出投資建議

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{dateStr}}` | 今天日期 |
| `{{quantText}}` | 量化帳戶數據 JSON |
| `{{macroAndChipStr}}` | 大盤籌碼與總經位階字串 |
| `{{macroText}}` | MacroAnalysis 報告文字 |
| `{{newsSummaryText}}` | 今日新聞摘要 |

**Config**：`temperature: 0.5`, `thinkingConfig.thinkingLevel: HIGH`, `maxOutputTokens: 65536`

---

### RuleOptimizer

**功能**：分析已通過過濾器的新聞，產生新的黑名單 regex 規則

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{regionLabel}}` | 地區標籤，例如 `台股（台灣）` |
| `{{count}}` | 新聞筆數 |
| `{{titlesText}}` | 新聞標題列表文字 |

**Config**：`temperature: 0.2`, `responseMimeType: application/json`, `maxOutputTokens: 1024`

---

### PeriodReport

**功能**：週報 / 月報 AI 分析（風險事件、策略一致性、下期展望）

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{period}}` | `weekly` 或 `monthly` |
| `{{dateFrom}}` | 起始日期 |
| `{{dateTo}}` | 結束日期 |
| `{{statsJson}}` | 期間統計數據 JSON |

**Config**：`temperature: 0.3`, `thinkingConfig.thinkingLevel: MEDIUM`, `maxOutputTokens: 8192`

---

### JudgeActionability

**功能**：LLM Judge，評估 InvestmentAdvice 的可操作性（0.0–1.0）

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{coachOutputJson}}` | InvestmentAdvice 輸出的 JSON 字串 |

**Config**：`temperature: 0.1`, `responseMimeType: application/json`, `maxOutputTokens: 512`

---

### JudgeToneEmpathy

**功能**：LLM Judge，評估 InvestmentAdvice 的語氣與同理心（0.0–1.0）

**插值變數**：
| 變數 | 說明 |
|------|------|
| `{{coachOutputJson}}` | InvestmentAdvice 輸出的 JSON 字串 |

**Config**：`temperature: 0.1`, `responseMimeType: application/json`, `maxOutputTokens: 512`

---

## 優先順序與 Fallback 機制

```
callAI() 參數（options）        最高優先
    ↓ 覆蓋
Langfuse prompt.config         中優先
    ↓ 覆蓋
prompts.mjs LANGFUSE_PROMPT_CONFIGS.config   最低優先（Langfuse 不可用時）
```

**responseSchema** 永遠使用 code-side 定義（`prompts.mjs` 中的 Schema 常數），Langfuse 無法序列化 Gemini SDK 的 JS Type 物件。

---

## 常見操作

### 調整 AI 推論參數

1. 進入 Langfuse UI → Prompts → 選擇目標 prompt
2. 點選 Edit，修改 `config` JSON 欄位
3. 發布新版本
4. 下次 `callAI()` 呼叫時自動生效，**不需要修改程式碼或重啟服務**

### 調整 System / User Prompt 文字

1. 進入 Langfuse UI → Prompts → 選擇目標 prompt
2. 修改對應 `role: system` 或 `role: user` 的 `content`
3. 發布新版本
4. 下次 `callAI()` 呼叫時自動使用最新版本

### 新增 prompt

1. 在 Langfuse UI 建立新的 chat format prompt
2. 在 `prompts.mjs` 的 `LANGFUSE_PROMPT_CONFIGS` 加入對應 schema 與 fallback config
3. 呼叫 `callAI('NewPromptName', userPrompt, { promptVariables: {...} })`

---

## 注意事項

- **langfuse v3.38.6+** 的 `getPrompt()` 需傳入 `{ type: 'chat' }` 才能取得 chat 格式 prompt
- Langfuse 連線失敗時，`systemInstruction` 會為空字串，`userTemplate` 也為空，
  系統會 fallback 使用傳入的 `userPrompt` 參數，AI 仍可正常運作（但無 system prompt）
- 插值語法為雙大括號：`{{variableName}}`
- `compile()` 函式由 Langfuse SDK 提供，負責將 `{{variable}}` 替換為實際值
