# Langfuse Score Configs

本文件用於整理專案中 Langfuse 的評分項目（Score Configs），作為 AI pipeline 各階段的品質監控標準。

---

## 使用目的

這些評分項目主要用於以下目的：

1. 監控各 Prompt 的輸出品質是否穩定。
2. 比較不同 Prompt 版本的效果差異。
3. 協助人工評估、規則評估與後續 LLM Judge 機制建立。
4. 建立一套可持續維護的 AI 評估標準。

---

## Data Type 使用原則

### Boolean

用於「是否通過」的檢查，例如：

- JSON 是否符合 schema
- 輸出格式是否完整

### Numeric

用於需要觀察趨勢、平均値、版本比較的評分項目。
本專案中，1~5 分制的主觀評分也統一使用 Numeric，而不是 Categorical。

建議分數定義：

- 1 = 極差
- 2 = 偏弱
- 3 = 普通
- 4 = 良好
- 5 = 極佳

---

# Score Configs

## 1. Schema_Validation

- **Name:** `Schema_Validation`
- **Data Type:** `Boolean`
- **Data Options/Range:** `True / False`
- **Description:**  
  [Rule] [All Prompts]  
  檢查 AI 輸出是否符合預期 schema，且可被正常解析。  
  True 代表格式完全正確，False 代表解析失敗、缺欄位或結構錯誤。

---

## 2. Format_Compliance

- **Name:** `Format_Compliance`
- **Data Type:** `Boolean`
- **Data Options/Range:** `True / False`
- **Description:**  
  [Rule] [Investment Coach 、 PeriodReportAnalysis]  
  檢查輸出是否符合指定格式要求。  
  對於 **Investment Coach**：評估輸出是否包含「上下文」、「具體動作」、「預期心態」等必要區塊。  
  對於 **PeriodReportAnalysis**：驗證 `topRiskEvents` 為非空陣列、`consistencyComment` 與 `periodOutlook` 為非空字串，三者同時满足才為 True。  
  comment 欄位會記錄各欄位實際長度供調適參考。

---

## 3. Keyword_Yield_Rate

- **Name:** Keyword_Yield_Rate
- **Data Type:** Numeric
- **Data Options/Range:** 0 ~ 1
- **Description:**
  [Rule] [Search Queries Generator]
  評估所有搜尋關鍵字（靜態 + 動態）的整體有效率。
  計算方式：過濾後 ≥ 1 篇新聞的 query 數 / 成功執行的 query 總數（排除 RSS 例外錯誤）。
  用於監控整體管線健康度。
  comment 欄位需同時記錄 base 與 dynamic 各自的 valid/total 明細。

---

## 4. Dynamic_Keyword_Yield_Rate

- **Name:** Dynamic_Keyword_Yield_Rate
- **Data Type:** Numeric
- **Data Options/Range:** 0 ~ 1
- **Description:**
  [Rule] [Search Queries Generator]
  專門評估 AI 動態生成關鍵字的有效率，排除靜態 base 關鍵字的影響。
  計算方式：動態關鍵字中過濾後 ≥ 1 篇新聞的 query 數 / 動態關鍵字成功執行數。
  此指標為 AI Prompt 優化的主要依據，搜配 Context_Alignment 可交叉判斷品質。
  建議警戒閾値：連續 3 日低於 0.4 需人工檢查 Prompt。

---

## 5. Context_Alignment

- **Name:** `Context_Alignment`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Search Queries Generator]  
  評估產出的搜尋關鍵字是否符合當日市場情境，例如 VIX 波動、大盤急跌、地緣政治升溫等。  
  1 分代表與市場脈絡明顯脱節，5 分代表高度貼合市場焦點。

---

## 6. Diversity_Score

- **Name:** `Diversity_Score`
- **Data Type:** `Numeric`
- **Data Options/Range:** `0 ~ 1`
- **Description:**  
  [Rule] [News Filter]  
  評估最終保留新聞是否有做到多維度覆蓋。  
  可依據 think 結構中的 dimension_check 計算，例如總經、地緣政治、資金流向、半導體、台股大盤等維度。  
  分數越高，代表覆蓋面越完整。

---

## 7. Signal_to_Noise_Ratio

- **Name:** `Signal_to_Noise_Ratio`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [News Filter]  
  評估過濾後新聞的訊噪比。  
  1 分代表仍混入大量農場文、個股雜訊或低價値內容；5 分代表留下的幾乎都是對大盤或總經有實質影響的重點新聞。

---

## 8. Summary_Quality

- **Name:** `Summary_Quality`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [News Filter]  
  評估新聞摘要品質。  
  重點包含：是否有具體數據、是否點出事件核心、是否說明對市場或產業的潛在影響。  
  1 分代表只是重寫標題，5 分代表具備深度與分析價値。

---

## 9. Score_Distribution_Spread

- **Name:** `Score_Distribution_Spread`
- **Data Type:** `Numeric`
- **Data Options/Range:** `0 ~ 1`
- **Description:**  
  [Rule] [Macro Analyst]  
  評估新聞影響力評分是否有合理分布。  
  用於避免 AI 將所有事件都打成相近分數，例如全部都是 3 分或全部都是 5 分。  
  可透過標準差正規化或自訂規則進行計算。

---

## 10. Logic_Consistency

- **Name:** `Logic_Consistency`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Macro Analyst]  
  評估最終 BULL / BEAR / NEUTRAL 判定，是否與新聞評分結果及利多利空總分一致。  
  1 分代表結論與前文明顯矛盾，5 分代表整體推論高度一致。

---

## 11. Weighting_Rationality

- **Name:** `Weighting_Rationality`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Macro Analyst]  
  評估各事件的權重配置是否合理。  
  例如 CPI、Fed、地緣衝突、油價變動等重大事件是否被正確賦予較高影響力。  
  1 分代表權重明顯失衡，5 分代表符合金融常識與市場直覺。

---

## 12. Actionability

- **Name:** `Actionability`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Investment Coach]  
  評估教練輸出的建議是否具體、可執行。  
  1 分代表內容空汎，只是口號式提醒；5 分代表有明確行動方向、可直接作為投資紀律或部位微調參考。

---

## 13. Tone_and_Empathy

- **Name:** `Tone_and_Empathy`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Investment Coach]  
  評估輸出是否兼具紀律感、清晰度與教練式溫度。  
  1 分代表生硬、機械或說教；5 分代表既有專業判斷，也能提供穩定情緒與實戰引導。

---

## 14. Optimizer_Accept_Rate

- **Name:** `Optimizer_Accept_Rate`
- **Data Type:** `Numeric`
- **Data Options/Range:** `0 ~ 1`
- **Description:**  
  [Rule] [Rule Optimizer]
  計算本次 Optimizer 執行的規則通過率。
  計算方式：accepted 規則數 / (accepted + rejected 規則總數)。若 AI 未產出任何規則（rules 為空陣列），則不打分，避免以 0 污染統計。
  用於監控 AI 產出品質與 Sandbox 驗證嚴格程度的動態平衡。
  comment 欄位需同時記錄各拒絕原因的明細（invalid_regex / overbroad / duplicate / golden_dataset_kill 各別計數）。
  建議觀察閾値：長期低於 0.3 需檢查 AI prompt 產出品質；長期高於 0.9 需檢查 Sandbox 是否過鬆。

---

## 15. Optimizer_Golden_Kill_Rate

- **Name:** `Optimizer_Golden_Kill_Rate`
- **Data Type:** `Numeric`
- **Data Options/Range:** `0 ~ 1`
- **Description:**  
  [Rule] [Rule Optimizer]
  計算被「黃金清單碰撞」這個關卡擋下的規則比例。
  計算方式：golden_dataset_kill 數 / rejected 規則總數。若 rejected 為 0，則不打分。
  此指標專門用來監控 AI 是否有產出過廣規則的側向（例如不斷產出會誤殺台積電、Fed 等關鍵字的規則）。
  若此値長期偏高（> 0.4），代表 RuleOptimizer 的 Langfuse Prompt 需要強化「不可誤殺黃金清單」的約束說明。

---

## 16. Thinking_Depth ⭐ 新增（改善 4）

- **Name:** `Thinking_Depth`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Rule → 後續可升 LLM Judge] [Investment Coach]  
  評估 `coach_internal_thinking` 欄位的分析密度，尤其針對「無明確操作訊號」的沉默情境。  
  **計分邏輯（Rule 規則版）：**  
  由程式自動評估以下四個維度，每個維度滿足得 1 分，最終映射至 1~5 分制：
  - **長度充足**：`coach_internal_thinking` 字數 ≥ 80 字（中文）
  - **包含等待理由**：出現「等待」、「觀察」、「尚未」、「條件」等關鍵詞，說明不行動的依據
  - **包含風險識別**：出現「風險」、「警戒」、「注意」、「壓力」等字眼，說明潛在威脅
  - **包含情境判斷**：出現「若」、「當」、「一旦」、「如果」等假設句式，代表有前瞻性推論

  評分映射：
  - 0 個維度 → 1 分（空洞輸出）
  - 1 個維度 → 2 分
  - 2 個維度 → 3 分
  - 3 個維度 → 4 分
  - 4 個維度 → 5 分（高密度 thinking）

  **搭配 `Signal_Context_Label` 使用**，在 Langfuse 中以情境標籤分層比較：
  - `quiet_market` 情境下的 `Thinking_Depth` 應 ≥ 3，否則代表 AI 在沉默情境下輸出空洞。
  - `active_signal` 情境下的 `Thinking_Depth` 通常自然偏高，可作為基準對照組。

  後續可建立 LLM Judge Prompt，將規則版替換為語意評估版。

---

## 17. Signal_Context_Label ⭐ 新增（改善 4）

- **Name:** `Signal_Context_Label`
- **Data Type:** `Numeric`
- **Data Options/Range:** `0 / 1`
- **Description:**  
  [Rule] [Investment Coach]  
  記錄本次 Coach 執行所處的市場情境，作為其他 score 做分層分析的 metadata tag。  
  **非評分用途，而是情境分類標籤。**

  計算方式（由程式自動判斷）：
  - `1`（active_signal）：當次 `action_items` 中包含明確的操作動作（買入、減碼、停損、加碼等關鍵詞），或 `marketStatus` 為非 HOLD 狀態。
  - `0`（quiet_market）：`action_items` 皆為觀察性內容，且 `marketStatus` 為 HOLD，代表市場無明確訊號。

  **在 Langfuse 中的使用方式：**  
  透過此欄位對 `Thinking_Depth`、`Actionability`、`Tone_and_Empathy` 做 group by 分析，比較兩種情境下各 score 的分布差異，找出 AI 在沉默情境中是否系統性輸出品質下降。

  comment 欄位記錄判斷依據，例如：`quiet_market｜action_items 無明確操作詞, marketStatus=HOLD`。

---

## 18. Confidence_Level ⭐ 新增（改善 5）

- **Name:** `Confidence_Level`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Rule] [Investment Coach]  
  直接回寫 AI output schema 中的 `confidence_level` 欄位值，供 Langfuse 做信心度分布分析。  
  此欄位由 AI 自評，程式不做二次判斷，直接透傳。

  **與其他 score 的交叉分析建議：**
  - `Confidence_Level` 高（4~5）但 `Thinking_Depth` 低（1~2）→ AI 過度自信，thinking 卻空洞，需 Prompt 加強約束。
  - `Confidence_Level` 低（1~2）但 `Actionability` 高（4~5）→ 建議具體但信心不足，可能是情境模糊導致。
  - `Signal_Context_Label = 0`（quiet_market）時，`Confidence_Level` 整體偏低屬正常，可作為基準校準。

  **Langfuse Schema 對應：**  
  AI output schema 需新增 `confidence_level` 欄位（Integer，1~5），Prompt 中說明：

  > 1 = 極不確定（市場訊號混亂）、3 = 中性（訊號模糊但可判斷）、5 = 高度確信（多重指標一致）

  comment 欄位記錄當次 `marketStatus` 與 `market_direction`，方便校驗信心度是否合理。

---

# 建議實作順序

建議先建立以下幾個最有價値的 score：

1. `Schema_Validation`
2. `Keyword_Yield_Rate`
3. `Dynamic_Keyword_Yield_Rate`
4. `Optimizer_Accept_Rate`
5. `Optimizer_Golden_Kill_Rate`
6. `Diversity_Score`
7. `Signal_to_Noise_Ratio`
8. `Logic_Consistency`
9. `Actionability`

這幾項最能快速反映：

- Query 是否抓得到東西
- News Filter 是否真的有過濾價値
- Macro Analyst 是否推論一致
- Coach 是否講出可執行的內容

---

# 評分維護建議

## Rule 類

由程式自動回寫，避免人工成本：

- Schema_Validation
- Format_Compliance
- Keyword_Yield_Rate
- Dynamic_Keyword_Yield_Rate
- Optimizer_Accept_Rate
- Optimizer_Golden_Kill_Rate
- Diversity_Score
- Score_Distribution_Spread
- **Thinking_Depth**（改善 4，規則版，後續可升 LLM Judge）
- **Signal_Context_Label**（改善 4，情境分類 tag）
- **Confidence_Level**（改善 5，AI 自評直接透傳）

## Human 類

適合人工抄查，建立黃金標準：

- Context_Alignment
- Signal_to_Noise_Ratio
- Summary_Quality
- Logic_Consistency
- Weighting_Rationality
- Actionability
- Tone_and_Empathy

## LLM 類

後續可建立 Judge Prompt 自動評估：

- Context_Alignment
- Signal_to_Noise_Ratio
- Summary_Quality
- Logic_Consistency
- Weighting_Rationality
- Actionability
- Tone_and_Empathy
- **Thinking_Depth**（規則版驗證穩定後，升至 LLM Judge）

---

# 備註

1. 1~5 分制一律使用 Numeric，方便 Langfuse 做平均値、趨勢線與版本比較。
2. Description 內需清楔標示該 score 是屬於 Rule、Human 還是 LLM 類型。
3. 若後續新增 Prompt，建議比照本文件格式擴充，不要混用不同評分標準。
4. `Format_Compliance` 現已同時覆蓋 **Investment Coach** 與 **PeriodReportAnalysis** 兩個 prompt，為全專案共用。
5. `Signal_Context_Label` 為情境分類 tag，非傳統評分；在 Langfuse 中建立時 Data Type 選 Numeric（0/1），利用過濾器做分層比較。
