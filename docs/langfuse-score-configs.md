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
用於需要觀察趨勢、平均值、版本比較的評分項目。
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
  [Rule] [Investment Coach]  
  檢查輸出是否符合指定格式要求，例如是否包含「上下文」、「具體動作」、「預期心態」等必要區塊。  
  True 代表格式完整，False 代表缺漏或格式不符。

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
  此指標為 AI Prompt 優化的主要依據，搭配 Context_Alignment 可交叉判斷品質。
  建議警戒閾值：連續 3 日低於 0.4 需人工檢查 Prompt。

---

## 5. Context_Alignment

- **Name:** `Context_Alignment`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [Search Queries Generator]  
  評估產出的搜尋關鍵字是否符合當日市場情境，例如 VIX 波動、大盤急跌、地緣政治升溫等。  
  1 分代表與市場脈絡明顯脫節，5 分代表高度貼合市場焦點。

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
  1 分代表仍混入大量農場文、個股雜訊或低價值內容；5 分代表留下的幾乎都是對大盤或總經有實質影響的重點新聞。

---

## 8. Summary_Quality

- **Name:** `Summary_Quality`
- **Data Type:** `Numeric`
- **Data Options/Range:** `1 ~ 5`
- **Description:**  
  [Human / LLM] [News Filter]  
  評估新聞摘要品質。  
  重點包含：是否有具體數據、是否點出事件核心、是否說明對市場或產業的潛在影響。  
  1 分代表只是重寫標題，5 分代表具備深度與分析價值。

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
  1 分代表內容空泛，只是口號式提醒；5 分代表有明確行動方向、可直接作為投資紀律或部位微調參考。

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

# 建議實作順序

建議先建立以下幾個最有價值的 score：

1. `Schema_Validation`
2. `Keyword_Yield_Rate`
3. `Diversity_Score`
4. `Signal_to_Noise_Ratio`
5. `Logic_Consistency`
6. `Actionability`

這幾項最能快速反映：
- Query 是否抓得到東西
- News Filter 是否真的有過濾價值
- Macro Analyst 是否推論一致
- Coach 是否講出可執行的內容

---

# 評分維護建議

## Rule 類
由程式自動回寫，避免人工成本：
- Schema_Validation
- Format_Compliance
- Keyword_Yield_Rate
- Diversity_Score
- Score_Distribution_Spread

## Human 類
適合人工抽查，建立黃金標準：
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

---

# 備註

1. 1~5 分制一律使用 Numeric，方便 Langfuse 做平均值、趨勢線與版本比較。
2. Description 內需清楚標示該 score 是屬於 Rule、Human 還是 LLM 類型。
3. 若後續新增 Prompt，建議比照本文件格式擴充，不要混用不同評分標準。