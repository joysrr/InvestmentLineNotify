# Langfuse Analytics Prompts

本文件整理如何搭配 `langfuse-score-configs.md` 使用 Langfuse 匯出資料，透過「分析專用 Prompt」協助你快速檢查各個 AI 模組的品質與優化方向。[cite:181]

建議流程：

1. 先到 Langfuse (Traces) 針對特定 prompt 建立 Filter，例如：`name = InvestmentAdvice`、時間範圍選最近 1–2 週。
2. 使用 Langfuse 的 Export 功能將該篩選結果匯出為 JSON（或 CSV 再轉 JSON）。[cite:178]
3. 依本文件的建議，把匯出的資料整理成「samples 陣列」，每筆包含 trace id、scores、input_prompt、output 等欄位。
4. 選擇對應 prompt 的分析模板，將「資料 + Prompt」交給 LLM 進行診斷。

---

## 0. 建議的資料整理格式

無論是哪一個 prompt，建議先把匯出的 Langfuse traces 整理成下列 JSON 結構之一，再餵給 LLM：

```json
{
  "task": "InvestmentAdvice",
  "time_range": "2026-04-01~2026-04-14",
  "samples": [
    {
      "trace_id": "tr_123",
      "created_at": "2026-04-10T01:23:45Z",
      "tags": ["feature:InvestmentAdvice", "env:ci"],
      "scores": {
        "Schema_Validation": 1,
        "Format_Compliance": 0,
        "Risk_Coverage": 0.33,
        "Actionability": 0.45,
        "Tone_and_Empathy": 0.8,
        "Context_Alignment": null
      },
      "input_prompt": "... coach user prompt ...",
      "output_json": { "short_summary": "...", "action_items": ["..."], "key_risks": ["..."], "mindset_advice": "..." },
      "status_message": null
    },
    {
      "trace_id": "tr_456",
      "created_at": "2026-04-11T02:03:10Z",
      "tags": ["feature:InvestmentAdvice", "env:ci"],
      "scores": { "Schema_Validation": 0 },
      "input_prompt": "...",
      "output_json": null,
      "status_message": "timeout or parse error..."
    }
  ]
}
```

每筆 sample 建議至少包含：

- `trace_id`, `created_at`, `tags`
- `scores`: 只要把當前有用到的 score 放進來即可
- `input_prompt`: 送入該 prompt 的完整文字（可以局部刪減，只保留關鍵部分）[cite:164][cite:165]
- `output_json`: 成功 parse 的 JSON 結果；若 parse 失敗則用 `null` 或 `{ "error": "..." }`
- `status_message`: 來自 `trace.update` 或錯誤訊息，方便 LLM 分析錯誤型態[cite:164]

一次丟給 LLM 的樣本數不宜過大，建議 20–50 筆即可，分批分析會比較精準。

---

## 1. 通用 Langfuse 分析模板（任何 prompt 通用）

> 角色：你是一位熟悉 Langfuse、LLM pipeline 與評估方法的資深 AI 系統工程師。
> 
> 目標：幫我找出這批 trace 資料中，可以優化 LLM prompt / pipeline 的具體方向，而不是只做單純統計。
> 
> 輸入說明：
> - 我會提供一個 JSON 物件，結構大致如下：
>   - `task`: 此批 trace 對應的功能名稱，例如 `InvestmentAdvice` 或 `AnalyzeMacroNews`。
>   - `time_range`: 資料時間範圍。
>   - `samples`: 陣列，每個元素包含：
>     - `trace_id`, `created_at`, `tags`, `scores`, `input_prompt`, `output_json`（或 error）、`status_message`。
> 
> 分析任務：
> 1. **健康度概覽**
>    - 根據 `scores`，描述這批 samples 的大致狀況：
>      - 格式相關的 score（例如 Schema_Validation / Format_Compliance）的成功率如何？
>      - 內容或語氣相關的 score（例如 Actionability / Tone / Risk_Coverage 等）的平均值與大致分布區間？
>    - 不用精算精準數值，可以用「大約」、「多數／少數」描述，但要指出是根據哪些 samples 的觀察。
> 
> 2. **問題類型分類**
>    - 依照錯誤或低分的型態，幫我將 samples 分成幾類，例如：
>      - 類型 A：Schema_Validation = 0，通常 output_json 為 null 或 error，常見 status_message。
>      - 類型 B：Schema_Validation = 1 但 Format_Compliance = 0，代表 JSON 解析成功但缺欄位。
>      - 類型 C：格式 OK，但某些品質 score 很低（例如 Actionability / Tone / Risk / Context 等）。
>    - 對每一類型，挑 1–3 筆具代表性的 sample，貼出**簡化版** input_prompt 與 output_json 片段，用來說明問題（避免貼整段太長）。
> 
> 3. **可能的 Prompt / Pipeline 調整建議**
>    - 根據上述問題類型，提出可以在 prompt / pipeline 中調整的具體建議，例如：
>      - 在 System Prompt 加入哪些硬性格式規則或範例。
>      - 要求必填欄位、最低條數（例如至少 N 條建議或風險）。
>      - 對 tone（語氣）、action 具體度、風險覆蓋等加入更明確說明。
>      - 是否應在程式中（例如 catch 區塊）補寫某些失敗用的 score（例如 Task_Success、Failure_Type）。
>    - 每一條建議都要說明「是為了解決哪一類的樣本問題」，盡量附上對應 trace_id。
> 
> 4. **若資料混有多種 task**
>    - 若 `samples` 中混有不同 `tags` / `feature:*`，請先將分析重點聚焦在樣本數量最多的 task，其他 task 只簡要點出主要問題。 
> 
> 請依上述結構輸出結果，分段列出，不需要寫程式碼，只要描述「什麼地方可以調整」與「為什麼」。

---

## 2. InvestmentAdvice 專用分析模板

適用對象：`getAiInvestmentAdvice` 產生的 `InvestmentAdvice` trace，搭配下列 scores 使用：

- `Schema_Validation`
- `Format_Compliance`
- `Risk_Coverage`
- `Actionability`
- `Tone_and_Empathy`
- `Context_Alignment`（若已實作）[cite:165][cite:147]

> 角色：你是一位專門做投資 AI 教練系統的 LLM 評估工程師，熟悉 Langfuse、投資建議的風險控管與用戶心理。
> 
> 目標：協助我審視 `InvestmentAdvice` 功能的輸出品質，並提出具體的 prompt / pipeline 改善建議。
> 
> 輸入說明：
> - 我會提供一個 JSON 物件：
>   - `task`: 固定為 `"InvestmentAdvice"`。
>   - `time_range`: 例如 `"2026-04-01~2026-04-14"`。
>   - `samples`: 每筆包含：
>     - `trace_id`, `created_at`, `tags`, `status_message`
>     - `scores`: 至少包含 `Schema_Validation`, `Format_Compliance`, `Risk_Coverage`，若有的話再加上 `Actionability`, `Tone_and_Empathy`, `Context_Alignment`。
>     - `input_prompt`: 教練看到的完整情境描述（市場、部位、新聞摘要等）。
>     - `output_json`: 解析後的投資建議物件（包含 `short_summary`, `action_items`, `key_risks`, `mindset_advice` 等欄位），若 parse 失敗則為 null 或 error 物件。
> 
> 分析任務：
> 1. **品質雷達圖（文字版）**
>    - 依下列指標，描述這批 samples 的大致表現（以「偏高／中等／偏低」＋簡短說明）：
>      - 格式面：`Schema_Validation`, `Format_Compliance`。
>      - 內容面：`Actionability`, `Risk_Coverage`。
>      - 語氣面：`Tone_and_Empathy`。
>      - 脈絡對齊：`Context_Alignment`（如果有）。
>    - 每一項給 1–2 句說明，並舉出 1–2 個代表性的 trace_id。
> 
> 2. **格式 OK 但內容不夠好的樣本**
>    - 找出 `Schema_Validation = 1` 且 `Format_Compliance = 1`，但至少一個內容型 score 偏低（例如 `Actionability < 0.6` 或 `Risk_Coverage < 0.6`）的樣本。
>    - 對這些樣本：
>      - 簡要貼出 input_prompt 的關鍵部分（例如市場狀況／持股／情緒）。
>      - 摘要 output_json：
>        - 行動建議的具體程度如何？
>        - 風險是否有列出足夠多且多元？
>        - 語氣是否過度絕對或過度保守？
>      - 條列說明「這筆輸出為什麼會被打低分」。
> 
> 3. **格式或 JSON 直接壞掉的樣本**
>    - 找出 `Schema_Validation = 0` 或 `output_json = null` 的樣本。
>    - 分析這些樣本常見錯誤型態：
>      - 純文字沒有包成 JSON。
>      - JSON 少了關鍵欄位（summary / action_items / mindset_advice）。
>      - 內容與題目無關或嚴重偏題。
>    - 對每種型態，提出對 System Prompt / responseSchema 說明的具體增強建議。
> 
> 4. **整體 Prompt / Pipeline 改善建議**
>    - 彙總 3–7 條優先級最高的改善建議，每條包含：
>      - 「要改什麼」：例如在 System Prompt 裡追加哪些硬性格式 constraint、是否在程式 catch 裡補寫 `Task_Success` score 等。
>      - 「要解決哪一類問題」：盡量附上對應的 trace_id。
>      - 「可能的副作用」：例如提高 Actionability 可能導致建議偏激，需要同時加強 Tone / Risk 的約束。
> 
> 5. **（選配）System Prompt 局部改寫草稿**
>    - 若你覺得必要，請提出一段「改寫後的 System Prompt 片段」，專注在：
>      - 格式約束（JSON 結構與欄位）。
>      - 行動建議具體度（例如要求至少 N 條具體 action）。
>      - 語氣與風險提醒（避免 FOMO、保持紀律與支持性）。

---

## 3. FilterAndCategorizeNews 專用分析模板

適用對象：`filterAndCategorizeAllNewsWithAI` 對應的 `FilterAndCategorizeNews` trace，搭配下列 scores 使用：

- `Schema_Validation`
- `Diversity_Score`
- `Contradiction_Count`
- （若有人工評分）`Summary_Quality`, `Signal_to_Noise_Ratio`[cite:165][cite:181]

> 角色：你是一位負責新聞去噪與事件盤點的 AI 系統設計師，熟悉金融新聞在投資決策中的角色。
> 
> 目標：評估 `FilterAndCategorizeNews` 模組在「新聞過濾與分群」上的品質，找出需要調整 prompt 或 pipeline 的地方。
> 
> 輸入說明：
> - 我會提供一個 JSON 物件：
>   - `task`: 固定為 `"FilterAndCategorizeNews"`。
>   - `time_range`: 例如 `"2026-04-01~2026-04-14"`。
>   - `samples`: 每筆包含：
>     - `trace_id`, `created_at`, `tags`, `status_message`
>     - `scores`: 至少包含 `Schema_Validation`, `Diversity_Score`, `Contradiction_Count`，若有則再包含 `Summary_Quality`, `Signal_to_Noise_Ratio`。
>     - `input_prompt`: 送入 AI 的新聞列表摘要（包含 index / tag / region / age_band 等資訊）。
>     - `output_json`: AI 過濾後的結果，含 `news` 陣列與 `think` 區塊（`event_inventory`, `dimension_check`, `excluded` 等）。
> 
> 分析任務：
> 1. **維度與訊噪狀況總覽**
>    - 根據 `Diversity_Score` 分布，描述新聞覆蓋的維度（總經／地緣政治／半導體／資金流等）是否足夠多元。
>    - 如果有 `Signal_to_Noise_Ratio`，說明這批 samples 的平均訊噪比（偏高／中／偏低），舉例說明哪幾條 trace 特別好或特別差。
> 
> 2. **矛盾事件偵測結果檢視**
>    - 觀察 `Contradiction_Count`：
>      - 是否經常為 0（代表幾乎沒有偵測到矛盾）或經常很多（代表可能過度敏感）。
>    - 對有矛盾的樣本：
>      - 摘要 output_json 中 `think.event_inventory` 的代表性項目，說明這些矛盾標記是否合理，是否有假陽性／假陰性傾向。
> 
> 3. **新聞選擇與摘要品質**
>    - 若有 `Summary_Quality` 分數：
>      - 找出高分與低分樣本，對比 input_prompt 的原始標題與 output_json.news 中的 summary，說明好壞差異在哪裡。
>    - 分析是否有「重要新聞被排除」或「無關新聞被保留」的模式，舉出具體例子。
> 
> 4. **Prompt / Pipeline 改善建議**
>    - 針對上述觀察，提出具體建議：
>      - 如何在 Prompt 裡明確定義哪些種類的新聞應優先保留或排除。
>      - 是否需要調整維度白名單（dimension_check）或矛盾偵測的說明。
>      - 是否需要新增或調整 score 定義，讓未來更容易觀察（例如對「重要新聞漏掉」的情況定義一個高權重評分）。
>    - 每條建議盡量對應到 1–2 個具體 trace_id 作為例證。

---

## 4. AnalyzeMacroNews 專用分析模板

適用對象：`analyzeMacroNewsWithAI` 對應的 `AnalyzeMacroNews` trace，搭配下列 scores 使用：

- `Schema_Validation`
- `Score_Distribution_Spread`
- （若有人工評分）`Logic_Consistency`, `Weighting_Rationality`[cite:165][cite:181]

> 角色：你是一位負責總經分析模組的 AI 研究員，熟悉宏觀事件對股市的影響與多空判斷邏輯。
> 
> 目標：評估 `AnalyzeMacroNews` 模組在「多空事件盤點與結論」上的品質，找出需要修正的 prompt 與評分策略。
> 
> 輸入說明：
> - 我會提供一個 JSON 物件：
>   - `task`: 固定為 `"AnalyzeMacroNews"`。
>   - `time_range`: 例如 `"2026-04-01~2026-04-14"`。
>   - `samples`: 每筆包含：
>     - `trace_id`, `created_at`, `tags`, `status_message`
>     - `scores`: 至少包含 `Schema_Validation`, `Score_Distribution_Spread`，若有則再包含 `Logic_Consistency`, `Weighting_Rationality`。
>     - `input_prompt`: 當日新聞文字摘要與前置 conflictSummary（若有）。
>     - `output_json`: 宏觀分析結果，含 `bull_events`, `bear_events`, `total_bull_score`, `total_bear_score`, `conclusion` 等欄位。
> 
> 分析任務：
> 1. **事件權重分布檢查**
>    - 根據 `Score_Distribution_Spread`，說明事件評分是否有合理的梯度（避免全部同分）。
>    - 找出 spread 過低的樣本，檢查 `bull_events` / `bear_events` 是否都被打成差不多的分數，說明這樣可能造成什麼風險。
> 
> 2. **結論與事件的一致性**
>    - 針對具代表性的樣本，對比：
>      - `total_bull_score` vs `total_bear_score`。
>      - `conclusion.market_direction`（BULL/BEAR/NEUTRAL）。
>    - 說明是否存在「結論與分數不一致」的情況，並舉例說明錯誤模式。
> 
> 3. **人為評分（若有）與自動分數的落差**
>    - 如果有 `Logic_Consistency` 或 `Weighting_Rationality`：
>      - 找出這些人為/LLM 評分與 `Score_Distribution_Spread` 不一致的案例（例如 spread 看起來 OK，但人覺得權重很奇怪）。
>    - 說明這樣的落差可能來自 prompt 說明不足、事件分類不明確等原因。
> 
> 4. **Prompt / Pipeline 改善建議**
>    - 提出具體建議，例如：
>      - 在 Prompt 中更明確定義「重大事件」與「一般事件」的評分範圍與差異。
>      - 要求 conclusion 中明確引用幾個關鍵事件作為多空判斷的佐證。
>      - 若必要，建議新增 score 或調整 `Score_Distribution_Spread` 的計算方式。
>    - 每條建議儘量附上對應的實際 trace_id 作為例子。

---

## 5. GenerateSearchQueries 專用分析模板

適用對象：`generateDailySearchQueries` 對應的 `GenerateSearchQueries` trace，搭配下列 scores 使用：

- `Schema_Validation`
- `Keyword_Yield_Rate`
- `Dynamic_Keyword_Yield_Rate`
- `Context_Alignment`[cite:165][cite:181]

> 角色：你是一位負責「新聞關鍵字池」設計的 AI 系統工程師，目標是確保搜尋關鍵字既貼近市場情境，又有良好的命中率。
> 
> 目標：評估 `GenerateSearchQueries` 模組產出的關鍵字在「命中率」與「情境貼合度」上的表現，並提出 prompt / pipeline 的優化建議。
> 
> 輸入說明：
> - 我會提供一個 JSON 物件：
>   - `task`: 固定為 `"GenerateSearchQueries"`。
>   - `time_range`: 例如 `"2026-04-01~2026-04-14"`。
>   - `samples`: 每筆包含：
>     - `trace_id`, `created_at`, `tags`, `status_message`
>     - `scores`: 至少包含 `Schema_Validation`, `Keyword_Yield_Rate`, `Dynamic_Keyword_Yield_Rate`, `Context_Alignment`。
>     - `input_prompt`: 包含當天市場數據摘要與靜態 base 關鍵字列表。
>     - `output_json`: AI 產出的動態關鍵字結果（例如 `twQueries`, `usQueries` 等）。
> 
> 分析任務：
> 1. **命中率與情境貼合度概況**
>    - 先根據 `Keyword_Yield_Rate` 與 `Dynamic_Keyword_Yield_Rate`，描述整體命中率表現（偏高／中／偏低），說明 base vs dynamic 哪一側表現較差。
>    - 觀察 `Context_Alignment`（若有）：描述動態關鍵字與市場情境的對齊程度，舉出具代表性的高分與低分樣本。
> 
> 2. **失敗樣本類型分類**
>    - 找出 `Dynamic_Keyword_Yield_Rate` 很低或 `Context_Alignment` 很差的樣本，分類問題型態：
>      - 類型 A：關鍵字過於寬泛（例如只產出「台股」、「美股」等）。
>      - 類型 B：關鍵字過於冷門或與當日情境不符。
>      - 類型 C：關鍵字與 base 池高度重疊，沒有實際增量價值。
>    - 每一類舉 1–2 個 sample，簡要貼出 input_prompt 中的市場情境，以及 output_json 中的關鍵字列表，說明問題所在。
> 
> 3. **Prompt / Pipeline 改善建議**
>    - 根據上述類型，提出具體的 prompt 設計建議，例如：
>      - 要求動態關鍵字必須補足 base 池中沒有涵蓋的主題。
>      - 根據 VIX / 大盤波動等指標，限制關鍵字聚焦於當日最重要的 3–5 個主題。
>      - 對於過於寬泛或過於冷門的關鍵字，提供範例說明「不應產出此類詞」。
>    - 若有必要，也可建議在程式端改寫 `Keyword_Yield_Rate` / `Dynamic_Keyword_Yield_Rate` 的計算方式，讓 score 更符合實際需求。

---

## 6. 如何在日常開發中使用這些模板

1. **新功能上線前後**
   - 在 Langfuse 裡針對新功能的 trace 匯出一批資料（20–50 筆），搭配對應模板請 LLM 幫你做一次「上線前健康檢查」。

2. **Prompt 大改之後**
   - 記錄改版日期與 Prompt 版本，導出改版前後兩段時間的 trace，各跑一次分析模板，比對 LLM 給出的建議與你自己的直覺是否一致。

3. **例行 QA**
   - 每週從 `needs-human-review` 的 trace 裡抽樣，用這些模板請 LLM 幫你先做第一輪分類；再從中挑出最有問題的幾筆做人工深度 review，效率會高很多。[cite:164][cite:165]

這些模板目標是把你目前在腦中用直覺做的 QA 流程，變成一套可重複、可交給 LLM 協助的「分析腳本」。後續如果你新增新的 prompt 或 score，只要比照這份文件的結構，再加一節對應的模板即可。
